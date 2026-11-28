import Cocoa

struct Item { let id: String; let text: String; let status: String; let why: String; let evidence: String }
struct Card { let task: String; let pct: Int; let done: Int; let total: Int; let eta: String; let now: String; let items: [Item]; let at: Double; let source: String }
struct Branch { let name: String; let kind: String; let ahead: Int; let subject: String }
struct Stage { let stage: String; let state: String; let detail: String }
struct Prompt { let label: String; let text: String }
struct Snapshot { var cards: [Card] = []; var branches: [Branch] = []; var prompts: [Prompt] = []; var pipeline: [Stage] = []; var dashboard = "" }

// Own clone of the wf-state branch, outside protected folders (Desktop/Documents).
let repo = NSString(string: "~/.devflow/wf-state").expandingTildeInPath

func git(_ args: [String]) -> String {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/usr/bin/git")
    p.arguments = args
    p.currentDirectoryURL = URL(fileURLWithPath: repo)
    let out = Pipe()
    p.standardOutput = out
    p.standardError = Pipe()
    do { try p.run() } catch { return "" }
    let d = out.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    return String(data: d, encoding: .utf8) ?? ""
}

func str(_ v: Any?) -> String { (v as? String) ?? "" }
func num(_ v: Any?) -> Int { (v as? NSNumber)?.intValue ?? 0 }

func loadSnapshot() -> Snapshot {
    _ = git(["fetch", "-q", "origin", "wf-state"])
    let names = git(["ls-tree", "--name-only", "FETCH_HEAD", "wf/"]).split(separator: "\n")
    var snap = Snapshot()
    var newest = 0.0
    for n in names {
        let txt = git(["show", "FETCH_HEAD:" + String(n)])
        guard let data = txt.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { continue }
        let at = (o["updatedAt"] as? NSNumber)?.doubleValue ?? 0
        let src = str(o["source"])
        for t in (o["tasks"] as? [[String: Any]]) ?? [] {
            let items = ((t["blocks"] as? [[String: Any]]) ?? []).map {
                Item(id: str($0["id"]), text: str($0["text"]), status: str($0["status"]), why: str($0["why"]), evidence: str($0["evidence"]))
            }
            snap.cards.append(Card(task: str(t["task"]), pct: num(t["pct"]), done: num(t["done"]), total: num(t["total"]),
                                   eta: str(t["eta"]), now: str(t["now"]), items: items, at: at, source: src))
        }
        for b in (o["branches"] as? [[String: Any]]) ?? [] {
            let br = Branch(name: str(b["name"]), kind: str(b["kind"]), ahead: num(b["ahead"]), subject: str(b["subject"]))
            if !snap.branches.contains(where: { $0.name == br.name && $0.kind == br.kind }) { snap.branches.append(br) }
        }
        if at >= newest {
            newest = at
            snap.prompts = ((o["prompts"] as? [[String: Any]]) ?? []).map { Prompt(label: str($0["label"]), text: str($0["text"])) }
            snap.pipeline = ((o["pipeline"] as? [[String: Any]]) ?? []).map { Stage(stage: str($0["stage"]), state: str($0["state"]), detail: str($0["detail"])) }
            let d = str(o["dashboardUrl"]); if !d.isEmpty { snap.dashboard = d }
        }
    }
    snap.cards.sort { $0.at > $1.at }
    return snap
}


// ---- Self-update: the wf-state branch carries widget/ProgressWidget.swift and widget/VERSION (sha256).
let widgetDir = NSString(string: "~/.devflow/widget").expandingTildeInPath
var failedVersion = ""
var updateStatus = "checking for updates"
var runningVersion = ""
var lastUpdateCheck = Date.distantPast

var lastToolError = ""
func runTool(_ path: String, _ args: [String]) -> Int32 {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: path)
    p.arguments = args
    p.standardOutput = Pipe()
    let err = Pipe()
    p.standardError = err
    do { try p.run() } catch { lastToolError = "cannot run \(path)"; return -1 }
    let d = err.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    let t = String(data: d, encoding: .utf8) ?? ""
    lastToolError = t.split(separator: "\n").first(where: { $0.contains("error") }).map(String.init) ?? String(t.prefix(160))
    return p.terminationStatus
}

