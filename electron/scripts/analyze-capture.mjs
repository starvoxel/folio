// Fails if a capture (scripts/capture.sh) shows any traffic or network syscall that is not loopback / local-socket.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: analyze-capture.mjs <capture dir>'); process.exit(2); }
const pcap = path.join(dir, 'capture.pcap');
const txt = execFileSync('tcpdump', ['-nr', pcap, '-i', 'any'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 28 }).split('\n').filter(Boolean);
const isLoop = (l) => /\b127\.\d+\.\d+\.\d+\b/.test(l) && !/\b(?!127\.)\d+\.\d+\.\d+\.\d+\.\d+/.test(l.replace(/127\.\d+\.\d+\.\d+(\.\d+)?/g, ''));
const nonLoop = txt.filter((l) => !isLoop(l));
const st = fs.readFileSync(path.join(dir, 'strace.log'), 'utf8').split('\n');
const sysc = st.filter((l) => /\b(connect|sendto|sendmsg|sendmmsg)\(/.test(l) && /sa_family=AF_INET6?\b/.test(l) && !/sin_addr=inet_addr\("127\./.test(l) && !/sin6_addr=inet_pton\(AF_INET6, "::1"\)/.test(l) && !/sa_family=AF_INET, sin_port=htons\(0\), sin_addr=inet_addr\("0\.0\.0\.0"\)/.test(l));
console.log(`packets captured: ${txt.length}; non-loopback packets: ${nonLoop.length}`);
console.log(`non-loopback connect/send syscalls in strace: ${sysc.length}`);
for (const l of nonLoop.slice(0, 20)) console.log('PKT  ' + l);
for (const l of sysc.slice(0, 20)) console.log('SYS  ' + l);
process.exit(nonLoop.length || sysc.length ? 1 : 0);
