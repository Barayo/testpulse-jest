import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import TestPulseReporter from '../../src/reporter';
import { writeCaseMetadata } from '../../src/caseStore';
import { writeAttachment } from '../../src/attachmentStore';
import { __resetScratchDirForTests } from '../../src/scratchDir';
import * as httpClient from '../../src/httpClient';

jest.mock('../../src/httpClient');
const mockedHttpClient = httpClient as jest.Mocked<typeof httpClient>;

function makeReporter(tmpDir: string, junitFile: string, overrides: Record<string, unknown> = {}): TestPulseReporter {
  return new TestPulseReporter(undefined, {
    url: 'https://testpulse.example',
    project: 'LOGIN',
    token: 't0k3n',
    scratchDir: tmpDir,
    junitFile,
    ...overrides,
  } as never);
}

describe('TestPulseReporter', () => {
  let tmpDir: string;
  let junitFile: string;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let originalExitCode: number | string | undefined;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpulse-jest-reporter-'));
    junitFile = path.join(tmpDir, 'junit.xml');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
    jest.clearAllMocks();
  });

  afterEach(() => {
    __resetScratchDirForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('fails with a named-cause message when the JUnit file is missing', async () => {
    const reporter = makeReporter(tmpDir, junitFile);
    await expect(reporter.onRunComplete()).rejects.toThrow(/reporters.*array|jest-junit/i);
  });

  it('refuses a JUnit file older than the current run (stale from a prior run)', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    const oldTime = new Date(Date.now() - 60_000);
    fs.utimesSync(junitFile, oldTime, oldTime);

    const reporter = makeReporter(tmpDir, junitFile);
    await expect(reporter.onRunComplete(undefined, { startTime: Date.now() })).rejects.toThrow(/stale|older than this test run/i);
    expect(mockedHttpClient.postImport).not.toHaveBeenCalled();
  });

  it('accepts a JUnit file freshly written for the current run', async () => {
    mockedHttpClient.postImport.mockResolvedValue({ status: 201, body: { id: 'RUN-1' } });
    const runStartTime = Date.now() - 5000;
    fs.writeFileSync(junitFile, '<testsuites></testsuites>'); // written "now", after runStartTime

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete(undefined, { startTime: runStartTime });

    expect(mockedHttpClient.postImport).toHaveBeenCalled();
  });

  it('joins attachments to their case key by fullName and submits base64 data', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    writeCaseMetadata(tmpDir, 'fails with bad password', 'LOGIN-42');
    writeAttachment(tmpDir, 'fails with bad password', Buffer.from('bytes'), 'failure.png', 'image/png');
    mockedHttpClient.postImport.mockResolvedValue({ status: 201, body: { id: 'RUN-1' } });

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete();

    expect(mockedHttpClient.postImport).toHaveBeenCalledWith(
      'https://testpulse.example',
      'LOGIN',
      't0k3n',
      '<testsuites></testsuites>',
      [{ caseKey: 'LOGIN-42', filename: 'failure.png', contentType: 'image/png', data: Buffer.from('bytes').toString('base64') }]
    );
  });

  it('dry run previews matches without submitting and leaves exitCode untouched', async () => {
    writeCaseMetadata(tmpDir, 'matched test', 'LOGIN-1');
    writeCaseMetadata(tmpDir, 'unmatched test', 'LOGIN-2');
    mockedHttpClient.getCases.mockResolvedValue({ status: 200, body: [{ key: 'LOGIN-1' }] });

    const reporter = makeReporter(tmpDir, junitFile, { dryRun: true });
    await reporter.onRunComplete();

    expect(mockedHttpClient.postImport).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('LOGIN-2'));
    expect(process.exitCode).toBeUndefined();
  });

  it('onRunStart clears the scratch directory', () => {
    fs.mkdirSync(tmpDir, { recursive: true });
    writeCaseMetadata(tmpDir, 'stale test', 'STALE-1');
    const reporter = makeReporter(tmpDir, junitFile);

    reporter.onRunStart();

    expect(fs.existsSync(path.join(tmpDir, 'cases'))).toBe(true);
    expect(fs.readdirSync(path.join(tmpDir, 'cases'))).toEqual([]);
  });

  it('a 201 response leaves exitCode untouched and logs a summary', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({ status: 201, body: { id: 'RUN-1' } });

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete();

    expect(process.exitCode).toBeUndefined();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('RUN-1'));
  });

  it('a 207 response with default config leaves exitCode untouched and warns', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({
      status: 207,
      body: { unmatched: [{ caseKey: 'LOGIN-9' }] },
    });

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete();

    expect(process.exitCode).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('LOGIN-9'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('failOnUnmatched'));
  });

  it('a 207 response with failOnUnmatched sets exitCode to 1', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({
      status: 207,
      body: { unmatched: [{ caseKey: 'LOGIN-9' }] },
    });

    const reporter = makeReporter(tmpDir, junitFile, { failOnUnmatched: true });
    await reporter.onRunComplete();

    expect(process.exitCode).toBe(1);
  });

  it('a 401 response always sets exitCode to 1 regardless of failOnUnmatched', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({ status: 401, body: { error: 'unauthorized' } });

    const reporter = makeReporter(tmpDir, junitFile, { failOnUnmatched: false });
    await reporter.onRunComplete();

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('a network error always sets exitCode to 1 regardless of failOnUnmatched', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockRejectedValue(new Error('ECONNREFUSED'));

    const reporter = makeReporter(tmpDir, junitFile, { failOnUnmatched: false });
    await reporter.onRunComplete();

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ECONNREFUSED'));
  });

  it('does NOT remove the scratch directory after a failed submission (401), even without keepScratchDir', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({ status: 401, body: { error: 'unauthorized' } });

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete();

    expect(fs.existsSync(tmpDir)).toBe(true);
  });

  it('removes the scratch directory after a successful run unless keepScratchDir is set', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({ status: 201, body: { id: 'RUN-1' } });
    writeCaseMetadata(tmpDir, 'a test', 'LOGIN-1');

    const reporter = makeReporter(tmpDir, junitFile);
    await reporter.onRunComplete();

    expect(fs.existsSync(tmpDir)).toBe(false);
  });

  it('keeps the scratch directory when keepScratchDir is set', async () => {
    fs.writeFileSync(junitFile, '<testsuites></testsuites>');
    mockedHttpClient.postImport.mockResolvedValue({ status: 201, body: { id: 'RUN-1' } });

    const reporter = makeReporter(tmpDir, junitFile, { keepScratchDir: true });
    await reporter.onRunComplete();

    expect(fs.existsSync(tmpDir)).toBe(true);
  });
});
