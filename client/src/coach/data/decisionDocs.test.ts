// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { NEW_COLLECTIONS } from '../../coachCrypto/newCollections';
import { VaultLockedError } from '../../coachCrypto/sealOrThrow';
import { readyVault, unsetVault } from '../../testVault';
import { dismissSignal, emptyBook, recordProgramDecision } from '../domain/decisions';
import { buildOptions } from '../domain/diff';
import { detectSignals } from '../domain/signals';
import { buildFixtureWorld, FIXTURE_NOW } from './__fixtures__/fixtures';
import { openDecision, openSignalState, sealDecision, sealSignalState } from './decisionDocs';

async function oleh() {
  const w = buildFixtureWorld();
  const sig = detectSignals(w.inputs, FIXTURE_NOW).find((s) => s.clientId === 'c1')!;
  const book = recordProgramDecision(emptyBook(), {
    id: 'dec-1',
    signal: sig,
    option: buildOptions(sig).find((o) => o.suggested)!,
    now: FIXTURE_NOW,
    message: 'secret-message-text',
  });
  return { sig, book, rec: book.decisions[0] };
}

describe('decision documents are sealed (NEW_COLLECTIONS, sealOrThrow)', () => {
  it('round-trips a decision with its evidence snapshot', async () => {
    const vault = await readyVault();
    const { rec } = await oleh();
    const { decision, evidence } = await sealDecision(rec, vault);
    const back = await openDecision(
      decision,
      evidence.map((e) => e.doc),
      vault,
    );
    expect(back).toEqual(rec);
    expect(back.evidence[0]).toMatchObject({ category: 'sets', level: 'full', granular: true });
  });

  it('puts only the declared open fields in the clear; message, diff, signal and reasoning are ciphertext', async () => {
    const vault = await readyVault();
    const { rec } = await oleh();
    const { decision, evidence } = await sealDecision(rec, vault);
    const open = Object.keys(decision).filter((k) => k !== 'enc');
    expect(open.sort()).toEqual([...NEW_COLLECTIONS.decisions.open].sort());
    const flat = JSON.stringify({ decision, evidence });
    for (const secret of ['secret-message-text', 'Bench press', 'Paused', 'c1|stall', '100x5'])
      expect(flat).not.toContain(secret);
    expect(evidence[0].doc.category).toBe('sets');
    expect(Object.keys(evidence[0].doc).sort()).toEqual(['category', 'enc']);
  });

  it('a dismiss reason is sealed in `notes`', async () => {
    const vault = await readyVault();
    const { sig } = await oleh();
    const rec = dismissSignal(emptyBook(), 'dec-2', sig, 'wrong-data', FIXTURE_NOW).decisions[0];
    const { decision } = await sealDecision(rec, vault);
    expect(JSON.stringify(decision)).not.toContain('wrong-data');
    expect((await openDecision(decision, [], vault)).reason).toBe('wrong-data');
  });

  it('refuses to write while the vault is locked (no plaintext fallback) and never calls the writer', async () => {
    const locked = await unsetVault();
    const { rec } = await oleh();
    const write = vi.fn();
    await expect(sealDecision(rec, locked).then(write)).rejects.toBeInstanceOf(VaultLockedError);
    expect(write).not.toHaveBeenCalled();
  });

  it('a different vault cannot open it', async () => {
    const { rec } = await oleh();
    const sealed = await sealDecision(rec, await readyVault());
    await expect(openDecision(sealed.decision, [], await readyVault())).rejects.toBeTruthy();
  });

  it('signalState (snoozed, dismissed, data-quality flags) round-trips sealed', async () => {
    const vault = await readyVault();
    const { sig } = await oleh();
    const book = dismissSignal(emptyBook(), 'x', sig, 'wrong-data', FIXTURE_NOW);
    const raw = await sealSignalState(book, vault, FIXTURE_NOW);
    expect(Object.keys(raw).sort()).toEqual(['enc', 'updatedAt']);
    expect(JSON.stringify(raw)).not.toContain('c1|stall');
    const back = await openSignalState(raw, vault);
    expect(back.dismissed).toEqual(book.dismissed);
    expect(back.dataQuality).toEqual({ c1: FIXTURE_NOW });
    expect(back.snoozed).toEqual({});
  });
});
