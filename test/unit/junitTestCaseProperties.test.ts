import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import getTestCaseProperties = require('../../src/junitTestCaseProperties');
import { writeCaseMetadata } from '../../src/caseStore';
import { setScratchDir, __resetScratchDirForTests } from '../../src/scratchDir';

describe('junitTestCaseProperties', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpulse-jest-props-'));
    setScratchDir(tmpDir);
  });

  afterEach(() => {
    __resetScratchDirForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns the case key for a matching sidecar', () => {
    writeCaseMetadata(tmpDir, 'logs in successfully', 'LOGIN-42');

    const result = getTestCaseProperties({ title: 'logs in successfully', ancestorTitles: [] });

    expect(result).toEqual({ testpulse_case_key: 'LOGIN-42' });
  });

  it('reconstructs fullName from ancestorTitles + title', () => {
    writeCaseMetadata(tmpDir, 'login succeeds with valid creds', 'LOGIN-42');

    const result = getTestCaseProperties({ title: 'succeeds with valid creds', ancestorTitles: ['login'] });

    expect(result).toEqual({ testpulse_case_key: 'LOGIN-42' });
  });

  it('includes optional properties only when supplied', () => {
    writeCaseMetadata(tmpDir, 'a test', 'LOGIN-42', { platform: 'linux', tags: ['smoke'] });

    const result = getTestCaseProperties({ title: 'a test', ancestorTitles: [] });

    expect(result).toEqual({
      testpulse_case_key: 'LOGIN-42',
      testpulse_platform: 'linux',
      testpulse_tags: 'smoke',
    });
    expect(result.testpulse_version).toBeUndefined();
  });

  it('returns an empty object for an untagged test', () => {
    const result = getTestCaseProperties({ title: 'untagged test', ancestorTitles: [] });

    expect(result).toEqual({});
  });
});
