package com.spotter.app;

import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The native end of {@code window.spotterNative}'s alarm methods (mobile/shell/alarm-shim.js). The port is a web message listener,
 * so only the app's own origin can reach it. Messages: {@code schedule {list}}, {@code cancel {ids}}, {@code show {id,title,body,mode}};
 * back to the page: {@code due {alarm}}.
 */
final class AlarmPort {
    static final String NAME = "__spotterAlarms";
    /** The page that is open right now; null while the app is closed or in the background without a live page. */
    private static volatile JavaScriptReplyProxy reply;
    /** An alarm that came due before the page was ready (the app was started by its notification). */
    private static volatile Alarm pending;

    private AlarmPort() {}

    static boolean supported() {
        return WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER);
    }

    static void attach(final MainActivity activity, WebView view, String origin) {
        final Context app = activity.getApplicationContext();
        WebViewCompat.addWebMessageListener(
                view,
                NAME,
                Collections.singleton(origin),
                (v, message, sourceOrigin, isMainFrame, replyProxy) -> {
                    if (!isMainFrame) return;
                    reply = replyProxy;
                    handle(activity, app, message.getData());
                    flushPending();
                });
    }

    static void handle(MainActivity activity, Context app, String raw) {
        if (raw == null) return;
        try {
            JSONObject m = new JSONObject(raw);
            String t = m.optString("t", "");
            if (t.equals("schedule")) {
                ensureNotificationPermission(activity);
                AlarmScheduler.replace(app, Alarm.parse(m.optJSONArray("list")), System.currentTimeMillis());
            } else if (t.equals("cancel")) {
                JSONArray ids = m.optJSONArray("ids");
                List<String> list = new ArrayList<>();
                if (ids != null) for (int i = 0; i < ids.length(); i++) list.add(ids.optString(i, ""));
                AlarmScheduler.cancel(app, list);
            } else if (t.equals("show")) {
                String id = m.optString("id", "");
                if (id.isEmpty() || id.length() > Alarm.MAX_ID_LENGTH) return;
                AlarmNotifier.show(app, id, m.optString("title", ""), m.optString("body", ""), m.optString("mode", "").equals("ring"));
            }
        } catch (org.json.JSONException ignored) {
            // A malformed message is dropped, never trusted.
        }
    }

    private static void ensureNotificationPermission(MainActivity activity) {
        if (Build.VERSION.SDK_INT < 33) return;
        if (activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) return;
        ActivityCompat.requestPermissions(activity, new String[] {android.Manifest.permission.POST_NOTIFICATIONS}, 5201);
    }

    /** Tells the open page that an alarm is due. Returns false when no page is listening (the caller then shows a notification). */
    static boolean deliver(Alarm alarm) {
        JavaScriptReplyProxy r = reply;
        if (r == null || !WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return false;
        try {
            JSONObject m = new JSONObject().put("t", "due").put("alarm", alarm.toJson());
            r.postMessage(m.toString());
            return true;
        } catch (org.json.JSONException e) {
            return false;
        }
    }

    static void setPending(Alarm a) {
        pending = a;
        flushPending();
    }

    private static void flushPending() {
        Alarm a = pending;
        if (a != null && deliver(a)) pending = null;
    }

    static void detach() {
        reply = null;
    }
}
