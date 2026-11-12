package com.spotter.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Wakes the shell at each alarm moment with {@link AlarmManager#setAlarmClock}: exact, works in Doze and needs no extra
 * permission. It is meant for alarm-clock apps, so before a Google Play release the use must be checked against the exact-alarm
 * policy (SPO-190); the direct APK distribution is not affected.
 */
final class AlarmScheduler {
    static final String ACTION_DUE = "com.spotter.app.PLANNER_ALARM_DUE";
    static final String EXTRA_ID = "spotter_alarm_id";
    static final String EXTRA_AT = "spotter_alarm_at";
    static final String EXTRA_MODE = "spotter_alarm_mode";

    private AlarmScheduler() {}

    private static int requestCode(String id) {
        return id.hashCode();
    }

    private static PendingIntent dueIntent(Context c, Alarm a) {
        Intent i = new Intent(c, AlarmReceiver.class)
                .setAction(ACTION_DUE)
                .putExtra(EXTRA_ID, a.id)
                .putExtra(EXTRA_AT, a.at)
                .putExtra(EXTRA_MODE, a.mode());
        return PendingIntent.getBroadcast(c, requestCode(a.id), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent showIntent(Context c) {
        Intent i = new Intent(c, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Replaces everything armed with exactly this list: alarms no longer in it are cancelled (dismissed here or on another device). */
    static void replace(Context c, List<Alarm> next, long now) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Set<String> keep = new HashSet<>();
        List<Alarm> stored = new ArrayList<>();
        for (Alarm a : next) {
            if (a.at + Alarm.GRACE_MS < now) continue;
            keep.add(a.id);
            stored.add(a);
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(Math.max(a.at, now + 1), showIntent(c)), dueIntent(c, a));
        }
        for (Alarm old : AlarmStore.load(c)) if (!keep.contains(old.id)) am.cancel(dueIntent(c, old));
        AlarmStore.save(c, stored);
    }

    static void cancel(Context c, List<String> ids) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        List<Alarm> kept = new ArrayList<>();
        for (Alarm a : AlarmStore.load(c)) {
            if (ids.contains(a.id)) {
                if (am != null) am.cancel(dueIntent(c, a));
            } else kept.add(a);
        }
        AlarmStore.save(c, kept);
    }

    /** After a reboot or an app update the system forgets every alarm: arm the stored ones again. */
    static void restore(Context c, long now) {
        replace(c, AlarmStore.load(c), now);
    }
}
