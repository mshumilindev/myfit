/**
 * `gymPlaces` (SPO-360): gym search and photos from Google Places, through the server. The key is a secret
 * (`firebase functions:secrets:set GOOGLE_PLACES_KEY`); a call needs a signed-in person whose latest `geo-search`
 * consent names Google (`google-places` engine) at the current version. Nothing about the person is forwarded and the
 * request is not logged. Logic and limits: `gymPlacesCore.ts`.
 */
import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { db, requireAuth } from './lib';
import { ENFORCE_APPCHECK } from './coach/runtime';
import { gymPlacesHandler } from './gymPlacesCore';

const GOOGLE_PLACES_KEY = defineSecret('GOOGLE_PLACES_KEY');

export const gymPlaces = onCall(
  { secrets: [GOOGLE_PLACES_KEY], enforceAppCheck: ENFORCE_APPCHECK, maxInstances: 5 },
  async (req) => {
    const uid = requireAuth(req);
    return gymPlacesHandler(req.data, {
      key: GOOGLE_PLACES_KEY.value(),
      fetch,
      records: async () =>
        (
          await db.collection(`users/${uid}/consentRecords`).where('kind', '==', 'geo-search').get()
        ).docs.map((d) => d.data()),
    });
  },
);
