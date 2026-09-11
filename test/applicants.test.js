'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { parse } = require('../src/applicants.js');

// Shaped the way the block reaches innerText on a Premium account.
const PREMIUM_BLOCK = [
  'Premium',
  'See how you compare to others who clicked apply',
  'Based on LinkedIn data. Excludes subsidiaries.',
  'Candidates who clicked apply',
  '2578 total',
  '195 in the past day',
  'Candidate seniority level',
  '83% Entry level candidates',
  '14% Senior level candidates'
].join('\n');

test('reads both counts from the Premium block', () => {
  assert.deepEqual(parse(PREMIUM_BLOCK), { total: 2578, recent: 195, period: 'day' });
});

test('reads thousands separators', () => {
  const out = parse('Candidates who clicked apply\n12,043 total\n1,205 in the past week');
  assert.deepEqual(out, { total: 12043, recent: 1205, period: 'week' });
});

test('a total with no recent figure still parses', () => {
  assert.deepEqual(parse('Candidates who clicked apply\n418 total'),
    { total: 418, recent: null, period: null });
});

test('returns null without the heading, which is the free account case', () => {
  assert.equal(parse('About the job\nWe are hiring. 2578 people work here.'), null);
});

test('returns null when the heading appears with no total', () => {
  assert.equal(parse('Candidates who clicked apply\nData unavailable'), null);
});

test('does not read a number from far below the heading', () => {
  const far = 'Candidates who clicked apply\n' + 'filler line\n'.repeat(40) + '900 total';
  assert.equal(parse(far), null);
});

test('ignores numbers before the heading', () => {
  const out = parse('50,000 employees\nSalary 200000 total comp\nCandidates who clicked apply\n12 total');
  assert.equal(out.total, 12);
});

test('empty and null input are safe', () => {
  assert.equal(parse(''), null);
  assert.equal(parse(null), null);
});
