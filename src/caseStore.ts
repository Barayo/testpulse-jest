import * as fs from 'fs';
import * as path from 'path';
import { casesDir, hashFullName } from './scratchDir';

export interface CaseMetadata {
  fullName: string;
  caseKey: string;
  platform?: string;
  version?: string;
  tags?: string[];
}

export interface CaseOptions {
  platform?: string;
  version?: string;
  tags?: string[];
}

export function writeCaseMetadata(scratchDir: string, fullName: string, caseKey: string, opts: CaseOptions = {}): void {
  const metadata: CaseMetadata = {
    fullName,
    caseKey,
    ...(opts.platform ? { platform: opts.platform } : {}),
    ...(opts.version ? { version: opts.version } : {}),
    ...(opts.tags && opts.tags.length > 0 ? { tags: opts.tags } : {}),
  };
  const dir = casesDir(scratchDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${hashFullName(fullName)}.json`), JSON.stringify(metadata), 'utf8');
}

export function readCaseMetadata(scratchDir: string, fullName: string): CaseMetadata | undefined {
  const file = path.join(casesDir(scratchDir), `${hashFullName(fullName)}.json`);
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as CaseMetadata;
}

export function readAllCaseMetadata(scratchDir: string): CaseMetadata[] {
  const dir = casesDir(scratchDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as CaseMetadata);
}
