import type { LegalTrainerTexts } from './legalTrainer.types';

/**
 * DRAFT texts of the Trainer Terms and the Data Processing Agreement (DPA, GDPR Art. 28 style), SPO-289.
 * NOT REVIEWED BY A LAWYER and NOT for publication (SPO-258). Canonical language: English.
 *
 * Every unresolved fact is a visible marker `{{ЮРИСТ:id}}` (a question for the lawyer), `{{ПОТРІБНО:id}}` (a fact only the
 * owner can give) or `{{ЗАЛЕЖИТЬ:id}}` (depends on something the app does not do yet). Each marker id is one entry in
 * `client/src/legal/pending.ts` (release blocker); `legalTrainer.test.ts` keeps the two lists equal. No number is invented:
 * periods, amounts and terms are markers. The documents describe what the code does today (checked against
 * docs/compliance/data-registry.md and processors.md); the Privacy Policy (legal.en.ts) stays the source for the roles of
 * a person using Spotter on their own.
 */
export const legalTrainerEn: LegalTrainerTexts = {
  draftNote:
    'DRAFT. This text has not been reviewed by a lawyer and is not final. Items in double braces are open and must be resolved before release.',
  trainerTerms: {
    title: 'Spotter Trainer Terms (DRAFT)',
    sections: [
      {
        id: 'tt1',
        title: 'What these terms are',
        body: [
          {
            p: 'These Trainer Terms apply to you when you use Spotter’s coaching features as a trainer, an administrator or a team manager. They add to the Spotter Terms of Use and to the Privacy Policy. The Data Processing Agreement (DPA) is a separate document that you also accept; it covers client data that Spotter handles on your behalf.',
          },
          {
            p: 'You must be 18 or older and you must use Spotter for coaching in a lawful, professional way. If you coach people for business, you confirm that you are entitled to do so where you work.',
          },
        ],
      },
      {
        id: 'tt2',
        title: 'Roles: you, your client and Spotter',
        body: [
          {
            ul: [
              '**Your client’s own data** (workouts, sleep, body metrics, nutrition and so on) belongs to the client. Spotter is the controller of that data, as the Privacy Policy explains. You see it only in the categories the client has shared with you.',
              '**What you record about a client** for coaching (private notes, decisions, plans, schedules, messages) is decided by you: what to record, why and for how long. For your private notes you are likely an independent controller. You are responsible for the lawfulness of that processing.',
              '**Spotter provides the tool.** For client data that you enter into Spotter, Spotter acts as your processor under the DPA.',
              '**This split is a working description, not a final legal assessment.** {{ЮРИСТ:tt-roles-matrix}}',
            ],
          },
        ],
      },
      {
        id: 'tt3',
        title: 'Lawful basis and your client’s agreement',
        body: [
          {
            p: 'Before you record personal data about a client you need a lawful basis, and for health information an explicit consent or another valid ground. You are responsible for informing your clients about what you record and why.',
          },
          {
            p: 'In Spotter a client decides what you can see: sharing starts only when the client accepts it on their Sharing page, covers only the categories they choose, and can be switched off at any time. Spotter shows the client who saw their data. You must not try to get around these limits.',
          },
          {
            p: 'About a person who does not have a Spotter account yet (for example someone you invite): record only what is needed for the invitation. {{ЮРИСТ:tt-no-account-person}}',
          },
        ],
      },
      {
        id: 'tt4',
        title: 'Your private notes and decisions',
        body: [
          {
            p: 'Private notes and decisions about a client are stored in encrypted form and are visible only to you. The client cannot read them in Spotter. A client who asks you for a copy of your records is asking you, because you are responsible for them.',
          },
          {
            p: 'The keys for stored data are issued by Spotter’s server. This is encryption of stored data, not end-to-end encryption. {{ПОТРІБНО:tt-key-access}}',
          },
          {
            p: '**Older notes.** Notes written in an earlier version of Spotter (legacy trainer notes) are stored separately and are not confirmed to be encrypted. Treat them as readable by Spotter’s systems and by the client they are about, who can read them in their own account.',
          },
        ],
      },
      {
        id: 'tt5',
        title: 'Client data you access through sharing',
        body: [
          {
            ul: [
              'You get access to a client’s data through the sharing the client granted (a key grant for the categories they chose). Without it you see nothing; the app shows that access is missing, not an empty page.',
              'Health information is shared only when the client has agreed to that category. Use it only for coaching that client.',
              'When you open a client’s screen, a log entry is kept per category that the client can see (“Who saw your data”). Some reads made by server functions are logged as well; reading the client roster or an assignment is not logged.',
              'You must not copy client data out of Spotter, publish it or use it for another purpose such as marketing.',
            ],
          },
        ],
      },
      {
        id: 'tt6',
        title: 'Your team and managers',
        body: [
          {
            p: 'A trainer can add team members, for example a manager. A manager works on the trainer’s behalf and sees only what the trainer has delegated and what the app allows for that role (the schedule, the client list and the team). Your clients can see who is on your team.',
          },
          {
            p: 'You are responsible for the people you add: choose them with care, remove them when they no longer need access, and make sure they follow these terms. A manager who uses the coaching features accepts these Trainer Terms and the DPA too. {{ЗАЛЕЖИТЬ:tt-manager-scope}}',
          },
        ],
      },
      {
        id: 'tt7',
        title: 'Confidentiality and security',
        body: [
          {
            ul: [
              'Keep what you learn about clients confidential, also after the coaching ends.',
              'Protect your account: do not share your sign-in, use a device you control and sign out on shared devices.',
              'Tell Spotter without delay if you suspect that an account, a device or client data has been exposed. See the DPA for the notification steps.',
            ],
          },
        ],
      },
      {
        id: 'tt8',
        title: 'When the coaching ends',
        body: [
          {
            p: 'When a client stops sharing, ends the link or deletes their account, your access to their data ends. The client keeps their own history, and your access to it is never needed for that. You decide what happens to your own records about the client (private notes, decisions, plans you wrote): export or delete them, and do not keep them longer than you need. {{ПОТРІБНО:tt-retention}}',
          },
          {
            p: 'A client loses access to your private notes when the link ends, because they never had access to them in Spotter.',
          },
        ],
      },
      {
        id: 'tt9',
        title: 'Suspension',
        body: [
          {
            p: 'Spotter can suspend a trainer account, for example for a breach of these terms or of the law, or to protect clients. Suspending a trainer never removes a client’s own history. {{ЮРИСТ:tt-suspension}}',
          },
        ],
      },
      {
        id: 'tt10',
        title: 'Liability',
        body: [{ p: '{{ЮРИСТ:tt-liability}}' }],
      },
      {
        id: 'tt11',
        title: 'Changes and governing law',
        body: [
          {
            p: 'When these terms change in a way that matters, you are asked to read and accept the new version before you continue with client features. {{ЮРИСТ:tt-governing-law}}',
          },
        ],
      },
    ],
  },
  dpa: {
    title: 'Spotter Data Processing Agreement (DRAFT)',
    sections: [
      {
        id: 'dp1',
        title: 'Parties and scope',
        body: [
          {
            p: 'This agreement is between you, the trainer (the controller of the client records you decide on), and Spotter, the operator named in the Privacy Policy (the processor). It applies to personal data about your clients that you enter into or create in Spotter for coaching, and it forms part of the Trainer Terms. {{ПОТРІБНО:dp-parties}}',
          },
          {
            p: 'It does not cover data a person enters about themselves when using Spotter on their own: for that, Spotter is the controller (see the Privacy Policy).',
          },
        ],
      },
      {
        id: 'dp2',
        title: 'Subject matter and duration',
        body: [
          {
            p: 'Spotter stores and transmits the client data you enter so that you can coach your clients with the app. The agreement lasts as long as your trainer account exists and as long as Spotter holds your client records after that, until they are deleted or returned. {{ПОТРІБНО:dp-duration}}',
          },
        ],
      },
      {
        id: 'dp3',
        title: 'Nature, purpose, data and people concerned',
        body: [
          {
            table: {
              head: ['Data', 'People', 'Purpose'],
              rows: [
                [
                  'Private notes and decisions about a client (encrypted)',
                  'Your clients',
                  'Coaching records',
                ],
                [
                  'Plans, schedules, live sessions and chat messages with a client',
                  'Your clients',
                  'Delivering the coaching',
                ],
                [
                  'Team membership, delegations and the team activity log',
                  'You and your team members',
                  'Running a team',
                ],
                [
                  'Client data you read through sharing (categories the client chose, including health information if the client agreed)',
                  'Your clients',
                  'Coaching that client',
                ],
              ],
            },
          },
          {
            p: 'Processing consists of storing, encrypting, transmitting, showing and deleting this data.',
          },
        ],
      },
      {
        id: 'dp4',
        title: 'Your instructions',
        body: [
          {
            p: 'Spotter processes this data only on your documented instructions: your use of the app and the settings you choose are your instructions, and so are the Trainer Terms and this DPA. If Spotter believes an instruction breaks data protection law, it tells you. Spotter may also process the data where the law requires it, and tells you first unless the law forbids that.',
          },
        ],
      },
      {
        id: 'dp5',
        title: 'Confidentiality',
        body: [
          {
            p: 'People at Spotter who can reach this data are bound to confidentiality and may use it only to run the service for you. {{ПОТРІБНО:dp-staff-access}}',
          },
        ],
      },
      {
        id: 'dp6',
        title: 'Security measures',
        body: [
          {
            ul: [
              'Data that users enter is stored encrypted. The keys are issued by Spotter’s server, so this is encryption of stored data, not end-to-end encryption.',
              'Access to a client’s data is enforced by the database rules and by server functions, not only in the screen: sealed client data is readable only through the client’s sharing grant; the older server-side reads are checked on the server (access to the profile and the client’s consent for sets); the client roster is read through your trainer link.',
              'Sign-in uses accounts with passkey support. Opening a client’s screen is logged per category for the client to see; some server-side reads are logged, roster and assignment reads are not.',
              'Spotter reviews these measures as the product changes. {{ЮРИСТ:dp-security-annex}}',
            ],
          },
        ],
      },
      {
        id: 'dp7',
        title: 'Sub-processors',
        body: [
          {
            p: 'You allow Spotter to use the sub-processors below. The list follows Spotter’s register of processors and is updated when it changes. {{ЮРИСТ:dp-subprocessor-authorisation}}',
          },
          {
            table: {
              head: ['Sub-processor', 'What it handles', 'Status'],
              rows: [
                [
                  'Google (Firebase: Authentication, Firestore, Cloud Functions, Storage, Hosting, messaging)',
                  'All data stored on the server, including client records, and technical data of requests',
                  'Terms and region to be confirmed {{ПОТРІБНО:dp-google-terms}}',
                ],
                [
                  'Google (reCAPTCHA Enterprise / App Check)',
                  'Browser and device signals to tell people from bots, IP address',
                  'Legal basis to be confirmed {{ЮРИСТ:dp-recaptcha}}',
                ],
                [
                  'QR Server (api.qrserver.com)',
                  'Draws the QR code of an invitation: it receives the full invitation link, which contains the invitation token, and the IP address of the browser',
                  'Legal basis to be confirmed {{ЮРИСТ:dp-qrserver}}',
                ],
              ],
            },
          },
          {
            p: 'Other services listed in the register (maps, food database, Atlas AI) are used only when a person turns them on for their own use. What each of them receives is described in the register; whether a client record you enter can reach any of them is still being checked. {{ПОТРІБНО:dp-other-processors-check}}',
          },
        ],
      },
      {
        id: 'dp8',
        title: 'Transfers outside the EU/EEA',
        body: [
          {
            p: 'Some sub-processors may process data outside the EU/EEA. The transfer mechanism (adequacy decision, standard contractual clauses) and the assessment are not yet documented. {{ЮРИСТ:dp-transfers}}',
          },
        ],
      },
      {
        id: 'dp9',
        title: 'Helping with the rights of people',
        body: [
          {
            p: 'Spotter gives clients their own data and lets them stop sharing. A request about your private records goes to you, because Spotter cannot hand them over in readable form on the client’s behalf. Spotter helps you with such requests to the extent the product allows, and passes on requests it receives that concern your records. {{ЮРИСТ:dp-dsar-assistance}}',
          },
        ],
      },
      {
        id: 'dp10',
        title: 'Personal data breaches',
        body: [
          {
            p: 'Spotter tells you without undue delay after it becomes aware of a breach that concerns your client data, with what it knows about the breach, its likely effects and what is being done. You decide whether to inform your supervisory authority and the people concerned, and Spotter helps you with the facts you need. The period within which Spotter informs you is not set yet. {{ЮРИСТ:dp-breach-period}}',
          },
        ],
      },
      {
        id: 'dp11',
        title: 'Deletion and return',
        body: [
          {
            p: 'When the agreement ends, or earlier at your request, Spotter deletes your client records or returns them to you, as you choose, unless the law requires them to be kept. Deleting your account removes your trainer records. The format and the period for returning data are not set yet. {{ПОТРІБНО:dp-return-format}}',
          },
        ],
      },
      {
        id: 'dp12',
        title: 'Audit',
        body: [
          {
            p: 'Spotter gives you the information needed to show that it meets this agreement and allows audits, within reasonable limits. {{ЮРИСТ:dp-audit}}',
          },
        ],
      },
      {
        id: 'dp13',
        title: 'Liability and governing law',
        body: [{ p: '{{ЮРИСТ:dp-liability}}' }],
      },
    ],
  },
};
