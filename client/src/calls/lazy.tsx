import { lazy } from 'react';

/** The call code (WebRTC session, UI layer) loads only after sign-in, as its own chunk: the app shell stays free of it. */
export const CallsHostLazy = lazy(() => import('./CallsHost'));
