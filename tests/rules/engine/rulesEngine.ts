/**
 * A small interpreter for the subset of the Firestore security-rules language that `firestore.rules` uses.
 *
 * WHY: the Firestore emulator needs Java and a jar download, which many machines (and the CI sandbox this was written
 * in) do not have. This engine PARSES the real `firestore.rules` and EVALUATES its `match` / `allow` / `function`
 * blocks against a fake document store, so size caps, `hasOnly` lists, field allow-lists, epoch checks and role
 * gates are exercised in plain vitest, with the shapes the real client code writes. It is a model of the rules
 * language, not Google's engine: where the two could differ (see the list in RUN-RULES.md) the emulator suite in
 * `coach.rules.test.ts` stays the authority.
 *
 * Supported: `function` with `let`, `match` nesting and `{wild}` / `{wild=**}`, `allow <ops>: if <expr>`, operators
 * `|| && ! == != < <= > >= + - * / % in is ?:`, member access, indexing, calls, list/map-ish values, paths with
 * `$(expr)` interpolation, and the built-ins used by the rules (`get exists int float string size keys hasAll
 * hasOnly hasAny get diff affectedKeys matches toMillis lower upper split`).
 * Semantics kept: an evaluation error (missing field, type mismatch, missing document in `get`) makes the allow
 * condition NOT hold; `||` / `&&` short-circuit past an error on the other side as the real engine does.
 *
 * Modelled since iteration 14 (they were gaps in the first audit): `int` vs `float` vs `number` (a JS number is an int
 * when it is integral, as the client SDK writes it), canonical-only `int('..')`, `string(x)`, the 10-document budget of
 * `get()` / `exists()` per request, TIMESTAMPS (`request.time` and stored values are `Ts`; `<`, `>`, `==`, `+/- duration`,
 * `toMillis()`, `seconds()`, `timestamp.date()`, `duration.value()`), `request.method`, `resource.id`, own-property
 * lookups only (no prototype names such as `constructor`), `size()` in code points like the real engine.
 *
 * Still NOT modelled (the emulator stays the authority; listed in docs/COACH-SERVER-SECURITY.md):
 *   - query provability: a `list` is checked per returned document, the engine cannot say a query is *provable*;
 *   - `request.query` (limit / offset / orderBy), `getAfter()`, `getAfter`-style multi-document write sets;
 *   - `request.auth.token` claims other than what the test passes in (no `firebase.sign_in_provider`, no `email`);
 *   - int / float arithmetic corner cases (`int / int` is JS division here);
 *   - the exact error semantics of every operator on mixed types (only the ones the rules file relies on);
 *   - callables, triggers and the Admin SDK (they bypass rules; covered by the in-memory Kv tests instead).
 */

// ---------------------------------------------------------------- tokens

type Tok = { k: 'num' | 'str' | 'id' | 'op' | 'path'; v: string } | { k: 'eof'; v: '' };

