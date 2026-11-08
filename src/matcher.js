import { EXCLUDED_TERMS, RESUME_PROFILE } from './profile.js';
import { cleanText, unique } from './utils.js';

export function isExcludedJob(job) {
  const text = cleanText(`${job.title} ${job.company || ''} ${job.snippet || ''} ${job.description || ''} ${job.url}`).toLowerCase();
  return EXCLUDED_TERMS.some((term) => text.includes(term));
}

const IMPORTANT_SKILLS = [
  ...RESUME_PROFILE.strongSkills,
  ...RESUME_PROFILE.supportingSkills,
];

// Personal projects add a small, capped bonus so real project work shows up
// without turning the projects list into another unbounded keyword pile.
const PROJECT_EVIDENCE_BONUS = 2;
const MAX_PROJECTS_SCORED = 2;

const PROJECT_TERM_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'over', 'via', 'from',
  'app', 'site', 'handling', 'includes', 'fixes', 'tests', 'using',
  'built', 'personal', 'assistant', 'store',
]);

export function rankJob(job, context) {
  const text = cleanText(`${job.title} ${job.location} ${job.snippet} ${job.description || ''} ${job.url}`).toLowerCase();
  const matchedSkills = [];
  const missingImportantSkills = [];
  const matchedLocations = [];
  let score = 0;

  for (const skill of RESUME_PROFILE.strongSkills) {
    if (includesTerm(text, skill)) {
      matchedSkills.push(skill);
      score += 4;
    }
  }

  for (const skill of RESUME_PROFILE.supportingSkills) {
    if (includesTerm(text, skill)) {
      matchedSkills.push(skill);
      score += 2;
    }
  }

  for (const role of RESUME_PROFILE.targetRoles) {
    if (includesTerm(text, role)) score += 4;
  }

  for (const place of context.preferredLocations) {
    if (includesTerm(text, place)) {
      matchedLocations.push(place);
      score += 3;
    }
  }

  if (includesTerm(text, context.keyword)) score += 3;

  if (context.entryLevelBoost) {
    const hasEntryLevelSignal = RESUME_PROFILE.entryLevelSignals.some((term) => includesTerm(text, term));
    if (hasEntryLevelSignal) score += 5;
  }

  const matchedProjects = matchProjects(text);
  score += Math.min(matchedProjects.length, MAX_PROJECTS_SCORED) * PROJECT_EVIDENCE_BONUS;

  for (const skill of IMPORTANT_SKILLS) {
    if (!includesTerm(text, skill)) missingImportantSkills.push(skill);
  }

  const uniqueMatchedSkills = unique(matchedSkills);
  const matchLabel = score >= 18 ? 'Strong Match' : score >= 9 ? 'Good Match' : 'Weak Match';
  const reasons = buildReasons(uniqueMatchedSkills, matchedLocations, matchLabel, matchedProjects);

  return {
    ...job,
    company: context.company,
    searchedKeyword: context.keyword,
    score,
    matchLabel,
    matchedSkills: uniqueMatchedSkills,
    matchedProjects,
    missingSkills: missingImportantSkills.slice(0, 10),
    matchedLocations: unique(matchedLocations),
    reasonToApply: reasons,
    scrapedAt: new Date().toISOString(),
  };
}

function projectTerms(project) {
  const raw = `${project.name || ''} ${project.summary || ''}`.toLowerCase();
  const tokens = raw
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !PROJECT_TERM_STOPWORDS.has(token));
  return unique(tokens);
}

function matchProjects(text) {
  const matched = [];
  for (const project of RESUME_PROFILE.projects || []) {
    const matchedOn = projectTerms(project).filter((term) => includesTerm(text, term));
    if (matchedOn.length) {
      matched.push({ name: project.name, matchedOn: matchedOn.slice(0, 3) });
    }
  }
  return matched;
}

function includesTerm(text, term) {
  const normalizedTerm = cleanText(term).toLowerCase();
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

function buildReasons(matchedSkills, matchedLocations, matchLabel, matchedProjects) {
  const reasons = [];

  if (matchedSkills.length) {
    reasons.push(`Matches resume skills: ${matchedSkills.slice(0, 6).join(', ')}`);
  }

  if (matchedLocations.length) {
    reasons.push(`Location preference matched: ${matchedLocations.slice(0, 3).join(', ')}`);
  }

  if (matchedProjects.length) {
    const evidence = matchedProjects
      .slice(0, MAX_PROJECTS_SCORED)
      .map((project) => `${project.name} (on ${project.matchedOn.join(', ')})`)
      .join('; ');
    reasons.push(`Personal project evidence: ${evidence}.`);
  }

  if (matchLabel === 'Strong Match') {
    reasons.push('Prioritize this role for application or referral outreach.');
  } else if (matchLabel === 'Good Match') {
    reasons.push('Worth reviewing closely; tailor resume bullets to the job description.');
  } else {
    reasons.push('Lower priority unless the role has hidden fit in the full description.');
  }

  return reasons.join(' ');
}
