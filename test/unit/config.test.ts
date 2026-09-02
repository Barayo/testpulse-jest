import { resolveConfig } from '../../src/config';

const ENV_KEYS = ['TESTPULSE_URL', 'TESTPULSE_TOKEN', 'TESTPULSE_PROJECT', 'TESTPULSE_FAIL_ON_UNMATCHED', 'TESTPULSE_DRY_RUN'];

describe('resolveConfig', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it.each([
    ['url', 'TESTPULSE_URL'],
    ['token', 'TESTPULSE_TOKEN'],
    ['project', 'TESTPULSE_PROJECT'],
  ] as const)('resolves %s from the env var alone', (field, envVar) => {
    process.env[envVar] = 'from-env';
    expect(resolveConfig({})[field]).toBe('from-env');
  });

  it.each([
    ['url', 'TESTPULSE_URL'],
    ['token', 'TESTPULSE_TOKEN'],
    ['project', 'TESTPULSE_PROJECT'],
  ] as const)('resolves %s from the reporter option alone', (field, envVar) => {
    expect(resolveConfig({ [field]: 'from-option' } as never)[field]).toBe('from-option');
  });

  it.each([
    ['url', 'TESTPULSE_URL'],
    ['token', 'TESTPULSE_TOKEN'],
    ['project', 'TESTPULSE_PROJECT'],
  ] as const)('env var overrides the reporter option for %s', (field, envVar) => {
    process.env[envVar] = 'from-env';
    expect(resolveConfig({ [field]: 'from-option' } as never)[field]).toBe('from-env');
  });

  it('resolves failOnUnmatched from env var alone (truthy string)', () => {
    process.env.TESTPULSE_FAIL_ON_UNMATCHED = 'true';
    expect(resolveConfig({}).failOnUnmatched).toBe(true);
  });

  it('resolves failOnUnmatched from the reporter option alone', () => {
    expect(resolveConfig({ failOnUnmatched: true }).failOnUnmatched).toBe(true);
  });

  it('env var overrides the reporter option for failOnUnmatched', () => {
    process.env.TESTPULSE_FAIL_ON_UNMATCHED = 'true';
    expect(resolveConfig({ failOnUnmatched: false }).failOnUnmatched).toBe(true);
  });

  it('resolves dryRun from env var alone', () => {
    process.env.TESTPULSE_DRY_RUN = '1';
    expect(resolveConfig({}).dryRun).toBe(true);
  });

  it('resolves dryRun from the reporter option alone', () => {
    expect(resolveConfig({ dryRun: true }).dryRun).toBe(true);
  });

  it('defaults failOnUnmatched/dryRun to false when nothing is set', () => {
    const config = resolveConfig({});
    expect(config.failOnUnmatched).toBe(false);
    expect(config.dryRun).toBe(false);
  });
});
