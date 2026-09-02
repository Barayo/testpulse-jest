import { getScratchDir } from './scratchDir';
import { writeCaseMetadata, CaseOptions } from './caseStore';
import { getGlobalTestRegistrar, getCurrentTestName, reconstructFullName, TestFn } from './jestState';
import { ensureDescribeTracked, getDescribeStack } from './describeStack';

export type TestpulseOptions = CaseOptions;

// Patches global describe() at MODULE LOAD time (a side effect of
// `require('testpulse-jest')`), not lazily on first testpulse() call --
// describe blocks run synchronously top-down during Jest's collection
// phase, so by the time any nested testpulse() call could trigger a lazy
// patch, the outermost describe() in the file would already have run
// unpatched. Real consumers import this package before defining any
// describe()/test() blocks, so module-load-time patching is early enough.
ensureDescribeTracked();

/**
 * Wraps `test`/`it`, tagging the test with a TestPulse case key without
 * altering its visible title -- the title/AssertionResult Jest itself
 * produces is identical to an unwrapped call with the same name.
 *
 * Writes the case-key sidecar TWICE, deliberately: once synchronously at
 * registration time (using the tracked describe-nesting stack, so a test
 * that never actually runs -- filtered out by `-t`, shadowed by a sibling
 * `.only`, cut short by `--bail`, a partial watch-mode run -- still gets
 * linked, rather than silently losing its case key and showing up as a
 * spurious "unmatched" entry) and again at execution time if the test
 * body does run (using `expect.getState().currentTestName`, which is
 * authoritative and correct even in the one case the tracked stack can't
 * see: `describe.each` -- see describeStack.ts). The execution-time write
 * is a same-data no-op in the common case, and a correcting overwrite in
 * that one edge case.
 */
export function testpulse(caseKey: string, opts: TestpulseOptions = {}) {
  if (typeof caseKey !== 'string' || caseKey.length === 0) {
    throw new Error(
      `testpulse-jest: testpulse() requires a non-empty case key string, got: ${JSON.stringify(caseKey)}`
    );
  }

  return function registerTest(name: string, fn: TestFn, timeout?: number): void {
    writeCaseMetadata(getScratchDir(), reconstructFullName(getDescribeStack(), name), caseKey, opts);

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
