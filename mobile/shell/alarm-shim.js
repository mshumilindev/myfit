/* eslint-disable @typescript-eslint/no-unused-expressions, @typescript-eslint/no-unused-vars -- one function expression evaluated as-is by the shells; ES5 catch needs a binding */
/*
 * Planner alarms for the Capacitor shells (SPO-568): the web side of the `window.spotterNative` alarm contract that
 * desktop/src/preload.ts already offers (scheduleAlarms / cancelAlarms / onAlarmDue / showAlarm). One file for Android and iOS;
 * each platform gives it a `port` ({ postMessage(string), onmessage }) that is locked to the app's own origin
 * (Android: WebViewCompat.addWebMessageListener, iOS: a WKScriptMessageHandler wrapper).
 * Only ids, moments and modes are sent to native code in `schedule`/`cancel`; a title or text is sent only by `showAlarm`,
 * which the page calls itself with its own decrypted copy. Plain ES5 on purpose: it is evaluated as-is by the shells and by
 * tests/native-alarms-contract.test.ts. Usage: `(<this function>)(port, window)` returns the methods to merge into the bridge.
 */
(function (port, w) {
  'use strict';
  var subs = [];

  function dispatch(raw) {
    var msg;
    try {
      msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      return;
    }
    if (!msg || msg.t !== 'due' || !msg.alarm || typeof msg.alarm.id !== 'string') return;
    var alarm = {
      id: msg.alarm.id,
      at: msg.alarm.at,
      mode: msg.alarm.mode === 'ring' ? 'ring' : 'quiet',
    };
    subs.slice().forEach(function (cb) {
      try {
        cb(alarm);
      } catch (e) {
        /* a listener's error never reaches the shell */
      }
    });
  }

  if (port)
    port.onmessage = function (e) {
      dispatch(e && e.data);
    };
  // iOS has no reply channel on the handler: native code calls this through evaluateJavaScript.
  w.__spotterAlarmDue = dispatch;

  function send(message) {
    port.postMessage(JSON.stringify(message));
    return Promise.resolve();
  }

  return {
    scheduleAlarms: function (list) {
      return send({
        t: 'schedule',
        list: (list || []).map(function (a) {
          return { id: a.id, at: a.at, mode: a.mode };
        }),
      });
    },
    cancelAlarms: function (ids) {
      return send({ t: 'cancel', ids: ids || [] });
    },
    onAlarmDue: function (cb) {
      subs.push(cb);
      return function () {
        var i = subs.indexOf(cb);
        if (i >= 0) subs.splice(i, 1);
      };
    },
    showAlarm: function (p) {
      return send({ t: 'show', id: p.id, title: p.title, body: p.body || '', mode: p.mode });
    },
  };
});