func checkForUpdate() {
    if Date().timeIntervalSince(lastUpdateCheck) < 120 { return }
    lastUpdateCheck = Date()
    let latest = git(["show", "FETCH_HEAD:widget/VERSION"]).trimmingCharacters(in: .whitespacesAndNewlines)
    let installed = ((try? String(contentsOfFile: widgetDir + "/installed-version", encoding: .utf8)) ?? "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    runningVersion = String(installed.prefix(7))
    if latest.isEmpty { updateStatus = "update check failed (no data)"; return }
    if latest == installed { updateStatus = "up to date"; return }
    if latest == failedVersion { return }
    updateStatus = "updating to \(latest.prefix(7))\u{2026}"
    let source = git(["show", "FETCH_HEAD:widget/ProgressWidget.swift"])
    if source.isEmpty { return }
    try? FileManager.default.createDirectory(atPath: widgetDir, withIntermediateDirectories: true)
    let srcPath = widgetDir + "/ProgressWidget.swift"
    let binNew = widgetDir + "/ProgressWidget.new"
    do { try source.write(toFile: srcPath, atomically: true, encoding: .utf8) } catch { return }
    try? FileManager.default.removeItem(atPath: binNew)
    guard runTool("/usr/bin/swiftc", ["-O", srcPath, "-o", binNew]) == 0,
          let exe = Bundle.main.executablePath else { failedVersion = latest; updateStatus = "update \(latest.prefix(7)) failed: " + lastToolError; return }
    try? FileManager.default.removeItem(atPath: exe)
    do { try FileManager.default.moveItem(atPath: binNew, toPath: exe) } catch { failedVersion = latest; updateStatus = "update \(latest.prefix(7)) failed: could not replace the app"; return }
    try? (latest + "\n").write(toFile: widgetDir + "/installed-version", atomically: true, encoding: .utf8)
    exit(0) // launchd (KeepAlive) starts the new build
}

func color(_ s: String) -> NSColor {
    switch s {
    case "done": return NSColor(calibratedRed: 0.25, green: 0.74, blue: 0.47, alpha: 1)
    case "doing": return NSColor(calibratedRed: 0.30, green: 0.58, blue: 0.95, alpha: 1)
    case "blocked": return NSColor(calibratedRed: 0.90, green: 0.33, blue: 0.30, alpha: 1)
    case "skipped": return NSColor(calibratedRed: 0.89, green: 0.67, blue: 0.25, alpha: 1)
    default: return NSColor(calibratedWhite: 0.38, alpha: 1)
    }
}
func statusName(_ s: String) -> String {
    switch s {
    case "done": return "Done"
    case "doing": return "In progress"
    case "blocked": return "Blocked"
    case "skipped": return "Skipped"
    default: return "To do"
    }
}
func explain(_ i: Item) -> String {
    switch i.status {
    case "done": return i.evidence.isEmpty ? "Finished." : "Proof: " + i.evidence
    case "doing": return "Being worked on right now."
    case "blocked": return i.why.isEmpty ? "Blocked." : i.why
    case "skipped": return i.why.isEmpty ? "Skipped on purpose." : "Skipped: " + i.why
    default: return "Not started yet."
    }
}

struct Hit { let rect: NSRect; let action: () -> Void }

final class WidgetView: NSView {
    var snap = Snapshot()
    var note = ""
    var tab = 0
    var selected: (String, String)? = nil   // task id, item id
    var toast = ""
    var showAll = false
    var scrollY: CGFloat = 0
    var contentHeight: CGFloat = 0
    var hits: [Hit] = []
    var squares: [(NSRect, Item)] = []
    var hover: Item? = nil
    var hoverRect = NSRect.zero
    var onChange: () -> Void = {}
    override var isFlipped: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    func font(_ size: CGFloat, _ bold: Bool = false) -> NSFont { NSFont.systemFont(ofSize: size, weight: bold ? .semibold : .regular) }
    func attrs(_ size: CGFloat, _ bold: Bool, _ alpha: CGFloat, _ c: NSColor? = nil) -> [NSAttributedString.Key: Any] {
        [.font: font(size, bold), .foregroundColor: (c ?? NSColor.white).withAlphaComponent(alpha)]
    }
    @discardableResult
    func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ bold: Bool, _ alpha: CGFloat, _ draw: Bool, right: CGFloat? = nil, c: NSColor? = nil) -> CGFloat {
        let a = attrs(size, bold, alpha, c)
        let ns = NSString(string: s)
        let w = ns.size(withAttributes: a).width
        if draw { ns.draw(at: NSPoint(x: right != nil ? right! - w : x, y: y), withAttributes: a) }
        return w
    }
    func wrapped(_ s: String, _ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ size: CGFloat, _ alpha: CGFloat, _ draw: Bool, c: NSColor? = nil) -> CGFloat {
        let a = attrs(size, false, alpha, c)
        let ns = NSString(string: s)
        let r = ns.boundingRect(with: NSSize(width: w, height: 400), options: [.usesLineFragmentOrigin], attributes: a)
        if draw { ns.draw(with: NSRect(x: x, y: y, width: w, height: ceil(r.height)), options: [.usesLineFragmentOrigin], attributes: a) }
        return ceil(r.height)
    }
    @discardableResult
    func pill(_ label: String, _ x: CGFloat, _ y: CGFloat, active: Bool, right: CGFloat? = nil, _ draw: Bool, _ action: @escaping () -> Void) -> CGFloat {
        let w = text(label, 0, 0, 11, active, 1, false) + 18
        let px = right != nil ? right! - w : x
        let r = NSRect(x: px, y: y, width: w, height: 22)
        if draw {
            (active ? NSColor(calibratedWhite: 1, alpha: 0.18) : NSColor(calibratedWhite: 1, alpha: 0.07)).setFill()
            NSBezierPath(roundedRect: r, xRadius: 11, yRadius: 11).fill()
            text(label, px + 9, y + 4, 11, active, active ? 1 : 0.75, true)
            hits.append(Hit(rect: r, action: action))
        }
        return w
    }
    func copyText(_ s: String, _ label: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(s, forType: .string)
        toast = "Copied: " + label
        onChange()
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.toast = ""; self.onChange() }
    }

    func render(_ w: CGFloat, _ draw: Bool) -> CGFloat {
        if draw { hits = []; squares = [] }
        let pad: CGFloat = 14, sq: CGFloat = 10, gap: CGFloat = 3
        var y: CGFloat = 12
        let devN = snap.branches.filter { $0.kind == "dev" }.count + max(0, snap.cards.count - 1)
        let cpdN = snap.branches.filter { $0.kind == "cpd" }.count
        var x = pad
        x += pill("Tasks", x, y, active: tab == 0, draw) { self.tab = 0; self.onChange() } + 6
        x += pill("In dev (\(devN))", x, y, active: tab == 1, draw) { self.tab = 1; self.onChange() } + 6
        x += pill("cpd (\(cpdN))", x, y, active: tab == 2, draw) { self.tab = 2; self.onChange() } + 6
        _ = pill("Pipeline", x, y, active: tab == 3, draw) { self.tab = 3; self.onChange() }
        let dash = snap.dashboard
        pill("Dashboard \u{2197}", 0, y, active: false, right: w - pad, draw) {
            if let u = URL(string: dash), !dash.isEmpty { NSWorkspace.shared.open(u) }
        }
        y += 34

        if tab == 0 {
            if snap.cards.isEmpty {
                if draw { text(note.isEmpty ? "No task yet" : note, pad, y, 12, false, 0.7, true) }
                y += 24
            }
            for c in snap.cards.prefix(2) {
                text("\(c.task)  \(c.pct)%  \(c.done)/\(c.total)", pad, y, 13, true, 0.95, draw)
                text(c.eta, 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 22
                var bx = pad
                for it in c.items {
                    if bx + sq > w - pad { bx = pad; y += sq + gap }
                    let r = NSRect(x: bx, y: y, width: sq, height: sq)
                    if draw {
                        color(it.status).setFill()
                        NSBezierPath(roundedRect: r, xRadius: 2, yRadius: 2).fill()
                        if let s = selected, s.0 == c.task, s.1 == it.id {
                            NSColor.white.setStroke()
                            let p = NSBezierPath(roundedRect: r.insetBy(dx: -1.5, dy: -1.5), xRadius: 3, yRadius: 3)
                            p.lineWidth = 1.5; p.stroke()
                        }
                        squares.append((r.insetBy(dx: -1.5, dy: -1.5), it))
                        hits.append(Hit(rect: r.insetBy(dx: -1.5, dy: -1.5)) { self.selected = (c.task, it.id); self.onChange() })
                    }
                    bx += sq + gap
                }
                y += sq + gap + 8
            }
            if let s = selected, let c = snap.cards.first(where: { $0.task == s.0 }), let it = c.items.first(where: { $0.id == s.1 }) {
                let box = y
                let tw = w - 2 * pad - 20
                let h1 = wrapped(it.text, 0, 0, tw, 11.5, 0.95, false)
                let h2 = wrapped(explain(it), 0, 0, tw, 11, 0.7, false)
                let inner = box + 30 + h1 + 6 + h2 + 12
                if draw {
                    NSColor(calibratedWhite: 1, alpha: 0.06).setFill()
                    NSBezierPath(roundedRect: NSRect(x: pad, y: box, width: w - 2 * pad, height: inner - box), xRadius: 8, yRadius: 8).fill()
                    color(it.status).setFill()
                    NSBezierPath(ovalIn: NSRect(x: pad + 10, y: box + 13, width: 8, height: 8)).fill()
                    text("\(it.id) \u{00B7} \(statusName(it.status))", pad + 24, box + 10, 12, true, 1, true, c: color(it.status))
                    _ = wrapped(it.text, pad + 10, box + 30, tw, 11.5, 0.95, true)
                    _ = wrapped(explain(it), pad + 10, box + 30 + h1 + 6, tw, 11, 0.7, true)
                }
                y = inner + 10
            }
            let ps = snap.prompts
            if !ps.isEmpty || selected != nil {
                text("Prompts to copy", pad, y, 11, true, 0.55, draw)
                y += 20
                var list = ps
                if let s = selected, let c = snap.cards.first(where: { $0.task == s.0 }), let it = c.items.first(where: { $0.id == s.1 }), it.status != "done" {
                    list.insert(Prompt(label: "Close \(it.id)", text: "\(c.task): close \(it.id) (\(it.text)). Current state: \(statusName(it.status))\(it.why.isEmpty ? "" : ", " + it.why). Finish it, prove it with wf done --evidence, and continue until nothing is left."), at: 0)
                }
                for p in list.prefix(5) {
                    let label = p.label.count > 38 ? String(p.label.prefix(37)) + "\u{2026}" : p.label
                    text(label, pad, y + 3, 11.5, false, 0.9, draw)
                    pill("Copy", 0, y, active: false, right: w - pad, draw) { self.copyText(p.text, p.label) }
                    y += 28
                }
            }
            if let c0 = snap.cards.first {
                y += 4
                let n = { (k: String) in c0.items.filter { $0.status == k }.count }
                var parts = ["\(n("done")) done"]
                if n("doing") > 0 { parts.append("\(n("doing")) in progress") }
                if n("blocked") > 0 { parts.append("\(n("blocked")) blocked") }
                if n("skipped") > 0 { parts.append("\(n("skipped")) skipped") }
                if n("todo") > 0 { parts.append("\(n("todo")) to do") }
                text(parts.joined(separator: " \u{00B7} "), pad, y + 3, 11.5, true, 0.85, draw)
                pill(showAll ? "Less" : "More", 0, y, active: showAll, right: w - pad, draw) { self.showAll.toggle(); self.scrollY = 0; self.onChange() }
                y += 30
                if showAll {
                    for it in c0.items {
                        if draw {
                            color(it.status).setFill()
                            NSBezierPath(roundedRect: NSRect(x: pad, y: y + 3, width: 8, height: 8), xRadius: 2, yRadius: 2).fill()
                        }
                        let line = "\(it.id) \u{00B7} \(statusName(it.status))"
                        text(line, pad + 16, y, 11, true, 0.95, draw, c: color(it.status))
                        let tw = text(line, 0, 0, 11, true, 1, false)
                        let maxW = w - 2 * pad - 16 - tw - 10
                        var t = it.text
                        while t.count > 4 && text(t, 0, 0, 11, false, 1, false) > maxW { t = String(t.dropLast(2)) }
                        if t != it.text { t += "\u{2026}" }
                        text(t, pad + 16 + tw + 8, y, 11, false, 0.7, draw)
                        y += 16
                        let why = it.status == "done" ? it.evidence : it.why
                        if !why.isEmpty { y += wrapped(why, pad + 16, y, w - 2 * pad - 16, 10.5, 0.55, draw) + 2 }
                        y += 6
                    }
                }
            }
        } else if tab == 1 {
            let rows = snap.branches.filter { $0.kind == "dev" }
            for b in rows {
                text(b.name, pad, y, 12, true, 0.95, draw)
                text(b.ahead > 0 ? "\(b.ahead) ahead" : "current", 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 18
                if !b.subject.isEmpty { y += wrapped(b.subject, pad, y, w - 2 * pad, 11, 0.6, draw) }
                y += 4
                let nm = b.name
                let ex = "Explain git branch \(nm) to me: what it contains compared with main (commits, changed files), why it exists (linked Linear issue / wf task), the status of its tasks, and whether it is merged, deployed or still open. Read-only, change nothing."
                let del = "I want to delete git branch \(nm). Do NOT delete anything yet. First check and report: (1) commits not in main, (2) whether its work is merged and deployed (CI and deploy status), (3) open PRs and linked Linear issue, (4) anything unique that would be lost, (5) whether it is safe to delete. Then ask me to confirm explicitly. Only after my yes delete the local and remote branch, never with force."
                let bw = pill("Explain in chat", pad, y, active: false, draw) { self.copyText(ex, "Explain prompt copied") }
                _ = pill("Delete\u{2026}", pad + bw + 6, y, active: false, draw) { self.copyText(del, "Delete prompt copied") }
                y += 34
            }
            for c in snap.cards.dropFirst() {
                text("\(c.task) \u{00B7} \(c.source)", pad, y, 12, true, 0.95, draw)
                text("\(c.pct)%  \(c.done)/\(c.total)", 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 26
            }
            if rows.isEmpty && snap.cards.count < 2 { text("No other work in progress", pad, y, 12, false, 0.6, draw); y += 24 }
        } else if tab == 3 {
            var stages: [(String, String, String)] = []
            let devDone = snap.cards.first.map { $0.done == $0.total } ?? false
            stages.append(("Development", devDone ? "done" : "doing", snap.cards.first.map { "\($0.task) \u{00B7} \($0.done)/\($0.total)" } ?? ""))
            let cpdN2 = snap.branches.filter { $0.kind == "cpd" }.count
            stages.append(("Waiting for cpd", cpdN2 > 0 ? "doing" : "done", cpdN2 > 0 ? "\(cpdN2) branch(es) not pushed" : "nothing queued"))
            for st in snap.pipeline {
                let m = ["ok": "done", "running": "doing", "fail": "blocked"][st.state] ?? "todo"
                stages.append((st.stage, m, st.detail))
            }
            for (name, st, detail) in stages {
                text("\u{25CF}", pad, y, 14, true, 1, draw, c: color(st))
                text(name, pad + 20, y + 1, 12, true, 0.95, draw)
                text(statusName(st), 0, y + 1, 11, true, 0.9, draw, right: w - pad, c: color(st))
                y += 18
                if !detail.isEmpty { text(detail, pad + 20, y, 10.5, false, 0.55, draw); y += 16 }
                y += 8
            }
        } else {
            let rows = snap.branches.filter { $0.kind == "cpd" }
            for b in rows {
                text(b.name, pad, y, 12, true, 0.95, draw)
                text("\(b.ahead) commit\(b.ahead == 1 ? "" : "s")", 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 18
                if !b.subject.isEmpty { y += wrapped(b.subject, pad, y, w - 2 * pad, 11, 0.6, draw) }
                y += 10
            }
            if rows.isEmpty { text("Nothing waiting for cpd", pad, y, 12, false, 0.6, draw); y += 24 }
            else {
                pill("Copy \u{201C}cpd\u{201D}", pad, y, active: false, draw) { self.copyText("cpd", "cpd") }
                y += 30
            }
        }
        if !toast.isEmpty {
            if draw { text(toast, pad, y, 11, true, 0.9, true, c: color("done")) }
            y += 20
        }
        text("v\(runningVersion) \u{00B7} \(updateStatus)", pad, y + 2, 9.5, false, 0.4, draw)
        y += 16
        return y + 8
    }

    override func scrollWheel(with event: NSEvent) {
        let maxScroll = max(0, contentHeight - bounds.height)
        scrollY = min(max(0, scrollY - event.scrollingDeltaY), maxScroll)
        needsDisplay = true
    }

    override func mouseDown(with event: NSEvent) {
        var p = convert(event.locationInWindow, from: nil)
        p.y += scrollY
        for h in hits.reversed() where h.rect.contains(p) { h.action(); return }
    }

    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5), xRadius: 14, yRadius: 14)
        NSColor(calibratedWhite: 0.08, alpha: 0.97).setFill()
        path.fill()
        NSColor(calibratedWhite: 1, alpha: 0.12).setStroke()
        path.stroke()
        NSGraphicsContext.current?.cgContext.translateBy(x: 0, y: -scrollY)
        contentHeight = render(bounds.width, true)
        if let it = hover {
            var why = explain(it); if why.count > 240 { why = String(why.prefix(240)) + "\u{2026}" }
            let tw: CGFloat = 280
            let h1 = wrapped(it.text, 0, 0, tw - 20, 11, 0.95, false)
            let h2 = wrapped(why, 0, 0, tw - 20, 10.5, 0.7, false)
            let hh = 34 + h1 + 4 + h2 + 10
            let bx = min(max(8, hoverRect.midX - tw / 2), bounds.width - tw - 8)
            var by = hoverRect.maxY + 6
            if by + hh > contentHeight + 4 && hoverRect.minY - hh - 6 > 0 { by = hoverRect.minY - hh - 6 }
            let box = NSRect(x: bx, y: by, width: tw, height: hh)
            NSColor(calibratedWhite: 0.16, alpha: 1).setFill()
            let bp = NSBezierPath(roundedRect: box, xRadius: 8, yRadius: 8); bp.fill()
            NSColor(calibratedWhite: 1, alpha: 0.2).setStroke(); bp.stroke()
            text("\(it.id) \u{00B7} \(statusName(it.status))", bx + 10, by + 8, 11.5, true, 1, true, c: color(it.status))
            _ = wrapped(it.text, bx + 10, by + 28, tw - 20, 11, 0.95, true)
            _ = wrapped(why, bx + 10, by + 28 + h1 + 4, tw - 20, 10.5, 0.7, true)
        }
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        for a in trackingAreas { removeTrackingArea(a) }
        addTrackingArea(NSTrackingArea(rect: bounds, options: [.activeAlways, .mouseMoved, .mouseEnteredAndExited, .inVisibleRect], owner: self, userInfo: nil))
    }

    override func mouseMoved(with event: NSEvent) {
        var p = convert(event.locationInWindow, from: nil)
        p.y += scrollY
        let found = squares.first { $0.0.contains(p) }
        if found?.1.id != hover?.id || (found == nil) != (hover == nil) {
            hover = found?.1
            hoverRect = found?.0 ?? .zero
            needsDisplay = true
        }
    }

    override func mouseExited(with event: NSEvent) {
        if hover != nil { hover = nil; needsDisplay = true }
    }
}

