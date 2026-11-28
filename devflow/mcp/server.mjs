#!/usr/bin/env node
/**
 * devflow MCP server (stdio, zero dependencies). Exposes the workflow state of the host project as tools so Claude reads
 * and changes it without shelling out by hand: wf_status, wf_bar, wf_add, wf_doing, wf_done, wf_block, wf_unblock.
 * It knows nothing about the host project: every path and pattern comes from devflow.config.json (next to this
 * package) and the project root from DEVFLOW_ROOT / CLAUDE_PROJECT_DIR / cwd.
 */
import { execFileSync } from 'node:child_process';
import process from 'node:process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.DEVFLOW_ROOT ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const CONFIG = JSON.parse(readFileSync(join(HERE, '..', 'devflow.config.json'), 'utf8'));

/** @param {string} cli @param {string[]} args */
const run = (cli, args) => {
  try {
    return execFileSync('node', [join(ROOT, cli), ...args], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (e) {
    const err = /** @type {{ stdout?: string, stderr?: string, message: string }} */ (e);
    return `${err.stdout ?? ''}${err.stderr ?? ''}`.trim() || err.message;
  }
};

const str = (description) => ({ type: 'string', description });
/** @type {{ name: string, description: string, inputSchema: object, call: (a: any) => string }[]} */
export const TOOLS = [
  {
    name: 'wf_status',
    description: 'Current task, items and statuses (like git status).',
    inputSchema: { type: 'object', properties: {} },
    call: () => run(CONFIG.wfCli, ['status']),
  },
  {
    name: 'wf_bar',
    description:
      'Progress by section as text bars, the same view as the dashboard Overview. Paste it into status messages.',
    inputSchema: { type: 'object', properties: {} },
    call: () => run(CONFIG.barCli, []),
  },
  {
    name: 'wf_add',
    description: 'Add a plan item (id like A.1: section.number).',
    inputSchema: {
      type: 'object',
      properties: { item: str('item id'), text: str('what it is'), kind: str('ac | step | extra') },
      required: ['item'],
    },
    call: (a) =>
      run(CONFIG.wfCli, [
        'add',
        String(a.item),
        ...(a.kind ? ['--kind', String(a.kind)] : []),
        ...(a.text ? ['--text', String(a.text)] : []),
      ]),
  },
  {
    name: 'wf_doing',
    description: 'Mark an item as in work.',
    inputSchema: { type: 'object', properties: { item: str('item id') }, required: ['item'] },
    call: (a) => run(CONFIG.wfCli, ['doing', String(a.item)]),
  },
  {
    name: 'wf_done',
    description:
      'Close an item. Evidence (command, file or link) is required: nothing is done without proof.',
    inputSchema: {
      type: 'object',
      properties: { item: str('item id'), evidence: str('command, file or link that proves it') },
      required: ['item', 'evidence'],
    },
    call: (a) => run(CONFIG.wfCli, ['done', String(a.item), '--evidence', String(a.evidence)]),
  },
  {
    name: 'wf_block',
    description: 'Block an item on something only the owner can resolve.',
    inputSchema: {
      type: 'object',
      properties: {
        item: str('item id'),
        needs: str('design | cpd | access | legal | irreversible'),
        reason: str('why'),
      },
      required: ['item', 'needs'],
    },
    call: (a) =>
      run(CONFIG.wfCli, [
        'block',
        String(a.item),
        '--needs',
        String(a.needs),
        ...(a.reason ? ['--reason', String(a.reason)] : []),
      ]),
  },
  {
    name: 'wf_unblock',
    description: 'Remove a block from an item.',
    inputSchema: { type: 'object', properties: { item: str('item id') }, required: ['item'] },
    call: (a) => run(CONFIG.wfCli, ['unblock', String(a.item)]),
  },
];

/** @param {any} msg @returns {any | null} the JSON-RPC response, or null for a notification */
export function handle(msg) {
  const reply = (/** @type {any} */ result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const fail = (/** @type {number} */ code, /** @type {string} */ message) => ({
    jsonrpc: '2.0',
    id: msg.id,
    error: { code, message },
  });
  if (msg.id === undefined) return null;
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: msg.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'devflow', version: '0.1.0' },
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case 'tools/call': {
      const tool = TOOLS.find((t) => t.name === msg.params?.name);
      if (!tool) return fail(-32602, 'unknown tool');
      const text = tool.call(msg.params?.arguments ?? {});
      return reply({ content: [{ type: 'text', text }] });
    }
    default:
      return fail(-32601, 'method not found');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rl = createInterface({ input: process.stdin });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const out = handle(msg);
    if (out) process.stdout.write(`${JSON.stringify(out)}\n`);
  });
}
