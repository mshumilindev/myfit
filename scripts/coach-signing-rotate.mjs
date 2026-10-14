#!/usr/bin/env node
/**
 * Builds the rotation announcement for `config/coachSigning.next`, signed by a key that is ALREADY pinned in shipped
 * clients. Write the printed JSON into the document (Admin SDK / console) after the new key is deployed as the server
 * signing secret and the new pin is in the next client build.
 *
 *   COACH_SIGNING_KEY_OLD=<old private PEM> node scripts/coach-signing-rotate.mjs --old-kid k1 --new-kid k2 --new-pub new.pem
 *
 * Payload (must equal client/src/coachCrypto/signingPins.ts rotationPayload):  signrot|1|<newKid>|<newPub base64 SPKI>
 */
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const oldKid = arg('old-kid');
const newKid = arg('new-kid');
const newPubFile = arg('new-pub');
const oldPriv = process.env.COACH_SIGNING_KEY_OLD;
if (!oldKid || !newKid || !newPubFile || !oldPriv) {
  console.error('need --old-kid, --new-kid, --new-pub <file> and env COACH_SIGNING_KEY_OLD');
  process.exit(2);
}
const newPub = createPublicKey(readFileSync(newPubFile, 'utf8'))
  .export({ type: 'spki', format: 'pem' })
  .toString();
const bare = newPub.replace(/-----(BEGIN|END) PUBLIC KEY-----/g, '').replace(/\s+/g, '');
const sig = sign(
  null,
  Buffer.from(`signrot|1|${newKid}|${bare}`),
  createPrivateKey(oldPriv),
).toString('base64');
console.log(JSON.stringify({ next: { kid: newKid, pub: newPub, by: oldKid, sig } }, null, 2));