final class App: NSObject {
    let width: CGFloat = 400
    let view = WidgetView()
    let panel: NSPanel

    override init() {
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 400, height: 120),
                        styleMask: [.borderless, .nonactivatingPanel],
                        backing: .buffered, defer: false)
        super.init()
        panel.level = .statusBar
        panel.isFloatingPanel = true
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.acceptsMouseMovedEvents = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = false
        panel.contentView = view
        view.onChange = { [weak self] in self?.place() }
        for name in [NSWorkspace.didActivateApplicationNotification, NSWorkspace.activeSpaceDidChangeNotification] {
            NSWorkspace.shared.notificationCenter.addObserver(self, selector: #selector(frontChanged), name: name, object: nil)
        }
        frontChanged()
        refresh()
        Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in self.refresh(); self.frontChanged() }
    }

    @objc func frontChanged() {
        let app = NSWorkspace.shared.frontmostApplication
        let id = (app?.bundleIdentifier ?? "").lowercased()
        let name = (app?.localizedName ?? "").lowercased()
        let isClaude = id.contains("claude") || id.contains("anthropic") || name.contains("claude")
        let isSelf = app?.processIdentifier == ProcessInfo.processInfo.processIdentifier
        if isClaude || isSelf { panel.orderFrontRegardless() } else { panel.orderOut(nil) }
    }

    func place() {
        guard let s = NSScreen.main else { return }
        let f = s.visibleFrame
        let total = view.render(width, false)
        view.contentHeight = total
        let h = min(total, f.height - 40)
        view.scrollY = min(view.scrollY, max(0, total - h))
        panel.setFrame(NSRect(x: f.maxX - width - 16, y: f.minY + 16, width: width, height: h), display: true)
        view.needsDisplay = true
    }

    func refresh() {
        DispatchQueue.global().async {
            let s = loadSnapshot()
            checkForUpdate()
            DispatchQueue.main.async {
                self.view.snap = s
                self.view.note = s.cards.isEmpty ? "No data (git fetch failed?)" : ""
                self.place()
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let controller = App()
app.run()
