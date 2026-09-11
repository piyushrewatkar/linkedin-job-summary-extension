'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/skills.js');
const { splitSections } = require('../src/extractor.js');

const typesOf = (secs) => secs.map((s) => s.type);
const sectionText = (secs, type) =>
  secs.filter((s) => s.type === type).map((s) => s.text).join('\n');

test('a colon heading starts a new section', () => {
  const secs = splitSections(
    'We build payments infrastructure.\n' +
    'Requirements:\n' +
    'Strong Java skills.\n' +
    'Preferred Qualifications:\n' +
    'Exposure to Kafka.'
  );
  assert.ok(typesOf(secs).includes('required'));
  assert.ok(typesOf(secs).includes('preferred'));
  assert.match(sectionText(secs, 'required'), /Strong Java skills/);
  assert.match(sectionText(secs, 'preferred'), /Kafka/);
});

test('preferred wins over required when a heading contains both words', () => {
  const secs = splitSections('Preferred Qualifications:\nNice extras here.');
  assert.deepEqual(typesOf(secs), ['preferred']);
});

test('boilerplate headings are labelled other', () => {
  const secs = splitSections(
    'Requirements:\nPython and SQL.\nBenefits:\nFree lunch and a 401k match.'
  );
  assert.ok(typesOf(secs).includes('other'));
  assert.match(sectionText(secs, 'other'), /Free lunch/);
});

test('"About the job" is not treated as boilerplate', () => {
  const secs = splitSections('About the job\nYou will build APIs in Go.');
  assert.ok(!typesOf(secs).includes('other'));
});

test('text with no headings defaults to required', () => {
  const secs = splitSections('You will write Python every day and own the pipeline.');
  assert.deepEqual(typesOf(secs), ['required']);
});

test('bullet lines are never treated as headings', () => {
  const secs = splitSections('Requirements:\n- Experience with React\n- Experience with Node.js');
  assert.equal(secs.length, 1);
  assert.equal(secs[0].type, 'required');
});

test('empty input produces no sections', () => {
  assert.deepEqual(splitSections(''), []);
  assert.deepEqual(splitSections(null), []);
});
