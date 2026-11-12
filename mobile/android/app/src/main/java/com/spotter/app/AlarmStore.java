package com.spotter.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;

/** The alarms the page last handed over, kept so they survive a reboot or an app update (the page tells us again on every change). */
final class AlarmStore {
    private static final String FILE = "spotter_planner_alarms";
    private static final String KEY = "list";

    private AlarmStore() {}

    static synchronized List<Alarm> load(Context c) {
        SharedPreferences p = c.getSharedPreferences(FILE, Context.MODE_PRIVATE);
        try {
            return Alarm.parse(new JSONArray(p.getString(KEY, "[]")));
        } catch (org.json.JSONException e) {
            return new ArrayList<>();
        }
    }

    static synchronized void save(Context c, List<Alarm> list) {
        JSONArray a = new JSONArray();
        try {
            for (Alarm x : list) a.put(x.toJson());
        } catch (org.json.JSONException e) {
            return;
        }
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString(KEY, a.toString()).apply();
    }

    static synchronized void remove(Context c, String id) {
        List<Alarm> kept = new ArrayList<>();
        for (Alarm x : load(c)) if (!x.id.equals(id)) kept.add(x);
        save(c, kept);
    }
}
