'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/company.js');

const LINE = 'Software Development\n · \n1001-5000 employees\n · \n1,662 on LinkedIn';

test('reads the size bracket and the LinkedIn headcount separately', () => {
  assert.deepEqual(parse(LINE), {
    label: '1k-5k employees', min: 1001, max: 5000, onLinkedIn: 1662
  });
});

test('reads thousands separators in the bracket', () => {
  const out = parse('Financial Services · 5,001-10,000 employees · 9,421 on LinkedIn');
  assert.equal(out.label, '5k-10k employees');
  assert.equal(out.max, 10000);
});

test('small companies keep their exact figures', () => {
  assert.equal(parse('Software Development · 51-200 employees').label, '51-200 employees');
  assert.equal(parse('Software Development · 2-10 employees').label, '2-10 employees');
});

test('an open ended bracket is reported as such', () => {
  const out = parse('Retail · 10,001+ employees · 48,302 on LinkedIn');
  assert.equal(out.label, '10k+ employees');
  assert.equal(out.max, null);
});

test('a single figure with no range still works', () => {
  assert.equal(parse('Software Development · 240 employees').label, '240 employees');
});

test('the LinkedIn figure is optional', () => {
  assert.equal(parse('Software Development · 51-200 employees').onLinkedIn, null);
});

test('"associated members" is read as the LinkedIn figure', () => {
  assert.equal(parse('IT Services · 1001-5000 employees · 3,114 associated members').onLinkedIn, 3114);
});

test('text with no company line returns null', () => {
  assert.equal(parse('About the job\nWe are hiring a backend engineer. 5+ years required.'), null);
  assert.equal(parse(''), null);
  assert.equal(parse(null), null);
});

test('a number not followed by "employees" is not a headcount', () => {
  assert.equal(parse('Over 100 people clicked apply. 2578 total.'), null);
});
