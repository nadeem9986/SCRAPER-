const state = {
  jobs: [],
  profile: null,
  suggestedInput: {},
};

const elements = {
  owner: document.querySelector('#owner'),
  focus: document.querySelector('#focus'),
  totalJobs: document.querySelector('#totalJobs'),
  strongJobs: document.querySelector('#strongJobs'),
  goodJobs: document.querySelector('#goodJobs'),
  weakJobs: document.querySelector('#weakJobs'),
  companyFilter: document.querySelector('#companyFilter'),
  matchFilter: document.querySelector('#matchFilter'),
  searchInput: document.querySelector('#searchInput'),
  sortFilter: document.querySelector('#sortFilter'),
  companyList: document.querySelector('#companyList'),
  keywordList: document.querySelector('#keywordList'),
  resultCount: document.querySelector('#resultCount'),
  jobs: document.querySelector('#jobs'),
  resumeFile: document.querySelector('#resumeFile'),
  targetCompanyInput: document.querySelector('#targetCompanyInput'),
  locationInput: document.querySelector('#locationInput'),
  experienceFilter: document.querySelector('#experienceFilter'),
  roleInput: document.querySelector('#roleInput'),
  applyResumeButton: document.querySelector('#applyResumeButton'),
  clearResumeButton: document.querySelector('#clearResumeButton'),
  resumeStatus: document.querySelector('#resumeStatus'),
  detectedSkillList: document.querySelector('#detectedSkillList'),
  suggestedInput: document.querySelector('#suggestedInput'),
};

init();

function init() {
  elements.owner.textContent = 'Find jobs from your resume';
  elements.focus.textContent = 'Upload a resume, enter a company, and view ranked roles after matching.';
  resetView();

  elements.applyResumeButton.addEventListener('click', matchJobs);
  elements.clearResumeButton.addEventListener('click', clearAll);
  elements.searchInput.addEventListener('input', renderJobs);
  elements.companyFilter.addEventListener('change', renderJobs);
  elements.matchFilter.addEventListener('change', renderJobs);
  elements.sortFilter.addEventListener('change', renderJobs);
  elements.locationInput.addEventListener('input', renderJobs);
  elements.experienceFilter.addEventListener('change', renderJobs);
  elements.roleInput.addEventListener('input', renderJobs);
  elements.resumeFile.addEventListener('change', () => {
    const file = elements.resumeFile.files?.[0];
    elements.resumeStatus.textContent = file ? `${file.name} selected. Click Match Jobs.` : 'Upload a resume to start matching jobs.';
  });
}

async function matchJobs() {
  const file = elements.resumeFile.files?.[0];
  if (!file) {
    elements.resumeStatus.textContent = 'Please upload a resume first.';
    return;
  }

  const form = new FormData();
  form.append('resume', file);
  form.append('company', elements.targetCompanyInput.value.trim());
  form.append('location', elements.locationInput.value.trim());
  form.append('experience', elements.experienceFilter.value);
  form.append('role', elements.roleInput.value.trim());

  elements.applyResumeButton.disabled = true;
  elements.resumeStatus.textContent = 'Reading resume in backend and matching jobs...';

  try {
    const response = await fetch('/api/match', {
      method: 'POST',
      body: form,
    });
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) throw new Error(payload.error || 'Could not match jobs.');

    state.jobs = payload.jobs || [];
    state.profile = payload.profile || null;
    state.suggestedInput = payload.suggestedInput || {};

    elements.owner.textContent = state.profile?.company
      ? `${state.profile.company} resume matches`
      : 'Resume job matches';
    elements.focus.textContent = 'Resume was processed in the backend. Only extracted skills and ranked jobs are shown here.';

    renderProfile();
    renderFilters();
    renderJobs();
    elements.resumeStatus.textContent = `${state.jobs.length} matched jobs found.`;
  } catch (error) {
    elements.resumeStatus.textContent = error.message;
  } finally {
    elements.applyResumeButton.disabled = false;
  }
}

function clearAll() {
  state.jobs = [];
  state.profile = null;
  state.suggestedInput = {};
  elements.resumeFile.value = '';
  elements.targetCompanyInput.value = '';
  elements.locationInput.value = '';
  elements.experienceFilter.value = '';
  elements.roleInput.value = '';
  elements.searchInput.value = '';
  elements.matchFilter.value = '';
  elements.sortFilter.value = 'resumeScore';
  elements.owner.textContent = 'Find jobs from your resume';
  elements.focus.textContent = 'Upload a resume, enter a company, and view ranked roles after matching.';
  resetView();
}

function resetView() {
  setStats([]);
  elements.companyFilter.innerHTML = '<option value="">All companies</option>';
  renderChips(elements.companyList, []);
  renderChips(elements.keywordList, []);
  elements.detectedSkillList.innerHTML = '<span class="chip">No resume uploaded</span>';
  elements.suggestedInput.textContent = '{}';
  elements.resultCount.textContent = '0 shown';
  elements.jobs.innerHTML = '<p class="focus">Upload a resume and click Match Jobs to see ranked roles.</p>';
  elements.resumeStatus.textContent = 'Upload a resume to start matching jobs.';
}

