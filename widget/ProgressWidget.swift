import Cocoa

struct Item { let id: String; let text: String; let status: String; let why: String; let evidence: String; let stage: String }
struct Card { let task: String; let pct: Int; let done: Int; let total: Int; let eta: String; let now: String; let items: [Item]; let at: Double; let source: String; let branch: String }
struct Branch { let name: String; let kind: String; let ahead: Int; let subject: String; let date: String }
struct Stage { let stage: String; let state: String; let detail: String; let url: String }
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
                Item(id: str($0["id"]), text: str($0["text"]), status: str($0["status"]), why: str($0["why"]), evidence: str($0["evidence"]), stage: str($0["stage"]))
            }
            snap.cards.append(Card(task: str(t["task"]), pct: num(t["pct"]), done: num(t["done"]), total: num(t["total"]),
                                   eta: str(t["eta"]), now: str(t["now"]), items: items, at: at, source: src, branch: str(t["branch"])))
        }
        for b in (o["branches"] as? [[String: Any]]) ?? [] {
            let br = Branch(name: str(b["name"]), kind: str(b["kind"]), ahead: num(b["ahead"]), subject: str(b["subject"]), date: str(b["date"]))
            if !snap.branches.contains(where: { $0.name == br.name && $0.kind == br.kind }) { snap.branches.append(br) }
        }
        if at >= newest {
            newest = at
            snap.prompts = ((o["prompts"] as? [[String: Any]]) ?? []).map { Prompt(label: str($0["label"]), text: str($0["text"])) }
            snap.pipeline = ((o["pipeline"] as? [[String: Any]]) ?? []).map { Stage(stage: str($0["stage"]), state: str($0["state"]), detail: str($0["detail"]), url: str($0["url"])) }
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

var darkTheme: Bool = (UserDefaults.standard.object(forKey: "devflow.dark") as? Bool) ?? true
func ink() -> NSColor { darkTheme ? NSColor.white : NSColor(calibratedRed: 0.15, green: 0.12, blue: 0.22, alpha: 1) }
func ov(_ a: CGFloat) -> NSColor { ink().withAlphaComponent(a) }
func panelBg() -> NSColor { darkTheme ? NSColor(calibratedRed: 0.04, green: 0.0, blue: 0.09, alpha: 1) : NSColor(calibratedRed: 1.0, green: 0.98, blue: 0.94, alpha: 0.98) }
func accent() -> NSColor { darkTheme ? NSColor(calibratedRed: 0.46, green: 0.30, blue: 0.78, alpha: 1) : NSColor(calibratedRed: 0.90, green: 0.58, blue: 0.10, alpha: 1) }
func tipBg() -> NSColor { darkTheme ? NSColor(calibratedRed: 0.10, green: 0.02, blue: 0.20, alpha: 1) : NSColor.white }

func color(_ s: String) -> NSColor {
    switch s {
    case "done": return NSColor(calibratedRed: 0.25, green: 0.74, blue: 0.47, alpha: 1)
    case "doing": return NSColor(calibratedRed: 0.30, green: 0.58, blue: 0.95, alpha: 1)
    case "blocked": return NSColor(calibratedRed: 0.90, green: 0.33, blue: 0.30, alpha: 1)
    case "skipped": return NSColor(calibratedRed: 0.89, green: 0.67, blue: 0.25, alpha: 1)
    default: return NSColor(calibratedWhite: 0.38, alpha: 1)
    }
}
// Dashboard: start the local server first when it is not running, then open it.
func dashboardPort(_ u: URL) -> String { String(u.port ?? 5174) }
func dashboardProjectDirs() -> [String] {
    let home = NSHomeDirectory()
    let fm = FileManager.default
    let marker = "/devflow/dashboard/server/main.mjs"
    var found: [String] = []
    if let saved = try? String(contentsOfFile: home + "/.devflow/project-dir", encoding: .utf8) {
        let d = saved.trimmingCharacters(in: .whitespacesAndNewlines)
        if fm.fileExists(atPath: d + marker) { found.append(d) }
    }
    // Search nested folders of the usual project roots (depth <= 6), skipping dependencies and VCS data.
    let roots = ["Desktop", "Documents", "Developer", "Projects", "Work", "dev", "code", "src", "repos", "GitHub", "git"].map { home + "/" + $0 }
    let skip: Set<String> = ["node_modules", ".git", "Library", ".Trash", "dist", "build", ".next", "venv"]
    for root in roots where fm.fileExists(atPath: root) {
        guard let en = fm.enumerator(at: URL(fileURLWithPath: root), includingPropertiesForKeys: [.isDirectoryKey], options: [.skipsPackageDescendants]) else { continue }
        for case let url as URL in en {
            if skip.contains(url.lastPathComponent) || en.level > 6 { en.skipDescendants(); continue }
            if url.lastPathComponent == "devflow" {
                let proj = url.deletingLastPathComponent().path
                if fm.fileExists(atPath: proj + marker), !found.contains(proj) { found.append(proj) }
            }
        }
    }
    // Newest server file first: the freshest checkout is the most likely to work.
    func stamp(_ d: String) -> Date { ((try? fm.attributesOfItem(atPath: d + marker))?[.modificationDate] as? Date) ?? .distantPast }
    return found.sorted { stamp($0) > stamp($1) }
}

func nodeCandidates() -> [String] {
    let home = NSHomeDirectory()
    let fm = FileManager.default
    var out: [String] = []
    let probe = Process()
    probe.executableURL = URL(fileURLWithPath: "/bin/zsh")
    probe.arguments = ["-lic", "command -v node"]
    let pipe = Pipe()
    probe.standardOutput = pipe
    probe.standardError = Pipe()
    if (try? probe.run()) != nil {
        let d = pipe.fileHandleForReading.readDataToEndOfFile()
        probe.waitUntilExit()
        if let t = String(data: d, encoding: .utf8)?.split(separator: "\n").last { out.append(String(t).trimmingCharacters(in: .whitespaces)) }
    }
    out += ["/opt/homebrew/bin/node", "/usr/local/bin/node", home + "/.volta/bin/node", "/usr/bin/node"]
    let nvm = home + "/.nvm/versions/node"
    if let vs = try? fm.contentsOfDirectory(atPath: nvm) { out += vs.sorted(by: >).map { nvm + "/" + $0 + "/bin/node" } }
    var seen = Set<String>()
    return out.filter { fm.isExecutableFile(atPath: $0) && seen.insert($0).inserted }
}

func lastLogLine() -> String {
    let t = (try? String(contentsOfFile: NSHomeDirectory() + "/.devflow/dashboard.log", encoding: .utf8)) ?? ""
    return t.split(separator: "\n").last.map { String($0.prefix(70)) } ?? ""
}

func openDashboard(_ u: URL, _ say: @escaping (String) -> Void, _ prog: @escaping (String, CGFloat) -> Void) {
    DispatchQueue.global().async {
        let port = dashboardPort(u)
        let up = { runTool("/usr/bin/nc", ["-z", "127.0.0.1", port]) == 0 }
        DispatchQueue.main.async { prog("Checking the dashboard\u{2026}", 0.1) }
        if !up() && (u.host == "localhost" || u.host == "127.0.0.1") {
            DispatchQueue.main.async { prog("Looking for the project\u{2026}", 0.2) }
            let dirs = dashboardProjectDirs()
            if dirs.isEmpty {
                DispatchQueue.main.async { say("Dashboard project not found under Desktop/Documents/Developer/Projects/Work") }
                return
            }
            let nodes = nodeCandidates()
            if nodes.isEmpty {
                DispatchQueue.main.async { say("Node.js not found (install it or add it to the shell PATH)") }
                return
            }
            var lastWhy = ""
            var started = false
            let total = CGFloat(dirs.count * nodes.count)
            var attempt: CGFloat = 0
            outer: for dir in dirs {
                for node in nodes {
                    attempt += 1
                    let base = 0.3 + 0.65 * (attempt - 1) / total
                    DispatchQueue.main.async { prog("Starting (\(URL(fileURLWithPath: dir).lastPathComponent))\u{2026}", base) }
                    _ = runTool("/bin/zsh", ["-lic", "mkdir -p ~/.devflow; cd '\(dir)' && (CLAUDE_PROJECT_DIR='\(dir)' nohup '\(node)' devflow/dashboard/server/main.mjs > ~/.devflow/dashboard.log 2>&1 &)"])
                    var tries = 0
                    while !up() && tries < 8 { Thread.sleep(forTimeInterval: 0.5); tries += 1 }
                    if up() { started = true; break outer }
                    lastWhy = lastLogLine()
                    _ = runTool("/usr/bin/pkill", ["-f", "devflow/dashboard/server/main.mjs"])
                }
            }
            if !started {
                let why = lastWhy
                DispatchQueue.main.async { say(why.isEmpty ? "Dashboard did not start after \(Int(total)) attempts (no log output)" : "Dashboard failed: " + why) }
                return
            }
        }
        DispatchQueue.main.async { prog("Opening the dashboard", 1.0); NSWorkspace.shared.open(u) }
    }
}

func activateClaude() {
    if let app = NSWorkspace.shared.runningApplications.first(where: { $0.localizedName == "Claude" }) {
        app.activate(options: [])
    }
}

func branchDays(_ b: Branch) -> Int {
    let f = ISO8601DateFormatter()
    guard let d = f.date(from: b.date) else { return -1 }
    return max(0, Int(Date().timeIntervalSince(d) / 86400))
}
// fresh (<= 3 days) blue, idle (<= 14) yellow, stale red, unknown gray
func branchColor(_ b: Branch) -> NSColor {
    let d = branchDays(b)
    if d < 0 { return color("todo") }
    return d <= 3 ? color("doing") : (d <= 14 ? color("skipped") : color("blocked"))
}
func branchAge(_ b: Branch) -> String {
    let d = branchDays(b)
    return d < 0 ? "" : (d == 0 ? "today" : "\(d)d ago")
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
    var cardIdx = 0
    var hovering = false
    var pinned = false
    var collapsed: Bool { !(hovering || pinned) }
    var cur: Card? { snap.cards.isEmpty ? nil : snap.cards[min(cardIdx, snap.cards.count - 1)] }
    var selected: (String, String)? = nil   // task id, item id
    var toast = ""
    var progress: CGFloat = -1
    var copied = ""
    var showAll = false
    var flipped = Set<String>()
    var showPrompts = false
    var scrollY: CGFloat = 0
    var contentHeight: CGFloat = 0
    var hits: [Hit] = []
    var squares: [(NSRect, Item)] = []
    var hover: Item? = nil
    var hoverRect = NSRect.zero
    var hoverHit = NSRect.zero
    var onChange: () -> Void = {}
    override var isFlipped: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    func font(_ size: CGFloat, _ bold: Bool = false) -> NSFont { NSFont.systemFont(ofSize: size, weight: bold ? .semibold : .regular) }
    func attrs(_ size: CGFloat, _ bold: Bool, _ alpha: CGFloat, _ c: NSColor? = nil) -> [NSAttributedString.Key: Any] {
        [.font: font(size, bold), .foregroundColor: (c ?? ink()).withAlphaComponent(alpha)]
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
            (active ? ov(0.18) : ov(0.08)).setFill()
            NSBezierPath(roundedRect: r, xRadius: 11, yRadius: 11).fill()
            text(label, px + 9, y + 4, 11, active, active ? 1 : 0.75, true)
            hits.append(Hit(rect: r, action: action))
        }
        return w
    }
    func showProgress(_ m: String, _ p: CGFloat) {
        toast = m
        progress = p
        onChange()
        if p >= 1 {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) { if self.progress >= 1 { self.toast = ""; self.progress = -1; self.onChange() } }
        }
    }

    func showToast(_ m: String) {
        progress = -1
        toast = m
        onChange()
        if !m.isEmpty {
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { if self.toast == m { self.toast = ""; self.onChange() } }
        }
    }

    func copyText(_ s: String, _ label: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(s, forType: .string)
        copied = label
        toast = "Copied to clipboard \u{2014} paste into Claude with \u{2318}V"
        onChange()
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.toast = ""; self.copied = ""; self.onChange() }
    }

    func render(_ w: CGFloat, _ draw: Bool) -> CGFloat {
        if draw { hits = []; squares = [] }
        let pad: CGFloat = 14, sq: CGFloat = 10, gap: CGFloat = 3
        var y: CGFloat = 12
        if collapsed {
            if let c = cur {
                let blocked = c.items.filter { $0.status == "blocked" }.count
                text("\(c.task)  \(c.pct)%", pad, 10, 13, true, 0.95, draw)
                text(blocked > 0 ? "\(c.done)/\(c.total) \u{00B7} \(blocked) blocked" : "\(c.done)/\(c.total)", 0, 12, 11, blocked > 0, 0.8, draw, right: w - pad, c: blocked > 0 ? color("blocked") : nil)
                if draw {
                    let bar = NSRect(x: pad, y: 34, width: w - 2 * pad, height: 5)
                    ov(0.14).setFill()
                    NSBezierPath(roundedRect: bar, xRadius: 2.5, yRadius: 2.5).fill()
                    color("done").setFill()
                    NSBezierPath(roundedRect: NSRect(x: pad, y: 34, width: max(5, (w - 2 * pad) * CGFloat(c.pct) / 100), height: 5), xRadius: 2.5, yRadius: 2.5).fill()
                }
            } else if draw { text("No task yet", pad, 14, 12, false, 0.7, true) }
            return 52
        }
        let devN = snap.branches.filter { $0.kind == "dev" }.count + max(0, snap.cards.count - 1)
        let cpdN = snap.branches.filter { $0.kind == "cpd" }.count
        let oldN = snap.branches.filter { $0.kind == "stale" }.count
        var x = pad
        x += pill("Tasks", x, y, active: tab == 0, draw) { self.tab = 0; self.onChange() } + 6
        x += pill("In dev (\(devN))", x, y, active: tab == 1, draw) { self.tab = 1; self.onChange() } + 6
        x += pill("cpd (\(cpdN))", x, y, active: tab == 2, draw) { self.tab = 2; self.onChange() } + 6
        x += pill("Old (\(oldN))", x, y, active: tab == 4, draw) { self.tab = 4; self.onChange() } + 6
        _ = pill("Pipeline", x, y, active: tab == 3, draw) { self.tab = 3; self.onChange() }
        let dash = snap.dashboard
        pill("Dashboard \u{2197}", 0, y, active: false, right: w - pad, draw) {
            if let u = URL(string: dash), !dash.isEmpty {
                openDashboard(u, { msg in self.showToast(msg) }, { msg, p in self.showProgress(msg, p) })
            }
        }
        y += 34

        if tab == 0 {
            if snap.cards.isEmpty {
                if draw { text(note.isEmpty ? "No task yet" : note, pad, y, 12, false, 0.7, true) }
                y += 24
            }
            if snap.cards.count > 1 {
                var cx = pad
                for (i, cd) in snap.cards.prefix(4).enumerated() {
                    let b = cd.branch.isEmpty ? "" : " \u{00B7} " + (cd.branch.count > 14 ? String(cd.branch.prefix(13)) + "\u{2026}" : cd.branch)
                    cx += pill("\(cd.task)\(b) \(cd.pct)%", cx, y, active: i == min(cardIdx, snap.cards.count - 1), draw) { self.cardIdx = i; self.selected = nil; self.onChange() } + 6
                }
                y += 32
            }
            for c in (cur.map { [$0] } ?? []) {
                text("\(c.task)  \(c.pct)%  \(c.done)/\(c.total)", pad, y, 13, true, 0.95, draw)
                text(c.eta, 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 22
                let order = ["Spike", "Design", "Risk", "Plan", "Development", "Tests", "CI", "Deploy test", "Deploy prod", "Legal"]
                var groups = order.filter { g in c.items.contains { ($0.stage.isEmpty ? "Development" : $0.stage) == g } }
                for it in c.items { let g = it.stage.isEmpty ? "Development" : it.stage; if !groups.contains(g) { groups.append(g) } }
                for g in groups {
                    let its = c.items.filter { ($0.stage.isEmpty ? "Development" : $0.stage) == g }
                    let gd = its.filter { $0.status == "done" }.count
                    text(g, pad, y, 10.5, true, 0.6, draw)
                    text("\(gd)/\(its.count)", 0, y, 10.5, false, 0.5, draw, right: w - pad)
                    y += 16
                    var bx = pad
                    for it in its {
                        if bx + sq > w - pad { bx = pad; y += sq + gap }
                        let r = NSRect(x: bx, y: y, width: sq, height: sq)
                        if draw {
                            color(it.status).setFill()
                            NSBezierPath(roundedRect: r, xRadius: 2, yRadius: 2).fill()
                            if let s = selected, s.0 == c.task, s.1 == it.id {
                                ink().setStroke()
                                let p = NSBezierPath(roundedRect: r.insetBy(dx: -1.5, dy: -1.5), xRadius: 3, yRadius: 3)
                                p.lineWidth = 1.5; p.stroke()
                            }
                            squares.append((r.insetBy(dx: -1.5, dy: -1.5), it))
                            hits.append(Hit(rect: r.insetBy(dx: -1.5, dy: -1.5)) {
                                if let cur = self.selected, cur.0 == c.task, cur.1 == it.id { self.selected = nil } else { self.selected = (c.task, it.id) }
                                self.onChange()
                            })
                        }
                        bx += sq + gap
                    }
                    y += sq + gap + 6
                }
                y += 2
            }
            if let s = selected, let c = snap.cards.first(where: { $0.task == s.0 }), let it = c.items.first(where: { $0.id == s.1 }) {
                let box = y
                let tw = w - 2 * pad - 20
                let h1 = wrapped(it.text, 0, 0, tw, 11.5, 0.95, false)
                let h2 = wrapped(explain(it), 0, 0, tw, 11, 0.7, false)
                let canFinish = it.status != "done"
                let inner = box + 30 + h1 + 6 + h2 + 12 + (canFinish ? 32 : 0)
                if draw {
                    ov(0.07).setFill()
                    NSBezierPath(roundedRect: NSRect(x: pad, y: box, width: w - 2 * pad, height: inner - box), xRadius: 8, yRadius: 8).fill()
                    color(it.status).setFill()
                    NSBezierPath(ovalIn: NSRect(x: pad + 10, y: box + 13, width: 8, height: 8)).fill()
                    text("\(it.id) \u{00B7} \(statusName(it.status))", pad + 24, box + 10, 12, true, 1, true, c: color(it.status))
                    pill("\u{2715}", 0, box + 6, active: false, right: w - pad - 6, true) { self.selected = nil; self.onChange() }
                    _ = wrapped(it.text, pad + 10, box + 30, tw, 11.5, 0.95, true)
                    _ = wrapped(explain(it), pad + 10, box + 30 + h1 + 6, tw, 11, 0.7, true)
                    if canFinish {
                        let py = box + 30 + h1 + 6 + h2 + 8
                        let one = "\(c.task): continue and finish \(it.id) (\(it.text)) now. State: \(statusName(it.status))\(it.why.isEmpty ? "" : ", " + it.why). Do the work, prove it with wf done --evidence, do not stop or ask until it is 100% done."
                        let stg = it.stage.isEmpty ? "Development" : it.stage
                        let open = c.items.filter { $0.status != "done" && ($0.stage.isEmpty ? "Development" : $0.stage) == stg }
                        let names: [String] = open.map { "\($0.id) (\($0.text))" }
                        let list: String = names.joined(separator: "; ")
                        let grp = "\(c.task): continue and finish every non-green item in \(stg): \(list). Work through them one by one, prove each with wf done --evidence, add anything new to wf, and do not stop or ask until they are all done."
                        let w1 = pill(copied == "ex:one" ? "Copied \u{2713} paste in chat" : "Finish this \u{2192} Claude", pad + 10, py, active: copied == "ex:one", true) { self.copyText(one, "ex:one"); activateClaude() }
                        _ = pill(copied == "ex:grp" ? "Copied \u{2713} paste in chat" : "Finish all in \(stg)", pad + 10 + w1 + 6, py, active: copied == "ex:grp", true) { self.copyText(grp, "ex:grp"); activateClaude() }
                    }
                }
                y = inner + 10
            }
            let ps = snap.prompts
            if !ps.isEmpty || selected != nil {
                var list = ps
                if let s = selected, let c = snap.cards.first(where: { $0.task == s.0 }), let it = c.items.first(where: { $0.id == s.1 }), it.status != "done" {
                    list.insert(Prompt(label: "Close \(it.id)", text: "\(c.task): close \(it.id) (\(it.text)). Current state: \(statusName(it.status))\(it.why.isEmpty ? "" : ", " + it.why). Finish it, prove it with wf done --evidence, and continue until nothing is left."), at: 0)
                }
                let head = (showPrompts ? "\u{25BE} " : "\u{25B8} ") + "Prompts to copy (\(min(list.count, 5)))"
                let hw = text(head, pad, y, 11, true, 0.7, draw)
                if draw { hits.append(Hit(rect: NSRect(x: pad - 4, y: y - 4, width: hw + 8, height: 22)) { self.showPrompts.toggle(); self.onChange() }) }
                y += 22
                if showPrompts {
                    for p in list.prefix(5) {
                        let label = p.label.count > 38 ? String(p.label.prefix(37)) + "\u{2026}" : p.label
                        text(label, pad, y + 3, 11.5, false, 0.9, draw)
                        pill("Copy", 0, y, active: false, right: w - pad, draw) { self.copyText(p.text, p.label) }
                        y += 28
                    }
                }
            }
            if let c0 = cur {
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
                    var order: [String] = []
                    for it in c0.items where !order.contains(it.stage) { order.append(it.stage) }
                    for st in order {
                        let grp = c0.items.filter { $0.stage == st }
                        let doneN = grp.filter { $0.status == "done" }.count
                        let open = (doneN < grp.count) != flipped.contains(st)
                        pill("\(open ? "\u{25BE}" : "\u{25B8}") \(st.isEmpty ? "Other" : st)  \(doneN)/\(grp.count)", pad, y, active: open, draw) {
                            if self.flipped.contains(st) { self.flipped.remove(st) } else { self.flipped.insert(st) }
                            self.onChange()
                        }
                        y += 30
                        if !open { continue }
                    for it in grp {
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
            }
        } else if tab == 1 || tab == 4 {
            let rows = snap.branches.filter { $0.kind == (tab == 1 ? "dev" : "stale") }
            if tab == 4 {
                y += wrapped("No commits for 7+ days. Review each one, then delete the ones that are merged or abandoned.", pad, y, w - 2 * pad, 11, 0.6, draw) + 8
            }
            for b in rows {
                let nm = b.name
                let ex = "Explain git branch \(nm) to me: what it contains compared with main (commits, changed files), why it exists (linked Linear issue / wf task), the status of its tasks, and whether it is merged, deployed or still open. Read-only, change nothing."
                let del = "I want to delete git branch \(nm). Do NOT delete anything yet. First check and report: (1) commits not in main, (2) whether its work is merged and deployed (CI and deploy status), (3) open PRs and linked Linear issue, (4) anything unique that would be lost, (5) whether it is safe to delete. Then ask me to confirm explicitly. Only after my yes delete the local and remote branch, never with force."
                let sh = b.subject.isEmpty ? 0 : wrapped(b.subject, 0, 0, w - 2 * pad - 24, 11, 0.6, false)
                let cardH = 10 + 18 + sh + 6 + 26 + 8
                let bc = branchColor(b)
                if draw {
                    ov(0.07).setFill()
                    NSBezierPath(roundedRect: NSRect(x: pad - 4, y: y, width: w - 2 * pad + 8, height: cardH), xRadius: 10, yRadius: 10).fill()
                    bc.setFill()
                    NSBezierPath(roundedRect: NSRect(x: pad - 4, y: y + 8, width: 3, height: cardH - 16), xRadius: 1.5, yRadius: 1.5).fill()
                }
                var cy = y + 10
                text(b.name, pad + 8, cy, 12, true, 0.95, draw)
                text("\(b.ahead) ahead \u{00B7} \(branchAge(b))", 0, cy + 1, 11, true, 0.9, draw, right: w - pad - 4, c: bc)
                cy += 18
                if !b.subject.isEmpty { _ = wrapped(b.subject, pad + 8, cy, w - 2 * pad - 24, 11, 0.6, draw); cy += sh }
                cy += 6
                let bw = pill(copied == "ex:" + nm ? "Copied \u{2713} paste in chat" : "Explain in chat", pad + 8, cy, active: copied == "ex:" + nm, draw) { self.copyText(ex, "ex:" + nm) }
                pill(copied == "del:" + nm ? "Copied \u{2713} paste in chat" : "Delete\u{2026}", pad + 8 + bw + 6, cy, active: copied == "del:" + nm, draw) { self.copyText(del, "del:" + nm) }
                y += cardH + 10
            }
            for c in (tab == 1 ? Array(snap.cards.dropFirst()) : []) {
                text("\(c.task) \u{00B7} \(c.source)", pad, y, 12, true, 0.95, draw)
                text("\(c.pct)%  \(c.done)/\(c.total)", 0, y + 1, 11, false, 0.6, draw, right: w - pad)
                y += 26
            }
            if rows.isEmpty && (tab == 4 || snap.cards.count < 2) { text(tab == 4 ? "No old branches" : "No other work in progress", pad, y, 12, false, 0.6, draw); y += 24 }
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
                let rowTop = y
                let target: () -> Void = {
                    if name == "Development" { self.tab = 0; self.onChange() }
                    else if name == "Waiting for cpd" { self.tab = 2; self.onChange() }
                    else if let u = self.snap.pipeline.first(where: { $0.stage == name })?.url, let url = URL(string: u), !u.isEmpty { NSWorkspace.shared.open(url) }
                }
                if draw { hits.append(Hit(rect: NSRect(x: pad - 4, y: rowTop - 4, width: w - 2 * pad + 8, height: 40), action: target)) }
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
                text("\(b.ahead) commit\(b.ahead == 1 ? "" : "s") \u{00B7} \(branchAge(b))", 0, y + 1, 11, true, 0.9, draw, right: w - pad, c: branchColor(b))
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
        if updateStatus.contains("failed") { text(String(updateStatus.prefix(60)), pad, y + 4, 9.5, true, 0.9, draw, c: color("blocked")) }
        let dw = pill(darkTheme ? "\u{2600} Day" : "\u{263E} Night", 0, y, active: false, right: w - pad, draw) {
            darkTheme.toggle()
            UserDefaults.standard.set(darkTheme, forKey: "devflow.dark")
            self.onChange()
        }
        pill(pinned ? "Unpin" : "Pin open", 0, y, active: pinned, right: w - pad - dw - 6, draw) { self.pinned.toggle(); self.onChange() }
        y += 26
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
        panelBg().setFill()
        path.fill()
        accent().withAlphaComponent(0.9).setStroke()
        path.lineWidth = 2
        path.stroke()
        NSGraphicsContext.current?.cgContext.translateBy(x: 0, y: -scrollY)
        contentHeight = render(bounds.width, true)
        if !toast.isEmpty {
            let bh: CGFloat = progress >= 0 ? 44 : 30
            let r = NSRect(x: 14, y: scrollY + bounds.height - bh - 12, width: bounds.width - 28, height: bh)
            accent().setFill()
            NSBezierPath(roundedRect: r, xRadius: 8, yRadius: 8).fill()
            text(toast, 24, r.minY + 7, 12, true, 1, true, c: NSColor.white)
            if progress >= 0 {
                let track = NSRect(x: 24, y: r.maxY - 14, width: r.width - 20, height: 5)
                NSColor(calibratedWhite: 1, alpha: 0.28).setFill()
                NSBezierPath(roundedRect: track, xRadius: 2.5, yRadius: 2.5).fill()
                NSColor.white.setFill()
                NSBezierPath(roundedRect: NSRect(x: track.minX, y: track.minY, width: max(5, track.width * min(progress, 1)), height: 5), xRadius: 2.5, yRadius: 2.5).fill()
            }
        }
        if hoverHit != .zero {
            ov(0.13).setFill()
            NSBezierPath(roundedRect: hoverHit, xRadius: 6, yRadius: 6).fill()
        }
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
            tipBg().setFill()
            let bp = NSBezierPath(roundedRect: box, xRadius: 8, yRadius: 8); bp.fill()
            accent().withAlphaComponent(0.6).setStroke(); bp.stroke()
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
        let over = hits.last { $0.rect.contains(p) }?.rect ?? .zero
        if over != hoverHit {
            hoverHit = over
            if over == .zero { NSCursor.arrow.set() } else { NSCursor.pointingHand.set() }
            needsDisplay = true
        }
        let found = squares.first { $0.0.contains(p) }
        if found?.1.id != hover?.id || (found == nil) != (hover == nil) {
            hover = found?.1
            hoverRect = found?.0 ?? .zero
            needsDisplay = true
        }
    }

    override func mouseEntered(with event: NSEvent) {
        if !hovering { hovering = true; onChange() }
    }

    override func mouseExited(with event: NSEvent) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) {
            if let f = self.window?.frame, f.contains(NSEvent.mouseLocation) { return }
            if self.hovering { self.hovering = false; self.onChange() }
        }
        if hover != nil || hoverHit != .zero { hover = nil; hoverHit = .zero; NSCursor.arrow.set(); needsDisplay = true }
    }
}

final class App: NSObject {
    let width: CGFloat = 470
    let view = WidgetView()
    let panel: NSPanel

    override init() {
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 470, height: 120),
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
        let curW: CGFloat = view.collapsed ? 250 : width
        let total = view.render(curW, false)
        view.contentHeight = total
        let h = min(total, f.height - 40)
        view.scrollY = min(view.scrollY, max(0, total - h))
        panel.setFrame(NSRect(x: f.maxX - curW - 16, y: f.minY + 16, width: curW, height: h), display: true)
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
