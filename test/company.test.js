'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/company.js');

const LINE = 'Software Development\n · \n1001-5000 employees\n · \n1,662 on LinkedIn';

// LinkedIn publishes no exact headcount. The bracket is a bracket, and the one
// precise figure on the page counts profiles rather than staff, so the card
// shows that figure and says so rather than implying a headcount it cannot know.
test('prefers the exact figure and keeps the bracket alongside it', () => {
  const out = parse(LINE);
  assert.equal(out.label, '1,662 on LinkedIn');
  assert.equal(out.exact, true);
  assert.equal(out.bracket, '1k-5k employees');
  assert.equal(out.onLinkedIn, 1662);
});

test('falls back to the bracket when no exact figure is given', () => {
  const out = parse('Software Development · 51-200 employees');
  assert.equal(out.label, '51-200 employees');
  assert.equal(out.exact, false);
  assert.equal(out.onLinkedIn, null);
});

test('reads thousands separators in the bracket', () => {
  assert.equal(parse('Financial Services · 5,001-10,000 employees').bracket, '5k-10k employees');
});

test('small companies keep their exact bracket figures', () => {
  assert.equal(parse('Software Development · 2-10 employees').bracket, '2-10 employees');
});

test('an open ended bracket is reported as such', () => {
  const out = parse('Retail · 10,001+ employees · 48,302 on LinkedIn');
  assert.equal(out.label, '48,302 on LinkedIn');
  assert.equal(out.bracket, '10k+ employees');
  assert.equal(out.max, null);
});

test('an exact figure with no bracket still works', () => {
  const out = parse('IT Services · 3,114 associated members');
  assert.equal(out.label, '3,114 on LinkedIn');
  assert.equal(out.bracket, null);
});

test('the exact figure is never rounded, however large', () => {
  assert.equal(parse('Retail · 10,001+ employees · 482,915 on LinkedIn').label, '482,915 on LinkedIn');
});

test('text with no company line returns null', () => {
  assert.equal(parse('About the job\nWe are hiring a backend engineer. 5+ years required.'), null);
  assert.equal(parse(''), null);
  assert.equal(parse(null), null);
});

test('a number not followed by "employees" or "on LinkedIn" is not a headcount', () => {
  assert.equal(parse('Over 100 people clicked apply. 2578 total.'), null);
});
