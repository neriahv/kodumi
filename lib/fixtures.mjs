const loginBefore = `export function validateLogin(email, password) {
  if (!email || !password) {
    return { valid: false, error: 'Email and password are required' };
  }
  return { valid: true };
}
`;
const loginAfter = `export function validateLogin(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' ||
      !email.trim() || !password.trim()) {
    return { valid: false, error: 'Email and password are required' };
  }
  return { valid: true };
}
`;
const paginationBefore = `export function paginate(items, page = 1, pageSize = 3) {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}
`;
const paginationAfter = `export function paginate(items, page = 1, pageSize = 3) {
  if (!Number.isInteger(page) || page < 1 ||
      !Number.isInteger(pageSize) || pageSize < 1) {
    throw new RangeError('Page and pageSize must be positive integers');
  }
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
`;
const cartBefore = `export function cartTotal(items) {
  return items.reduce((total, item) => total + item.price, 0);
}
`;
const cartAfter = `export function cartTotal(items) {
  const cents = items.reduce((total, item) =>
    total + Math.round(item.price * 100) * item.quantity, 0);
  return cents / 100;
}
`;

export const fixtures = [
  {
    id: 'lab-login', name: 'Launchpad', slug: 'kodumi/launchpad', language: 'JavaScript',
    summary: 'A tiny authentication module with a whitespace validation bug.',
    title: 'Reject whitespace-only login credentials',
    description: 'Users can submit a login form with spaces in the email or password. Reject blank and non-string credentials while preserving valid logins.',
    path: 'src/auth/validate.mjs', before: loginBefore, after: loginAfter,
    evidence: [{path:'src/auth/validate.mjs',line:2,text:'The truthiness check accepts non-empty strings containing only spaces.'}],
    plan: ['Check that both credentials are strings.', 'Reject credentials that become empty after trimming.', 'Preserve the existing error shape and valid-login behavior.'],
    tests: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateLogin } from './src/auth/validate.mjs';
test('accepts valid credentials', () => assert.equal(validateLogin('reader@example.com', 'secret123').valid, true));
test('rejects empty email', () => assert.equal(validateLogin('', 'secret123').valid, false));
test('rejects whitespace-only email', () => assert.equal(validateLogin('   ', 'secret123').valid, false));
test('rejects whitespace-only password', () => assert.equal(validateLogin('reader@example.com', '   ').valid, false));
test('rejects non-string credentials', () => assert.equal(validateLogin(123, ['secret']).valid, false));
test('preserves error contract', () => assert.deepEqual(validateLogin('', ''), { valid: false, error: 'Email and password are required' }));
`,
    docs: '# Launchpad\nA curated Kodumi debugging lab. This repository is bundled locally, not connected to GitHub.\n',
  },
  {
    id: 'lab-pagination', name: 'Pagecraft', slug: 'kodumi/pagecraft', language: 'JavaScript',
    summary: 'A pagination utility with an off-by-one error.',
    title: 'Restore the missing first page',
    description: 'The first page skips the first three items. Use one-based pages and reject invalid page sizes and page numbers.',
    path: 'src/paginate.mjs', before: paginationBefore, after: paginationAfter,
    evidence: [{path:'src/paginate.mjs',line:2,text:'Multiplying page by pageSize starts page 1 at index 3 instead of index 0.'}],
    plan: ['Convert one-based page numbers to a zero-based array offset.', 'Require positive integer page and pageSize values.', 'Verify first, second, empty, and out-of-range pages.'],
    tests: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from './src/paginate.mjs';
test('returns the first page', () => assert.deepEqual(paginate([1,2,3,4,5,6]), [1,2,3]));
test('returns the second page', () => assert.deepEqual(paginate([1,2,3,4,5,6], 2), [4,5,6]));
test('handles empty collections', () => assert.deepEqual(paginate([]), []));
test('handles pages beyond the collection', () => assert.deepEqual(paginate([1,2], 4), []));
test('rejects zero page', () => assert.throws(() => paginate([1], 0), RangeError));
test('rejects invalid page sizes', () => assert.throws(() => paginate([1], 1, 0), RangeError));
test('rejects fractional pages', () => assert.throws(() => paginate([1], 1.5), RangeError));
`, docs: '# Pagecraft\nA curated Kodumi pagination debugging lab.\n',
  },
  {
    id: 'lab-cart', name: 'Tinycart', slug: 'kodumi/tinycart', language: 'JavaScript',
    summary: 'A shopping cart that ignores item quantities.',
    title: 'Include quantities in cart totals',
    description: 'Cart totals add unit prices but ignore quantities. Calculate in integer cents to avoid floating-point artifacts. Inputs use non-negative prices with at most two decimal places and non-negative integer quantities.',
    path: 'src/cart.mjs', before: cartBefore, after: cartAfter,
    evidence: [{path:'src/cart.mjs',line:2,text:'The reduction adds item.price once per line and never reads item.quantity.'}],
    plan: ['Convert each unit price to integer cents.', 'Multiply each line price by its quantity.', 'Sum cents and return the total in currency units.'],
    tests: `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cartTotal } from './src/cart.mjs';
test('includes item quantities', () => assert.equal(cartTotal([{price:12.5,quantity:3}]), 37.5));
test('sums multiple lines', () => assert.equal(cartTotal([{price:10,quantity:2},{price:5,quantity:3}]), 35));
test('handles an empty cart', () => assert.equal(cartTotal([]), 0));
test('avoids decimal addition artifacts', () => assert.equal(cartTotal([{price:0.1,quantity:1},{price:0.2,quantity:1}]), 0.3));
test('handles zero quantities', () => assert.equal(cartTotal([{price:20,quantity:0}]), 0));
`, docs: '# Tinycart\nA curated Kodumi cart debugging lab.\n',
  },
];
export const getFixture = id => fixtures.find(f => f.id === id);
export function fixtureFiles(f) {
  return [
    { path:f.path, content:f.before, language:'javascript' },
    { path:'regression.test.mjs', content:f.tests, language:'javascript' },
    { path:'README.md', content:f.docs, language:'markdown' },
  ];
}
