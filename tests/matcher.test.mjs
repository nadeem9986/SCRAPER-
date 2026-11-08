import test from 'node:test';
import assert from 'node:assert/strict';
import { rankJob, isExcludedJob } from '../src/matcher.js';

const baseContext = {
  company: 'TestCo',
  keyword: '',
  preferredLocations: [],
  entryLevelBoost: false,
};

function makeJob(overrides = {}) {
  return {
    title: 'Platform role',
    company: 'TestCo',
    location: '',
    url: 'https://example.com/jobs/1',
    snippet: '',
    ...overrides,
  };
}

test('personal project evidence contributes to scoring and is reported separately', () => {
  const ranked = rankJob(
    makeJob({ snippet: 'You will work on embeddings pipelines for legal documents.' }),
    baseContext,
  );
  const projectNames = ranked.matchedProjects.map((project) => project.name);
  assert.ok(projectNames.includes('legal-ai-rag-assistant'));
  assert.equal(ranked.score, 2); // bounded per-project bonus, no skill hits
  assert.deepEqual(ranked.matchedSkills, []); // project evidence stays out of the skills list
  assert.match(ranked.reasonToApply, /Personal project evidence: legal-ai-rag-assistant/);
});

test('project bonus is capped across many matching projects', () => {
  const ranked = rankJob(
    makeJob({ snippet: 'embeddings legal documents cart accessibility ancs service' }),
    baseContext,
  );
  assert.equal(ranked.matchedProjects.length, 5); // every project matched
  assert.equal(ranked.score, 4); // but only 2 projects x 2 points are scored
});

test('many matching terms from one project still score once', () => {
  const ranked = rankJob(
    makeJob({ snippet: 'legal documents embeddings' }),
    baseContext,
  );
  assert.equal(ranked.matchedProjects.length, 1);
  assert.ok(ranked.matchedProjects[0].matchedOn.length >= 2);
  assert.equal(ranked.score, 2);
});

test('boundary matching prevents storage/digital/javascript false hits', () => {
  const ranked = rankJob(
    makeJob({
      title: 'Storage engineer',
      snippet: 'Own our digital object storage platform; javascript not required.',
    }),
    baseContext,
  );
  assert.ok(!ranked.matchedSkills.includes('java')); // 'java' must not match inside 'javascript'
  assert.ok(!ranked.matchedSkills.includes('rag')); // 'rag' must not match inside 'storage'
  assert.ok(!ranked.matchedSkills.includes('git')); // 'git' must not match inside 'digital'
  assert.deepEqual(ranked.matchedSkills, ['javascript']);
  assert.deepEqual(ranked.matchedProjects, []); // no project terms hit by storage/digital text
});

test('gambling exclusion still applies', () => {
  assert.equal(isExcludedJob(makeJob({ snippet: 'sportsbook platform' })), true);
});

test('realistic matching role scores higher with project evidence', () => {
  const ranked = rankJob(
    makeJob({
      title: 'Associate Software Engineer - Python/React',
      location: 'Bengaluru',
      snippet: 'Entry level role using Python, React, Django and MySQL on our LangChain RAG platform.',
    }),
    {
      company: 'Acme',
      keyword: 'python developer',
      preferredLocations: ['Bengaluru', 'Remote', 'India'],
      entryLevelBoost: true,
    },
  );
  assert.equal(ranked.matchLabel, 'Strong Match');
  const projectNames = ranked.matchedProjects.map((project) => project.name);
  assert.ok(projectNames.includes('legal-ai-rag-assistant'));
  assert.ok(projectNames.includes('book_store'));
  console.log(`realistic role score: ${ranked.score}, projects: ${projectNames.join(', ')}`);
});
