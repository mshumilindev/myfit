package com.spotter.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * The system notification for a Planner alarm. A persistent ("ring") alarm uses the alarm sound on a high-importance channel, a
 * full-screen intent and stays until it is opened or dismissed; a quiet one is one ordinary notification. With no text from the page
 * (the app was closed, so the sealed title cannot be read) the notification is generic and opens the app, where the page shows its ring screen.
 */
final class AlarmNotifier {
    static final String CHANNEL_RING = "planner_ring";
    static final String CHANNEL_QUIET = "planner_quiet";

    private AlarmNotifier() {}

    private static void channels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ring = new NotificationChannel(CHANNEL_RING, c.getString(R.string.planner_channel_ring), NotificationManager.IMPORTANCE_HIGH);
        ring.setSound(
                RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
                new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
        ring.enableVibration(true);
        ring.setBypassDnd(false);
        NotificationChannel quiet = new NotificationChannel(CHANNEL_QUIET, c.getString(R.string.planner_channel_quiet), NotificationManager.IMPORTANCE_DEFAULT);
        nm.createNotificationChannel(ring);
        nm.createNotificationChannel(quiet);
    }

    static void show(Context c, String id, String title, String body, boolean ring) {
        channels(c);
        Intent open = new Intent(c, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
                .putExtra(AlarmScheduler.EXTRA_ID, id)
                .putExtra(AlarmScheduler.EXTRA_MODE, ring ? "ring" : "quiet");
        PendingIntent pi = PendingIntent.getActivity(c, id.hashCode(), open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder b = new NotificationCompat.Builder(c, ring ? CHANNEL_RING : CHANNEL_QUIET)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title.isEmpty() ? c.getString(R.string.planner_due_title) : title)
                .setContentText(body.isEmpty() ? c.getString(R.string.planner_due_body) : body)
                .setContentIntent(pi)
                .setAutoCancel(true)
                .setCategory(ring ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_REMINDER)
                .setPriority(ring ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PRIVATE);
        if (ring) b.setFullScreenIntent(pi, true).setOngoing(true);
        Notification n = b.build();
        if (ring) n.flags |= Notification.FLAG_INSISTENT; // the alarm sound repeats until the notification is opened or dismissed
        try {
            NotificationManagerCompat.from(c).notify(id.hashCode(), n);
        } catch (SecurityException ignored) {
            // POST_NOTIFICATIONS was refused: nothing can be shown; the page says so in its settings.
        }
    }

    static void clear(Context c, String id) {
        NotificationManagerCompat.from(c).cancel(id.hashCode());
    }
}
