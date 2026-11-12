// Dump the macOS accessibility (AX) tree of a process. Needs the Accessibility permission for the calling process.
import Foundation
import ApplicationServices

let pid = pid_t(CommandLine.arguments[1])!
let out = CommandLine.arguments[2]
var lines: [String] = []
lines.append("AXIsProcessTrusted=\(AXIsProcessTrusted())")
if !AXIsProcessTrusted() { lines.append("NOT TRUSTED: the runner did not grant the Accessibility permission to this process; AX attributes will be unavailable.") }
let app = AXUIElementCreateApplication(pid)
// Ask the app to build its accessibility tree.
AXUIElementSetAttributeValue(app, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
Thread.sleep(forTimeInterval: 1.5)
func attr(_ e: AXUIElement, _ name: String) -> AnyObject? {
  var v: CFTypeRef?
  return AXUIElementCopyAttributeValue(e, name as CFString, &v) == .success ? (v as AnyObject?) : nil
}
var count = 0
let maxNodes = 2500
func walk(_ e: AXUIElement, _ depth: Int) {
  if count >= maxNodes { return }
  count += 1
  let role = (attr(e, "AXRole") as? String) ?? "?"
  var parts = ["[\(role)]"]
  if let s = attr(e, "AXSubrole") as? String { parts.append("subrole=\(s)") }
  if let s = attr(e, "AXTitle") as? String, !s.isEmpty { parts.append("title='\(s)'") }
  if let s = attr(e, "AXDescription") as? String, !s.isEmpty { parts.append("desc='\(s)'") }
  if let v = attr(e, "AXValue") { parts.append("value=\(String(describing: v).prefix(80))") }
  if let s = attr(e, "AXSelected") as? Bool { parts.append("selected=\(s)") }
  if let s = attr(e, "AXFocused") as? Bool { parts.append("focused=\(s)") }
  if let i = attr(e, "AXIndex") { parts.append("index=\(i)") }
  if let rows = attr(e, "AXRows") as? [AnyObject] { parts.append("rows=\(rows.count)") }
  if let cols = attr(e, "AXColumns") as? [AnyObject] { parts.append("columns=\(cols.count)") }
  if let rng = attr(e, "AXRowIndexRange") { parts.append("rowRange=\(rng)") }
  if let rng = attr(e, "AXColumnIndexRange") { parts.append("colRange=\(rng)") }
  lines.append(String(repeating: "  ", count: depth) + parts.joined(separator: " "))
  if let kids = attr(e, "AXChildren") as? [AXUIElement] { for k in kids { walk(k, depth + 1) } }
}
walk(app, 0)
if count >= maxNodes { lines.append("... truncated at \(maxNodes) nodes") }
try! lines.joined(separator: "\n").appending("\n").write(toFile: out, atomically: true, encoding: .utf8)
print("\(count) nodes -> \(out)")
