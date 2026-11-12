// macOS accessibility hierarchy dump (what the OS reports). Usage: ax-dump <pid> [maxDepth] [maxChildren]
// Needs the Accessibility permission for the process that runs it; prints AXIsProcessTrusted() so a block is visible.
import Cocoa
import ApplicationServices

let args = CommandLine.arguments
guard args.count > 1, let pid = Int32(args[1]) else { print("usage: ax-dump <pid>"); exit(2) }
let maxDepth = args.count > 2 ? Int(args[2])! : 30
let maxKids = args.count > 3 ? Int(args[3])! : 12
print("AXIsProcessTrusted: \(AXIsProcessTrusted())")

func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
    var v: CFTypeRef?
    return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? (v as AnyObject?) : nil
}
func names(_ e: AXUIElement) -> [String] {
    var n: CFArray?
    return AXUIElementCopyAttributeNames(e, &n) == .success ? (n as? [String] ?? []) : []
}
func walk(_ e: AXUIElement, _ d: Int) {
    let role = attr(e, "AXRole") as? String ?? "?"
    let sub = attr(e, "AXSubrole") as? String ?? ""
    let title = attr(e, "AXTitle") as? String ?? ""
    let desc = attr(e, "AXDescription") as? String ?? ""
    let val = attr(e, "AXValue").map { "\($0)" } ?? ""
    let sel = attr(e, "AXSelected").map { "\($0)" } ?? ""
    let foc = attr(e, "AXFocused").map { "\($0)" } ?? ""
    var line = String(repeating: " ", count: d) + "\(role)\(sub.isEmpty ? "" : "/" + sub) | title='\(title)' | desc='\(desc)' | value='\(val.prefix(80))'"
    if !sel.isEmpty { line += " | selected=\(sel)" }
    if foc == "1" { line += " | FOCUSED" }
    for k in ["AXRows", "AXSelectedRows", "AXColumns", "AXRowCount", "AXColumnCount", "AXRowIndexRange", "AXColumnIndexRange", "AXIndex"] { if let x = attr(e, k) { if let arr = x as? [Any] { line += " | \(k)=[\(arr.count) items]" } else { line += " | \(k)=\(x)" } } }
    let kids = (attr(e, "AXChildren") as? [AXUIElement]) ?? []
    line += " | children=\(kids.count)"
    print(line)
    if d < maxDepth { for k in kids.prefix(maxKids) { walk(k, d + 1) } ; if kids.count > maxKids { print(String(repeating: " ", count: d + 1) + "... \(kids.count - maxKids) more") } }
}
let app = AXUIElementCreateApplication(pid)
walk(app, 0)
