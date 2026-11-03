/**
 * Calls strings (SPO-441 / SPO-445): voice and video calls between a coach and a client. Own dictionary like
 * coachChat; read through `useCallsT()` in `calls.ts`. Every key is mirrored in uk / pl / lt / et (enforced by
 * `typeof callsEn`). Copy never claims "end-to-end" or hides what is sent; "Not recorded" is the only trust line.
 * Unavailability reasons are neutral: they never reveal a schedule. Names are inserted as-is (no declension), so
 * every template puts the name in the nominative or after a colon. Push texts live on the server.
 */
export const callsEn = {
  // Entry points (CallActions, roster, chat header)
  callVoice: 'Voice',
  callVideo: 'Video',
  callCall: 'Call',
  callTo: (name: string) => `Call ${name}`,
  callTypeVoice: 'Voice call',
  callTypeVideo: 'Video call',
  callsDisabled: 'Calls are temporarily unavailable',
  callReasonOffline: 'Offline',
  callReasonNoAccess: 'No access',

  // Controls
  callMute: 'Mute',
  callUnmute: 'Unmute',
  callCamOff: 'Turn camera off',
  callCamOn: 'Turn camera on',
  callFlip: 'Flip camera',
  callSpeaker: 'Speaker',
  callEnd: 'End call',
  callMinimize: 'Minimise',
  callExpand: 'Expand the call',
  callBackToCall: 'Back to the call',
  callWith: (name: string) => `Call with ${name}`,
  callFullScreen: 'Full screen',
  callExitFullScreen: 'Exit full screen',
  callBackToWorkout: 'Back to your workout',
  callYou: 'You',

  // Incoming
  callIncomingVoice: 'Incoming voice call',
  callIncomingVideo: 'Incoming video call',
  callAnswer: 'Answer',
  callDecline: 'Decline',
  callVoiceOnly: 'Voice only',
  callAnswerVoiceOnly: 'Answer with voice only',

  // Live status
  callCalling: 'Calling…',
  callConnecting: 'Connecting…',
  callReconnecting: 'Reconnecting…',
  callWeakVoiceOnly: 'Weak connection — voice only',
  callNotRecorded: 'Not recorded',

  // End states (CallState)
  callEndedT: (time: string) => `Call ended · ${time}`,
  callEndedB: 'It is saved in your chat.',
  callDeclinedT: 'Call declined',
  callDeclinedB: 'You can write in the chat.',
  callNoAnswerT: 'No answer',
  callNoAnswerB: 'A missed call will show in the chat.',
  callBusyT: 'Busy',
  callBusyB: 'The other person is on another call. Try again in a few minutes.',
  callUnavailT: 'Unavailable',
  callUnavailB: 'Leave a message in the chat. It will be there when they are back.',
  callNoAccessT: 'No access',
  callNoAccessB: 'You can call people you work with while your coaching link is active.',
  callLostT: 'Connection lost',
  callLostB: 'Check your connection and try again.',
  callOfflineT: 'Offline — you cannot call',
  callOfflineB:
    'Calls need an internet connection. Chat messages are sent when you are back online.',
  callTryAgain: 'Try again',
  callClose: 'Close',
  callGoToChat: 'Open chat',

  // Permissions and devices
  callPermAskT: 'Allow the microphone and camera',
  callPermAskB: 'Spotter uses them only during a call. The call is not recorded.',
  callPermAllow: 'Allow',
  callPermDeniedT: 'The microphone is blocked',
  callPermDeniedB:
    'Calls need the microphone. Allow it in your browser or system settings, then try again.',
  callPermCamDeniedT: 'The camera is blocked',
  callPermCamDeniedB:
    'Allow the camera in your browser or system settings, or continue with voice only.',
  callPermHowTo:
    'Open the site settings next to the address bar, set the microphone and camera to Allow, then reload.',
  callNoDeviceT: 'No microphone found',
  callNoDeviceB: 'Connect a microphone or headset and try again.',
  callUnsupportedT: 'This browser cannot make calls',
  callUnsupportedB: 'Open Spotter in an up-to-date browser, or install the app.',

  // Chat history rows
  callLogVideo: (min: number) => `Video call · ${min} min`,
  callLogVoice: (min: number) => `Voice call · ${min} min`,
  callLogMissed: 'Missed call',
  callLogMissedVideo: 'Missed video call',
  callBack: 'Call back',
  callLogDeclined: 'Call declined',
  callLogNoAnswer: 'No answer',
  callLogDropped: 'Call dropped — connection lost',

  // Device check before the call
  callPreTitle: 'Check before the call',
  callPreMic: 'Microphone',
  callPreCam: 'Camera',
  callPreLevel: 'Microphone level',
  callPreDevices: 'Devices',
  callPreNoDevices: 'No devices found',
  callPreStart: 'Start',

  // Workout session strip
  callSessionLabel: 'Workout',
  callSessionOpen: 'Open',
  callSessionSet: (v: string) => `Set ${v}`,
  callSessionRest: 'rest',
};
