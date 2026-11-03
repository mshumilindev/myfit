import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { currentUid, getRole } from '../api';
import { db } from '../firebase';
import { CallLayer } from './CallLayer';
import { CallSession } from './callSession';
import { browserCallDevices, firebaseCallApi, firebaseCallWire } from './callsFirebase';
import { loopbackPorts } from './callsLoopback';
import { callLogFor } from './callLog';
import { readCallPrefs } from './callPrefs';
import { publishCalls, queueCallLog, useCallsPublished } from './callsStore';

/**
 * The one place the call code runs (SPO-445): mounted lazily at the app root once someone is signed in. It watches the
 * server switch (`config/flags.calls`), starts listening for incoming calls and publishes the session for the call
 * buttons. Managers never get calls (the server refuses them too).
 */
export default function CallsHost() {
  const uid = currentUid();
  const role = getRole();
  const allowed = !!uid && role !== 'manager';
  // E2E only (SPO-434): the fixtures build, when the test exposed its in-process server. Constant `null` in every other build.
  const lb = import.meta.env.VITE_COACH_BACKEND === 'fixtures' ? loopbackPorts() : null;
  const [flag, setFlag] = useState(false);
  const { session } = useCallsPublished();

  useEffect(() => {
    if (!allowed) return;
    if (lb && uid) return lb.watchFlag(uid, setFlag);
    return onSnapshot(
      doc(db, 'config', 'flags'),
      (s) => setFlag(s.data()?.calls === true),
      () => setFlag(false),
    );
  }, [allowed, lb, uid]);

  useEffect(() => {
    if (!allowed || !flag || !uid) return;
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
  }, [allowed, flag, uid, lb]);

  return session ? <CallLayer session={session} /> : null;
}
