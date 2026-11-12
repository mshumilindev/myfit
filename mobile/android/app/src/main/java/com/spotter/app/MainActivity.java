package com.spotter.app;

import android.net.Uri;
import android.view.View;
import android.webkit.WebView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import com.getcapacitor.android.R;
import android.content.Intent;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

/**
 * Thin shell around the hosted Spotter web app: all product code lives in `client/`.
 *
 * The only thing added here is `window.spotterNative`, the same additive contract as the desktop shell
 * (desktop/src/shared.ts): the web app feature-detects it (and each method) and keeps working in a plain
 * browser / PWA without it. It is injected at document start, only for the app's own origin.
 * Bridge v2 (SPO-568) adds the Planner alarm methods (scheduleAlarms, cancelAlarms, onAlarmDue, showAlarm) from
 * mobile/shell/alarm-shim.js, backed by AlarmPort (a web message listener locked to the app's origin).
 */
public class MainActivity extends BridgeActivity {

    /** Bumped only on a breaking bridge change (see desktop/src/shared.ts). */
    private static final int BRIDGE_VERSION = 2;

    /**
     * The script must be registered before Capacitor starts the first navigation (it calls loadUrl inside
     * super.load()), otherwise it would miss the first page load.
     */
    @Override
    protected void load() {
        injectSpotterNative();
        super.load();
    }

    private void injectSpotterNative() {
        View view = findViewById(R.id.webview);
        if (!(view instanceof WebView)) return;
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) return;

        String serverUrl = CapConfig.loadDefault(getApplicationContext()).getServerUrl();
        if (serverUrl == null) return;
        Uri uri = Uri.parse(serverUrl);
        if (uri.getScheme() == null || uri.getAuthority() == null) return;
        String origin = uri.getScheme() + "://" + uri.getAuthority();

        String shim = readShim();
        boolean alarms = shim != null && AlarmPort.supported();
        if (alarms) AlarmPort.attach(this, (WebView) view, origin);

        // BuildConfig.VERSION_NAME is derived from mobile/package.json and contains digits and dots only.
        String script =
            "(function(){if(window.spotterNative)return;"
                + "var b={"
                + "bridgeVersion:" + BRIDGE_VERSION + ","
                + "platform:'android',"
                + "getAppVersion:function(){return Promise.resolve('" + BuildConfig.VERSION_NAME + "');}"
                + "};"
                + (alarms ? "var m=(" + shim + ")(window." + AlarmPort.NAME + ",window);for(var k in m)b[k]=m[k];" : "")
                + "Object.defineProperty(window,'spotterNative',{configurable:false,value:Object.freeze(b)});}());";

        WebViewCompat.addDocumentStartJavaScript((WebView) view, script, Collections.singleton(origin));
    }

    /** mobile/shell/alarm-shim.js, packaged as an asset (the one file Android and iOS share). */
    private String readShim() {
        try (InputStream in = getAssets().open("alarm-shim.js")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            return null;
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        openedFromAlarm(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        openedFromAlarm(getIntent());
    }

    @Override
    public void onDestroy() {
        AlarmPort.detach();
        super.onDestroy();
    }

    /** The app was opened from an alarm's notification: tell the page which one, so it shows its ring screen. */
    private void openedFromAlarm(Intent intent) {
        if (intent == null) return;
        String id = intent.getStringExtra(AlarmScheduler.EXTRA_ID);
        if (id == null || id.isEmpty()) return;
        boolean ring = "ring".equals(intent.getStringExtra(AlarmScheduler.EXTRA_MODE));
        intent.removeExtra(AlarmScheduler.EXTRA_ID);
        AlarmNotifier.clear(getApplicationContext(), id);
        AlarmPort.setPending(new Alarm(id, System.currentTimeMillis(), ring));
    }
}
