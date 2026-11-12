# Dump the Windows UI Automation tree of the running FolioSlice app (what the OS reports) in several states.
# Usage: pwsh tools/uia-dump.ps1 -App <FolioSlice.exe> -Cli <folio-slice-cli.exe> -Data <fixtures dir> -Out <dir> [-AppArgs "--a11y-fix"]
param([string]$App, [string]$Cli, [string]$Data, [string]$Out, [string]$AppArgs = "")
$ErrorActionPreference = "Continue"
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$disc = Join-Path $Out "discovery.json"; Remove-Item $disc -ErrorAction SilentlyContinue
$env:FOLIO_DISCOVERY = $disc
$argList = @("--data", $Data, "--automation", "--discovery", $disc, "--size", "1440x900") + ($AppArgs -split " " | Where-Object { $_ })
$p = Start-Process -FilePath $App -ArgumentList $argList -PassThru
& $Cli wait-ready | Out-Null
Start-Sleep -Seconds 3

function PatternNames($e) { try { ($e.GetSupportedPatterns() | ForEach-Object { $_.ProgrammaticName -replace "Identifiers.Pattern", "" }) -join "," } catch { "" } }
function Describe($e) {
  $c = $e.Current
  $s = "{0} | name='{1}' | id='{2}' | class='{3}' | patterns=[{4}]" -f ($c.ControlType.ProgrammaticName -replace "ControlType.", ""), $c.Name, $c.AutomationId, $c.ClassName, (PatternNames $e)
  try { $g = $e.GetCurrentPattern([System.Windows.Automation.GridPattern]::Pattern); $s += " | GRID rows={0} cols={1}" -f $g.Current.RowCount, $g.Current.ColumnCount } catch {}
  try { $t = $e.GetCurrentPattern([System.Windows.Automation.TablePattern]::Pattern); $s += " | TABLE rowHeaders={0} colHeaders={1}" -f $t.Current.GetRowHeaders().Length, $t.Current.GetColumnHeaders().Length } catch {}
  try { $gi = $e.GetCurrentPattern([System.Windows.Automation.GridItemPattern]::Pattern); $s += " | GRIDITEM row={0} col={1}" -f $gi.Current.Row, $gi.Current.Column } catch {}
  try { $si = $e.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern); $s += " | SELECTED={0}" -f $si.Current.IsSelected } catch {}
  try { $v = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern); $s += " | value='{0}'" -f $v.Current.Value } catch {}
  if ($c.HasKeyboardFocus) { $s += " | HAS-KEYBOARD-FOCUS" } elseif ($c.IsKeyboardFocusable) { $s += " | focusable" }
  if ($c.IsOffscreen) { $s += " | offscreen" }
  return $s
}
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
function Walk($e, $depth, $sb, $max) {
  if ($depth -gt 30) { return }
  [void]$sb.AppendLine((" " * $depth) + (Describe $e))
  $n = 0; $child = $walker.GetFirstChild($e)
  while ($child -ne $null) {
    if ($n -ge $max) { [void]$sb.AppendLine((" " * ($depth + 1)) + "... (more children not dumped)"); break }
    Walk $child ($depth + 1) $sb $max
    $n++; $child = $walker.GetNextSibling($child)
  }
}
function Dump($name, $max = 12) {
  $root = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children,
    (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $p.Id)))
  $sb = New-Object System.Text.StringBuilder
  if ($root -eq $null) { [void]$sb.AppendLine("no UIA window found for pid " + $p.Id) } else { Walk $root 0 $sb $max }
  try { $f = [System.Windows.Automation.AutomationElement]::FocusedElement; [void]$sb.AppendLine("FOCUSED ELEMENT: " + (Describe $f)) } catch { [void]$sb.AppendLine("FOCUSED ELEMENT: none ($_)") }
  Set-Content -Path (Join-Path $Out "$name.txt") -Value $sb.ToString() -Encoding UTF8
}
& $Cli navigate Transactions | Out-Null; Start-Sleep 2; Dump "transactions"
& $Cli invoke '{"action":"select","id":"tx-00002"}' | Out-Null; Start-Sleep 1; Dump "transactions-selected"
& $Cli navigate Reporting | Out-Null; Start-Sleep 2; Dump "reporting" 25
& $Cli navigate Settings | Out-Null; Start-Sleep 2; Dump "settings"
& $Cli invoke '{"action":"openDialog"}' | Out-Null; Start-Sleep 2; Dump "dialog"
& $Cli quit | Out-Null
Start-Sleep 2
if (!$p.HasExited) { $p.Kill() }
