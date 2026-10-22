/**
 * Gym-search consent (SPO-293, G13). Mounted once, next to the app (main.tsx), like the legal gate.
 *  - Keeps `data/geoSearchGate` in step with the person's records: on = `optionalConsentOn(records, 'geo-search')`.
 *    Until the records are known it is off (fail closed): nothing is sent.
 *  - Renders the consent prompt when something calls `openGeoPrompt()`. "Search with these services" records the grant
 *    (the engines are the services the code really calls); "Not now" and dismissing record nothing.
 */
import { useEffect, useState } from 'react';
import { ConsentPrompt } from '../components/ui/ConsentPrompt';
import { Notice } from '../components/ui/Notice';
import {
  closeGeoPrompt,
  GEO_ENGINES,
  setGeoOverride,
  setGeoSearchState,
} from '../data/geoSearchGate';
import { useT } from '../i18n';
import { useGeoT } from '../i18n/geoConsent';
import { currentUid } from '../api';
import { grantConsent, useConsentRecords } from './consentApi';
import { consentState, currentVersion, optionalConsentOn } from './consents';
import { clearLocalOff, localOffKinds } from './localOff';
import { prepareDirectGrant } from './signupConsents';
import { useGeoPromptOpen } from './useGeoSearch';

function GeoConsentSync() {
  const { records, confirmed } = useConsentRecords();
  useEffect(() => {
    // A withdrawal made on this device that the server may not have yet (kept across a reload) keeps it off.
    if (localOffKinds(currentUid()).includes('geo-search')) setGeoOverride(false);
    setGeoSearchState({
      on: optionalConsentOn(records, 'geo-search'),
      ready: confirmed || records.length > 0,
      answered: consentState(records, 'geo-search') !== 'none',
      confirmed,
    });
  }, [records, confirmed]);
  return null;
}

function GeoConsentPrompt() {
  const { t } = useT();
  const g = useGeoT();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function accept() {
    setBusy(true);
    setFailed(false);
    try {
      const commit = await prepareDirectGrant('geo-search');
      await grantConsent({ kind: 'geo-search', engines: [...GEO_ENGINES] });
      commit(); // only now may an unsent withdrawal of this kind be dropped
      clearLocalOff(currentUid(), 'geo-search');
      setGeoOverride(true); // a stop left over from an unsent withdrawal must not outlive this newer grant
      closeGeoPrompt();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsentPrompt
      icon="map-pin"
      title={g.title}
      lead={g.lead}
      factsLabel={g.factsLabel}
      facts={[
        { icon: 'map-pin', label: g.sentLabel, sub: g.sent },
        { icon: 'shield-warning', label: g.whoLabel, sub: g.who, tone: 'injury' },
        { icon: 'lock-simple', label: g.withoutLabel, sub: g.without },
      ]}
      primary={g.primary}
      secondary={g.secondary}
      closeLabel={t.close}
      primaryDisabled={busy}
      before={
        failed ? (
          <Notice tone="danger" icon="info">
            {g.saveError}
          </Notice>
        ) : undefined
      }
      foot={
        <>
          <a href="/privacy" target="_blank" rel="noreferrer">
            {g.privacy}
          </a>
          {` · ${g.version(currentVersion('geo-search'))}`}
        </>
      }
      onPrimary={() => void accept()}
      onSecondary={() => closeGeoPrompt(true)}
    />
  );
}

export function GeoConsentHost() {
  const open = useGeoPromptOpen();
  return (
    <>
      <GeoConsentSync />
      {open && <GeoConsentPrompt />}
    </>
  );
}
