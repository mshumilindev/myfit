import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { cert, initializeApp } = require('firebase-admin/app');
const { FieldValue, getFirestore } = require('firebase-admin/firestore');

const serviceAccount = JSON.parse(
  readFileSync(new URL('../serviceAccountKey.json', import.meta.url), 'utf8'),
);

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

let batch = db.batch();
let ops = 0;

async function commitBatch() {
  if (!ops) return;
  await batch.commit();
  batch = db.batch();
  ops = 0;
}

async function enqueue(ref, write) {
  write(batch, ref);
  ops++;
  if (ops >= 450) await commitBatch();
}

let updatedUsers = 0;
const users = await db.collection('users').get();
for (const user of users.docs) {
  const data = user.data();
  if (!Object.hasOwn(data, 'email') && !Object.hasOwn(data, 'emailLower')) continue;
  await enqueue(user.ref, (b, ref) =>
    b.update(ref, {
      email: FieldValue.delete(),
      emailLower: FieldValue.delete(),
      updatedAt: Date.now(),
    }),
  );
  updatedUsers++;
}

let deletedEmailReservations = 0;
const emailReservations = await db.collection('emails').listDocuments();
for (const ref of emailReservations) {
  await enqueue(ref, (b, docRef) => b.delete(docRef));
  deletedEmailReservations++;
}

await commitBatch();

console.log(
  `Removed email identity data: ${updatedUsers} user docs updated, ${deletedEmailReservations} email reservations deleted.`,
);
