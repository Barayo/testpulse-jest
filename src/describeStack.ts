/**
 * Tracks the currently-executing `describe()` nesting by patching the
 * global `describe` (and `.only`/`.skip`) the first time this module is
 * used. `describe` blocks run synchronously during Jest's collection
 * phase (before any test body executes), so this lets testpulse() know
 * a test's ancestorTitles at *registration* time -- unlike
 * `expect.getState().currentTestName`, which is only available once a
 * test body actually starts running.
 *
 * Known limitation: `describe.each` is not patched -- jest-circus's
 * `.each` implementation calls its own internal `describe` reference
 * rather than looking up `globalThis.describe` per call, so blocks
 * created via `.each` won't be reflected in the tracked stack. A test
 * tagged inside a `describe.each` block still gets correct metadata once
 * it actually runs (the execution-time write in testpulse.ts recomputes
 * the real fullName from `expect.getState()` and overwrites the
 * registration-time sidecar), so this only affects the "still linked
 * even if skipped/filtered" guarantee for that specific nesting case.
 */

let patched = false;
const stack: string[] = [];

export function getDescribeStack(): string[] {
  return [...stack];
}

type DescribeFn = (name: string, fn: () => void) => void;

function wrapBlock(original: DescribeFn, name: string, fn: () => void, ...rest: unknown[]): unknown {
  return (original as (...args: unknown[]) => unknown)(
    name,
    (...args: unknown[]) => {
      stack.push(name);
      try {
        return (fn as (...a: unknown[]) => unknown)(...args);
      } finally {
        stack.pop();
      }
    },
    ...rest
  );
}

export function ensureDescribeTracked(): void {
  if (patched) return;
  const g = globalThis as unknown as { describe?: DescribeFn & { only?: DescribeFn; skip?: DescribeFn } };
  const original = g.describe;
  if (typeof original !== 'function') return;
  patched = true;

  const tracked = ((name: string, fn: () => void, ...rest: unknown[]) =>
    wrapBlock(original, name, fn, ...rest)) as DescribeFn & { only?: DescribeFn; skip?: DescribeFn };

  // Copy through any other static properties (e.g. `.each`) unpatched first
  // -- best-effort tracking is better than throwing away functionality --
  // then override `.only`/`.skip` with tracked versions so they aren't
  // clobbered by the copy.
  Object.assign(tracked, original);
  if (typeof original.only === 'function') {
    tracked.only = (name: string, fn: () => void, ...rest: unknown[]) =>
      wrapBlock(original.only as DescribeFn, name, fn, ...rest);
  }
  if (typeof original.skip === 'function') {
    tracked.skip = (name: string, fn: () => void, ...rest: unknown[]) =>
      wrapBlock(original.skip as DescribeFn, name, fn, ...rest);
  }

  (g as unknown as { describe: unknown }).describe = tracked;
}

/** Test-only: reset patch state and stack between test cases. */
export function __resetDescribeStackForTests(): void {
  patched = false;
  stack.length = 0;
}
