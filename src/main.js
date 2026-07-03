import { Actor } from 'apify';
import { PlaywrightCrawler, log } from 'crawlee';
import { resolveCareerUrl } from './discovery.js';
import { extractJobs, searchCareerPage } from './extractor.js';
import { rankJob } from './matcher.js';
import { DEFAULT_KEYWORDS, DEFAULT_LOCATIONS, RESUME_PROFILE } from './profile.js';
import { writeFrontendData } from './output.js';
import { normalizeUrl, parseCompanyInputs, unique } from './utils.js';

await Actor.init();

const input = await Actor.getInput() ?? {};
const companies = parseCompanyInputs(input);
const keywords = unique(input.keywords?.length ? input.keywords : DEFAULT_KEYWORDS);
const preferredLocations = unique(input.locations?.length ? input.locations : DEFAULT_LOCATIONS);
const maxJobs = Number(input.maxJobs ?? 100);
const minScore = Number(input.minScore ?? 2);
const entryLevelBoost = input.entryLevelBoost !== false;
const headless = input.headless !== false;

const seen = new Map();
const resolvedCompanies = new Map();

const crawler = new PlaywrightCrawler({
  headless,
  maxConcurrency: 1,
  maxRequestRetries: 1,
  preNavigationHooks: [
    async (_crawlingContext, gotoOptions) => {
      gotoOptions.waitUntil = 'domcontentloaded';
    },
  ],
  requestHandlerTimeoutSecs: 120,
  navigationTimeoutSecs: 60,
  async requestHandler({ page, request }) {
    const { company, keyword } = request.userData;

    const targetUrl = await getCareerUrl(page, company);
    log.info(`Searching ${company.name} for "${keyword}" at ${targetUrl}`);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await acceptCookies(page);
    await searchCareerPage(page, keyword, company.name);

    const jobs = await extractJobs(page, company.name);
    log.info(`Found ${jobs.length} candidates for ${company.name} / "${keyword}"`);

    for (const job of jobs) {
      const ranked = rankJob(job, {
        company: company.name,
        keyword,
        preferredLocations,
        entryLevelBoost,
      });

      const key = normalizeUrl(ranked.url) || `${ranked.company}|${ranked.title}|${ranked.location}`;
      const existing = seen.get(key);
      if (!existing || ranked.score > existing.score) seen.set(key, ranked);
    }
  },
});

const requests = [];
for (const company of companies) {
  const seedUrl = company.careerUrl || 'https://www.bing.com/';
  for (const keyword of keywords) {
    requests.push({
      url: seedUrl,
      uniqueKey: `${company.name}-${keyword}`,
      userData: { company, keyword },
    });
  }
}

await crawler.run(requests);

const rankedJobs = [...seen.values()]
  .filter((job) => job.score >= minScore)
  .sort((a, b) => b.score - a.score || a.company.localeCompare(b.company) || a.title.localeCompare(b.title))
  .slice(0, maxJobs);

const summary = {
  generatedAt: new Date().toISOString(),
  resumeOwner: RESUME_PROFILE.owner,
  resumeHeadline: RESUME_PROFILE.headline,
  resumeFocus: RESUME_PROFILE.summary,
  companies: companies.map((company) => ({
    name: company.name,
    careerUrl: resolvedCompanies.get(company.name) || company.careerUrl || '',
  })),
  searchedKeywords: keywords,
  preferredLocations,
  savedJobs: rankedJobs.length,
  strongMatches: rankedJobs.filter((job) => job.matchLabel === 'Strong Match').length,
  goodMatches: rankedJobs.filter((job) => job.matchLabel === 'Good Match').length,
  weakMatches: rankedJobs.filter((job) => job.matchLabel === 'Weak Match').length,
  topMatches: rankedJobs.slice(0, 10),
};

await Actor.pushData(rankedJobs);
await Actor.setValue('MATCH_SUMMARY', summary);
await writeFrontendData({ jobs: rankedJobs, summary });

log.info(`Saved ${rankedJobs.length} ranked job matches across ${companies.length} company input(s).`);
await Actor.exit();

async function getCareerUrl(page, company) {
  const cached = resolvedCompanies.get(company.name);
  if (cached) return cached;

  const resolvedUrl = await resolveCareerUrl(page, company);
  resolvedCompanies.set(company.name, resolvedUrl);
  return resolvedUrl;
}

async function acceptCookies(page) {
  const labels = [/accept all/i, /^accept$/i, /agree/i, /allow all/i, /continue/i];
  for (const label of labels) {
    const button = page.getByRole('button', { name: label }).first();
    if (await button.count()) {
      await button.click({ timeout: 3000 }).catch(() => {});
      return;
    }
  }
}
