/** SPO-639 (G2): the only place that talks to Firebase for crash reports; loaded lazily so a crash screen stays light. */
export async function sendErrorReport(payload: Record<string, unknown>): Promise<void> {
  const [{ httpsCallable }, { functions }] = await Promise.all([
    import('firebase/functions'),
    import('./firebase'),
  ]);
  await httpsCallable(functions, 'reportClientError')(payload);
}
