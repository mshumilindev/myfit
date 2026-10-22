/**
 * Vitest setup (SPO-290): the existing suites exercise the health features themselves, so every test starts with all
 * seven consents ON and known. A test about consent turns them off with `resetHealthGateForTests()` (the real,
 * fail-closed start) and drives the gate like the app does.
 */
import { beforeEach } from 'vitest';
import { resetHealthGateForTests } from '../data/healthConsentGate';

beforeEach(() => resetHealthGateForTests(true));
