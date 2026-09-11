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
const { extractSkills, usableSections } = require('../src/extractor.js');

const skillsFor = (text) => extractSkills(usableSections(splitSections(text)));

test('skills under Requirements land in required', () => {
  const out = skillsFor('Requirements:\nStrong Java and Spring Boot experience on AWS.');
  assert.deepEqual(out.required, ['Java', 'Spring Boot', 'AWS']);
  assert.deepEqual(out.preferred, []);
});

test('skills under Preferred land in preferred', () => {
  const out = skillsFor('Requirements:\nJava.\nNice to Have:\nKafka and gRPC.');
  assert.deepEqual(out.required, ['Java']);
  assert.deepEqual(out.preferred, ['Kafka', 'gRPC']);
});

test('a skill in both groups is reported as required only', () => {
  const out = skillsFor('Nice to Have:\nRedis.\nRequirements:\nRedis and SQL.');
  assert.ok(out.required.includes('Redis'));
  assert.ok(!out.preferred.includes('Redis'));
});

test('a line saying "a plus" overrides its required section', () => {
  const out = skillsFor('Requirements:\nPython is required.\nTerraform is a plus.');
  assert.ok(out.required.includes('Python'));
  assert.ok(out.preferred.includes('Terraform'));
});

test('Java does not match inside JavaScript', () => {
  const out = skillsFor('Requirements:\nJavaScript and TypeScript.');
  assert.ok(!out.required.includes('Java'));
  assert.ok(out.required.includes('JavaScript'));
});

test('Go matches Golang but not Google', () => {
  assert.ok(skillsFor('Requirements:\nWe use Golang.').required.includes('Go'));
  assert.ok(!skillsFor('Requirements:\nWe are a Google Cloud shop.').required.includes('Go'));
});

test('C does not match C++ or C#', () => {
  const out = skillsFor('Requirements:\nC++ and C# only.');
  assert.ok(!out.required.includes('C'));
  assert.ok(out.required.includes('C++'));
  assert.ok(out.required.includes('C#'));
});

test('aliases resolve to the canonical name', () => {
  const out = skillsFor('Requirements:\nk8s, postgres, and gcp.');
  assert.ok(out.required.includes('Kubernetes'));
  assert.ok(out.required.includes('PostgreSQL'));
  assert.ok(out.required.includes('Google Cloud'));
});

test('each group is capped at twelve entries', () => {
  const many = 'Requirements:\n' + [
    'Java', 'Python', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Scala',
    'Perl', 'Elixir', 'Haskell', 'Clojure', 'Groovy', 'Lua'
  ].join(', ') + '.';
  assert.equal(skillsFor(many).required.length, 12);
});

test('Spring is not double-reported inside Spring Boot', () => {
  const out = skillsFor('Requirements:\nStrong Spring Boot and Kubernetes experience in production.');
  assert.ok(out.required.includes('Spring Boot'));
  assert.ok(!out.required.includes('Spring'));
});

test('boilerplate sections do not contribute skills', () => {
  const out = skillsFor(
    'Requirements:\nStrong Java and Spring Boot experience, with Kubernetes and AWS running in production environments.\n' +
    'Benefits:\nWe use Slack and offer Excel training.'
  );
  assert.ok(!out.required.includes('Excel'));
});
