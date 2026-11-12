package com.spotter.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Fires at an alarm moment, also when the app is closed. The open page (if any) gets the event; otherwise a notification is shown. */
public class AlarmReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !AlarmScheduler.ACTION_DUE.equals(intent.getAction())) return;
        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        if (id == null || id.isEmpty() || id.length() > Alarm.MAX_ID_LENGTH) return;
        long at = intent.getLongExtra(AlarmScheduler.EXTRA_AT, System.currentTimeMillis());
        boolean ring = "ring".equals(intent.getStringExtra(AlarmScheduler.EXTRA_MODE));
        Alarm alarm = new Alarm(id, at, ring);
        AlarmStore.remove(context, id);
        // A moment missed by far (the phone was off) is the page's to show as missed.
        if (System.currentTimeMillis() - at > Alarm.GRACE_MS) return;
        if (!AlarmPort.deliver(alarm)) AlarmNotifier.show(context, id, "", "", ring);
    }
}
