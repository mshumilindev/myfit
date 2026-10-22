/**
 * Open items of the Privacy Policy and Terms of Use (SPO-295 N2): THE single list. Every `{{ПОТРІБНО}}` /
 * `{{ЗАЛЕЖИТЬ}}` / `{{ЮРИСТ}}` marker of the draft (claude/SPO-29-privacy-policy-terms-draft.md) is one entry here instead
 * of raw markup in the rendered text; the texts (i18n/legal.*.ts) carry the neutral wording the draft allows, or leave out
 * a sentence that only held the missing value. `legalPending.test.ts` prints this list and checks it against the texts.
 *
 * RELEASE BLOCKER: the documents must not be published to real users while any entry has `blocksRelease`. Close an
 * entry by deleting it in the same change that writes the missing fact into the texts and raises LEGAL_VERSIONS.
 */

export type PendingDoc = 'privacy' | 'terms' | 'trainer-terms' | 'dpa';
/** owner = a fact only the owner can give; depends = describes something the app does not do yet; lawyer = a question for SPO-258. */
export type PendingKind = 'owner' | 'depends' | 'lawyer';

export interface PendingItem {
  id: string;
  doc: PendingDoc;
  /** Section id in the texts (`p1`..`p14`, `t1`..`t16`), `tt1`..`tt11` (Trainer Terms), `dp1`..`dp13` (DPA), or `header` for the version line. */
  section: string;
  kind: PendingKind;
  note: string;
  /** True while the item stops publication. */
  blocksRelease: true;
}

const item = (
  id: string,
  doc: PendingDoc,
  section: string,
  kind: PendingKind,
  note: string,
): PendingItem => ({ id, doc, section, kind, note, blocksRelease: true });

