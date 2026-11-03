#!/usr/bin/env node
// Scans Markdown/text files for AI-writing patterns. Usage: node scan.js <file...> [--json]
// Skips frontmatter, fenced code, and inline code. Exit 1 when findings exist.
'use strict';
const fs = require('fs');
const path = require('path');

const patterns = JSON.parse(fs.readFileSync(path.join(__dirname, 'patterns.json'), 'utf8'));

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds the compiled rule list from patterns.json. Pure. */
function buildRules(p) {
  const rules = [];
  for (const [category, { fix, terms }] of Object.entries(p.words)) {
    for (const term of terms) {
      const edge = /[a-z0-9]$/i.test(term) ? '\\b' : '';
      rules.push({ category, fix, re: new RegExp(`\\b${escapeRe(term)}${edge}`, 'gi') });
    }
  }
  for (const { match, fix } of p.wordy) {
    rules.push({ category: 'filler', fix, re: new RegExp(`\\b${escapeRe(match)}\\b`, 'gi') });
  }
  for (const { category, pattern, fix } of p.regex) {
    rules.push({ category, fix, re: new RegExp(pattern, 'giu') });
  }
  return rules;
}

/** Replaces code spans and fences with spaces, keeping line numbers. Pure. */
function maskCode(text) {
  const lines = text.split(/\r?\n/);
  let start = 0;
  if (lines[0] && lines[0].trim() === '---') {
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
    if (end > 0) start = end + 1;
  }
  let fence = null;
  return lines.map((line, i) => {
    if (i < start) return '';
    const m = line.match(/^\s*(`{3,}|~{3,})/);
    if (m) {
      if (!fence) fence = m[1][0];
      else if (m[1][0] === fence) fence = null;
      return '';
    }
    if (fence) return '';
    return line.replace(/`[^`]*`/g, (s) => ' '.repeat(s.length));
  });
}

/** Heading title-case check: 2+ later words capitalized, excluding acronyms. Pure. */
function titleCaseHeading(line) {
  const m = line.match(/^#{1,6}\s+(.*)$/);
  if (!m) return null;
  const words = m[1].replace(/[*_]/g, '').split(/\s+/).slice(1);
  const caps = words.filter((w) => /^[A-Z][a-z]+$/.test(w));
  return caps.length >= 2 ? m[1] : null;
}

/** Returns findings for one file's text. Pure. */
function scanText(text, rules) {
  const findings = [];
  maskCode(text).forEach((line, i) => {
    if (!line.trim()) return;
    for (const { category, fix, re } of rules) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        if (m[0] === '') { re.lastIndex++; continue; }
        findings.push({ line: i + 1, category, match: m[0].trim(), fix });
      }
    }
    const t = titleCaseHeading(line);
    if (t) findings.push({ line: i + 1, category: 'title-case', match: t, fix: 'use sentence case' });
  });
  return findings.sort((a, b) => a.line - b.line);
}

function main(argv) {
  const json = argv.includes('--json');
  const files = argv.filter((a) => a !== '--json');
  if (!files.length) {
    console.error('Usage: node scan.js <file...> [--json]');
    return 2;
  }
  const rules = buildRules(patterns);
  const all = [];
  for (const file of files) {
    for (const f of scanText(fs.readFileSync(file, 'utf8'), rules)) all.push({ file, ...f });
  }
  if (json) console.log(JSON.stringify(all, null, 2));
  else for (const f of all) console.log(`${f.file}:${f.line} [${f.category}] "${f.match}" -> ${f.fix}`);
  return all.length ? 1 : 0;
}

if (require.main === module) process.exit(main(process.argv.slice(2)));
module.exports = { buildRules, maskCode, scanText, titleCaseHeading };
