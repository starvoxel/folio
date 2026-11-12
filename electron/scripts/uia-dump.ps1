# Dump the Windows UI Automation tree of the app's top-level window (what NVDA/Narrator see through UIA).
param([int]$ProcessId, [string]$Out, [int]$MaxNodes = 2500)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$AE = [System.Windows.Automation.AutomationElement]
$cond = New-Object System.Windows.Automation.PropertyCondition($AE::ProcessIdProperty, $ProcessId)
$win = $null
for ($i = 0; $i -lt 30 -and -not $win; $i++) { $win = $AE::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond); if (-not $win) { Start-Sleep -Seconds 1 } }
$lines = New-Object System.Collections.Generic.List[string]
if (-not $win) {
  # Fall back to the window by class (Electron/Chromium top-level class) or title, and say what the desktop contains.
  foreach ($c in $AE::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)) {
    $lines.Add("desktop child: name='$($c.Current.Name)' pid=$($c.Current.ProcessId) class='$($c.Current.ClassName)'")
    if (-not $win -and ($c.Current.ClassName -eq 'Chrome_WidgetWin_1' -or $c.Current.Name -eq 'Folio')) { $win = $c; $lines.Add("  -> using this window") }
  }
}
if (-not $win) { $lines.Add("NO WINDOW for pid $ProcessId"); $lines | Set-Content -Encoding UTF8 $Out; exit 2 }
$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$script:count = 0
function Describe($e) {
  $c = $e.Current
  $extra = @()
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.GridPattern]::Pattern, [ref]$p)) { $extra += "GRID rows=$($p.Current.RowCount) cols=$($p.Current.ColumnCount)" } } catch {}
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.GridItemPattern]::Pattern, [ref]$p)) { $extra += "GRIDITEM row=$($p.Current.Row) col=$($p.Current.Column)" } } catch {}
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$p)) { $extra += "SELECTED=$($p.Current.IsSelected)" } } catch {}
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$p)) { $extra += "VALUE='$($p.Current.Value)'" } } catch {}
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.TablePattern]::Pattern, [ref]$p)) { $extra += "TABLE rows=$($p.Current.RowCount) cols=$($p.Current.ColumnCount)" } } catch {}
  try { $p = $null; if ($e.TryGetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$p)) { $extra += "EXPAND=$($p.Current.ExpandCollapseState)" } } catch {}
  "[$($c.ControlType.ProgrammaticName -replace 'ControlType\.','')] name='$($c.Name)' id='$($c.AutomationId)' class='$($c.ClassName)' focusable=$($c.IsKeyboardFocusable) focused=$($c.HasKeyboardFocus) enabled=$($c.IsEnabled) offscreen=$($c.IsOffscreen) $($extra -join ' ')"
}
function Walk($e, $depth) {
  if ($script:count -ge $MaxNodes) { return }
  $script:count++
  $lines.Add(('  ' * $depth) + (Describe $e))
  $ch = $walker.GetFirstChild($e)
  while ($ch -ne $null -and $script:count -lt $MaxNodes) { Walk $ch ($depth + 1); $ch = $walker.GetNextSibling($ch) }
}
Walk $win 0
if ($script:count -ge $MaxNodes) { $lines.Add("... truncated at $MaxNodes nodes") }
$lines | Set-Content -Encoding UTF8 $Out
Write-Output "$($script:count) nodes -> $Out"
