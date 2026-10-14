import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultRequest } from '../domain/invite';
import { createLocalInvitePort, resetCreatedInvites, useCoachInvites } from './inviteStore';

afterEach(() => resetCreatedInvites());

describe('local invite port', () => {
  const now = Date.UTC(2026, 9, 7, 9, 5);
  const port = createLocalInvitePort({ now: () => now });

  it('app and hybrid get a link that works 7 days; program-only gets no link', async () => {
    const a = await port.create({
      name: ' Olena Marchenko ',
      mode: 'app',
      request: defaultRequest('app'),
    });
    expect(a.name).toBe('Olena Marchenko');
    expect(a.url).toMatch(/\/#\/invite\/[0-9a-z]{20}$/);
    expect(a.expiresAt).toBe(now + 7 * 86_400_000);
    const p = await port.create({
      name: 'Dmytro K',
      mode: 'program',
      request: defaultRequest('program'),
    });
    expect(p.url).toBeNull();
    expect(p.expiresAt).toBeNull();
  });

  it('each link is unique; an invalid name is refused like the server will', async () => {
    const a = await port.create({ name: 'Olena', mode: 'app', request: defaultRequest('app') });
    const b = await port.create({ name: 'Olena', mode: 'app', request: defaultRequest('app') });
    expect(a.url).not.toBe(b.url);
    await expect(
      port.create({ name: 'A', mode: 'app', request: defaultRequest('app') }),
    ).rejects.toThrow();
  });

  it('offline failure surfaces as a PortError with code offline', async () => {
    const off = createLocalInvitePort({ fail: 'offline' });
    await expect(
      off.create({ name: 'Olena', mode: 'app', request: defaultRequest('app') }),
    ).rejects.toMatchObject({ code: 'offline' });
  });
});

describe('useCoachInvites', () => {
  it("keeps this session's invites, newest first, shared by every reader", async () => {
    const port = createLocalInvitePort();
    const a = renderHook(() => useCoachInvites(port));
    const b = renderHook(() => useCoachInvites(port));
    await act(async () => {
      await a.result.current.create({ name: 'Olena', mode: 'app', request: defaultRequest('app') });
      await a.result.current.create({
        name: 'Dmytro',
        mode: 'program',
        request: defaultRequest('program'),
      });
    });
    expect(b.result.current.created.map((c) => c.name)).toEqual(['Dmytro', 'Olena']);
  });
});
