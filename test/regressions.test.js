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

test('LinkedIn panels above the posting do not contribute skills', () => {
  // The profile match panel lists skills from the reader's own profile. Read as
  // part of the posting, it made an Azure and .NET job report Java and Spring Boot.
  const page = [
    'Your profile and resume match several of the required qualifications:',
    'Show match details',
    'Skills: Microservices, Java, AWS, Spring Boot, SQL, Machine learning, Accessibility',
    'People you can reach out to',
    'About the job',
    'Design and develop secure backend APIs using .NET 8.0 (C#) and Python.',
    'Containerize and orchestrate applications using Docker and Terraform on Azure.',
    'Integrate and manage Kafka pipelines for real-time data streaming and events.'
  ].join('\n');
  const out = required(page);
  for (const leaked of ['Java', 'AWS', 'Spring Boot', 'SQL', 'Machine learning', 'Accessibility']) {
    assert.ok(!out.includes(leaked), leaked + ' leaked in from the profile panel');
  }
  for (const real of ['.NET', 'C#', 'Python', 'Docker', 'Terraform', 'Azure', 'Kafka']) {
    assert.ok(out.includes(real), 'missing ' + real);
  }
});

test('text with no posting heading is left alone', () => {
  const { trimToPosting } = require('../src/extractor.js');
  const plain = 'Requirements\nStrong Java and Kubernetes experience in production systems.';
  assert.equal(trimToPosting(plain), plain);
});

test('a heading with almost nothing after it is not treated as the start', () => {
  // Guards against throwing the posting away on a page where the phrase appears
  // as a stray label rather than as the real heading.
  const { trimToPosting } = require('../src/extractor.js');
  const text = 'Strong Java, Kubernetes and Terraform experience building services.\nAbout the job\nsee below';
  assert.equal(trimToPosting(text), text);
});

test('the posting heading itself is dropped, not kept as content', () => {
  const { trimToPosting } = require('../src/extractor.js');
  const body = 'x'.repeat(250);
  assert.equal(trimToPosting('panel noise\nAbout the job\n' + body).trim(), body);
});

test('similar-jobs rails below the posting do not contribute skills', () => {
  // Rail entries are job titles. Read as part of the posting, an NLP role in
  // the rail becomes NLP in the requirements.
  const page = [
    'About the job',
    'Lead and conduct code review, design review, testing and debugging activities.',
    'Clearly communicates Agile concepts to partners within the product team here.',
    'Delivers high-performance, scalable, repeatable and secure deliverables daily.',
    'Show more',
    'People also viewed',
    'Senior Machine Learning Engineer',
    'NLP Research Scientist',
    'Workday Integration Consultant',
    'Oracle Database Administrator',
    'Distributed Systems Engineer'
  ].join('\n');
  const out = required(page);
  for (const leaked of ['Machine learning', 'NLP', 'Workday', 'Oracle Database', 'Distributed systems']) {
    assert.ok(!out.includes(leaked), leaked + ' leaked in from the similar-jobs rail');
  }
  assert.ok(out.includes('Code review'));
  assert.ok(out.includes('Agile'));
});

test('"4 year degree" is the length of a degree, not an experience bar', () => {
  const summary = extract(
    'Requirements\n 4 year degree or equivalent experience\n 5+ years of software development experience'
  );
  assert.equal(summary.years.label, '5+ years');
});

test('a four year degree on its own produces no experience row', () => {
  assert.equal(
    extract('Requirements\nFour year degree or equivalent experience required for this role.').years,
    null
  );
});

test('"degree plus N years of experience" still counts as the bar', () => {
  // Guards the fix above against over-correcting: there the number is not
  // attached to the word degree, so it really is an experience requirement.
  assert.equal(
    extract("Requirements\nBachelor's Degree in Computer Science plus 8 years of experience.").years.label,
    '8 years'
  );
});

test('text with no end marker is left alone', () => {
  const { trimAfterPosting } = require('../src/extractor.js');
  const plain = 'Strong Java, Kubernetes and Terraform experience building production services daily.';
  assert.equal(trimAfterPosting(plain), plain);
});

test('an end marker appearing early is not treated as the end', () => {
  const { trimAfterPosting } = require('../src/extractor.js');
  const text = 'Premium\nStrong Java and Kubernetes experience building production services.';
  assert.equal(trimAfterPosting(text), text);
});
