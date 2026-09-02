import { getScratchDir } from './scratchDir';
import { writeCaseMetadata, CaseOptions } from './caseStore';
import { getGlobalTestRegistrar, getCurrentTestName, TestFn } from './jestState';

export type TestpulseOptions = CaseOptions;

/**
 * Wraps `test`/`it`, tagging the test with a TestPulse case key without
 * altering its visible title -- the title/AssertionResult Jest itself
 * produces is identical to an unwrapped call with the same name.
 */
export function testpulse(caseKey: string, opts: TestpulseOptions = {}) {
  if (typeof caseKey !== 'string' || caseKey.length === 0) {
    throw new Error(
      `testpulse-jest: testpulse() requires a non-empty case key string, got: ${JSON.stringify(caseKey)}`
    );
  }

  return function registerTest(name: string, fn: TestFn, timeout?: number): void {
    const registrar = getGlobalTestRegistrar();
    registrar(
      name,
      async (...args: unknown[]) => {
        writeCaseMetadata(getScratchDir(), getCurrentTestName(), caseKey, opts);
        return fn(...args);
      },
      timeout
    );
  };
}
