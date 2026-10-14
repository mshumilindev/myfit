#!/usr/bin/env node
/**
 * Prints the VITE_COACH_SIGNING_PINS value for the client build from the server signing key.
 *
 *   node scripts/pin-coach-signing.mjs --kid <kid> [--key <file.pem>]      # private key PEM (file or env COACH_SIGNING_KEY)
 *   node scripts/pin-coach-signing.mjs --kid <kid> --pub <file.pem>        # public key PEM
 *   ... --add '<existing JSON array>'                                      # append during a rotation
 *
 * The private key is read, never printed; only the public half goes to the output.
 */
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const kid = arg('kid');
if (!kid) {
  console.error('usage: pin-coach-signing.mjs --kid <kid> [--key file | --pub file] [--add json]');
  process.exit(2);
}
let pubKey;
if (arg('pub')) pubKey = createPublicKey(readFileSync(arg('pub'), 'utf8'));
else {
  const pemText = arg('key') ? readFileSync(arg('key'), 'utf8') : process.env.COACH_SIGNING_KEY;
  if (!pemText) {
    console.error('no key: pass --key <file>, --pub <file> or set COACH_SIGNING_KEY');
    process.exit(2);
  }
  pubKey = createPublicKey(createPrivateKey(pemText));
}
if (pubKey.asymmetricKeyType !== 'ed25519') {
  console.error('the signing key must be Ed25519');
  process.exit(2);
}
const pub = pubKey.export({ type: 'spki', format: 'pem' }).toString().trim();
const list = arg('add') ? JSON.parse(arg('add')) : [];
list.push({ kid, pub });
console.log(`VITE_COACH_SIGNING_PINS=${JSON.stringify(list)}`);
