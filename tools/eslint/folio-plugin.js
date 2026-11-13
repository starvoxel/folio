// ------------------------------
// folio-plugin.js
//
// Author: Starvoxel AI Agent - 2026-11-13
//
// Copyright (c) Starvoxel. All rights reserved.
// ------------------------------

/**
 * Local ESLint rules for Folio conventions that no published plugin covers.
 *
 * `file-header` enforces the file header block of the javascript_base standard on every source
 * file (the standard names `.js` files; TypeScript standards are not written yet, so the same
 * block applies to `.ts` and `.tsx`).
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

export default {
  meta: { name: 'eslint-plugin-folio' },
  rules: { 'file-header': fileHeader },
};
