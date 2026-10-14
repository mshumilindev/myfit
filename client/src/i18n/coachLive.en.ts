/**
 * Live screen strings (Coach, S-22 / C-21): the "who is training now" list and the one-client live page. The
 * widget in the header keeps its strings in coachToday (live*). Every key is mirrored in uk / pl / lt / et.
 * Only the service fields are named here: there is no string for a set, a weight or a rep (R-FE-062).
 */
export const liveEn = {
  lvTitle: 'Training now',
  lvBack: 'Clients',
  lvListLabel: 'Clients training now',
  lvSummary: (live: number, offline: number, finished: number) =>
    `${live} live · ${offline} offline · ${finished} finished`,
  lvSubLive: (min: number, gym: string) => `Live, ${min} min, ${gym}`,
  lvSubOffline: (ago: string, gym: string) => `Offline, last seen ${ago}, ${gym}`,
  lvSubFinished: (time: string, gym: string) => `Finished ${time}, ${gym}`,
  lvSubNone: (first: string) => `${first} is not training right now`,
  lvMessage: (first: string) => `Message ${first}`,
  lvOpenClient: 'Open client',
  lvStatusLive: 'Training now',
  lvStatusOffline: 'Offline',
  lvStatusFinished: 'Finished',
  lvClockLabel: 'Time since the session started',
  lvFieldsLabel: 'Session details',
  lvFName: 'Session',
  lvFStarted: 'Started at',
  lvFGym: 'Gym',
  lvFExercises: 'Exercises',
  lvFHeartbeat: 'Heartbeat',
  lvUnknown: 'Not shared yet',
  lvLastSeenS: (s: number) => `Last seen ${s} s ago`,
  lvLastSeenMin: (m: number) => `Last seen ${m} min ago`,
  lvAgoS: (s: number) => `${s} s ago`,
  lvAgoMin: (m: number) => `${m} min ago`,
  lvHeartbeatOk: (s: number) => `Last seen ${s} s ago`,
  lvLastSession: 'Last session',
  lvLastLine: (name: string, sets: number, tonnes: string) => `${name}, ${sets} sets, ${tonnes} t`,
  lvFinishedLine: (time: string, sets: number, tonnes: string) =>
    `Finished ${time} · ${sets} sets · ${tonnes} t`,
  lvNote: (first: string) =>
    `During a session you see the service fields. The sets appear in ${first}'s workouts when the session ends.`,
  lvNoneH: 'Nobody is training now',
  lvNoneB: 'When a client starts a session, you see who is training and for how long.',
  lvNoneClientH: (first: string) => `${first} is not training now`,
  lvNoneClientB: 'This page fills in when a session starts.',
  lvDuplicate: (first: string) => `${first} has two sessions open. Showing the newest.`,
  lvClient: 'Client',
  lvGoal: 'Goal',
  lvProgram: 'Program',
  lvWeek: (n: number) => `Week ${n}`,
  lvUnavailable: 'Live status is unavailable right now.',
  lvRetry: 'Retry',
};

export type LiveStrings = typeof liveEn;
