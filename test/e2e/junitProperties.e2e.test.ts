import * as fs from 'fs';
import * as path from 'path';
import { runNestedJest } from './helpers/runJest';

jest.setTimeout(30000);

const FIXTURE_DIR = path.join(__dirname, '../fixtures/junit-properties');
const JUNIT_PATH = path.join(FIXTURE_DIR, 'junit.xml');
const SCRATCH_DIR = path.join(FIXTURE_DIR, '.testpulse');

describe('junitTestCaseProperties end-to-end', () => {
  beforeAll(() => {
    fs.rmSync(JUNIT_PATH, { force: true });
    fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });

  afterAll(() => {
    fs.rmSync(JUNIT_PATH, { force: true });
    fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
  });

  it('writes testpulse_case_key into jest-junit output for a tagged test', async () => {
    const result = await runNestedJest(FIXTURE_DIR, path.join(FIXTURE_DIR, 'jest.config.js'));
    expect(result.exitCode).toBe(0);

    const xml = fs.readFileSync(JUNIT_PATH, 'utf8');
    expect(xml).toContain('<property name="testpulse_case_key" value="LOGIN-42"/>');
    expect(xml).toContain('<property name="testpulse_platform" value="linux"/>');
    expect(xml).toContain('<property name="testpulse_tags" value="smoke"/>');

    // the untagged test's <testcase> carries no testpulse properties
    const untaggedIndex = xml.indexOf('an untagged test');
    const nextTestcase = xml.indexOf('<testcase', untaggedIndex);
    const nextTestcaseEnd = xml.indexOf('</testcase>', nextTestcase);
    const untaggedBlock = xml.slice(nextTestcase, nextTestcaseEnd);
    expect(untaggedBlock).not.toContain('testpulse_case_key');
  });
});