const OPS = [
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '(',
  ')',
  '{',
  '}',
  '[',
  ']',
  ',',
  ';',
  ':',
  '.',
  '!',
  '<',
  '>',
  '+',
  '-',
  '*',
  '%',
  '?',
  '=',
];

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const valueEnd = () => {
    const l = out[out.length - 1];
    return (
      !!l &&
      (l.k === 'num' ||
        l.k === 'str' ||
        l.k === 'id' ||
        l.k === 'path' ||
        l.v === ')' ||
        l.v === ']')
    );
  };
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      i = src.indexOf('*/', i + 2) + 2;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9._]/.test(src[j])) j++;
      out.push({ k: 'num', v: src.slice(i, j).replace(/_/g, '') });
      i = j;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') j++;
        s += src[j++];
      }
      out.push({ k: 'str', v: s });
      i = j + 1;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ k: 'id', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '/' && !valueEnd()) {
      // path literal: runs to whitespace / , / ) / ; at depth 0; `$( ... )` nests
      let j = i;
      let depth = 0;
      while (j < src.length) {
        const ch = src[j];
        if (ch === '(') depth++;
        else if (ch === ')') {
          if (depth === 0) break;
          depth--;
        } else if (depth === 0 && (/\s/.test(ch) || ch === ',' || ch === ';')) break;
        j++;
      }
      out.push({ k: 'path', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (c === '/') {
      out.push({ k: 'op', v: '/' });
      i++;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (!op) throw new Error(`rules: unexpected character ${JSON.stringify(c)} at ${i}`);
    out.push({ k: 'op', v: op });
    i += op.length;
  }
  out.push({ k: 'eof', v: '' });
  return out;
}

// ---------------------------------------------------------------- AST

export type Node =
  | { t: 'lit'; v: unknown }
  | { t: 'id'; n: string }
  | { t: 'path'; segs: (string | Node)[] }
  | { t: 'un'; op: string; a: Node }
  | { t: 'bin'; op: string; a: Node; b: Node }
  | { t: 'is'; a: Node; type: string }
  | { t: 'cond'; c: Node; a: Node; b: Node }
  | { t: 'mem'; a: Node; n: string }
  | { t: 'idx'; a: Node; i: Node }
  | { t: 'call'; f: Node; args: Node[] }
  | { t: 'list'; items: Node[] };

export interface FnDef {
  name: string;
  params: string[];
  lets: [string, Node][];
  ret: Node;
}
export interface Allow {
  ops: string[];
  cond: Node;
  line: string;
}
export interface MatchDef {
  /** pattern segments: literal or `{name}` / `{name=**}` */
  segs: string[];
  allows: Allow[];
  children: MatchDef[];
}
export interface Rules {
  fns: Map<string, FnDef>;
  root: MatchDef;
  /** every `match` pattern, joined, e.g. `/conversations/{cid}/keyring/{epoch}` */
  patterns: string[];
  source: string;
}

class Parser {
  p = 0;
  constructor(private t: Tok[]) {}
  peek(o = 0) {
    return this.t[this.p + o];
  }
  next() {
    return this.t[this.p++];
  }
  is(v: string, o = 0) {
    const x = this.peek(o);
    return x.k !== 'str' && x.v === v;
  }
  eat(v: string) {
    if (!this.is(v))
      throw new Error(`rules: expected ${v}, got ${this.peek().v} (token ${this.p})`);
    return this.next();
  }
  maybe(v: string) {
    if (this.is(v)) {
      this.p++;
      return true;
    }
    return false;
  }

  expr(): Node {
    const c = this.or();
    if (this.maybe('?')) {
      const a = this.expr();
      this.eat(':');
      const b = this.expr();
      return { t: 'cond', c, a, b };
    }
    return c;
  }
  or(): Node {
    let a = this.and();
    while (this.is('||')) {
      this.next();
      a = { t: 'bin', op: '||', a, b: this.and() };
    }
    return a;
  }
  and(): Node {
    let a = this.cmp();
    while (this.is('&&')) {
      this.next();
      a = { t: 'bin', op: '&&', a, b: this.cmp() };
    }
    return a;
  }
  cmp(): Node {
    let a = this.add();
    for (;;) {
      const x = this.peek();
      if (x.k === 'op' && ['==', '!=', '<', '<=', '>', '>='].includes(x.v)) {
        this.next();
        a = { t: 'bin', op: x.v, a, b: this.add() };
      } else if (x.k === 'id' && x.v === 'in') {
        this.next();
        a = { t: 'bin', op: 'in', a, b: this.add() };
      } else if (x.k === 'id' && x.v === 'is') {
        this.next();
        a = { t: 'is', a, type: this.next().v };
      } else return a;
    }
  }
  add(): Node {
    let a = this.mul();
    while (this.is('+') || this.is('-')) {
      const op = this.next().v;
      a = { t: 'bin', op, a, b: this.mul() };
    }
    return a;
  }
  mul(): Node {
    let a = this.unary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const op = this.next().v;
      a = { t: 'bin', op, a, b: this.unary() };
    }
    return a;
  }
  unary(): Node {
    if (this.is('!')) {
      this.next();
      return { t: 'un', op: '!', a: this.unary() };
    }
    if (this.is('-')) {
      this.next();
      return { t: 'un', op: '-', a: this.unary() };
    }
    return this.postfix();
  }
  postfix(): Node {
    let a = this.primary();
    for (;;) {
      if (this.is('.')) {
        this.next();
        a = { t: 'mem', a, n: this.next().v };
      } else if (this.is('[')) {
        this.next();
        const i = this.expr();
        this.eat(']');
        a = { t: 'idx', a, i };
      } else if (this.is('(')) {
        this.next();
        const args: Node[] = [];
        while (!this.is(')')) {
          args.push(this.expr());
          if (!this.maybe(',')) break;
        }
        this.eat(')');
        a = { t: 'call', f: a, args };
      } else return a;
    }
  }
  primary(): Node {
    const x = this.next();
    if (x.k === 'num') return { t: 'lit', v: Number(x.v) };
    if (x.k === 'str') return { t: 'lit', v: x.v };
    if (x.k === 'path') return this.pathNode(x.v);
    if (x.k === 'op' && x.v === '(') {
      const e = this.expr();
      this.eat(')');
      return e;
    }
    if (x.k === 'op' && x.v === '[') {
      const items: Node[] = [];
      while (!this.is(']')) {
        items.push(this.expr());
        if (!this.maybe(',')) break;
      }
      this.eat(']');
      return { t: 'list', items };
    }
    if (x.k === 'id') {
      if (x.v === 'true') return { t: 'lit', v: true };
      if (x.v === 'false') return { t: 'lit', v: false };
      if (x.v === 'null') return { t: 'lit', v: null };
      return { t: 'id', n: x.v };
    }
    throw new Error(`rules: unexpected token ${x.v}`);
  }
  pathNode(raw: string): Node {
    const segs: (string | Node)[] = [];
    let i = 0;
    let lit = '';
    while (i < raw.length) {
      if (raw[i] === '$' && raw[i + 1] === '(') {
        let d = 1;
        let j = i + 2;
        while (j < raw.length && d > 0) {
          if (raw[j] === '(') d++;
          else if (raw[j] === ')') d--;
          j++;
        }
        if (lit) segs.push(lit);
        lit = '';
        const inner = new Parser(tokenize(raw.slice(i + 2, j - 1)));
        segs.push(inner.expr());
        i = j;
      } else lit += raw[i++];
    }
    if (lit) segs.push(lit);
    return { t: 'path', segs };
  }

  // ---- declarations
  fn(fns: Map<string, FnDef>) {
    this.eat('function');
    const name = this.next().v;
    this.eat('(');
    const params: string[] = [];
    while (!this.is(')')) {
      params.push(this.next().v);
      if (!this.maybe(',')) break;
    }
    this.eat(')');
    this.eat('{');
    const lets: [string, Node][] = [];
    while (this.is('let')) {
      this.next();
      const n = this.next().v;
      this.eat('=');
      lets.push([n, this.expr()]);
      this.eat(';');
    }
    this.eat('return');
    const ret = this.expr();
    this.maybe(';');
    this.eat('}');
    fns.set(name, { name, params, lets, ret });
  }
  match(fns: Map<string, FnDef>, patterns: string[], parent: string): MatchDef {
    this.eat('match');
    // the pattern is tokenised as a path (starts with /) ; take its raw text via re-join
    const first = this.next();
    const raw = first.v;
    const full = (parent + raw).replace(/\/+/g, '/');
    patterns.push(full);
    const m: MatchDef = { segs: raw.split('/').filter(Boolean), allows: [], children: [] };
    this.eat('{');
    while (!this.is('}')) {
      if (this.is('function')) this.fn(fns);
      else if (this.is('match')) m.children.push(this.match(fns, patterns, full));
      else if (this.is('allow')) {
        this.next();
        const ops: string[] = [];
        do ops.push(this.next().v);
        while (this.maybe(','));
        let cond: Node = { t: 'lit', v: true };
        const start = this.p;
        if (this.maybe(':')) {
          this.eat('if');
          cond = this.expr();
        }
        this.eat(';');
        m.allows.push({
          ops,
          cond,
          line: this.t
            .slice(start, this.p)
            .map((x) => x.v)
            .join(' '),
        });
      } else throw new Error(`rules: unexpected ${this.peek().v} in match`);
    }
    this.eat('}');
    return m;
  }
}

/** Parse `firestore.rules`. */
export function parseRules(source: string): Rules {
  // match patterns are not valid expression paths (`{x}`); give the tokenizer a form it keeps whole
  const text = source.replace(
    /match\s+(\/[^\s{]*(?:\{[^}]*\}[^\s{]*)*)\s*\{/g,
    (_m, p: string) => `match '${p}' {`,
  );
  const t = tokenize(text);
  const p = new Parser(t);
  // header
  while (!p.is('service')) p.next();
  p.eat('service');
  while (!p.is('{')) p.next();
  p.eat('{');
  const fns = new Map<string, FnDef>();
  const patterns: string[] = [];
  const root: MatchDef = { segs: [], allows: [], children: [] };
  // match arrives as `match` + string token: adapt Parser.match to read a str token
  while (!p.is('}')) {
    if (p.is('function')) p.fn(fns);
    else if (p.is('match')) root.children.push(p.match(fns, patterns, ''));
    else throw new Error(`rules: unexpected ${p.peek().v} at top level`);
  }
  return { fns, root, patterns, source };
}

// ---------------------------------------------------------------- values

export type Doc = Record<string, unknown>;
class RuleError extends Error {}
const fail = (m: string): never => {
  throw new RuleError(m);
};

const isMap = (v: unknown): v is Doc =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  !(v instanceof PathVal) &&
  !(v instanceof KeySet) &&
  !(v instanceof Ts) &&
  !(v instanceof Dur) &&
  !(v instanceof Namespace);
class PathVal {
  constructor(public path: string) {}
}
/** A Firestore timestamp / `request.time` (milliseconds since the epoch). */
export class Ts {
  constructor(public ms: number) {}
}
export const ts = (ms: number): Ts => new Ts(ms);
class Dur {
  constructor(public ms: number) {}
}
type NsName = 'duration' | 'timestamp' | 'firestore';
class Namespace {
  constructor(public name: NsName) {}
}
const hasOwn = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
class KeySet {
  constructor(public keys: string[]) {}
}
const deepEq = (a: unknown, b: unknown): boolean => {
  if (a instanceof Ts || b instanceof Ts)
    return a instanceof Ts && b instanceof Ts && a.ms === b.ms;
  if (a instanceof Dur || b instanceof Dur)
    return a instanceof Dur && b instanceof Dur && a.ms === b.ms;
  return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));
};
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isMap(v))
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, sortKeys(v[k])]),
    );
  return v;
}

