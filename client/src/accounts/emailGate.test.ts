import { describe, expect, it } from 'vitest';
import { cooldownLeft, emailGateView, RESEND_COOLDOWN_S } from './emailGate';

describe('emailGateView', () => {
  it('stays clear while the server has not answered', () => {
    expect(emailGateView(null)).toBe('clear');
  });
  it('stays clear when the switch is off or missing', () => {
    expect(emailGateView({ email: null, verified: false })).toBe('clear');
    expect(emailGateView({ email: null, verified: false, required: false })).toBe('clear');
  });
  it('asks for an email when required and none is linked', () => {
    expect(emailGateView({ email: null, verified: false, required: true })).toBe('add');
  });
  it('asks to check the inbox when linked but not confirmed', () => {
    expect(emailGateView({ email: 'a@b.co', verified: false, required: true })).toBe('sent');
  });
  it('opens once confirmed', () => {
    expect(emailGateView({ email: 'a@b.co', verified: true, required: true })).toBe('clear');
  });
});

describe('cooldownLeft', () => {
  it('counts down and never goes negative', () => {
    expect(cooldownLeft(null, 5)).toBe(0);
    expect(cooldownLeft(0, 0)).toBe(RESEND_COOLDOWN_S);
    expect(cooldownLeft(0, 59_100)).toBe(1);
    expect(cooldownLeft(0, 90_000)).toBe(0);
  });
});
