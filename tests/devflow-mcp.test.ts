import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM without types
import { TOOLS, handle } from '../devflow/mcp/server.mjs';

describe('devflow MCP server', () => {
  it('answers initialize and lists the wf tools', () => {
    const init = handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
    expect(init.result.serverInfo.name).toBe('devflow');
    const list = handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const names = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      'wf_status',
      'wf_bar',
      'wf_add',
      'wf_doing',
      'wf_done',
      'wf_block',
      'wf_unblock',
    ]);
    expect(
      TOOLS.every((t: { inputSchema: { type: string } }) => t.inputSchema.type === 'object'),
    ).toBe(true);
  });

  it('ignores notifications and rejects unknown methods and tools', () => {
    expect(handle({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeNull();
    expect(handle({ jsonrpc: '2.0', id: 3, method: 'nope' }).error.code).toBe(-32601);
    expect(
      handle({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'x' } }).error.code,
    ).toBe(-32602);
  });

  it('runs wf_bar through the host CLI named in the config', () => {
    const r = handle({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'wf_bar' } });
    expect(r.result.content[0].type).toBe('text');
    expect(typeof r.result.content[0].text).toBe('string');
  });

  it('requires evidence to close an item', () => {
    const done = TOOLS.find((t: { name: string }) => t.name === 'wf_done');
    expect(done.inputSchema.required).toEqual(['item', 'evidence']);
  });
});