export interface Ctx {
  /** auth: null = signed out */
  auth: { uid: string; token?: Record<string, unknown> } | null;
  /** the stored documents by relative path ('conversations/abc') */
  db: Record<string, Doc>;
  /** request.resource.data (the document AFTER the write); undefined for reads and deletes */
  data?: Doc;
  /** Cloud Storage: request.resource for an upload (size, contentType) */
  object?: Doc;
  /** request.time in ms */
  time?: number;
  /** request.method ('get' | 'list' | 'create' | 'update' | 'delete'); set by `decide` */
  method?: string;
}

interface Env {
  vars: Map<string, unknown>;
  ctx: Ctx;
  rules: Rules;
  resource: { data: Doc; id: string } | null;
  depth: number;
  /** distinct documents touched by get()/exists() in this request (the real limit is 10) */
  touched: Set<string>;
}

export const MAX_GET_CALLS = 10;

function evalNode(n: Node, e: Env): unknown {
  switch (n.t) {
    case 'lit':
      return n.v;
    case 'list':
      return n.items.map((i) => evalNode(i, e));
    case 'id': {
      if (e.vars.has(n.n)) return e.vars.get(n.n);
      if (n.n === 'request') {
        const c = e.ctx;
        return {
          auth: c.auth ? { uid: c.auth.uid, token: c.auth.token ?? {} } : null,
          resource: c.object ?? (c.data ? { data: c.data } : null),
          time: new Ts(c.time ?? Date.now()),
          method: c.method ?? 'get',
        };
      }
      if (n.n === 'resource') return e.resource;
      if (n.n === 'duration' || n.n === 'timestamp' || n.n === 'firestore')
        return new Namespace(n.n);
      return fail(`unbound ${n.n}`);
    }
    case 'path': {
      let s = '';
      for (const g of n.segs) s += typeof g === 'string' ? g : String(evalNode(g, e));
      return new PathVal(s.replace(/^\/databases\/[^/]+\/documents\//, '').replace(/^\/+/, ''));
    }
    case 'un': {
      const a = evalNode(n.a, e);
      if (n.op === '!') return typeof a === 'boolean' ? !a : fail('! of non-bool');
      return typeof a === 'number' ? -a : fail('- of non-number');
    }
    case 'cond':
      return evalNode(n.c, e) === true ? evalNode(n.a, e) : evalNode(n.b, e);
    case 'is': {
      const a = evalNode(n.a, e);
      switch (n.type) {
        case 'int':
          return typeof a === 'number' && Number.isInteger(a);
        case 'float':
          // the client SDK writes an integral JS number as int and a fractional one as double
          return typeof a === 'number' && !Number.isInteger(a);
        case 'number':
          return typeof a === 'number';
        case 'string':
          return typeof a === 'string';
        case 'bool':
          return typeof a === 'boolean';
        case 'map':
          return isMap(a);
        case 'list':
          return Array.isArray(a);
        case 'timestamp':
          return a instanceof Ts;
        case 'duration':
          return a instanceof Dur;
        case 'path':
          return a instanceof PathVal;
        default:
          return fail(`is ${n.type}`);
      }
    }
    case 'bin':
      return bin(n, e);
    case 'mem': {
      const a = evalNode(n.a, e);
      if (a instanceof PathVal) return fail('member of path');
      if (a === null || a === undefined) return fail(`member ${n.n} of null`);
      if (isMap(a) && hasOwn(a, n.n)) return a[n.n];
      if (a instanceof Ts && n.n === 'ms') return fail('no field ms');
      return fail(`no field ${n.n}`);
    }
    case 'idx': {
      const a = evalNode(n.a, e);
      const i = evalNode(n.i, e);
      if (isMap(a) && typeof i === 'string' && hasOwn(a, i)) return a[i];
      if (
        Array.isArray(a) &&
        typeof i === 'number' &&
        Number.isInteger(i) &&
        i >= 0 &&
        i < a.length
      )
        return a[i];
      return fail('index');
    }
    case 'call':
      return call(n, e);
  }
}

function or2(n: Node & { t: 'bin' }, e: Env, isOr: boolean): boolean {
  let err: unknown = null;
  let av: unknown;
  try {
    av = evalNode(n.a, e);
    if (typeof av !== 'boolean') fail('non-bool operand');
  } catch (x) {
    if (!(x instanceof RuleError)) throw x;
    err = x;
  }
  if (!err && av === isOr) return isOr; // short circuit
  let bv: unknown;
  try {
    bv = evalNode(n.b, e);
    if (typeof bv !== 'boolean') fail('non-bool operand');
  } catch (x) {
    if (!(x instanceof RuleError)) throw x;
    if (err) throw err;
    // other side decided nothing
    throw x;
  }
  if (bv === isOr) return isOr;
  if (err) throw err;
  return bv as boolean;
}

function bin(n: Node & { t: 'bin' }, e: Env): unknown {
  if (n.op === '&&') return or2(n, e, false);
  if (n.op === '||') return or2(n, e, true);
  const a = evalNode(n.a, e);
  const b = evalNode(n.b, e);
  switch (n.op) {
    case '==':
      return deepEq(a, b) && (a === null) === (b === null);
    case '!=':
      return !(deepEq(a, b) && (a === null) === (b === null));
    case 'in':
      if (isMap(b)) return typeof a === 'string' && hasOwn(b, a);
      if (b instanceof KeySet) return b.keys.includes(a as string);
      if (Array.isArray(b)) return b.some((x) => deepEq(x, a));
      return fail('in');
    case '+':
      if (a instanceof Ts && b instanceof Dur) return new Ts(a.ms + b.ms);
      if (a instanceof Dur && b instanceof Ts) return new Ts(a.ms + b.ms);
      if (a instanceof Dur && b instanceof Dur) return new Dur(a.ms + b.ms);
      if (typeof a === 'number' && typeof b === 'number') return a + b;
      if (typeof a === 'string' && typeof b === 'string') return a + b;
      if (Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
      return fail('+');
    case '-':
    case '*':
    case '/':
    case '%':
    case '<':
    case '<=':
    case '>':
    case '>=': {
      if (a instanceof Ts && b instanceof Ts) {
        switch (n.op) {
          case '-':
            return new Dur(a.ms - b.ms);
          case '<':
            return a.ms < b.ms;
          case '<=':
            return a.ms <= b.ms;
          case '>':
            return a.ms > b.ms;
          case '>=':
            return a.ms >= b.ms;
        }
        return fail(`op ${n.op} on timestamps`);
      }
      if (a instanceof Ts && b instanceof Dur && n.op === '-') return new Ts(a.ms - b.ms);
      if (a instanceof Dur && b instanceof Dur) {
        if (n.op === '-') return new Dur(a.ms - b.ms);
        if (n.op === '<') return a.ms < b.ms;
        if (n.op === '<=') return a.ms <= b.ms;
        if (n.op === '>') return a.ms > b.ms;
        if (n.op === '>=') return a.ms >= b.ms;
      }
      if (typeof a !== typeof b || (typeof a !== 'number' && typeof a !== 'string'))
        return fail(`type mismatch ${n.op}`);
      const x = a as number;
      const y = b as number;
      switch (n.op) {
        case '-':
          return x - y;
        case '*':
          return x * y;
        case '/':
          return x / y;
        case '%':
          return x % y;
        case '<':
          return x < y;
        case '<=':
          return x <= y;
        case '>':
          return x > y;
        default:
          return x >= y;
      }
    }
  }
  return fail(`op ${n.op}`);
}

function lookupDoc(e: Env, p: PathVal): Doc | null {
  e.touched.add(p.path);
  if (e.touched.size > MAX_GET_CALLS)
    return fail(`more than ${MAX_GET_CALLS} get()/exists() documents`);
  return hasOwn(e.ctx.db, p.path) ? e.ctx.db[p.path] : null;
}

function callFn(def: FnDef, args: unknown[], e: Env): unknown {
  if (e.depth > 40) return fail('recursion');
  if (args.length !== def.params.length) return fail(`arity ${def.name}`);
  const vars = new Map<string, unknown>(def.params.map((p, i) => [p, args[i]]));
  vars.set('database', '(default)');
  const inner: Env = { ...e, vars, depth: e.depth + 1 };
  for (const [n, ex] of def.lets) vars.set(n, evalNode(ex, inner));
  return evalNode(def.ret, inner);
}

function call(n: Node & { t: 'call' }, e: Env): unknown {
  const f = n.f;
  if (f.t === 'id') {
    const args = () => n.args.map((a) => evalNode(a, e));
    const def = e.rules.fns.get(f.n);
    if (def) return callFn(def, args(), e);
    const [a] = args();
    switch (f.n) {
      case 'get': {
        if (!(a instanceof PathVal)) return fail('get(path)');
        const d = lookupDoc(e, a);
        return d ? { data: d } : fail(`get: no document ${a.path}`);
      }
      case 'exists':
        return a instanceof PathVal ? lookupDoc(e, a) !== null : fail('exists(path)');
      case 'int':
        return typeof a === 'string' && /^-?(0|[1-9]\d*)$/.test(a)
          ? Number(a)
          : typeof a === 'number'
            ? Math.trunc(a)
            : fail('int()');
      case 'float':
        return Number(a);
      case 'string':
        return typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean'
          ? String(a)
          : fail('string()');
      default:
        return fail(`unknown function ${f.n}`);
    }
  }
  if (f.t !== 'mem') return fail('call of non-function');
  const recv = evalNode(f.a, e);
  const args = n.args.map((a) => evalNode(a, e));
  const m = f.n;
  if (recv instanceof Namespace) {
    // Storage rules read Firestore through `firestore.get(path)` / `firestore.exists(path)`
    if (
      recv.name === 'firestore' &&
      (m === 'get' || m === 'exists') &&
      args[0] instanceof PathVal
    ) {
      const d = lookupDoc(e, args[0]);
      return m === 'exists'
        ? d !== null
        : d
          ? { data: d }
          : fail(`get: no document ${args[0].path}`);
    }
    if (recv.name === 'duration' && m === 'value' && typeof args[0] === 'number') {
      const unit: Record<string, number> = {
        w: 6.048e8,
        d: 8.64e7,
        h: 3.6e6,
        m: 6e4,
        s: 1e3,
        ms: 1,
      };
      const u = unit[String(args[1])];
      return u === undefined ? fail('duration unit') : new Dur(args[0] * u);
    }
    if (recv.name === 'timestamp' && m === 'date' && args.every((x) => typeof x === 'number'))
      return new Ts(Date.UTC(args[0] as number, (args[1] as number) - 1, args[2] as number));
    if (recv.name === 'timestamp' && m === 'value' && typeof args[0] === 'number')
      return new Ts(args[0] * 1000);
    return fail(`unknown ${recv.name}.${m}`);
  }
  if (recv instanceof Ts) {
    if (m === 'toMillis') return recv.ms;
    if (m === 'seconds') return Math.floor(recv.ms / 1000);
    if (m === 'nanos') return (((recv.ms % 1000) + 1000) % 1000) * 1e6;
    return fail(`unknown timestamp method ${m}`);
  }
  if (recv instanceof Dur) {
    if (m === 'seconds') return Math.trunc(recv.ms / 1000);
    if (m === 'nanos') return (recv.ms % 1000) * 1e6;
    return fail(`unknown duration method ${m}`);
  }
  if (m === 'keys' && isMap(recv)) return new KeySet(Object.keys(recv));
  if (recv instanceof KeySet) {
    const list = args[0];
    switch (m) {
      case 'hasOnly':
        return Array.isArray(list) ? recv.keys.every((k) => list.includes(k)) : fail('hasOnly');
      case 'hasAll':
        return Array.isArray(list)
          ? list.every((k) => recv.keys.includes(k as string))
          : fail('hasAll');
      case 'hasAny':
        return Array.isArray(list)
          ? list.some((k) => recv.keys.includes(k as string))
          : fail('hasAny');
      case 'size':
        return recv.keys.length;
    }
  }
  if (m === 'get' && isMap(recv)) {
    const k = args[0];
    return typeof k === 'string' && hasOwn(recv, k) ? recv[k] : args[1];
  }
  if (m === 'diff' && isMap(recv) && isMap(args[0])) {
    const other = args[0];
    const keys = new Set([...Object.keys(recv), ...Object.keys(other)]);
    const changed = [...keys].filter(
      (k) => !(k in recv) || !(k in other) || !deepEq(recv[k], other[k]),
    );
    return { affectedKeys: () => new KeySet(changed) };
  }
  if (m === 'affectedKeys' && recv && typeof recv === 'object' && 'affectedKeys' in recv) {
    return (recv as { affectedKeys: () => KeySet }).affectedKeys();
  }
  if (m === 'size') {
    if (typeof recv === 'string') return [...recv].length; // code points, like the real engine
    if (Array.isArray(recv)) return recv.length;
    if (isMap(recv)) return Object.keys(recv).length;
  }
  if (m === 'hasOnly' && Array.isArray(recv))
    return recv.every((k) => (args[0] as unknown[]).includes(k));
  if (m === 'hasAll' && Array.isArray(recv))
    return (args[0] as unknown[]).every((k) => recv.includes(k));
  if (m === 'matches' && typeof recv === 'string' && typeof args[0] === 'string')
    return new RegExp(`^(?:${args[0]})$`).test(recv);
  if (m === 'lower' && typeof recv === 'string') return recv.toLowerCase();
  if (m === 'upper' && typeof recv === 'string') return recv.toUpperCase();
  if (m === 'split' && typeof recv === 'string') return recv.split(String(args[0]));
  return fail(`unknown method ${m}`);
}

// ---------------------------------------------------------------- matching

export type Op = 'get' | 'list' | 'create' | 'update' | 'delete';
const GROUPS: Record<string, Op[]> = {
  read: ['get', 'list'],
  write: ['create', 'update', 'delete'],
  get: ['get'],
  list: ['list'],
  create: ['create'],
  update: ['update'],
  delete: ['delete'],
};

function matchPath(m: MatchDef, parts: string[], vars: Map<string, string>): string[] | null {
  let i = 0;
  for (const s of m.segs) {
    const w = /^\{(\w+)(=\*\*)?\}$/.exec(s);
    if (w && w[2]) {
      vars.set(w[1], parts.slice(i).join('/'));
      return [];
    }
    if (i >= parts.length) return null;
    if (w) vars.set(w[1], parts[i]);
    else if (s !== parts[i]) return null;
    i++;
  }
  return parts.slice(i);
}

export interface Decision {
  allowed: boolean;
  /** the `allow` statements that matched the path and op, with their outcome */
  tried: { line: string; ok: boolean; error?: string }[];
}

/** Would `op` on document `path` be allowed? */
export function decide(
  rules: Rules,
  op: Op,
  path: string,
  ctx: Ctx,
  /** where the path starts: Firestore documents by default; Cloud Storage objects pass ['b', bucket, 'o'] */
  root: string[] = ['databases', '(default)', 'documents'],
): Decision {
  const parts = [...root, ...path.split('/').filter(Boolean)];
  const tried: Decision['tried'] = [];
  const touched = new Set<string>(); // one get()/exists() budget for the whole request
  const walk = (m: MatchDef, rest: string[], vars: Map<string, string>) => {
    for (const c of m.children) {
      const v = new Map(vars);
      const r = matchPath(c, rest, v);
      if (!r) continue;
      if (r.length === 0) {
        for (const a of c.allows) {
          if (!a.ops.some((o) => GROUPS[o]?.includes(op))) continue;
          const env: Env = {
            vars: new Map<string, unknown>([...v, ['database', '(default)']]),
            ctx: { ...ctx, method: op },
            rules,
            resource: hasOwn(ctx.db, path)
              ? { data: ctx.db[path], id: path.split('/').pop() ?? '' }
              : null,
            depth: 0,
            touched,
          };
          try {
            tried.push({ line: a.line, ok: evalNode(a.cond, env) === true });
          } catch (x) {
            if (!(x instanceof RuleError)) throw x;
            tried.push({ line: a.line, ok: false, error: x.message });
          }
        }
      }
      walk(c, r, v);
    }
  };
  walk(rules.root, parts, new Map());
  return { allowed: tried.some((t) => t.ok), tried };
}

/** Call one named rules function with plain arguments (unit test of a helper). */
export function callRulesFn(rules: Rules, name: string, args: unknown[], ctx: Ctx): unknown {
  const def = rules.fns.get(name);
  if (!def) throw new Error(`no rules function ${name}`);
  const env: Env = { vars: new Map(), ctx, rules, resource: null, depth: 0, touched: new Set() };
  const wrapped = args.map((a) =>
    typeof a === 'object' && a !== null && !Array.isArray(a) ? a : a,
  );
  try {
    return callFn(def, wrapped, env);
  } catch (x) {
    if (x instanceof RuleError) return `error: ${x.message}`;
    throw x;
  }
}
