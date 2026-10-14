import type { InviteLabels } from '../../../components/ui/InvitePanel';
import type { RosterStrings } from '../../../i18n/coachRoster';
import { CATEGORIES } from '../../domain/types';

export function inviteLabels(r: RosterStrings, hero = false): InviteLabels {
  return {
    title: hero ? r.roEmptyH : r.ivTitle,
    intro: hero ? r.roEmptyIntro : undefined,
    modeGroup: r.ivModeGroup,
    modes: {
      app: { label: r.ivApp, hint: r.ivHintApp, submit: r.ivSubmitApp },
      hybrid: { label: r.ivHybrid, hint: r.ivHintHybrid, submit: r.ivSubmitHybrid },
      program: { label: r.ivProgram, hint: r.ivHintProgram, submit: r.ivSubmitProgram },
    },
    nameLabel: r.ivName,
    namePlaceholder: r.ivNamePlaceholder,
    nameNeeded: r.ivNameNeeded,
    nameTooShort: r.ivNameShort,
    consentToggleShow: r.ivConsentShow,
    consentToggleHide: r.ivConsentHide,
    consentLegend: r.ivConsentLegend,
    consentNote: r.ivConsentNote,
    levels: r.c3Level,
    categories: CATEGORIES.map((c) => ({ id: c, label: r.c3Cat[c].label, what: r.c3Cat[c].what })),
    sending: r.ivSending,
    errorOffline: r.ivErrorOffline,
    errorFailed: r.ivErrorFailed,
    sent: { app: r.ivSentApp, hybrid: r.ivSentHybrid, program: r.ivSentProgram },
    linkLabel: r.ivLink,
    copy: r.ivCopy,
    copied: r.ivCopied,
    share: r.ivShare,
    sendInChat: r.ivSendInChat,
    expires: r.ivExpires,
    another: r.ivAnother,
    openProfile: r.ivOpenProfile,
  };
}
