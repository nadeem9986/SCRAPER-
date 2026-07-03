import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root = join(process.cwd(), 'frontend');
const port = Number(process.env.PORT || 5173);
const execFileAsync = promisify(execFile);

const skillDictionary = [
  'agentic ai', 'generative ai', 'genai', 'ai agent', 'llm', 'rag', 'langchain', 'langgraph',
  'python', 'fastapi', 'react', 'java', 'javascript', 'sql', 'mysql', 'pandas', 'tensorflow',
  'scikit-learn', 'huggingface', 'llamaindex', 'pinecone', 'faiss', 'streamlit', 'docker',
  'git', 'linux', 'azure', 'azure ai', 'aws', 'gcp', 'rest api', 'nlp', 'machine learning',
  'data science', 'full stack', 'software engineering', 'cloud', 'devops', 'automation',
  'pydantic', 'prompt engineering', 'vector database'
];

const roleDictionary = [
  'ai engineer', 'generative ai engineer', 'software engineer', 'associate software engineer',
  'python developer', 'full stack developer', 'data scientist', 'machine learning engineer',
  'cloud engineer', 'java developer', 'data engineer'
];

const experienceTerms = {
  entry: ['entry level', 'entry-level', 'fresher', 'graduate', 'campus', 'early professional'],
  junior: ['junior', 'associate'],
  professional: ['professional', 'experienced', 'senior', 'lead'],
  internship: ['intern', 'internship', 'trainee'],
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  const requestedPath = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);

  if (request.method === 'POST' && requestedPath === '/api/match') {
    await handleMatch(request, response);
    return;
  }

  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(root, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath)) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  if (statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
    if (!existsSync(filePath)) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
  }

  response.writeHead(200, { 'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
});

server.listen(port, () => {
  console.log(`Frontend running at http://localhost:${port}`);
});

async function handleMatch(request, response) {
  try {
    const body = await readRequestBody(request);
    const form = parseMultipart(body, request.headers['content-type'] || '');
    const resumeFile = form.files.resume;
    const fields = form.fields;

    if (!resumeFile?.data?.length) {
      sendJson(response, 400, { error: 'Upload a resume file first.' });
      return;
    }

    const resumeText = await extractResumeText(resumeFile);
    const skills = extractTerms(resumeText, skillDictionary);
    const roles = extractTerms(resumeText, roleDictionary);
    const company = clean(fields.company || '');
    const location = clean(fields.location || '');
    const role = clean(fields.role || '');
    const experience = clean(fields.experience || '');
    const jobsPath = join(root, 'data', 'jobs.json');
    const allJobs = existsSync(jobsPath)
      ? JSON.parse(await readFile(jobsPath, 'utf8'))
      : [];
    const matchedJobs = rankAndFilterJobs(allJobs, { skills, roles, company, location, role, experience });

    sendJson(response, 200, {
      profile: {
        skills,
        roles,
        company,
        location,
        experience,
      },
      summary: {
        totalJobs: matchedJobs.length,
        strongMatches: matchedJobs.filter((job) => job.dynamicLabel === 'Strong Match').length,
        goodMatches: matchedJobs.filter((job) => job.dynamicLabel === 'Good Match').length,
        weakMatches: matchedJobs.filter((job) => job.dynamicLabel === 'Weak Match').length,
      },
      suggestedInput: {
        company: company || 'Company name',
        careerUrl: '',
        keywords: [...new Set([...roles, ...skills.slice(0, 8)])].slice(0, 10),
        locations: location ? [location] : ['India', 'Bengaluru', 'Hyderabad', 'Pune'],
        maxJobs: 100,
        minScore: 2,
        entryLevelBoost: true,
        headless: true,
      },
      jobs: matchedJobs,
    });
  } catch (error) {
    sendJson(response, 500, { error: error.message || 'Could not match jobs.' });
  }
}