function renderProfile() {
  renderChips(elements.detectedSkillList, state.profile?.skills || []);
  renderChips(elements.companyList, state.profile?.company ? [state.profile.company] : []);
  renderChips(elements.keywordList, state.suggestedInput?.keywords || []);
  elements.suggestedInput.textContent = JSON.stringify(state.suggestedInput || {}, null, 2);
}

function renderFilters() {
  const companies = ['All companies', ...new Set(state.jobs.map((job) => job.company).filter(Boolean))];
  elements.companyFilter.innerHTML = companies
    .map((company, index) => `<option value="${index === 0 ? '' : escapeHtml(company)}">${escapeHtml(company)}</option>`)
    .join('');
}

function renderJobs() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const company = elements.companyFilter.value;
  const match = elements.matchFilter.value;
  const sort = elements.sortFilter.value;
  const location = elements.locationInput.value.trim().toLowerCase();
  const role = elements.roleInput.value.trim().toLowerCase();
  const experience = elements.experienceFilter.value;

  let jobs = state.jobs.filter((job) => {
    const haystack = buildHaystack(job);
    if (query && !haystack.includes(query)) return false;
    if (company && job.company !== company) return false;
    if (match && job.dynamicLabel !== match) return false;
    if (location && !haystack.includes(location)) return false;
    if (role && !haystack.includes(role)) return false;
    if (experience && !matchesExperience(job, experience)) return false;
    return true;
  });

  jobs = sortJobs(jobs, sort);
  setStats(jobs);
  elements.resultCount.textContent = `${jobs.length} shown`;
  elements.jobs.innerHTML = jobs.map(renderJobCard).join('') || '<p class="focus">No jobs match the current filters.</p>';
}

function setStats(jobs) {
  elements.totalJobs.textContent = jobs.length;
  elements.strongJobs.textContent = jobs.filter((job) => job.dynamicLabel === 'Strong Match').length;
  elements.goodJobs.textContent = jobs.filter((job) => job.dynamicLabel === 'Good Match').length;
  elements.weakJobs.textContent = jobs.filter((job) => job.dynamicLabel === 'Weak Match').length;
}

function renderJobCard(job) {
  const badgeClass = job.dynamicLabel === 'Strong Match' ? 'strong' : job.dynamicLabel === 'Good Match' ? 'good' : 'weak';
  const skills = (job.dynamicMatchedSkills || []).slice(0, 8);
  const missing = (job.dynamicMissingSkills || []).slice(0, 6);

  return `
    <article class="job">
      <div>
        <h3><a href="${escapeAttribute(job.url)}" target="_blank" rel="noreferrer">${escapeHtml(job.title)}</a></h3>
        <div class="job-meta">${escapeHtml(job.company || '')}${job.location ? ` · ${escapeHtml(job.location)}` : ''}${job.searchedKeyword ? ` · ${escapeHtml(job.searchedKeyword)}` : ''}</div>
        <p class="reason">${escapeHtml(job.dynamicReason || '')}</p>
        <p class="snippet">${escapeHtml(job.snippet || '').slice(0, 320)}</p>
        <div class="chips">${skills.map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join('')}</div>
        ${missing.length ? `<div class="chips missing">${missing.map((skill) => `<span class="chip">Missing: ${escapeHtml(skill)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="score">
        <strong>${Number(job.dynamicScore || 0)}</strong>
        <span class="badge ${badgeClass}">${escapeHtml(job.dynamicLabel || 'Match')}</span>
      </div>
    </article>
  `;
}

function sortJobs(jobs, sort) {
  return [...jobs].sort((a, b) => {
    if (sort === 'company') return String(a.company || '').localeCompare(String(b.company || '')) || b.dynamicScore - a.dynamicScore;
    if (sort === 'newest') return new Date(b.scrapedAt || 0) - new Date(a.scrapedAt || 0);
    if (sort === 'score') return Number(b.score || 0) - Number(a.score || 0);
    return Number(b.dynamicScore || 0) - Number(a.dynamicScore || 0);
  });
}

function matchesExperience(job, experience) {
  const terms = {
    entry: ['entry level', 'entry-level', 'fresher', 'graduate', 'campus', 'early professional'],
    junior: ['junior', 'associate'],
    professional: ['professional', 'experienced', 'senior', 'lead'],
    internship: ['intern', 'internship', 'trainee'],
  }[experience] || [];

  const haystack = buildHaystack(job);
  return terms.some((term) => haystack.includes(term));
}

function buildHaystack(job) {
  return [
    job.title,
    job.company,
    job.location,
    job.searchedKeyword,
    job.dynamicLabel,
    ...(job.dynamicMatchedSkills || []),
    ...(job.dynamicMissingSkills || []),
    job.dynamicReason,
    job.snippet,
  ].join(' ').toLowerCase();
}

function renderChips(container, values) {
  container.innerHTML = values.length
    ? values.map((value) => `<span class="chip">${escapeHtml(value)}</span>`).join('')
    : '<span class="chip">None</span>';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
