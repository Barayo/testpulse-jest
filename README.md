# testpulse-jest

A Jest reporter + [`jest-junit`](https://github.com/jest-community/jest-junit)
companion for reporting Jest results into
[TestPulse](https://github.com/Barayo/TestPulse) — matches each test to an
existing TestPulse case by key and submits the run automatically.

Jest has no built-in way for a running test to attach custom metadata to
its own result (no `record_property()`-equivalent). `testpulse-jest` works
around that by tagging tests through a small wrapper, injecting the case
key into `jest-junit`'s own JUnit XML output via its property hook, and
then submitting that report.

## Install

```bash
npm install --save-dev testpulse-jest jest-junit
```

## Configure

Three pieces need to be wired into `jest.config.js`: `jest-junit` itself,
the property-injection hook this package ships (which needs a
`path.dirname()`/`path.basename()` split — `jest-junit` joins its two
`testCaseProperties*` options with `path.join()`, which mangles a single
combined absolute path), and this package's own reporter, **listed after
`jest-junit`**:

```js
// jest.config.js
const path = require('path');
const propsPath = require.resolve('testpulse-jest/junitTestCaseProperties');

module.exports = {
  reporters: [
    'default',
    ['jest-junit', {
      outputName: 'junit.xml',
      // jest-junit's default suiteNameTemplate ("{title}") resolves to the
      // literal string "undefined" for a flat test() with no enclosing
      // describe() -- {filepath} always names the run meaningfully.
      suiteNameTemplate: '{filepath}',
      testCasePropertiesDirectory: path.dirname(propsPath),
      testCasePropertiesFile: path.basename(propsPath),
    }],
    ['testpulse-jest', {
      url: 'http://localhost:8080',
      project: 'LOGIN',
    }],
  ],
};
```

## Tag your tests

```js
const { testpulse, testpulseAttach } = require('testpulse-jest');

testpulse('LOGIN-42', { platform: 'linux', tags: ['smoke'] })(
  'logs in successfully',
  async () => {
    // ...
  }
);

testpulse('LOGIN-43')('fails with a bad password', async () => {
  const screenshot = await page.screenshot();
  await testpulseAttach(screenshot, { filename: 'failure.png', contentType: 'image/png' });
  // ...
});
```

`testpulse()` wraps `test`/`it` — the test's own title is never modified,
so nothing shows up differently in console output, CI logs, or the JUnit
report's own `<testcase name>`. `testpulseAttach()` only accepts
`image/png`, `image/jpeg`, and `image/webp`, and only works inside a test
already tagged via `testpulse()` — calling it from an untagged test logs a
warning and drops the attachment.

## Configuration reference

Each setting resolves from an environment variable first, falling back to
the matching reporter option in `jest.config.js`:

| Setting | Env var | Reporter option |
|---|---|---|
| API base URL | `TESTPULSE_URL` | `url` |
| API token | `TESTPULSE_TOKEN` | `token` |
| Project key | `TESTPULSE_PROJECT` | `project` |
| Fail build on unmatched cases | `TESTPULSE_FAIL_ON_UNMATCHED` | `failOnUnmatched` |
| Dry run (preview only) | `TESTPULSE_DRY_RUN` | `dryRun` |
| jest-junit output path | — | `junitFile` (default `./junit.xml`) |
| Scratch directory | — | `scratchDir` (default `.testpulse/`) |
| Keep scratch dir after run | — | `keepScratchDir` (default `false`) |

Put the token in `TESTPULSE_TOKEN` (a CI secret), not in a committed
`jest.config.js` — the reporter option exists but env var wins, so a
committed placeholder never accidentally shadows the real secret.

`--testpulse` isn't a real CLI flag family here — Jest owns the CLI, so
all of this is configured via `jest.config.js`'s `reporters` entry and env
vars, not command-line flags.

## Build outcome

| API response | Behavior |
|---|---|
| `201` all matched | build succeeds; summary logged |
| `207` some unmatched | build succeeds by default (unmatched case keys + `failOnUnmatched` pointer logged); fails when `failOnUnmatched` is set |
| network/auth/4xx/5xx error | always fails the build, unconditionally |

`dryRun: true` (or `TESTPULSE_DRY_RUN=1`) previews matches via a read-only
`GET /cases` request and never submits anything — never affects the exit
code.

## License

MIT
