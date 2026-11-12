package com.spotter.app;

import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * One Planner alarm: only an id, a UTC moment and a mode. The title and text of a plan stay sealed in the web app
 * (SPO-552 privacy rule); this shell never sees them except in {@code show} messages the page sends itself.
 * The limits below mirror desktop/src/alarms.ts (tests/android-alarm-parity.guard.test.ts keeps them equal).
 */
final class Alarm {
    static final int MAX_ALARMS = 200;
    static final int MAX_ID_LENGTH = 200;
    /** A moment missed by more than this (phone off, shell killed) is left for the page to show as missed. */
    static final long GRACE_MS = 10 * 60_000L;

    final String id;
    final long at;
    final boolean ring;

    Alarm(String id, long at, boolean ring) {
        this.id = id;
        this.at = at;
        this.ring = ring;
    }

    String mode() {
        return ring ? "ring" : "quiet";
    }

    JSONObject toJson() throws org.json.JSONException {
        return new JSONObject().put("id", id).put("at", at).put("mode", mode());
    }

    /** Accepts only well-formed alarms; anything else is dropped, never trusted. */
    static List<Alarm> parse(JSONArray input) {
        List<Alarm> out = new ArrayList<>();
        if (input == null) return out;
        int n = Math.min(input.length(), MAX_ALARMS);
        for (int i = 0; i < n; i++) {
            JSONObject o = input.optJSONObject(i);
            if (o == null) continue;
            String id = o.optString("id", "");
            if (id.isEmpty() || id.length() > MAX_ID_LENGTH) continue;
            if (!o.has("at") || o.isNull("at")) continue;
            double at = o.optDouble("at", Double.NaN);
            if (Double.isNaN(at) || Double.isInfinite(at)) continue;
            String mode = o.optString("mode", "");
            if (!mode.equals("quiet") && !mode.equals("ring")) continue;
            out.add(new Alarm(id, (long) Math.floor(at), mode.equals("ring")));
        }
        return out;
    }
}
