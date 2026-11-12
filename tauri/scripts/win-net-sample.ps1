# G1 on Windows: sample TCP/UDP sockets once a second, attributed to processes. Output: <Out>\samples.csv and <Out>\summary.txt
# "Web view tree" = the app process, its descendants, and every msedgewebview2.exe whose command line carries the app's WebView2 user data folder id.
# Limits (also stated in the results): this sees sockets of those processes only while a sample catches them (1 s). It does not see traffic sent by system
# services on the app's behalf (Windows diagnostic data, Edge update, DNS client service lookups are made by svchost), and it cannot see UDP that is open for < 1 s.
param([Parameter(Mandatory)][string]$Out, [int]$Seconds = 60, [string]$Id = 'invalid.example.folio.spike', [string]$AppName = 'folio')
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$csv = Join-Path $Out 'samples.csv'
'time,scope,pid,process,proto,local,remote,state' | Set-Content $csv
$end = (Get-Date).AddSeconds($Seconds)
$isLoop = { param($a) $a -match '^(127\.|::1$|0\.0\.0\.0$|::$|\*$|fe80:)' -or $a -eq '' }
while ((Get-Date) -lt $end) {
  $procs = Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name, CommandLine
  $root = @($procs | Where-Object { $_.Name -ieq "$AppName.exe" } | ForEach-Object { [int]$_.ProcessId })
  $ids = New-Object System.Collections.Generic.HashSet[int]
  foreach ($r in $root) { [void]$ids.Add($r) }
  do { $n = $ids.Count; foreach ($p in $procs) { if ($ids.Contains([int]$p.ParentProcessId)) { [void]$ids.Add([int]$p.ProcessId) } } } while ($ids.Count -ne $n)
  foreach ($p in $procs) { if ($p.Name -ieq 'msedgewebview2.exe' -and $p.CommandLine -like "*$Id*") { [void]$ids.Add([int]$p.ProcessId) } }
  $names = @{}; foreach ($p in $procs) { $names[[int]$p.ProcessId] = $p.Name }
  $t = (Get-Date).ToString('HH:mm:ss')
  $rows = @()
  foreach ($c in (Get-NetTCPConnection -ErrorAction SilentlyContinue)) {
    $scope = if ($ids.Contains([int]$c.OwningProcess)) { 'webview-tree' } else { 'other' }
    if ($scope -eq 'other' -and (& $isLoop $c.RemoteAddress)) { continue }
    $rows += "$t,$scope,$($c.OwningProcess),$($names[[int]$c.OwningProcess]),tcp,$($c.LocalAddress):$($c.LocalPort),$($c.RemoteAddress):$($c.RemotePort),$($c.State)"
  }
  foreach ($u in (Get-NetUDPEndpoint -ErrorAction SilentlyContinue)) {
    if ($ids.Contains([int]$u.OwningProcess)) { $rows += "$t,webview-tree,$($u.OwningProcess),$($names[[int]$u.OwningProcess]),udp,$($u.LocalAddress):$($u.LocalPort),,bound" }
  }
  $rows | Add-Content $csv
  Start-Sleep -Milliseconds 700
}
$all = Import-Csv $csv
$tree = $all | Where-Object { $_.scope -eq 'webview-tree' }
$treeRemote = $tree | Where-Object { $_.remote -ne '' -and $_.remote -notmatch '^(127\.|\[?::1|0\.0\.0\.0|\[?::\]?)' -and $_.state -ne 'Listen' }
$s = @()
$s += "samples: $(($all | Select-Object -ExpandProperty time -Unique).Count) distinct seconds"
$s += "web view tree processes seen: $((($tree | Select-Object -ExpandProperty process -Unique) -join ', '))"
$s += "web view tree sockets (any): $($tree.Count) rows; non-loopback remote (not Listen): $($treeRemote.Count) rows"
$s += ($treeRemote | Group-Object process, remote | Sort-Object Count -Descending | Select-Object -First 30 | ForEach-Object { "  $($_.Count)x $($_.Name)" })
$s += 'other (non-web-view) processes with non-loopback connections during the sample, by process:'
$s += ($all | Where-Object { $_.scope -eq 'other' } | Group-Object process | Sort-Object Count -Descending | Select-Object -First 15 | ForEach-Object { "  $($_.Count) rows  $($_.Name)" })
$s | Set-Content (Join-Path $Out 'summary.txt')
$s