export const PENDING: readonly PendingItem[] = [
  // Privacy Policy
  item(
    'pp-effective-date',
    'privacy',
    'header',
    'owner',
    'Effective date of the first published version (the page shows only "Last updated" from LEGAL_VERSIONS).',
  ),
  item(
    'pp-address-option',
    'privacy',
    'p1',
    'lawyer',
    'Which controller address to publish: residence in Poland (used) or the Ukrainian registration address.',
  ),
  item(
    'pp-business-entity',
    'privacy',
    'p1',
    'depends',
    'SPO-185: replace the private individual with the Polish business entity when paid plans start.',
  ),
  item(
    'pp-privacy-email',
    'privacy',
    'p1',
    'owner',
    'Privacy email on myspotter.fit (also p9 "by email", p14 contact). PROPOSED value: privacy@myspotter.fit via Cloudflare email routing. State: owner to create the alias; NOT published as fact, the texts name the postal address only until it exists and works.',
  ),
  item(
    'pp-dpo',
    'privacy',
    'p1',
    'lawyer',
    'Confirm no DPO is required; check whether a UK representative is needed.',
  ),
  item(
    'pp-apps',
    'privacy',
    'p1',
    'depends',
    'Add the desktop and Android apps to the description only when they are released.',
  ),
  item(
    'pp-roles-allocation',
    'privacy',
    'p2',
    'lawyer',
    'Controller/processor split between Spotter and trainers (managers, team members) is an inference from project research.',
  ),
  item(
    'pp-team-visibility',
    'privacy',
    'p2',
    'depends',
    'SPO-196: "team visible to you" and "Who saw your data" for team members.',
  ),
  item(
    'pp-health-consent-per-feature',
    'privacy',
    'p3',
    'lawyer',
    'Built in SPO-290: each of the seven health features has its own recorded consent (health:<feature>), asked before first use, off without it. A lawyer still confirms the wording (client/src/i18n/healthConsent.ts, uk/pl machine-translated).',
  ),
  item(
    'pp-version-no-bump',
    'privacy',
    'header',
    'owner',
    'Version policy (decision recorded for the owner, 2026-10-22): LEGAL_VERSIONS stays at the 2026-10-21 baseline although p3-p9 and p11 were corrected (health consent per feature and safety limits in p6, QR service, consent records, export contents, deletion cascade, reCAPTCHA and fonts, retention without expiry). A bump is unnecessary until the first public release because this text has never been accepted by a real user. Raise LEGAL_VERSIONS once, at the release that publishes the texts; any change after the first real acceptance needs a bump and a re-notice.',
  ),
  item(
    'pp-translation-native-read',
    'privacy',
    'header',
    'lawyer',
    'uk and pl texts are machine translations of the English text (including the 2026-10-22 corrections) and need a native read; lt and et fall back to English and need a native translator before those locales get their own text.',
  ),
  item(
    'pp-art22',
    'privacy',
    'p3',
    'lawyer',
    'Confirm the Art. 22 sentence and the Atlas wording.',
  ),
  item(
    'pp-key-model',
    'privacy',
    'p4',
    'lawyer',
    'Keep the "encryption at rest and in transit, not end-to-end" wording unless the key model changes.',
  ),
  item(
    'pp-conversation-keys',
    'privacy',
    'p4',
    'lawyer',
    'Check the conversation-key paragraph against the architecture documents.',
  ),
  item(
    'pp-plaintext-list',
    'privacy',
    'p4',
    'depends',
    'SPO-73, SPO-153: the full list of collections still in plaintext is OMITTED until final. p4 already names what is known true today: the nutrition food log, the consent records (kind visible) and legacy trainer notes; check the rest against the registry before release.',
  ),
  item(
    'pp-firebase-terms',
    'privacy',
    'p5',
    'owner',
    'Confirm the Firebase terms accepted for this project and the Data Processing Terms in force.',
  ),
  item(
    'pp-maps-list',
    'privacy',
    'p5',
    'lawyer',
    'SPO-293: p5 (three locales) now matches the calls in gymProviders.ts / gateChoices.ts: consent-based, OSM services (Photon, Overpass, Nominatim, OSRM, tiles), Wikidata / Wikimedia Commons, unpkg; no Google Places / Foursquare. Still open: LEGAL_VERSIONS is NOT raised (draft not released); raise it with the release, and have the wording checked by a lawyer.',
  ),
  item(
    'pp-off',
    'privacy',
    'p5',
    'lawyer',
    'Open Food Facts is a third party we do not control: disclosure or routing wording.',
  ),
  item(
    'pp-invite-photo',
    'privacy',
    'p5',
    'depends',
    'G12 decision in SPO-252 (profile photo shown to an invited person).',
  ),
  item(
    'pp-atlas',
    'privacy',
    'p7',
    'lawyer',
    'SPO-286 built the consent flow and the payload now matches this section (see chatFacts.consent.test.ts). Still open: the free-tier statement (Google may use requests to improve its products, people may read them) and the Puter wording are from the owner-approved consent text, not yet checked against the providers’ current terms; Gemini API for EEA users needs Paid Services (B3).',
  ),
  item('pp-retention-account', 'privacy', 'p8', 'depends', 'SPO-285: account deletion.'),
  item(
    'pp-retention-coaching',
    'privacy',
    'p8',
    'owner',
    'Verify in code what is deleted and kept when a coaching relationship ends (endRelationship); the sentence is OMITTED.',
  ),
  item(
    'pp-retention-logs',
    'privacy',
    'p8',
    'owner',
    'Retention values for sign-in counters, key-fetch log, push tokens, planned and dismissed reminders, service notices, consent history. p8 now states that these have no automatic expiry and no period is set (no number invented); consent records: until account deletion. Owner/lawyer to set the periods (see pp-no-ttl-automation).',
  ),
  item(
    'pp-google-deletion',
    'privacy',
    'p8',
    'lawyer',
    'Confirm the Google deletion wording (up to 180 days).',
  ),
  item(
    'pp-rights-in-app',
    'privacy',
    'p9',
    'depends',
    '"My data" (N5, N7), account deletion (SPO-285), Atlas off (SPO-286) and the data copy (N6: ZIP of JSON and CSV built on the device) now exist, so the sentence in the policy is true; p9 now also says the copy is built on the device and lists server-held data in its contents file, and describes the deletion cascade (what goes, what stays with other people). Still open: the copy lists parts it cannot read on the device (server-held records, trainer messages, anything not loaded) in its manifest, so the wording "a copy of your data" needs the lawyer to confirm it covers Art. 15 with that list, or the server-held parts need a read path; the legal gate offers no copy before deletion yet.',
  ),
  item(
    'pp-legacy-notes',
    'privacy',
    'p9',
    'depends',
    'SPO-292: p4 now says the current notes feature is under the trainer key and older (legacy trainerNotes) notes are readable on our servers. Replace with the plain sentence once the legacy notes are migrated; the lawyer should also confirm the controller allocation for those notes.',
  ),
  item(
    'pp-trainer-access-flow',
    'privacy',
    'p9',
    'depends',
    'SPO-254 request flow for access to trainer records; controller allocation (lawyer).',
  ),
  item(
    'pp-qr-invite-leak',
    'privacy',
    'p5',
    'depends',
    'OPEN GAP: the invitation QR in client/src/views/AdminView.tsx loads an image from api.qrserver.com with the full invitation URL (it contains the invitation token) in the query, so the token and the viewer IP go to a third party. p5 now discloses it. Recommendation: draw the QR on the client (no network) and delete the bullet from p5, processors.md and trackers.md. Dev task needed; the bullet is the fallback until then.',
  ),
  item(
    'pp-unpkg-sri',
    'privacy',
    'p5',
    'depends',
    'OPEN GAP: Leaflet 1.9.4 JS and CSS are loaded from unpkg.com without Subresource Integrity (RouteMap.tsx): third-party code runs in the app after the geo consent. Recommendation: self-host Leaflet (or add SRI hashes), then drop unpkg from p5, processors.md, trackers.md and the CSP.',
  ),
  item(
    'pp-no-ttl-automation',
    'privacy',
    'p8',
    'owner',
    'OPEN GAP: there is no TTL or retention automation for loginAttempts, keyLog, pings, outbox, reminderDismissals, notices, consentLog or ended coaching links (registry G9). Owner decides the periods (proposals in the SPO-29 draft part 3.4), then dev adds TTL/cleanup and p8 gets the numbers.',
  ),
  item(
    'pp-consent-records-plaintext-kind',
    'privacy',
    'p4',
    'lawyer',
    'OPEN GAP: users/{uid}/consentRecords keep kind (health:<feature>, atlas-ai, ...) and categories in plaintext (registry R43), which reveals to the operator which health features a person turned on. p4 discloses it. Lawyer: acceptable, or minimise (hash the kind). After deletion no proof of consent or deletion is kept (lawyer question).',
  ),
  item(
    'pp-deletion-wording',
    'privacy',
    'p9',
    'lawyer',
    'New p9 bullet on account deletion (what the cascade removes; log entries, notices and team activity held by other people stay): confirm it is adequate for Art. 17 and whether a minimal proof of deletion must be kept.',
  ),
  item(
    'pp-authority',
    'privacy',
    'p9',
    'lawyer',
    'Confirm the supervisory authority name and contact details (UODO).',
  ),
  item(
    'pp-age',
    'privacy',
    'p10',
    'lawyer',
    '18+ was chosen by the owner for launch; confirm the wording.',
  ),
  item(
    'pp-local-storage',
    'privacy',
    'p11',
    'depends',
    'SPO-153, SPO-216 (some local data still unencrypted). p11 now says fonts are self-hosted, Spotter sets no own cookies, and reCAPTCHA/App Check may set its own; the full list of Google reCAPTCHA cookies is unknown (check in a browser before release). Firebase Analytics was removed (SPO-287): the text describes what happens and does not claim anything about analytics.',
  ),
  item(
    'pp-versioning',
    'privacy',
    'p13',
    'depends',
    'Versioning, in-app announcement of changes and the version in Settings (SPO-29 design, N8).',
  ),
  // Terms of Use
  item(
    'tu-effective-date',
    'terms',
    'header',
    'owner',
    'Effective date of the first published version.',
  ),
  item(
    'tu-free-at-launch',
    'terms',
    't2',
    'owner',
    'Confirm Spotter is free at launch (no payment flow in code; payments are planned in SPO-185, SPO-176).',
  ),
  item(
    'tu-health-wording',
    'terms',
    't5',
    'lawyer',
    'Mandatory consumer-law health wording for the controller country and the EU/UK/US.',
  ),
  item(
    'tu-delete-account',
    'terms',
    't10',
    'depends',
    'SPO-285: account deletion (also t13 "Ending the contract").',
  ),
  item(
    'tu-liability',
    'terms',
    't11',
    'lawyer',
    'Limitation of liability for the controller jurisdiction and target consumer laws.',
  ),
  item(
    'tu-regions',
    'terms',
    't12',
    'owner',
    'SPO-220/SPO-221: final list of unavailable regions and its sanctions basis. The texts name NO country; the draft proposed Russia, Belarus, North Korea, Iran and occupied territories of Ukraine.',
  ),
  item(
    'tu-tech-requirements',
    'terms',
    't13',
    'owner',
    'Confirm exact browser versions and device requirements from the build targets.',
  ),
  item(
    'tu-service-changes',
    'terms',
    't13',
    'lawyer',
    'Check against Art. 43p-43q of the Polish Consumer Rights Act and whether it applies to a free service.',
  ),
  item(
    'tu-complaints',
    'terms',
    't13',
    'owner',
    'Complaints email and the answer period (commonly 14 days); the texts name the postal address and no period.',
  ),
  item('tu-governing-law', 'terms', 't15', 'lawyer', 'Confirm venue wording.'),
  item(
    'tu-contact-email',
    'terms',
    't16',
    'owner',
    'Contact email (the texts name the postal address only).',
  ),
  // Trainer Terms + DPA (SPO-289): the ids are the markers {{ЮРИСТ:id}} / {{ПОТРІБНО:id}} / {{ЗАЛЕЖИТЬ:id}} in i18n/legalTrainer.*.ts
  item(
    'tt-lawyer-review',
    'trainer-terms',
    'tt1',
    'lawyer',
    'Whole Trainer Terms text is a DRAFT (SPO-289): lawyer review before any trainer sees it as final; the draft banner is removed only then.',
  ),
  item(
    'tt-roles-matrix',
    'trainer-terms',
    'tt2',
    'lawyer',
    'Final role split (controller / processor / joint) per operation: the approved matrix of SPO-289 replaces the working description.',
  ),
  item(
    'tt-no-account-person',
    'trainer-terms',
    'tt3',
    'lawyer',
    'Lawful basis and limits for data about a person without an account (an invitee); what a trainer may record before they join.',
  ),
  item(
    'tt-key-access',
    'trainer-terms',
    'tt4',
    'owner',
    'Who at Spotter can technically reach stored trainer data (server-issued keys, VAULT_MASTER) and under what controls; facts only the owner can confirm. Never claim end-to-end.',
  ),
  item(
    'tt-manager-scope',
    'trainer-terms',
    'tt6',
    'depends',
    'Final list of what a manager may do (SPO-196 roles); decision (owner, 22.10): trainers, managers and admins with coach rights accept the same Trainer Terms + DPA, in the legal gate drawer after login (the whole app is blocked until accepted); owner to confirm the manager part. Server-side enforcement of the acceptance is not needed while the whole app is gated (revisit before a public release, SPO-295 plan section 13).',
  ),
  item(
    'tt-retention',
    'trainer-terms',
    'tt8',
    'owner',
    'How long a trainer may keep records about a former client; the product sets no period today (R35 "until deletion").',
  ),
  item(
    'tt-suspension',
    'trainer-terms',
    'tt9',
    'lawyer',
    'Grounds, notice and consequences of suspending a trainer.',
  ),
  item(
    'tt-liability',
    'trainer-terms',
    'tt10',
    'lawyer',
    'Limitation of liability and indemnity between Spotter and the trainer.',
  ),
  item(
    'tt-governing-law',
    'trainer-terms',
    'tt11',
    'lawyer',
    'Governing law, venue and the change-notice wording for the Trainer Terms.',
  ),
  item(
    'dp-lawyer-review',
    'dpa',
    'dp1',
    'lawyer',
    'Whole DPA text is a DRAFT (SPO-289, GDPR Art. 28(3) checklist): lawyer review before use.',
  ),
  item(
    'dp-parties',
    'dpa',
    'dp1',
    'owner',
    'Identity of the processor (private individual today; SPO-185 business entity later) and how the trainer is identified in the agreement.',
  ),
  item(
    'dp-duration',
    'dpa',
    'dp2',
    'owner',
    'Duration and the period Spotter keeps trainer records after the account ends.',
  ),
  item(
    'dp-staff-access',
    'dpa',
    'dp5',
    'owner',
    'Who at Spotter can reach client data and the confidentiality undertakings in place.',
  ),
  item(
    'dp-security-annex',
    'dpa',
    'dp6',
    'lawyer',
    'Whether the security measures need a fuller annex (Art. 32); no claim beyond what the code confirms.',
  ),
  item(
    'dp-subprocessor-authorisation',
    'dpa',
    'dp7',
    'lawyer',
    'General or specific authorisation of sub-processors, notice of changes and the right to object.',
  ),
  item(
    'dp-google-terms',
    'dpa',
    'dp7',
    'owner',
    'Firebase DPA link, Firestore region and transfer terms (processors.md "pending").',
  ),
  item(
    'dp-recaptcha',
    'dpa',
    'dp7',
    'lawyer',
    'Legal basis for reCAPTCHA Enterprise / App Check signals (processors.md).',
  ),
  item(
    'dp-qrserver',
    'dpa',
    'dp7',
    'lawyer',
    'Legal basis and transfer terms for QR Server (api.qrserver.com): it receives the full invitation link (with the token) and the IP address; processors.md.',
  ),
  item(
    'dp-other-processors-check',
    'dpa',
    'dp7',
    'owner',
    'Confirm whether any trainer-entered client record can reach the optional services (maps, food database, Atlas AI); the text no longer claims that none does.',
  ),
  item(
    'dp-transfers',
    'dpa',
    'dp8',
    'lawyer',
    'Transfer mechanism (DPF / SCC) and TIA for each sub-processor outside the EU/EEA (D6, SPO-257).',
  ),
  item(
    'dp-dsar-assistance',
    'dpa',
    'dp9',
    'lawyer',
    'Scope and form of Spotter help with data subject requests about trainer records (SPO-252 section 4).',
  ),
  item(
    'dp-breach-period',
    'dpa',
    'dp10',
    'lawyer',
    'The period within which Spotter informs the trainer of a breach (no number is set).',
  ),
  item(
    'dp-return-format',
    'dpa',
    'dp11',
    'owner',
    'Format of returned data and the period for return or deletion after the agreement ends.',
  ),
  item('dp-audit', 'dpa', 'dp12', 'lawyer', 'Audit scope, notice, frequency and cost allocation.'),
  item(
    'dp-liability',
    'dpa',
    'dp13',
    'lawyer',
    'Liability, indemnity and governing law of the DPA.',
  ),
];

/** The uk and pl texts are machine-prepared; the canonical text is English. Each needs a lawyer / native-speaker review. */
export const TRANSLATION_REVIEW = ['uk', 'pl'] as const;
