package com.spotter.app;

import android.net.Uri;
import android.view.View;
import android.webkit.WebView;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.CapConfig;
import com.getcapacitor.android.R;
import java.util.Collections;

/**
 * Thin shell around the hosted Spotter web app: all product code lives in `client/`.
 *
 * The only thing added here is `window.spotterNative`, the same additive contract as the desktop shell
 * (desktop/src/shared.ts): the web app feature-detects it (and each method) and keeps working in a plain
 * browser / PWA without it. It is injected at document start, only for the app's own origin.
 */
public class MainActivity extends BridgeActivity {

    /** Bumped only on a breaking bridge change (see desktop/src/shared.ts). */
    private static final int BRIDGE_VERSION = 1;

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

        // BuildConfig.VERSION_NAME is derived from mobile/package.json and contains digits and dots only.
        String script =
            "(function(){if(window.spotterNative)return;"
                + "Object.defineProperty(window,'spotterNative',{configurable:false,value:Object.freeze({"
                + "bridgeVersion:" + BRIDGE_VERSION + ","
                + "platform:'android',"
                + "getAppVersion:function(){return Promise.resolve('" + BuildConfig.VERSION_NAME + "');}"
                + "})});}());";

        WebViewCompat.addDocumentStartJavaScript((WebView) view, script, Collections.singleton(origin));
    }
}
