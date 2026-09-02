describe('describeStack', () => {
  // jest.isolateModules gives each test a fresh module registry, so the
  // module-level `patched` flag and `stack` array in describeStack.ts
  // start clean -- and, critically, so patching a mock `describe` here
  // never touches this test file's own real global describe.
  function withMockDescribeAndFreshModule<T>(mockDescribe: unknown, fn: (mod: typeof import('../../src/describeStack')) => T): T {
    const original = (global as unknown as { describe?: unknown }).describe;
    (global as unknown as { describe: unknown }).describe = mockDescribe;
    let result!: T;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('../../src/describeStack') as typeof import('../../src/describeStack');
      result = fn(mod);
    });
    (global as unknown as { describe: unknown }).describe = original;
    return result;
  }

  function makeFakeJestDescribe() {
    // Mimics real Jest: the block function runs synchronously, right when
    // describe() itself is called.
    const fakeDescribe = (name: string, fn: () => void) => fn();
    fakeDescribe.only = (name: string, fn: () => void) => fn();
    fakeDescribe.skip = (name: string, fn: () => void) => fn();
    fakeDescribe.each = (name: string, fn: () => void) => fn(); // unpatched passthrough, by design
    return fakeDescribe;
  }

  it('tracks nesting while a describe block is executing', () => {
    const fakeDescribe = makeFakeJestDescribe();
    let observedDuringInner: string[] = [];

    withMockDescribeAndFreshModule(fakeDescribe, ({ ensureDescribeTracked, getDescribeStack }) => {
      ensureDescribeTracked();
      const patched = (global as unknown as { describe: (name: string, fn: () => void) => void }).describe;
      patched('outer', () => {
        patched('inner', () => {
          observedDuringInner = getDescribeStack();
        });
      });
    });

    expect(observedDuringInner).toEqual(['outer', 'inner']);
  });

  it('pops the stack back to empty after the describe block finishes', () => {
    const fakeDescribe = makeFakeJestDescribe();

    withMockDescribeAndFreshModule(fakeDescribe, ({ ensureDescribeTracked, getDescribeStack }) => {
      ensureDescribeTracked();
      const patched = (global as unknown as { describe: (name: string, fn: () => void) => void }).describe;
      patched('outer', () => {
        /* no-op body */
      });
      expect(getDescribeStack()).toEqual([]);
    });
  });

  it('preserves describe.only/.skip behavior while tracking them', () => {
    const fakeDescribe = makeFakeJestDescribe();
    let onlyStack: string[] = [];
    let skipStack: string[] = [];

    withMockDescribeAndFreshModule(fakeDescribe, ({ ensureDescribeTracked, getDescribeStack }) => {
      ensureDescribeTracked();
      const patched = (global as unknown as {
        describe: ((name: string, fn: () => void) => void) & { only: (name: string, fn: () => void) => void; skip: (name: string, fn: () => void) => void };
      }).describe;
      patched.only('focused', () => {
        onlyStack = getDescribeStack();
      });
      patched.skip('skipped', () => {
        skipStack = getDescribeStack();
      });
    });

    expect(onlyStack).toEqual(['focused']);
    expect(skipStack).toEqual(['skipped']);
  });

  it('is idempotent -- calling ensureDescribeTracked twice does not double-wrap', () => {
    const fakeDescribe = makeFakeJestDescribe();
    let observed: string[] = [];

    withMockDescribeAndFreshModule(fakeDescribe, ({ ensureDescribeTracked, getDescribeStack }) => {
      ensureDescribeTracked();
      ensureDescribeTracked();
      const patched = (global as unknown as { describe: (name: string, fn: () => void) => void }).describe;
      patched('once', () => {
        observed = getDescribeStack();
      });
    });

    expect(observed).toEqual(['once']);
  });
});
