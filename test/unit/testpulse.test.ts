import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testpulse } from '../../src/testpulse';
import { setScratchDir, __resetScratchDirForTests, hashFullName, casesDir } from '../../src/scratchDir';
import * as describeStack from '../../src/describeStack';

// describeStack's own patching mechanism is tested in isolation in
// describeStack.test.ts (module patching needs jest.isolateModules to
// avoid mutating this file's own real global describe). Here,
// getDescribeStack is mocked directly so testpulse()'s registration-time
// write can be tested deterministically without real describe nesting.
jest.mock('../../src/describeStack');
const mockedDescribeStack = describeStack as jest.Mocked<typeof describeStack>;

function withMockedGlobalTest<T>(fn: () => T): { result: T; registrarSpy: jest.Mock } {
  const registrarSpy = jest.fn();
  const originalTest = (global as unknown as { test?: unknown }).test;
  (global as unknown as { test: unknown }).test = registrarSpy;
  try {
    const result = fn();
    return { result, registrarSpy };
  } finally {
    (global as unknown as { test: unknown }).test = originalTest;
  }
}

function withMockedCurrentTestName<T>(name: string, fn: () => T): T {
  const originalExpect = (global as unknown as { expect?: unknown }).expect;
  (global as unknown as { expect: unknown }).expect = {
    getState: () => ({ currentTestName: name }),
  };
  try {
    return fn();
  } finally {
    (global as unknown as { expect: unknown }).expect = originalExpect;
  }
}

describe('testpulse()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpulse-jest-'));
    setScratchDir(tmpDir);
    mockedDescribeStack.getDescribeStack.mockReturnValue([]);
  });

  afterEach(() => {
    __resetScratchDirForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes the case-key sidecar at registration time, before the test body ever runs', () => {
    const fn = jest.fn();
    withMockedGlobalTest(() => {
      // The mocked registrar never invokes fn -- simulating a test that
      // Jest registers but never runs (a -t filter, a sibling .only,
      // --bail, a partial watch-mode run).
      testpulse('LOGIN-42')('never actually runs', fn);
    });

    expect(fn).not.toHaveBeenCalled();
    const sidecarPath = path.join(casesDir(tmpDir), `${hashFullName('never actually runs')}.json`);
    expect(fs.existsSync(sidecarPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(sidecarPath, 'utf8'))).toEqual({
      fullName: 'never actually runs',
      caseKey: 'LOGIN-42',
    });
  });

  it('includes ancestorTitles from the tracked describe stack in the registration-time sidecar', () => {
    mockedDescribeStack.getDescribeStack.mockReturnValue(['login']);

    withMockedGlobalTest(() => {
      testpulse('LOGIN-42')('succeeds with valid creds', jest.fn());
    });

    const fullName = 'login succeeds with valid creds';
    const sidecarPath = path.join(casesDir(tmpDir), `${hashFullName(fullName)}.json`);
    expect(fs.existsSync(sidecarPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(sidecarPath, 'utf8')).fullName).toBe(fullName);
  });

  it('registers the test with its title unchanged', () => {
    const fn = jest.fn();
    const { registrarSpy } = withMockedGlobalTest(() => {
      testpulse('LOGIN-42')('logs in successfully', fn);
    });

    expect(registrarSpy).toHaveBeenCalledTimes(1);
    expect(registrarSpy.mock.calls[0][0]).toBe('logs in successfully');
    expect(typeof registrarSpy.mock.calls[0][1]).toBe('function');
  });

  it('throws synchronously for an empty case key', () => {
    expect(() => testpulse('')).toThrow(/non-empty case key/);
  });

  it('throws synchronously for an undefined case key', () => {
    expect(() => testpulse(undefined as unknown as string)).toThrow(/non-empty case key/);
  });

  it('writes a hashed sidecar into the scratch dir when the wrapped test runs', async () => {
    const fn = jest.fn();
    const { registrarSpy } = withMockedGlobalTest(() => {
      testpulse('LOGIN-42', { platform: 'linux', tags: ['smoke'] })('logs in successfully', fn);
    });

    const wrappedFn = registrarSpy.mock.calls[0][1] as () => Promise<void>;
    await withMockedCurrentTestName('logs in successfully', () => wrappedFn());

    const hashed = hashFullName('logs in successfully');
    const sidecarPath = path.join(casesDir(tmpDir), `${hashed}.json`);
    expect(fs.existsSync(sidecarPath)).toBe(true);

    const contents = JSON.parse(fs.readFileSync(sidecarPath, 'utf8'));
    expect(contents).toEqual({
      fullName: 'logs in successfully',
      caseKey: 'LOGIN-42',
      platform: 'linux',
      tags: ['smoke'],
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('a test name containing path-traversal characters cannot escape the scratch directory', async () => {
    const fn = jest.fn();
    const trickyName = '../../evil';
    const { registrarSpy } = withMockedGlobalTest(() => {
      testpulse('LOGIN-42')(trickyName, fn);
    });

    const wrappedFn = registrarSpy.mock.calls[0][1] as () => Promise<void>;
    await withMockedCurrentTestName(trickyName, () => wrappedFn());

    const sidecarPath = path.join(casesDir(tmpDir), `${hashFullName(trickyName)}.json`);
    expect(fs.existsSync(sidecarPath)).toBe(true);

    // Nothing was written outside the scratch dir's cases/ subfolder.
    const escapedPath = path.resolve(casesDir(tmpDir), trickyName + '.json');
    expect(fs.existsSync(escapedPath)).toBe(false);
    const entries = fs.readdirSync(casesDir(tmpDir));
    expect(entries).toEqual([`${hashFullName(trickyName)}.json`]);
  });

  it('respects an overridden scratch directory', async () => {
    const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpulse-jest-other-'));
    setScratchDir(otherDir);
    const fn = jest.fn();
    const { registrarSpy } = withMockedGlobalTest(() => {
      testpulse('LOGIN-42')('a test', fn);
    });
    const wrappedFn = registrarSpy.mock.calls[0][1] as () => Promise<void>;
    await withMockedCurrentTestName('a test', () => wrappedFn());

    expect(fs.existsSync(path.join(casesDir(otherDir), `${hashFullName('a test')}.json`))).toBe(true);
    fs.rmSync(otherDir, { recursive: true, force: true });
  });
});
