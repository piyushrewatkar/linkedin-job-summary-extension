'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { SKILLS } = require('../src/skills.js');

test('dictionary is large enough to be useful', () => {
  assert.ok(SKILLS.length >= 300, `expected >= 300 skills, got ${SKILLS.length}`);
});

test('every entry has a name and no duplicate names', () => {
  const seen = new Set();
  for (const s of SKILLS) {
    assert.equal(typeof s.name, 'string', 'name must be a string');
    assert.ok(s.name.length > 0, 'name must not be empty');
    assert.ok(!seen.has(s.name.toLowerCase()), `duplicate skill: ${s.name}`);
    seen.add(s.name.toLowerCase());
  }
});

test('aliases, when present, are a non-empty array of strings', () => {
  for (const s of SKILLS) {
    if (s.aliases === undefined) continue;
    assert.ok(Array.isArray(s.aliases), `${s.name} aliases must be an array`);
    assert.ok(s.aliases.length > 0, `${s.name} aliases must not be empty`);
    for (const a of s.aliases) assert.equal(typeof a, 'string');
  }
});

test('ambiguous and overlapping names carry an explicit pattern', () => {
  const ambiguous = ['Go', 'R', 'C', 'C++', 'C#', '.NET', 'React', 'Spring', 'SQL'];
  for (const name of ambiguous) {
    const entry = SKILLS.find((s) => s.name === name);
    assert.ok(entry, `missing dictionary entry for ${name}`);
    assert.ok(entry.pattern instanceof RegExp, `${name} must define a pattern`);
  }
});

test('the dictionary sets a global for browser load order', () => {
  assert.ok(Array.isArray(globalThis.LJS_SKILLS), 'LJS_SKILLS global not set');
});
