import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function writeFrontendData({ jobs, summary }) {
  const dataDir = join(process.cwd(), 'frontend', 'data');
  await mkdir(dataDir, { recursive: true });

  await writeFile(join(dataDir, 'jobs.json'), `${JSON.stringify(jobs, null, 2)}\n`, 'utf8');
  await writeFile(join(dataDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
}
