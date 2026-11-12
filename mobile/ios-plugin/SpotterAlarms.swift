import UIKit
import UserNotifications
import WebKit

/// Planner alarms for the iOS shell (SPO-568). NOT BUILT YET: there is no `ios/` project until the Apple Developer account exists
/// (SPO-161); this file is the reference implementation to add to it. It talks to `mobile/shell/alarm-shim.js` through a
/// WKScriptMessageHandler named `spotterAlarms` (add it with `WKUserContentController.addScriptMessageHandler` for the app's own
/// origin only, and inject the shim at document start with `{ postMessage: m => webkit.messageHandlers.spotterAlarms.postMessage(m) }` as the port).
///
/// iOS has no alarm API: a reminder is a local notification (time-sensitive, plus a short run of repeats for a persistent one, because
/// the system caps pending notifications at 64 and allows no endless ring). The page keeps its own ring screen when the app is open.
final class SpotterAlarms: NSObject, WKScriptMessageHandler {
    static let handlerName = "spotterAlarms"
    private static let maxAlarms = 200 // mirrors desktop/src/alarms.ts and Alarm.java
    private static let maxIdLength = 200
    private static let ringRepeats = 5 // a persistent alarm repeats every minute, five times
    private static let prefix = "spotter.planner."

    weak var webView: WKWebView?

    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let raw = message.body as? String,
              let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let t = obj["t"] as? String else { return }
        switch t {
        case "schedule":
            requestAuthorizationIfNeeded()
            replace(with: Self.parse(obj["list"]))
        case "cancel":
            cancel(ids: (obj["ids"] as? [String]) ?? [])
        case "show":
            if let id = obj["id"] as? String, !id.isEmpty, id.count <= Self.maxIdLength {
                post(id: id, title: obj["title"] as? String ?? "", body: obj["body"] as? String ?? "", ring: obj["mode"] as? String == "ring", after: 1)
            }
        default: break
        }
    }

    struct Alarm { let id: String; let at: Double; let ring: Bool }

    static func parse(_ input: Any?) -> [Alarm] {
        guard let list = input as? [[String: Any]] else { return [] }
        var out: [Alarm] = []
        for o in list.prefix(maxAlarms) {
            guard let id = o["id"] as? String, !id.isEmpty, id.count <= maxIdLength,
                  let at = o["at"] as? Double, at.isFinite,
                  let mode = o["mode"] as? String, mode == "quiet" || mode == "ring" else { continue }
            out.append(Alarm(id: id, at: at.rounded(.down), ring: mode == "ring"))
        }
        return out
    }

    private func requestAuthorizationIfNeeded() {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound, .timeSensitive]) { _, _ in }
    }

    /// Replaces everything pending with exactly this list (a dismissed alarm, here or on another device, is simply not in it).
    func replace(with next: [Alarm]) {
        let center = UNUserNotificationCenter.current()
        center.getPendingNotificationRequests { pending in
            let old = pending.map(\.identifier).filter { $0.hasPrefix(Self.prefix) }
            center.removePendingNotificationRequests(withIdentifiers: old)
            let now = Date().timeIntervalSince1970 * 1000
            for a in next where a.at + 10 * 60_000 >= now {
                self.post(id: a.id, title: "", body: "", ring: a.ring, after: max(1, (a.at - now) / 1000))
            }
        }
    }

    func cancel(ids: [String]) {
        let all = ids.flatMap { id in (0...Self.ringRepeats).map { "\(Self.prefix)\(id).\($0)" } }
        UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: all)
    }

    /// Generic text when the page gave none: the title of a plan is sealed and the shell never holds it.
    private func post(id: String, title: String, body: String, ring: Bool, after seconds: Double) {
        for n in 0...(ring ? Self.ringRepeats : 0) {
            let content = UNMutableNotificationContent()
            content.title = title.isEmpty ? NSLocalizedString("planner_due_title", value: "Planner", comment: "") : title
            content.body = body.isEmpty ? NSLocalizedString("planner_due_body", value: "A reminder is due", comment: "") : body
            content.sound = .default // a critical-alert sound needs an Apple entitlement; not requested
            content.interruptionLevel = ring ? .timeSensitive : .active
            content.userInfo = ["spotterAlarmId": id, "mode": ring ? "ring" : "quiet"]
            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: seconds + Double(n) * 60, repeats: false)
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: "\(Self.prefix)\(id).\(n)", content: content, trigger: trigger))
        }
    }

    /// Call from `UNUserNotificationCenterDelegate.userNotificationCenter(_:didReceive:)` and `willPresent`: tells the open page.
    func due(id: String, ring: Bool, at: Double) {
        let json = "{\"t\":\"due\",\"alarm\":{\"id\":\(Self.quote(id)),\"at\":\(Int(at)),\"mode\":\"\(ring ? "ring" : "quiet")\"}}"
        webView?.evaluateJavaScript("window.__spotterAlarmDue && window.__spotterAlarmDue(\(Self.quote(json)))")
    }

    private static func quote(_ s: String) -> String {
        guard let d = try? JSONSerialization.data(withJSONObject: [s]), let j = String(data: d, encoding: .utf8) else { return "\"\"" }
        return String(j.dropFirst().dropLast())
    }
}
