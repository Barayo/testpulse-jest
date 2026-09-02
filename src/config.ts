import { DEFAULT_SCRATCH_DIR } from './scratchDir';

export const DEFAULT_JUNIT_FILE = './junit.xml';

export interface ReporterOptions {
  url?: string;
  token?: string;
  project?: string;
  failOnUnmatched?: boolean;
  dryRun?: boolean;
  junitFile?: string;
  scratchDir?: string;
  keepScratchDir?: boolean;
}

export interface ResolvedConfig {
  url?: string;
  token?: string;
  project?: string;
  failOnUnmatched: boolean;
  dryRun: boolean;
  junitFile: string;
  scratchDir: string;
  keepScratchDir: boolean;
}

function resolveString(envVar: string, optionValue: string | undefined): string | undefined {
  const envValue = process.env[envVar];
  if (envValue !== undefined && envValue !== '') return envValue;
  return optionValue;
}

function resolveBoolean(envVar: string, optionValue: boolean | undefined): boolean {
  const envValue = process.env[envVar];
  if (envValue !== undefined && envValue !== '') return envValue === 'true' || envValue === '1';
  return optionValue ?? false;
}

/** Env var always wins over the reporter's own `jest.config.js` options -- see design.md. */
export function resolveConfig(options: ReporterOptions = {}): ResolvedConfig {
  return {
    url: resolveString('TESTPULSE_URL', options.url),
    token: resolveString('TESTPULSE_TOKEN', options.token),
    project: resolveString('TESTPULSE_PROJECT', options.project),
    failOnUnmatched: resolveBoolean('TESTPULSE_FAIL_ON_UNMATCHED', options.failOnUnmatched),
    dryRun: resolveBoolean('TESTPULSE_DRY_RUN', options.dryRun),
    junitFile: options.junitFile ?? DEFAULT_JUNIT_FILE,
    scratchDir: options.scratchDir ?? DEFAULT_SCRATCH_DIR,
    keepScratchDir: options.keepScratchDir ?? false,
  };
}
