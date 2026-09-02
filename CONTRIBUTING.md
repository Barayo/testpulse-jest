# Contributing

## Setup

```bash
npm install
npm run build
```

## Testing

Tests are layered, since there's no `pytester`-equivalent for authoring
Jest plugins/reporters:

- **Unit tests** (`test/unit/`, `npm test`) — `testpulse()`/
  `testpulseAttach()`, `junitTestCaseProperties`, `config`, and the
  reporter each tested in isolation, with `../../src/httpClient` mocked
  via `jest.mock()` for reporter tests. Fast, no real Jest processes
  spawned.
- **End-to-end tests** (`test/e2e/`, `npm run test:e2e`) — spawn a real
  nested `jest` process against a fixture project under `test/fixtures/`,
  proving the pieces actually integrate (wrapper → scratch dir →
  `jest-junit`'s properties hook → the reporter → the submitted request).
  These run against the built `dist/` output, so `npm run test:e2e`
  rebuilds first. A stub HTTP server (`test/e2e/helpers/stubImportServer.ts`)
  stands in for the TestPulse import API — no real network access.

Run everything: `npm run test:all`.

TDD is the standing practice: write the failing test first, then the
minimal implementation to make it pass.

## Release process

Releases are automated via [`semantic-release`](https://semantic-release.gitbook.io/)
on merge to `main`, following [Angular/Conventional Commits](https://www.conventionalcommits.org/)
(`feat:`, `fix:`, etc.) — see `.releaserc.json`. Publishing to npm uses
[trusted publishing (OIDC)](https://docs.npmjs.com/trusted-publishers/), so
there's no `NPM_TOKEN` secret to manage.

If a release's publish step fails after its version-bump commit/tag has
already been pushed (a real risk with `semantic-release`'s prepare-before-publish
ordering), trigger `.github/workflows/release.yml` manually
(`workflow_dispatch`) to publish the already-tagged version directly,
rather than re-running the push-triggered flow.
