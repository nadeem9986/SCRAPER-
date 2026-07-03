import { cleanText } from './utils.js';

const LOCATION_HINTS = [
  'Bengaluru',
  'Bangalore',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Chennai',
  'Gurgaon',
  'Gurugram',
  'Noida',
  'Kolkata',
  'Delhi',
  'India',
  'Remote',
  'Hybrid',
  'On-site',
];

export async function searchCareerPage(page, keyword, companyName) {
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForSelector('body', { timeout: 30000 });

  const usedDirectUrl = await tryKnownUrlSearch(page, keyword);
  if (usedDirectUrl) return 'url';

  const usedSearchBox = await trySearchBox(page, keyword);
  if (usedSearchBox) return 'searchbox';

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+F' : 'Control+F').catch(() => {});
  await page.keyboard.type(keyword).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});
  await page.waitForTimeout(1500);

  return `${companyName}:visible-page`;
}

export async function extractJobs(page, companyName) {
  return page.evaluate(({ companyName: currentCompany, locationHints }) => {
    const clean = (value) => (value || '').replace(/\s+/g, ' ').trim();
    const isLikelyJobUrl = (href) => /job|career|apply|position|opening|requisition|posting|workday|greenhouse|lever|ashby|smartrecruiters|icims/i.test(href);
    const anchors = [...document.querySelectorAll('a[href]')];
    const jobs = [];

    for (const anchor of anchors) {
      const href = anchor.href;
      const text = clean(anchor.innerText || anchor.textContent);
      const card = anchor.closest('article, li, tr, [class*="card"], [class*="result"], [class*="job"], [class*="position"], [data-autoid], [data-testid]');
      const cardText = clean(card?.innerText || text);
      const title = inferTitle(text, cardText);

      if (!title || title.length < 4 || title.length > 160) continue;
      if (!isLikelyJobUrl(href) && !/engineer|developer|analyst|consultant|scientist|architect|associate|intern|specialist|manager/i.test(title)) continue;

      jobs.push({
        title,
        company: currentCompany,
        url: href,
        location: inferLocation(cardText, locationHints),
        snippet: cardText || title,
      });
    }

    return dedupe(jobs);

    function inferTitle(text, cardText) {
      const firstLine = clean(text.split('\n')[0]);
      if (firstLine && !/^apply|view|learn more|read more|search|next|previous$/i.test(firstLine)) return firstLine;

      const lines = cardText.split(/(?=[A-Z][a-z]+ )|\n/).map(clean).filter(Boolean);
      return lines.find((line) => /engineer|developer|analyst|consultant|scientist|architect|associate|intern|specialist|manager|lead/i.test(line)) || firstLine;
    }

    function inferLocation(text, hints) {
      return hints.filter((place) => new RegExp(`\\b${escapeRegExp(place)}\\b`, 'i').test(text)).join(', ');
    }

    function escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function dedupe(items) {
      const seen = new Set();
      return items.filter((item) => {
        const key = `${item.title.toLowerCase()}|${item.url.split('?')[0]}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
  }, { companyName, locationHints: LOCATION_HINTS });
}

async function trySearchBox(page, keyword) {
  const selectors = [
    'input[type="search"]',
    'input[placeholder*="Search" i]',
    'input[placeholder*="Keyword" i]',
    'input[placeholder*="Job" i]',
    '[role="searchbox"]',
    'input[name*="search" i]',
    'input[name*="keyword" i]',
    'input[id*="search" i]',
    'input[id*="keyword" i]',
  ];

  for (const selector of selectors) {
    const input = page.locator(selector).first();
    if (!(await input.count())) continue;

    await input.fill(keyword, { timeout: 5000 }).catch(() => {});
    await input.press('Enter').catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    return true;
  }

  return false;
}

async function tryKnownUrlSearch(page, keyword) {
  const url = new URL(page.url());
  const host = url.hostname.toLowerCase();
  const keywordValue = keyword.trim();

  if (!keywordValue) return false;

  if (host.includes('greenhouse.io')) {
    url.searchParams.set('keyword', keywordValue);
  } else if (host.includes('lever.co')) {
    url.searchParams.set('department', '');
    url.searchParams.set('team', '');
  } else if (host.includes('workdayjobs') || host.includes('myworkdayjobs')) {
    url.searchParams.set('q', keywordValue);
  } else if (host.includes('amazon.jobs')) {
    url.searchParams.set('base_query', keywordValue);
  } else if (host.includes('google.com')) {
    url.searchParams.set('q', keywordValue);
  } else if (host.includes('microsoft.com')) {
    url.searchParams.set('q', keywordValue);
  } else {
    return false;
  }

  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return true;
}
