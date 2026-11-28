import Cocoa

struct Card {
    let task: String
    let pct: Int
    let done: Int
    let total: Int
    let eta: String
    let now: String
    let blocks: [String]
    let at: Double
}

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

func loadCards() -> [Card] {
    _ = git(["fetch", "-q", "origin", "wf-state"])
    let names = git(["ls-tree", "--name-only", "FETCH_HEAD", "wf/"]).split(separator: "\n")
    var cards: [Card] = []
    for n in names {
        let txt = git(["show", "FETCH_HEAD:" + String(n)])
        guard let data = txt.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] else { continue }
        let at = (o["updatedAt"] as? NSNumber)?.doubleValue ?? 0
        let tasks = (o["tasks"] as? [[String: Any]]) ?? []
        for t in tasks {
            let blocks = ((t["blocks"] as? [[String: Any]]) ?? []).map { ($0["status"] as? String) ?? "todo" }
            cards.append(Card(
                task: (t["task"] as? String) ?? "",
                pct: (t["pct"] as? NSNumber)?.intValue ?? 0,
                done: (t["done"] as? NSNumber)?.intValue ?? 0,
                total: (t["total"] as? NSNumber)?.intValue ?? 0,
                eta: (t["eta"] as? String) ?? "",
                now: (t["now"] as? String) ?? "",
                blocks: blocks,
                at: at))
        }
    }
    return cards.sorted { $0.at > $1.at }
}

func color(_ s: String) -> NSColor {
    switch s {
    case "done": return NSColor(calibratedRed: 0.25, green: 0.74, blue: 0.47, alpha: 1)
    case "doing": return NSColor(calibratedRed: 0.30, green: 0.58, blue: 0.95, alpha: 1)
    case "blocked": return NSColor(calibratedRed: 0.90, green: 0.33, blue: 0.30, alpha: 1)
    case "skipped": return NSColor(calibratedRed: 0.89, green: 0.67, blue: 0.25, alpha: 1)
    default: return NSColor(calibratedWhite: 0.30, alpha: 1)
    }
}

final class WidgetView: NSView {
    var cards: [Card] = []
    var note = ""
    override var isFlipped: Bool { true }

    func text(_ s: String, _ x: CGFloat, _ y: CGFloat, _ size: CGFloat, _ bold: Bool, _ alpha: CGFloat, rightEdge: CGFloat? = nil) {
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: size, weight: bold ? .semibold : .regular),
            .foregroundColor: NSColor(calibratedWhite: 1, alpha: alpha)
        ]
        let str = NSString(string: s)
        let w = str.size(withAttributes: attrs).width
        str.draw(at: NSPoint(x: rightEdge != nil ? rightEdge! - w : x, y: y), withAttributes: attrs)
    }

    func render(_ w: CGFloat, _ draw: Bool) -> CGFloat {
        let pad: CGFloat = 14, sq: CGFloat = 9, gap: CGFloat = 3
        var y: CGFloat = 12
        if cards.isEmpty {
            if draw { text(note.isEmpty ? "No task yet" : note, pad, y, 12, false, 0.7) }
            return 44
        }
        for c in cards.prefix(2) {
            if draw {
                text("\(c.task)  \(c.pct)%  \(c.done)/\(c.total)", pad, y, 13, true, 0.95)
                text(c.eta, 0, y + 1, 11, false, 0.6, rightEdge: w - pad)
            }
            y += 22
            var x = pad
            for b in c.blocks {
                if x + sq > w - pad { x = pad; y += sq + gap }
                if draw {
                    color(b).setFill()
                    NSBezierPath(roundedRect: NSRect(x: x, y: y, width: sq, height: sq), xRadius: 2, yRadius: 2).fill()
                }
                x += sq + gap
            }
            y += sq + gap + 6
            if !c.now.isEmpty {
                if draw { text("Now: " + c.now, pad, y, 11, false, 0.7) }
                y += 16
            }
            y += 6
        }
        return y + 6
    }

    override func draw(_ dirtyRect: NSRect) {
        let path = NSBezierPath(roundedRect: bounds.insetBy(dx: 0.5, dy: 0.5), xRadius: 14, yRadius: 14)
        NSColor(calibratedWhite: 0.08, alpha: 0.96).setFill()
        path.fill()
        NSColor(calibratedWhite: 1, alpha: 0.12).setStroke()
        path.stroke()
        _ = render(bounds.width, true)
    }
}

final class App: NSObject {
    let width: CGFloat = 360
    let view = WidgetView()
    let panel: NSPanel

    override init() {
        panel = NSPanel(contentRect: NSRect(x: 0, y: 0, width: 360, height: 80),
                        styleMask: [.borderless, .nonactivatingPanel],
                        backing: .buffered, defer: false)
        super.init()
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary]
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.hidesOnDeactivate = false
        panel.isMovableByWindowBackground = true
        panel.contentView = view
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(frontChanged),
            name: NSWorkspace.didActivateApplicationNotification, object: nil)
        frontChanged()
        refresh()
        Timer.scheduledTimer(withTimeInterval: 4, repeats: true) { _ in self.refresh() }
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
        let h = view.render(width, false)
        guard let s = NSScreen.main else { return }
        let f = s.visibleFrame
        panel.setFrame(NSRect(x: f.maxX - width - 16, y: f.minY + 16, width: width, height: h), display: true)
        view.needsDisplay = true
    }

    func refresh() {
        DispatchQueue.global().async {
            let cards = loadCards()
            DispatchQueue.main.async {
                self.view.cards = cards
                self.view.note = cards.isEmpty ? "No data (git fetch failed?)" : ""
                self.place()
            }
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let controller = App()
app.run()
