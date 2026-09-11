'use strict';
// Defects found by review after the extractor passed its unit and fixture tests.
// Each one produced a confidently wrong answer rather than a blank one, which is
// the failure mode this project cares most about avoiding.
const test = require('node:test');
const assert = require('node:assert');
require('../src/skills.js');
const { extract } = require('../src/extractor.js');

const names = (list) => list.map((s) => s.name);
const required = (text) => names(extract(text).skillsRequired);

test('ordinary English words are not reported as skills', () => {
  const prose =
    'You will excel in a fast paced environment and dart between competing priorities.\n' +
    'We raised a Series C last year and the role starts in Spring 2026.\n' +
    'Our people are the spark behind everything we build, no less than that.\n' +
    'The rest of the team is remote. Write to jobs@acmecorp.net about Go-To-Market.';
  const summary = extract(prose);
  assert.deepEqual(summary.skillsRequired, [], 'prose with no technology must yield no skills');
  assert.deepEqual(summary.skillsPreferred, []);
  assert.equal(summary.empty, true);
});

test('the same words still match when they are the real technology', () => {
  const out = required(
    'Requirements\nAdvanced Excel and Spark, plus Dart and Spring Boot.\nWe build in C and Go.'
  );
  for (const skill of ['Excel', 'Spark', 'Dart', 'Spring Boot', 'C', 'Go']) {
    assert.ok(out.includes(skill), 'missing ' + skill);
  }
});

test('a list item with no bullet character and no full stop is not a heading', () => {
  // Browsers do not put the bullet glyph into innerText, so a LinkedIn <li>
  // arrives as a bare line and was being swallowed as a heading.
  const out = required(
    [
      'Requirements',
      'Experience with Java and Spring Boot',
      'Strong Kubernetes and Docker skills',
      'You have worked with PostgreSQL at scale'
    ].join('\n')
  );
  for (const skill of ['Java', 'Spring Boot', 'Kubernetes', 'Docker', 'PostgreSQL']) {
    assert.ok(out.includes(skill), 'missing ' + skill);
  }
});

test('a general experience phrase keeps the headline even when the line names a skill', () => {
  const summary = extract(
    'Requirements\n8+ years of professional experience building distributed systems on AWS.'
  );
  assert.equal(summary.years.label, '8+ years');
  const aws = summary.skillsRequired.find((s) => s.name === 'AWS');
  assert.equal(aws.years, null, 'AWS must not inherit the job-wide number');
});

test('a technology-specific number attaches to the nearest skill, not the first in the dictionary', () => {
  const summary = extract(
    'Requirements\n5+ years of hands-on Java, plus some exposure to Python for scripting.'
  );
  assert.equal(summary.skillsRequired.find((s) => s.name === 'Java').years, 5);
  assert.equal(summary.skillsRequired.find((s) => s.name === 'Python').years, null);
});

test('a three digit number is not read as a two digit one', () => {
  const summary = extract('Our leadership team has over 100 years of combined experience.');
  assert.equal(summary.years, null, '"100 years" must not become "0 years"');
});

test('a word ending in min is not a minimum prefix', () => {
  const summary = extract('Requirements\nAs a sysadmin 5 years of relevant experience is expected.');
  assert.equal(summary.years.label, '5 years');
});

test('a US state abbreviation is not a degree', () => {
  assert.equal(
    extract('Requirements\nThe team sits in Cambridge, MA. You will own our Python services.').education,
    null
  );
  assert.equal(
    extract('Requirements\nYou will partner with the BA, and own delivery of Python services.').education,
    null
  );
});

test('a real MA or BA degree is still recognised', () => {
  assert.equal(extract('Requirements\nMA in Economics required.').education.level, "Master's");
  assert.equal(extract('Requirements\nBA degree preferred.').education.level, "Bachelor's");
});
