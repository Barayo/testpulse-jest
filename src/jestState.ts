export type TestFn = (...args: unknown[]) => unknown;
export type TestRegistrar = (name: string, fn: TestFn, timeout?: number) => void;

export function getGlobalTestRegistrar(): TestRegistrar {
  const g = globalThis as unknown as { test?: unknown; it?: unknown };
  const registrar = (g.test ?? g.it) as TestRegistrar | undefined;
  if (typeof registrar !== 'function') {
    throw new Error(
      'testpulse-jest: no global test()/it() found -- testpulse() must be called from within a Jest test file'
    );
  }
  return registrar;
}

/** Reconstructs Jest's own fullName from an AssertionResult's ancestorTitles/title -- the same value `currentTestName` holds while the test is running. */
export function reconstructFullName(ancestorTitles: string[], title: string): string {
  return [...ancestorTitles, title].join(' ').trim();
}

export function getCurrentTestName(): string {
  const g = globalThis as unknown as {
    expect?: { getState?: () => { currentTestName?: string } };
  };
  const name = g.expect?.getState?.()?.currentTestName;
  if (typeof name !== 'string') {
    throw new Error(
      'testpulse-jest: unable to resolve the current test name via expect.getState().currentTestName -- is this running inside a Jest test?'
    );
  }
  return name;
}
