import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCents, formatCentsWhole } from './money.ts';

test('formats integer cents', () => {
  assert.equal(formatCents(0), '$0.00');
  assert.equal(formatCents(5), '$0.05');
  assert.equal(formatCents(-13541), '-$135.41');
  assert.equal(formatCents(123456789), '$1,234,567.89');
  assert.equal(formatCents(-100), '-$1.00');
});
test('whole dollars round half away from zero', () => {
  assert.equal(formatCentsWhole(12349), '$123');
  assert.equal(formatCentsWhole(12350), '$124');
  assert.equal(formatCentsWhole(-12350), '-$124');
});
test('rejects non-integers', () => {
  assert.throws(() => formatCents(1.5));
});
