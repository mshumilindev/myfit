import { useEffect } from 'react';
import { currentUid, getRole } from '../api';
import { CallLayer } from './CallLayer';
import { CallSession } from './callSession';
import { browserCallDevices, firebaseCallApi, firebaseCallWire } from './callsFirebase';
import { loopbackPorts } from './callsLoopback';
import { callLogFor } from './callLog';
import { readCallPrefs } from './callPrefs';
import { publishCalls, queueCallLog, useCallsPublished } from './callsStore';

/**
 * The one place the call code runs (SPO-445): mounted lazily at the app root once someone is signed in. It starts
 * listening for incoming calls and publishes the session for the call buttons. Managers never get calls (the server
 * refuses them too). There is no feature flag: calls are always on.
 */
export default function CallsHost() {
  const uid = currentUid();
  const role = getRole();
  const allowed = !!uid && role !== 'manager';
  // E2E only (SPO-434): the fixtures build, when the test exposed its in-process server. Constant `null` in every other build.
  const lb = import.meta.env.VITE_COACH_BACKEND === 'fixtures' ? loopbackPorts() : null;
  const { session } = useCallsPublished();

  useEffect(() => {
    if (!allowed || !uid) return;
    const sess = new CallSession({
      uid,
      api: lb?.api ?? firebaseCallApi,
      wire: lb?.wire ?? firebaseCallWire,
      devices: lb?.devices ?? browserCallDevices,
      preferRelay: () => !readCallPrefs().direct,
    });
    sess.listen();
    const offLog = sess.subscribe(() => {
      const st = sess.getState();
      const entry = callLogFor(st);
      if (entry && st.peerId && st.callId) {
        queueCallLog({ peerId: st.peerId, callId: st.callId, entry });
      }
    });
    publishCalls({ session: sess, enabled: true });
    return () => {
      offLog();
      publishCalls({ session: null, enabled: false });
      sess.dispose();
    };
  }, [allowed, uid, lb]);

  return session ? <CallLayer session={session} /> : null;
}
