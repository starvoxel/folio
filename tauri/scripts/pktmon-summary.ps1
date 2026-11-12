# Summarise a pktmon text export (UTF-16) to a small file: unique non-private IPv4 destinations with packet counts, then delete the raw text.
# pktmon sees the whole machine and carries no process names, so this is NOT attributable to the app; it is a cross-check of the socket sampler.
param([Parameter(Mandatory)][string]$Txt, [Parameter(Mandatory)][string]$Out)
$dst = @{}
$n = 0
foreach ($line in (Get-Content -Encoding Unicode $Txt -ReadCount 5000)) {
  foreach ($l in $line) {
    $n++
    if ($l -match 'IPv4.*?: (\d+\.\d+\.\d+\.\d+)\.(\d+) > (\d+\.\d+\.\d+\.\d+)\.(\d+)') {
      $d = $Matches[3]
      if ($d -notmatch '^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|224\.|255\.)') { $k = "$d`:$($Matches[4])"; $dst[$k] = 1 + [int]$dst[$k] }
    }
  }
}
$s = @("lines in text export: $n", 'top public IPv4 destinations (ip:port, packets), whole machine, not process-attributed:')
$s += ($dst.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 25 | ForEach-Object { "  $($_.Value)  $($_.Key)" })
$s | Set-Content $Out
Remove-Item $Txt -ErrorAction SilentlyContinue
