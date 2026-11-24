// ------------------------------
// folio-plugin.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Local ESLint rules no published plugin covers: `file-header` (the javascript_base header block,
 * applied to `.ts` and `.tsx` too) and `max-comment-lines` (project-standards.md, "Comments").
 */

const RULE_LINE = '// ------------------------------';
const AUTHOR_PATTERN = /^\/\/ Author: .+ - \d{4}-\d{2}-\d{2}$/;
const COPYRIGHT_PATTERN = /^\/\/ Copyright \(c\) .+\. All rights reserved\.$/;

/**
 * Describe what is wrong with the first lines of a file, or return null when the header is valid.
 * @param {string[]} lines - The first lines of the file.
 * @param {string} fileName - The base name of the file, which the second header line must repeat.
 * @returns {string | null} A description of the first problem found, or null.
 */
function findHeaderProblem(lines, fileName) {
  if (lines[0] !== RULE_LINE) {
    return 'the first line must be the header rule';
  }
  if (lines[1] !== `// ${fileName}`) {
    return `the second line must be "// ${fileName}"`;
  }
  if (lines[2] !== '//') {
    return 'the third line must be "//"';
  }
  if (!AUTHOR_PATTERN.test(lines[3] ?? '')) {
    return 'the fourth line must be "// Author: {name} - {YYYY-MM-DD}"';
  }
  if (lines[4] !== '//') {
    return 'the fifth line must be "//"';
  }
  if (!COPYRIGHT_PATTERN.test(lines[5] ?? '')) {
    return 'the sixth line must be "// Copyright (c) {company}. All rights reserved."';
  }
  if (lines[6] !== RULE_LINE) {
    return 'the seventh line must be the header rule';
  }
  return null;
}

const fileHeader = {
  meta: {
    type: 'problem',
    fixable: 'code',
    schema: [
      {
        type: 'object',
        properties: {
          author: { type: 'string' },
          company: { type: 'string' },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      invalid: 'File header block is wrong: {{problem}}.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const author = options.author ?? 'Starvoxel AI Agent';
    const company = options.company ?? 'Starvoxel';
    return {
      Program(node) {
        const fileName = context.filename.split(/[\\/]/u).at(-1);
        const lines = context.sourceCode.lines.slice(0, 7);
        const problem = findHeaderProblem(lines, fileName);
        if (problem === null) {
          return;
        }
        context.report({
          node,
          loc: { line: 1, column: 0 },
          messageId: 'invalid',
          data: { problem },
          fix(fixer) {
            // Only insert a header into a file that has none; a wrong header is fixed by hand.
            if (lines[0]?.startsWith('// ---')) {
              return null;
            }
            const today = new Date().toISOString().slice(0, 10);
            const header = [
              RULE_LINE,
              `// ${fileName}`,
              '//',
              `// Author: ${author} - ${today}`,
              '//',
              `// Copyright (c) ${company}. All rights reserved.`,
              RULE_LINE,
              '',
              '',
            ].join('\n');
            return fixer.insertTextBeforeRange([0, 0], header);
          },
        });
      },
    };
  },
};

const DIRECTIVE_PATTERN = /^\s*(eslint-|@ts-|prettier-ignore|istanbul |c8 |jscpd:)/u;

/**
 * Count the lines a JSDoc comment spends on its description and the most lines any one tag uses.
 * @param {string} value - The comment text between the opening and closing markers.
 * @returns {{ description: number, tag: number }} Description lines and the longest tag, in lines.
 */
function measureJsdoc(value) {
  let description = 0;
  let tag = 0;
  let current = 0;
  let inTag = false;
  for (const raw of value.split('\n')) {
    const text = raw.replace(/^\s*\*+\s?/u, '').trim();
    if (text.startsWith('@')) {
      inTag = true;
      current = 1;
    } else if (text !== '') {
      if (inTag) {
        current += 1;
      } else {
        description += 1;
      }
    }
    tag = Math.max(tag, current);
  }
  return { description, tag };
}

/**
 * Group `//` comments that sit on consecutive lines into one block each.
 * @param {import('eslint').AST.Token[]} comments - The line comments of a file, in order.
 * @returns {import('eslint').AST.Token[][]} The blocks.
 */
function groupLineComments(comments) {
  const groups = [];
  for (const comment of comments) {
    const last = groups.at(-1)?.at(-1);
    if (last !== undefined && comment.loc.start.line === last.loc.end.line + 1) {
      groups.at(-1).push(comment);
    } else {
      groups.push([comment]);
    }
  }
  return groups;
}

const maxCommentLines = {
  meta: {
    type: 'suggestion',
    schema: [
      {
        type: 'object',
        properties: {
          line: { type: 'integer', minimum: 1 },
          jsdoc: { type: 'integer', minimum: 1 },
          tag: { type: 'integer', minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      line: 'Comment is {{count}} lines; keep it to {{max}}. Say why, not what, or link the doc that owns it.',
      jsdoc:
        'JSDoc description is {{count}} lines; keep it to {{max}}. Say why, not what, or link the doc that owns it.',
      tag: 'A JSDoc tag description is {{count}} lines; keep it to {{max}}.',
    },
  },
  create(context) {
    const options = context.options[0] ?? {};
    const limits = { line: options.line ?? 3, jsdoc: options.jsdoc ?? 4, tag: options.tag ?? 2 };
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();
        const lineComments = comments.filter(
          (c) => c.type === 'Line' && !DIRECTIVE_PATTERN.test(c.value),
        );
        for (const group of groupLineComments(lineComments)) {
          // The file header block (javascript_base) starts on line 1 and is exempt.
          if (group[0].loc.start.line === 1) {
            continue;
          }
          if (group.length > limits.line) {
            context.report({
              loc: { start: group[0].loc.start, end: group.at(-1).loc.end },
              messageId: 'line',
              data: { count: group.length, max: limits.line },
            });
          }
        }
        for (const comment of comments.filter((c) => c.type === 'Block')) {
          if (DIRECTIVE_PATTERN.test(comment.value)) {
            continue;
          }
          if (!comment.value.startsWith('*')) {
            const count = comment.loc.end.line - comment.loc.start.line + 1;
            if (count > limits.line) {
              context.report({
                loc: comment.loc,
                messageId: 'line',
                data: { count, max: limits.line },
              });
            }
            continue;
          }
          const measured = measureJsdoc(comment.value);
          if (measured.description > limits.jsdoc) {
            context.report({
              loc: comment.loc,
              messageId: 'jsdoc',
              data: { count: measured.description, max: limits.jsdoc },
            });
          }
          if (measured.tag > limits.tag) {
            context.report({
              loc: comment.loc,
              messageId: 'tag',
              data: { count: measured.tag, max: limits.tag },
            });
          }
        }
      },
    };
  },
};

export default {
  meta: { name: 'eslint-plugin-folio' },
  rules: { 'file-header': fileHeader, 'max-comment-lines': maxCommentLines },
};
