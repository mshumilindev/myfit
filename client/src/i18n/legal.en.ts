import type { LegalTexts } from './legal.types';

/**
 * Canonical English texts of the Privacy Policy and Terms of Use, from claude/SPO-29-privacy-policy-terms-draft.md
 * (parts 1 and 2). DRAFT FOR A LAWYER (SPO-258), not for publication.
 *
 * The draft's markers ({{ПОТРІБНО}}, {{ЗАЛЕЖИТЬ}}, {{ЮРИСТ}}) are NOT rendered. Each one is a typed item in
 * `client/src/legal/pending.ts`; where the draft allows neutral wording the text says so below, and a paragraph that
 * only held a marker's value is left out until the value exists. Version and date are generated from LEGAL_VERSIONS.
 * Terms section "12a" of the draft is section 13 here, so every section has a plain number.
 */
export const legalEn: LegalTexts = {
  ui: {
    brandLabel: 'Spotter home',
    contents: 'Contents',
    save: 'Save as PDF',
    print: 'Print',
    saveHint:
      'Both buttons open your browser’s print dialog. To get a PDF, choose “Save as PDF” as the printer.',
    version: (v) => `Version ${v}`,
    updated: (d) => `Last updated ${d}`,
    legalNav: 'Legal',
    privacyLink: 'Privacy Policy',
    termsLink: 'Terms of Use',
    englishOnlyNote:
      'This document is available in English, Ukrainian and Polish. The English text is shown.',
  },
  privacy: {
    title: 'Spotter Privacy Policy',
    sections: [
      {
        id: 'p1',
        title: 'Who we are',
        body: [
          {
            p: 'The controller of your personal data is **Mykola Volodymyrovych Lukianov**, a private individual, Bukowińska 17/1005, Warsaw, Poland (“Spotter”, “we”). We have not appointed a data protection officer.',
          },
          {
            p: 'Spotter is a training app for people who work out and for personal trainers who coach them, available as a web app (myspotter.fit).',
          },
        ],
      },
      {
        id: 'p2',
        title: 'Roles: you, your trainer, and us',
        body: [
          {
            ul: [
              '**When you use Spotter on your own** (log workouts, sleep, body metrics, nutrition and so on), we decide why and how your data is processed. We are the controller.',
              '**When you work with a trainer in Spotter**, the trainer decides what they record about you for coaching (for example private notes, plans and schedules) and for what purpose. For those records the trainer is likely an independent controller, and we provide the tool.',
              '**A trainer’s team members** (for example a manager) see only what the trainer has granted and what the app allows for that role. Your trainer’s team is visible to you in the app, and actions a team member takes on your data are shown in “Who saw your data”.',
            ],
          },
        ],
      },
      {
        id: 'p3',
        title: 'What data we process, why, and on what legal basis',
        body: [
          {
            table: {
              head: ['What', 'Why', 'Legal basis (GDPR)'],
              rows: [
                [
                  '**Account:** username, first and last name, role, status, profile photo, your trainer link, a password hash, the time of creation and updates',
                  'Create and run your account; sign you in; show who is who',
                  'Contract, Art. 6(1)(b)',
                ],
                [
                  '**Training, activity and body data you enter:** workouts, sets, gyms, rest periods, activities, sleep, body metrics, goals',
                  'Provide the tracker and the calculations you ask for',
                  'Contract, Art. 6(1)(b). Where it reveals health, explicit consent, Art. 9(2)(a), see section 6',
                ],
                [
                  '**Health-related data you choose to enter:** injuries, chronic conditions, menstrual cycle, nicotine, alcohol, supplements, nutrition',
                  'Provide the features you turn on',
                  'Explicit consent, Art. 9(2)(a), given when you turn the feature on',
                ],
                [
                  '**Coaching data:** chat messages, notes shared with you, plans, schedules and reschedule requests, consent and sharing settings, access log, service notices',
                  'Let you and your trainer work together',
                  'Contract, Art. 6(1)(b); health content under your explicit consent, Art. 9(2)(a)',
                ],
                [
                  '**Team data (trainers and managers):** team membership, roles, invitations, activity log (who did what, without content)',
                  'Run a trainer’s team and show you what happened to your data',
                  'Contract; legitimate interest in accountability, Art. 6(1)(f)',
                ],
                [
                  '**Push notifications:** device token, planned reminder text, quiet hours',
                  'Send reminders and alerts you asked for',
                  'Consent through the browser or OS permission, Art. 6(1)(a)',
                ],
                [
                  '**Security data:** sign-in attempt counters (including IP address and the name you typed), device sessions and passkeys, key-fetch log',
                  'Protect accounts against guessing and abuse',
                  'Legitimate interest, Art. 6(1)(f)',
                ],
                [
                  '**Atlas AI chat (only if you turn it on):** your question and a summary of your training data',
                  'Answer free-form questions',
                  'Explicit consent, Art. 9(2)(a) where health data is included, Art. 6(1)(a) otherwise; see section 7',
                ],
                [
                  '**Technical data:** IP address and request metadata processed by our hosting and cloud providers',
                  'Deliver the service and keep it secure',
                  'Legitimate interest, Art. 6(1)(f)',
                ],
              ],
            },
          },
          {
            p: 'We do not sell your data. We do not use it for advertising. We do not take decisions about you based solely on automated processing that produce legal or similarly significant effects (Art. 22).',
          },
        ],
      },
      {
        id: 'p4',
        title: 'How your data is protected',
        body: [
          {
            ul: [
              'Data you enter (workouts, sleep, body, injuries, conditions, cycle, nicotine, alcohol, supplements, and the rest of the list in the app’s “What Spotter knows about you”) is encrypted on your device before it is written to our database, so the database contains ciphertext. The encryption key for your account is issued by our server to your signed-in device; a small set of fields that our servers need to operate (such as timestamps and some summary figures) is not encrypted, and neither is the record of the consents you gave, which shows the kind of consent (for example which health feature, or Atlas AI chat). The nutrition food log is not encrypted by Spotter either. Because the key is issued by our server, this is **encryption at rest and in transit, not end-to-end encryption against us**: someone with access to our server secrets could technically derive the key.',
              'Conversations with your trainer, shared notes, plans and schedules are encrypted with a conversation key that is wrapped for the participants’ devices. Our servers do not hold that conversation key. Key changes are tracked, and a removed team member does not receive keys for new content.',
              'Private notes your trainer keeps about you in the current notes feature are encrypted under the trainer’s own key, not ours or yours. Older trainer notes (from before that feature) are stored on our servers in readable form.',
              'Access to the database is limited by rules and by our cloud functions; privileged actions go through functions only.',
              'When you sign out, the account’s data is removed from the device.',
            ],
          },
          {
            p: 'No system is perfectly secure. If a breach affects your rights, we will notify you and the supervisory authority as required by law.',
          },
        ],
      },
      {
        id: 'p5',
        title: 'Who receives your data',
        body: [
          {
            ul: [
              '**Your trainer and their team**, within what you share and what their role allows. You control sharing for health categories in Privacy and sharing and can revoke it.',
              '**Google (Firebase / Google Cloud)** as our processor: authentication, database, cloud functions (region us-central1), file storage, hosting, push delivery and app attestation (App Check with reCAPTCHA Enterprise). Google acts as a processor under the Firebase Data Processing and Security Terms; international transfers rely on the mechanisms in those terms (adequacy decisions, the EU-US Data Privacy Framework, or Standard Contractual Clauses). Firebase Authentication is processed in the United States.',
              '**Atlas AI providers (only if you turn Atlas AI on):** Google (Gemini via Firebase AI Logic) and, if you allow it, Puter (puter.com) through your own Puter account. See section 7.',
              '**Place and map services** when you search for a gym or open a route: your search text and, if you allow location, your approximate or precise position and your IP address go to the map and place-search services the app uses (OpenStreetMap-based services: Photon, Overpass, Nominatim and OSRM, plus map tiles from OpenStreetMap), and gym logos and photos from Wikidata and Wikimedia Commons; the map library is loaded from unpkg. These services see your IP address. They are used only after you consent to gym search and maps, which you can withdraw at any time. Google Places and Foursquare are not used.',
              '**Invitation QR code:** when an administrator or trainer shows an invitation as a QR code, the invitation link (which contains the invitation token) and their IP address are sent to the QR image service api.qrserver.com (QR Server), which draws the code.',
              '**Open Food Facts** when you search products or scan barcodes in Nutrition: your browser sends the search or barcode to their service, and they see your IP address.',
              '**Authorities and advisers** where required by law or to protect legal rights.',
            ],
          },
          {
            p: 'If you invite someone to Spotter, your profile photo may be shown to the invited person before they sign up.',
          },
        ],
      },
      {
        id: 'p6',
        title: 'Health data and consent',
        body: [
          {
            p: 'Some data you enter reveals your health. Seven features handle it: injuries, long-term conditions, cycle, nicotine, alcohol, supplements and nutrition. Each asks for your explicit consent before first use and stays off without it; the consent is recorded with the version of its text. You can withdraw it at any time in Settings > Your privacy > Consents; withdrawal does not affect processing before it. Safety limits already saved from injuries, long-term conditions and pregnancy keep applying as restrictions on training, streak protection and the Cycle after you turn the feature off; they are never shown, shared or sent anywhere, and deleting the entries removes them. Turning off Injuries or Nutrition also switches the matching trainer-sharing category off. Sleep and body metrics have no separate consent step. Using Spotter does not require consent for features you do not use.',
          },
        ],
      },
      {
        id: 'p7',
        title: 'Atlas AI chat',
        body: [
          {
            p: 'Atlas answers from its own built-in library when it can, without sending anything outside your device. **If you turn on “Atlas AI chat”, Atlas sends your question and a training summary to an AI provider to word an answer.**',
          },
          {
            ul: [
              '**What is sent (all together, you cannot pick parts):** your question and the last messages of the chat; recent workouts (dates, exercises, sets, reps, weights) and your history for each exercise; your plan; your notes and what you told Atlas; other activities; injured muscles; training effects of long-term conditions (de-identified: never a name, area or note); last night’s sleep hours; body weight; today’s date, the weekday and your role. Your name, email, birth date and photos are not sent.',
              '**To whom:** Google (Gemini API, free tier). On the free tier Google may use what you send to improve its products, and people may read it. If you separately allow it, and Google’s daily free limit is used up, Puter, through **your own Puter account** (its own consent).',
              '**Conditions:** the request goes from your device to the provider; our servers do not see its content. Providers’ own terms apply to what they do with it.',
              '**Your choices:** Atlas AI chat is off until you turn it on. You are asked each time you turn it on, all or nothing, and you can turn it off in one tap (Atlas settings or Your privacy > Consents); nothing more is sent after that, and you can clear the chat history. The history (the last 100 messages) is kept on your device only. A reply written by the AI model is marked “AI reply”. Answers are not medical advice.',
            ],
          },
        ],
      },
      {
        id: 'p8',
        title: 'How long we keep data',
        body: [
          {
            ul: [
              '**Account and the data you enter:** until you delete it or your account.',
              '**Coaching records:** your trainer’s private notes about you are the trainer’s records and follow the trainer’s retention.',
              '**“Who saw your data” log:** 400 days. **Team activity log:** 90 days. **Reminder log entries:** 30 days.',
              '**Records of your consents** (what you agreed to, which version, when): until you delete your account.',
              '**Technical records without an automatic expiry:** sign-in attempt counters, the key-fetch log, push tokens, planned and dismissed reminders and service notices have no automatic expiry in the app today, and we have not yet set retention periods for them.',
              '**Backups and Google’s deletion:** after you delete data, Google completes deletion from its systems within the period stated in the Firebase terms (up to 180 days unless law requires storage).',
              'Legal obligations may require us to keep specific records longer; we will tell you which when that happens.',
            ],
          },
        ],
      },
      {
        id: 'p9',
        title: 'Your rights',
        body: [
          {
            p: 'You have the right to: be informed; **access** your data and get a copy; **rectify**; **erase**; **restrict** processing; **object** to processing based on legitimate interests; **portability** of data you provided, in a structured, commonly used, machine-readable format; **withdraw consent** at any time. How to use them:',
          },
          {
            ul: [
              'In the app: **What Spotter knows about you** (see what the app holds, download a copy as a ZIP with JSON and CSV, delete by category, delete the account), **Privacy and sharing** (revoke trainer access), **Atlas AI** (turn off).',
              '**The copy** is built on your device from what the app can read and decrypt there. Data held only on our servers (for example profile details such as name and photo, sign-in attempts, passkeys and device sessions, the key-fetch log, service notices), conversations, plans and schedules not loaded on the device, and your trainer’s private records are not in it; the copy lists them in its contents file, and you can ask us for them in writing.',
              '**Deleting your account** (in the app, after you enter your password) removes your profile, the data you entered, your coaching relationships, passkeys, sign-in counters, profile photo, username and password hash, and then your sign-in account. Entries that other people hold about you stay with them: access and sharing log entries in their records, service notices they received, and up to 90 days of activity entries of a team you belonged to. Backups follow section 8.',
              'By writing to us at the address in section 14. We answer within one month; if a request is complex or numerous we may extend by up to two further months and tell you why. We may ask you to sign in again to confirm it is you; we will not ask for identity documents if you are already signed in.',
              '**Your trainer’s records about you:** you can ask your trainer for access in the app; the trainer answers for those records.',
              '**Complaint:** you can complain to the supervisory authority of your country of residence or work, or of the country of the controller: **the President of the Personal Data Protection Office (UODO), Poland**.',
            ],
          },
        ],
      },
      {
        id: 'p10',
        title: 'Children',
        body: [
          {
            p: 'Spotter is for people aged **18 and over**. We do not knowingly process data of younger children. If you believe a child has an account, write to us and we will delete it.',
          },
        ],
      },
      {
        id: 'p11',
        title: 'Local storage and similar technologies',
        body: [
          {
            p: 'Spotter stores settings, an offline cache and a cached copy of your encryption key (not extractable) in your browser or app (local storage and IndexedDB). They are needed to make the app work offline and keep you signed in; they are removed when you sign out. Spotter sets no cookies of its own and uses no advertising cookies. Fonts are served from our own host, not from Google. Google reCAPTCHA Enterprise (App Check) runs when the app loads and when it talks to Firebase to tell people from bots; it reads signals from your browser or device, may set its own cookies, and Google sees your IP address.',
          },
        ],
      },
      {
        id: 'p12',
        title: 'International transfers',
        body: [
          {
            p: 'Your data is processed in the United States and other countries where Google operates, on the mechanisms described in section 5.',
          },
        ],
      },
      {
        id: 'p13',
        title: 'Changes to this policy',
        body: [
          {
            p: 'We version this policy. Material changes are announced in the app before they take effect; the version and date are shown at the top and in Settings. The earlier versions are available on request.',
          },
        ],
      },
      {
        id: 'p14',
        title: 'Contact',
        body: [{ p: 'Bukowińska 17/1005, Warsaw, Poland' }],
      },
    ],
  },
  terms: {
    title: 'Spotter Terms of Use',
    sections: [
      {
        id: 't1',
        title: 'Who these terms are with',
        body: [
          {
            p: 'These terms are between you and **Mykola Volodymyrovych Lukianov**, Bukowińska 17/1005, Warsaw, Poland (“Spotter”, “we”). By creating an account you agree to these terms and acknowledge that you have been provided with our Privacy Policy. If you do not agree, do not use Spotter. The Privacy Policy explains how we process data; it is not a contract term and is not a general consent to processing. Where the law requires your consent (for example for health data or AI processing), we ask for it separately.',
          },
        ],
      },
      {
        id: 't2',
        title: 'The service',
        body: [
          {
            p: 'Spotter is a training tracker and coaching app. Features may be changed, added or removed only for the reasons in sections 10 and 13, and we will tell you about changes in the way described there. Some features need an internet connection; the app is designed to work offline with later sync. If paid features are introduced we will tell you before you are charged and these terms will be updated.',
          },
        ],
      },
      {
        id: 't3',
        title: 'Who may use it',
        body: [
          {
            p: 'You must be at least 18 years old, have legal capacity to enter this agreement, and not be located in a country or region where the service is unavailable (see section 12). You are responsible for what happens under your account; keep your password and devices secure and tell us if you suspect misuse.',
          },
        ],
      },
      {
        id: 't4',
        title: 'Accounts and trainers',
        body: [
          {
            ul: [
              'An account is personal. Do not share it. Trainers and their team members use their own accounts.',
              '**Trainers are independent.** A trainer you work with is not our employee or agent. Any coaching agreement is between you and the trainer. We provide the tool and are not responsible for their advice, fees, conduct or qualifications.',
              'You decide what you share with a trainer in the app. The trainer’s team members get only the access the app grants for their role.',
            ],
          },
        ],
      },
      {
        id: 't5',
        title: 'Health and safety',
        body: [
          {
            p: 'Spotter, including Atlas, gives general fitness information, **not medical advice**, and does not diagnose, treat or prevent any condition. Exercise carries risk. Consult a qualified professional before starting or changing a programme, especially if you have an injury, illness, are pregnant, or take medication. Stop if you feel pain, dizziness or unwell. Atlas replies, including AI-assisted replies, can be wrong; use your judgement.',
          },
        ],
      },
      {
        id: 't6',
        title: 'Your content',
        body: [
          {
            p: 'You keep ownership of what you enter. You give us a limited licence to store, process and display it only as needed to run the service for you and the people you choose to share with. You are responsible for your content and must have the right to enter it (for example, do not enter someone else’s private data without permission).',
          },
        ],
      },
      {
        id: 't7',
        title: 'Acceptable use',
        body: [
          {
            p: 'Do not: break the law; harass or impersonate others; upload malware or abuse the service’s resources; try to access other accounts or data, probe, scrape or reverse engineer the service beyond what the law allows; circumvent security, rate limits or regional restrictions; use the service to give unlicensed medical treatment. We may suspend or end accounts that break these terms, and will explain why unless law prevents us.',
          },
        ],
      },
      {
        id: 't8',
        title: 'Third-party services and AI',
        body: [
          {
            p: 'Some features use third parties (see the Privacy Policy). Atlas AI chat is optional and works only after you consent each time you turn it on. AI answers are generated by a third-party model and are not guaranteed to be accurate.',
          },
        ],
      },
      {
        id: 't9',
        title: 'Our intellectual property',
        body: [
          {
            p: 'Spotter’s software, design, text, exercise catalogue and brand belong to us or our licensors. You may use them to use the service for yourself; no other rights are granted. Third-party open-source components stay under their licences.',
          },
        ],
      },
      {
        id: 't10',
        title: 'Availability, changes and termination',
        body: [
          {
            p: 'We aim to keep Spotter available but do not promise uninterrupted service. We may change or discontinue features; where a change significantly reduces what you paid for or relied on, we will give reasonable notice. You can stop using Spotter and delete your account in the app at any time; we delete your data as described in the Privacy Policy. We may end the service for you if you materially breach these terms or if the law requires; we will tell you and, where possible, let you export your data first.',
          },
        ],
      },
      {
        id: 't11',
        title: 'Disclaimers and liability',
        body: [
          {
            p: 'The service is provided “as is” to the extent the law allows. We are not liable for indirect or consequential loss, injury or damage resulting from your exercise or training choices, or for the acts of trainers. **Nothing in these terms limits liability that cannot be limited by law (including for death or personal injury caused by negligence, fraud or wilful misconduct) or your rights as a consumer under mandatory law.**',
          },
        ],
      },
      {
        id: 't12',
        title: 'Availability by region',
        body: [
          {
            p: 'Spotter is not offered in every country or region. We may restrict access by network location. By using Spotter you confirm you are not located in a place where the service is unavailable. Attempts to bypass the restriction are a breach of these terms.',
          },
        ],
      },
      {
        id: 't13',
        title: 'Technical requirements, contract formation, complaints',
        body: [
          {
            ul: [
              '**Technical requirements:** a current browser with JavaScript, local storage and IndexedDB enabled, and an internet connection for sign-in and sync.',
              '**Making the contract:** the contract is made when you complete registration and confirm you agree to these terms. You can read these terms before registering and download or save them at any time.',
              '**Ending the contract:** you can delete your account at any time. We may end it only on the grounds and with the notice in section 10.',
              '**Changes to the service:** we may change a feature for a valid reason stated here (security, legal requirement, fixing a defect, a third-party service we depend on changing or ending, improving the service without making it worse for you). We tell you clearly and in advance; if a change significantly and negatively affects your use, you may end the contract within 30 days, and we will not charge you for that.',
              '**Complaints:** write to us at the address in section 16. We acknowledge the complaint and answer in the language of the service you use, stating the decision and reasons.',
              '**Unlawful content:** you must not upload content that is unlawful (see section 7).',
            ],
          },
        ],
      },
      {
        id: 't14',
        title: 'Changes to the terms',
        body: [
          {
            p: 'We may update these terms. Material changes are announced in the app with the new version and date before they take effect; if you do not agree, you can stop using Spotter and delete your account. Continued use after the effective date means acceptance.',
          },
        ],
      },
      {
        id: 't15',
        title: 'Governing law and disputes',
        body: [
          {
            p: 'These terms are governed by **Polish law**, without depriving you of the mandatory consumer protections of your country of residence. Courts: **the competent courts of Poland**; consumers may also use the courts of their residence where the law gives that right.',
          },
        ],
      },
      {
        id: 't16',
        title: 'Contact',
        body: [{ p: 'Bukowińska 17/1005, Warsaw, Poland' }],
      },
    ],
  },
};
