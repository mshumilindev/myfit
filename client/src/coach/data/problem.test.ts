import { describe, expect, it, vi, afterEach } from 'vitest';
import { classifyProblem, problemOfCode } from './problem';
import { toPortError } from './firestore/errors';
import { HttpError } from '../../api';

const fb = (code: string, status = 500) =>
  new HttpError(status, code, { code: `functions/${code}` });

afterEach(() => vi.unstubAllGlobals());

describe('classifyProblem: one word per failure class', () => {
  it('permission-denied / 403 / unauthenticated -> denied', () => {
    expect(classifyProblem(fb('permission-denied', 403))).toBe('denied');
    expect(classifyProblem({ status: 403 })).toBe('denied');
    expect(classifyProblem({ code: 'unauthenticated' })).toBe('denied');
  });
  it('a missing callable (not-found / 404 / unimplemented / 501) -> not-deployed', () => {
    expect(classifyProblem(fb('not-found', 404))).toBe('not-deployed');
    expect(classifyProblem({ code: 'functions/unimplemented' })).toBe('not-deployed');
    expect(classifyProblem({ status: 501 })).toBe('not-deployed');
  });
  it('offline: our 503 offline error, the SDK unavailable code, or a device that says so', () => {
    expect(classifyProblem(new HttpError(503, 'offline'))).toBe('offline');
    expect(classifyProblem({ code: 'unavailable' })).toBe('offline');
    vi.stubGlobal('navigator', { onLine: false });
    expect(classifyProblem(new Error('x'))).toBe('offline');
  });
  it('deadline-exceeded / 504 -> timeout; anything else -> unknown', () => {
    expect(classifyProblem(fb('deadline-exceeded', 504))).toBe('timeout');
    expect(classifyProblem(new Error('boom'))).toBe('unknown');
    expect(classifyProblem(fb('internal', 500))).toBe('unknown');
  });
  it('port codes map to the same words', () => {
    expect(problemOfCode('forbidden')).toBe('denied');
    expect(problemOfCode('not-deployed')).toBe('not-deployed');
    expect(problemOfCode('offline')).toBe('offline');
    expect(problemOfCode('timeout')).toBe('timeout');
    expect(problemOfCode('unavailable')).toBe('unknown');
    expect(problemOfCode(null)).toBe('unknown');
  });
  it('toPortError keeps the distinction for the world port', () => {
    expect(toPortError(fb('not-found', 404)).code).toBe('not-deployed');
    expect(toPortError(fb('permission-denied', 403)).code).toBe('forbidden');
    expect(toPortError(new HttpError(503, 'offline')).code).toBe('offline');
    expect(toPortError(new Error('?')).code).toBe('unavailable');
  });
});
