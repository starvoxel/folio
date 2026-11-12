# A5: best-effort network observation on Windows, attributed by process.
# Samples Get-NetTCPConnection and Get-NetUDPEndpoint every 500 ms for -Seconds and records, per sample, every connection owned by a
# process named FolioSlice, plus a tally of every non-loopback connection of all other processes (the runner's own background traffic).
# Also runs a packet capture with pktmon (all NICs) to cross-check the set of remote addresses. Usage: pwsh win-netwatch.ps1 -Out <dir> -Seconds 480
param([string]$Out, [int]$Seconds = 480)
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$etl = Join-Path $Out "pktmon.etl"
try { pktmon stop 2>&1 | Out-Null; pktmon start --capture --comp nics --file-name $etl 2>&1 | Out-File (Join-Path $Out "pktmon-start.txt") } catch { "pktmon unavailable: $_" | Out-File (Join-Path $Out "pktmon-start.txt") }
$app = New-Object System.Collections.Generic.List[string]
$other = @{}
$byproc = @{}   # every process, loopback included: shows the sampler can see sockets (validation of the method)
$names = @{}
$end = (Get-Date).AddSeconds($Seconds)
$samples = 0; $appSeen = 0
function IsLocal($a) { return ($a -eq "127.0.0.1" -or $a -eq "::1" -or $a -eq "0.0.0.0" -or $a -eq "::" -or $a -like "fe80:*") }
while ((Get-Date) -lt $end) {
  $samples++
  $procs = @{}; Get-Process | ForEach-Object { $procs[$_.Id] = $_.ProcessName }
  $t = Get-Date -Format "HH:mm:ss.fff"
  $conns = @(); try { $conns += Get-NetTCPConnection -ErrorAction SilentlyContinue | Select-Object @{n='proto';e={'tcp'}}, LocalAddress, LocalPort, RemoteAddress, RemotePort, State, OwningProcess } catch {}
  try { $conns += Get-NetUDPEndpoint -ErrorAction SilentlyContinue | Select-Object @{n='proto';e={'udp'}}, LocalAddress, LocalPort, @{n='RemoteAddress';e={''}}, @{n='RemotePort';e={0}}, @{n='State';e={''}}, OwningProcess } catch {}
  foreach ($c in $conns) {
    $pn = $procs[[int]$c.OwningProcess]; if (-not $pn) { $pn = "pid" + $c.OwningProcess }
    $bk = "$pn  state=$($c.State)  local=$($c.LocalAddress)  remote=$($c.RemoteAddress)"; if ($c.State -ne 'Listen' -or $pn -like 'folio*' -or $pn -eq 'System') { $byproc[$bk] = 1 + [int]$byproc[$bk] }
    if ($pn -eq "FolioSlice") {
      $appSeen++
      $app.Add(("{0},{1},{2}:{3},{4}:{5},{6}" -f $t, $c.proto, $c.LocalAddress, $c.LocalPort, $c.RemoteAddress, $c.RemotePort, $c.State))
    } elseif ($c.proto -eq 'tcp' -and $c.RemoteAddress -and -not (IsLocal $c.RemoteAddress) -and $c.State -ne 'Listen') {
      $k = "$pn -> $($c.RemoteAddress):$($c.RemotePort)"; $other[$k] = 1 + [int]$other[$k]
    }
  }
  Start-Sleep -Milliseconds 500
}
try { pktmon stop 2>&1 | Out-File (Join-Path $Out "pktmon-stop.txt"); pktmon etl2txt $etl --out (Join-Path $Out "pktmon.txt") 2>&1 | Out-Null } catch {}
$byproc.GetEnumerator() | Where-Object { $_.Name -match "folio|System|pwsh" } | Sort-Object Name | ForEach-Object { "{0}  samples={1}" -f $_.Name, $_.Value } | Set-Content (Join-Path $Out "loopback-and-listeners-validation.txt")
$app | Sort-Object -Unique | Set-Content (Join-Path $Out "app-connections-unique.csv")
$other.GetEnumerator() | Sort-Object Name | ForEach-Object { "{0}  samples={1}" -f $_.Key, $_.Value } | Set-Content (Join-Path $Out "other-processes-nonloopback.txt")
$nonlocalApp = $app | Where-Object { $f = $_.Split(','); $r = ($f[3] -replace ':\d+$', ''); $r -and -not (IsLocal $r) } | Sort-Object -Unique
"samples=$samples; sample interval ~500 ms (+ enumeration time); rows for FolioSlice (all, incl. loopback) = $appSeen" | Set-Content (Join-Path $Out "summary.txt")
"app rows with a non-loopback remote address: $(@($nonlocalApp).Count)" | Add-Content (Join-Path $Out "summary.txt")
$nonlocalApp | Add-Content (Join-Path $Out "summary.txt")
if (Test-Path (Join-Path $Out "pktmon.txt")) { $remote = Select-String -Path (Join-Path $Out "pktmon.txt") -Pattern '(\d{1,3}\.){3}\d{1,3}\.\d+ > (\d{1,3}\.){3}\d{1,3}\.\d+' -AllMatches | ForEach-Object { $_.Matches.Value } | ForEach-Object { ($_ -split ' > ')[1] -replace '\.\d+$', '' } | Where-Object { $_ -notlike '127.*' } | Sort-Object | Group-Object | ForEach-Object { "{0} packets={1}" -f $_.Name, $_.Count }; "pktmon destination addresses (all processes):" | Add-Content (Join-Path $Out "summary.txt"); $remote | Add-Content (Join-Path $Out "summary.txt") }