function rankAndFilterJobs(jobs, profile) {
  return jobs
    .map((job) => scoreJob(job, profile))
    .filter((job) => {
      const haystack = buildHaystack(job);
      if (profile.company && String(job.company || '').toLowerCase() !== profile.company.toLowerCase()) return false;
      if (profile.location && !haystack.includes(profile.location.toLowerCase())) return false;
      if (profile.role && !haystack.includes(profile.role.toLowerCase())) return false;
      if (profile.experience && !(experienceTerms[profile.experience] || []).some((term) => haystack.includes(term))) return false;
      return true;
    })
    .sort((a, b) => b.dynamicScore - a.dynamicScore)
    .slice(0, 100);
}

function scoreJob(job, profile) {
  const haystack = buildHaystack(job);
  const matchedSkills = profile.skills.filter((skill) => haystack.includes(skill.toLowerCase()));
  const missingSkills = profile.skills.filter((skill) => !haystack.includes(skill.toLowerCase())).slice(0, 8);
  let score = Number(job.score || 0) + matchedSkills.length * 5;

  if (profile.location && haystack.includes(profile.location.toLowerCase())) score += 5;
  if (profile.company && String(job.company || '').toLowerCase() === profile.company.toLowerCase()) score += 4;
  if (profile.role && haystack.includes(profile.role.toLowerCase())) score += 5;
  if (profile.experience && (experienceTerms[profile.experience] || []).some((term) => haystack.includes(term))) score += 4;

  const dynamicLabel = score >= 30 ? 'Strong Match' : score >= 16 ? 'Good Match' : 'Weak Match';
  return {
    ...job,
    dynamicScore: score,
    dynamicLabel,
    dynamicMatchedSkills: matchedSkills,
    dynamicMissingSkills: missingSkills,
    dynamicReason: matchedSkills.length
      ? `Resume match: ${matchedSkills.slice(0, 7).join(', ')}.`
      : 'No direct resume skill match found in the visible job card.',
  };
}

async function extractResumeText(file) {
  const extension = file.filename.split('.').pop().toLowerCase();
  if (['txt', 'md', 'json', 'csv'].includes(extension)) return file.data.toString('utf8');

  if (extension === 'pdf') {
    const dir = await mkdtemp(join(tmpdir(), 'resume-match-'));
    const filePath = join(dir, 'resume.pdf');
    await writeFile(filePath, file.data);

    try {
      const code = [
        'from pypdf import PdfReader',
        'import sys',
        'r=PdfReader(sys.argv[1])',
        "print('\\n'.join([(p.extract_text() or '') for p in r.pages]))",
      ].join('; ');
      const { stdout } = await execFileAsync('python', ['-c', code, filePath], { maxBuffer: 5 * 1024 * 1024 });
      return stdout;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  return file.data.toString('utf8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
}

function parseMultipart(buffer, contentType) {
  const boundary = contentType.match(/boundary=(.+)$/)?.[1];
  if (!boundary) return { fields: {}, files: {} };

  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};
  let start = buffer.indexOf(delimiter) + delimiter.length + 2;

  while (start > delimiter.length) {
    const end = buffer.indexOf(delimiter, start);
    if (end < 0) break;

    const part = buffer.subarray(start, end - 2);
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd > -1) {
      const header = part.subarray(0, headerEnd).toString('utf8');
      const data = part.subarray(headerEnd + 4);
      const name = header.match(/name="([^"]+)"/)?.[1];
      const filename = header.match(/filename="([^"]*)"/)?.[1];

      if (name && filename) files[name] = { filename, data };
      else if (name) fields[name] = data.toString('utf8');
    }

    start = end + delimiter.length + 2;
  }

  return { fields, files };
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function extractTerms(text, dictionary) {
  const lower = String(text || '').toLowerCase();
  return dictionary.filter((term) => lower.includes(term.toLowerCase()));
}

function buildHaystack(job) {
  return [
    job.title,
    job.company,
    job.location,
    job.searchedKeyword,
    job.matchLabel,
    ...(job.matchedSkills || []),
    job.reasonToApply,
    job.snippet,
  ].join(' ').toLowerCase();
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
