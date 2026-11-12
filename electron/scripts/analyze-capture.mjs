// Reports anything in a capture (scripts/capture.sh) that is not loopback / local-socket traffic.
// Exit 1 if there is a finding. Kernel IPv6 housekeeping on the namespace's own veth pair (duplicate address detection,
// neighbour and router solicitations, MLD reports from ::) is not application traffic and is reported separately.
import * as fs from 'node:fs';
import * as path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: analyze-capture.mjs <capture dir>'); process.exit(2); }
const txtFile = path.join(dir, 'capture.txt');
const pkts = fs.existsSync(txtFile) ? fs.readFileSync(txtFile, 'utf8').split('\n').filter(Boolean) : [];
const isLoop = (l) => /\blo\b/.test(l.split(/\s+/)[2] ?? '') || / lo +(In|Out|M|P) /.test(l);
const isKernelV6 = (l) => /ICMP6, (neighbor (solicitation|advertisement)|router solicitation|multicast listener)|HBH ICMP6/.test(l);
const loop = pkts.filter(isLoop);
const kernel = pkts.filter((l) => !isLoop(l) && isKernelV6(l));
const app = pkts.filter((l) => !isLoop(l) && !isKernelV6(l));
const st = fs.readFileSync(path.join(dir, 'strace.log'), 'utf8').split('\n');
const sockets = new Map(); // "pid fd" -> socket() line
const findings = [];
const notices = [];
const pending = new Map(); // pid -> socket() args seen as <unfinished ...>
for (const l of st) {
  const m = /^(\d+)\s+\S+\s+socket\(([^)]*)\)\s+=\s+(\d+)/.exec(l);
  if (m) sockets.set(`${m[1]} ${m[3]}`, m[2]);
  const u = /^(\d+)\s+\S+\s+socket\(([^<]*)<unfinished/.exec(l);
  if (u) pending.set(u[1], u[2]);
  const r = /^(\d+)\s+\S+\s+<\.\.\. socket resumed>.*=\s+(\d+)/.exec(l);
  if (r && pending.has(r[1])) sockets.set(`${r[1]} ${r[2]}`, pending.get(r[1]));
  const c = /^(\d+)\s+\S+\s+(connect|sendto|sendmsg|sendmmsg)\((\d+),/.exec(l);
  if (!c || !/sa_family=AF_INET6?\b/.test(l)) continue;
  if (/sin_addr=inet_addr\("127\./.test(l) || /"::1"/.test(l) || /sin_addr=inet_addr\("0\.0\.0\.0"\)/.test(l)) continue;
  const sock = sockets.get(`${c[1]} ${c[3]}`) ?? '?';
  const entry = `${l.trim()}\n      socket(${sock})`;
  // connect() on a datagram socket only selects a route; it emits no packet. Chromium uses it to probe IPv6 reachability.
  if (c[2] === 'connect' && /SOCK_DGRAM/.test(sock)) notices.push(entry); else findings.push(entry);
}
console.log(`text capture lines: ${pkts.length}; loopback: ${loop.length}; kernel IPv6 housekeeping on the namespace veth: ${kernel.length}; other (application) packets: ${app.length}`);
console.log(`non-loopback connect/send syscalls in strace: ${findings.length} (plus ${notices.length} UDP route-probe connect() calls, no packet emitted)`);
for (const n of notices.slice(0, 5)) console.log('NOTICE ' + n);
for (const l of app.slice(0, 20)) console.log('PKT  ' + l);
for (const f of findings.slice(0, 20)) console.log('SYS  ' + f);
process.exit(app.length || findings.length ? 1 : 0);
