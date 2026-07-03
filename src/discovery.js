import { cleanText, tokenizeCompanyName } from './utils.js';

export const KNOWN_CAREERS_URLS = new Map([
  ['ibm', 'https://www.ibm.com/in-en/careers/search'],
  ['microsoft', 'https://jobs.careers.microsoft.com/global/en/search'],
  ['google', 'https://www.google.com/about/careers/applications/jobs/results'],
  ['amazon', 'https://www.amazon.jobs/en/search'],
  ['accenture', 'https://www.accenture.com/in-en/careers/jobsearch'],
  ['infosys', 'https://www.infosys.com/careers/apply.html'],
  ['tcs', 'https://www.tcs.com/careers'],
  ['wipro', 'https://careers.wipro.com/careers-home/'],
]);

const SEARCH_ENGINES = /(^|\.)bing\.com$|(^|\.)google\.com$|(^|\.)duckduckgo\.com$|(^|\.)yahoo\.com$/i;
const JOB_BOARDS = /linkedin|glassdoor|indeed|naukri|ambitionbox|monster|foundit|timesjobs/i;
const SOCIAL_OR_MEDIA = /facebook|twitter|x\.com|youtube|instagram|wikipedia|crunchbase/i;
const ATS_HOSTS = /workdayjobs|greenhouse\.io|lever\.co|ashbyhq|smartrecruiters|successfactors|myworkdayjobs|oraclecloud|icims|jobvite|bamboohr/i;

export async function resolveCareerUrl(page, company) {
  const known = KNOWN_CAREERS_URLS.get(tokenizeCompanyName(company.name));
  if (company.careerUrl) return company.careerUrl;
  if (known) return known;

  const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(`${company.name} official careers jobs`)}`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

  const candidates = await page.evaluate(() => {
    return [...document.querySelectorAll('a[href]')].map((anchor) => ({
      href: anchor.href,
      text: (anchor.innerText || anchor.textContent || '').replace(/\s+/g, ' ').trim(),
    }));
  });

  const best = rankCareerCandidates(candidates, company.name)[0];
  if (best) return best.href;

  throw new Error(`Could not auto-discover a careers page for "${company.name}". Add careerUrl for this company.`);
}

export function rankCareerCandidates(candidates, companyName) {
  const companyToken = tokenizeCompanyName(companyName);

  return candidates
    .filter((candidate) => /^https?:\/\//i.test(candidate.href))
    .map((candidate) => scoreCandidate(candidate, companyToken))
    .filter((candidate) => candidate.score >= 8)
    .sort((a, b) => b.score - a.score);
}

function scoreCandidate(candidate, companyToken) {
  let url;
  try {
    url = new URL(candidate.href);
  } catch {
    return { ...candidate, score: -100 };
  }

  const text = cleanText(candidate.text).toLowerCase();
  const href = candidate.href.toLowerCase();
  const hostToken = url.hostname.toLowerCase().replace(/[^a-z0-9]/g, '');
  const haystack = `${href} ${text}`;
  let score = 0;

  if (SEARCH_ENGINES.test(url.hostname)) score -= 30;
  if (JOB_BOARDS.test(url.hostname)) score -= 12;
  if (SOCIAL_OR_MEDIA.test(url.hostname)) score -= 12;
  if (url.hash && !url.pathname.replace('/', '')) score -= 20;

  if (hostToken.includes(companyToken)) score += 7;
  if (ATS_HOSTS.test(url.hostname)) score += 7;
  if (haystack.includes('career')) score += 6;
  if (haystack.includes('jobs')) score += 5;
  if (haystack.includes('job search')) score += 5;
  if (haystack.includes('open positions')) score += 4;
  if (haystack.includes('search results')) score += 2;
  if (/\/careers?|\/jobs?|\/job-search|\/openings?|\/search/i.test(url.pathname)) score += 5;
  if (/apply|job-details|jobdetail/i.test(url.pathname)) score += 2;

  return {
    href: candidate.href,
    text: candidate.text,
    score,
  };
}
