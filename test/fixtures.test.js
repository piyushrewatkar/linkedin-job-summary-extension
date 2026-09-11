'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('../src/skills.js');
const { extract } = require('../src/extractor.js');

const load = (name) =>
  fs.readFileSync(path.join(__dirname, 'fixtures', name + '.txt'), 'utf8');
const summarize = (name) => extract(load(name));
const names = (list) => list.map((s) => s.name);

test('structured posting: headline years, both skill groups, education', () => {
  const s = summarize('structured');
  assert.equal(s.years.label, '5+ years');
  for (const skill of ['Java', 'Spring Boot', 'Kubernetes', 'AWS', 'PostgreSQL']) {
    assert.ok(names(s.skillsRequired).includes(skill), 'missing required ' + skill);
  }
  for (const skill of ['Kafka', 'gRPC', 'Terraform']) {
    assert.ok(names(s.skillsPreferred).includes(skill), 'missing preferred ' + skill);
  }
  assert.equal(s.education.level, "Bachelor's");
  assert.equal(s.education.field, 'Computer Science');
  assert.equal(s.education.equivalentOk, true);
  assert.equal(s.empty, false);
});

test('structured posting: benefits boilerplate leaks nothing', () => {
  const s = summarize('structured');
  assert.ok(!names(s.skillsRequired).includes('Excel'));
  assert.notEqual(s.years.label, '20 years');
});

test('vague prose with no headings still yields skills and years', () => {
  const s = summarize('vague-prose');
  assert.equal(s.years.label, '3+ years');
  for (const skill of ['Python', 'Django', 'React', 'AWS', 'Docker']) {
    assert.ok(names(s.skillsRequired).includes(skill), 'missing ' + skill);
  }
  assert.equal(s.education, null);
});

test('preferred-heavy posting keeps the groups apart', () => {
  const s = summarize('preferred-heavy');
  assert.equal(s.years.label, '2+ years');
  assert.ok(names(s.skillsRequired).includes('SQL'));
  assert.ok(names(s.skillsRequired).includes('Excel'));
  for (const skill of ['Tableau', 'Power BI', 'Python', 'Snowflake', 'dbt']) {
    assert.ok(names(s.skillsPreferred).includes(skill), 'missing preferred ' + skill);
  }
  assert.ok(!names(s.skillsRequired).includes('Tableau'));
});

test('a posting with no numbers shows no years rather than guessing', () => {
  const s = summarize('no-years');
  assert.equal(s.years, null);
  assert.ok(names(s.skillsRequired).includes('Terraform'));
  assert.ok(names(s.skillsRequired).includes('Kubernetes'));
  assert.ok(names(s.skillsPreferred).includes('Prometheus'));
  assert.equal(s.empty, false);
});

test('technology years qualify their skill, not the headline', () => {
  const s = summarize('tech-specific-years');
  assert.equal(s.years.label, '7+ years');
  const python = s.skillsRequired.find((x) => x.name === 'Python');
  assert.ok(python, 'Python missing from required');
  assert.equal(python.years, 3);
  assert.equal(s.education.level, "Master's");
});

test('an unreadable blob summarises as empty rather than throwing', () => {
  const s = extract('   \n\n   ');
  assert.equal(s.empty, true);
  assert.equal(s.years, null);
  assert.deepEqual(s.skillsRequired, []);
});
