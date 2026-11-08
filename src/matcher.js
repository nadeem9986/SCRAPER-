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

  for (const skill of IMPORTANT_SKILLS) {
    if (!includesTerm(text, skill)) missingImportantSkills.push(skill);
  }

  const uniqueMatchedSkills = unique(matchedSkills);
  const matchLabel = score >= 18 ? 'Strong Match' : score >= 9 ? 'Good Match' : 'Weak Match';
  const reasons = buildReasons(uniqueMatchedSkills, matchedLocations, matchLabel);

  return {
    ...job,
    company: context.company,
    searchedKeyword: context.keyword,
    score,
    matchLabel,
    matchedSkills: uniqueMatchedSkills,
    missingSkills: missingImportantSkills.slice(0, 10),
    matchedLocations: unique(matchedLocations),
    reasonToApply: reasons,
    scrapedAt: new Date().toISOString(),
  };
}

function includesTerm(text, term) {
  const normalizedTerm = cleanText(term).toLowerCase();
  if (!normalizedTerm) return false;
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

function buildReasons(matchedSkills, matchedLocations, matchLabel) {
  const reasons = [];

  if (matchedSkills.length) {
    reasons.push(`Matches resume skills: ${matchedSkills.slice(0, 6).join(', ')}`);
  }

  if (matchedLocations.length) {
    reasons.push(`Location preference matched: ${matchedLocations.slice(0, 3).join(', ')}`);
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
