import * as fs from 'fs';
import * as path from 'path';
import { runNestedJest } from './helpers/runJest';
import { startStubImportServer, StubImportServer } from './helpers/stubImportServer';

jest.setTimeout(30000);

const FIXTURE_DIR = path.join(__dirname, '../fixtures/submit-basic');
const CONFIG_PATH = path.join(FIXTURE_DIR, 'jest.config.js');
const JUNIT_PATH = path.join(FIXTURE_DIR, 'junit.xml');
const SCRATCH_DIR = path.join(FIXTURE_DIR, '.testpulse');

function cleanFixtureArtifacts(): void {
  fs.rmSync(JUNIT_PATH, { force: true });
  fs.rmSync(SCRATCH_DIR, { recursive: true, force: true });
}

describe('reporter submission end-to-end', () => {
  let server: StubImportServer;

  beforeEach(cleanFixtureArtifacts);
  afterEach(async () => {
    cleanFixtureArtifacts();
    if (server) await server.close();
  });

  it('submits the JUnit report and succeeds on a 201 response', async () => {
    server = await startStubImportServer(201, { id: 'RUN-1' });

    const result = await runNestedJest(FIXTURE_DIR, CONFIG_PATH, {
      TESTPULSE_URL: server.url,
      TESTPULSE_PROJECT: 'FIXTURE',
      TESTPULSE_TOKEN: 't0k3n',
    });

    expect(result.exitCode).toBe(0);
    expect(server.requests).toHaveLength(1);
    const [request] = server.requests;
    expect(request.method).toBe('POST');
    expect(request.url).toBe('/api/v1/projects/FIXTURE/imports');
    expect(request.authorization).toBe('Bearer t0k3n');
    const body = request.body as { format: string; report: string; attachments: unknown[] };
    expect(body.format).toBe('junit-xml');
    expect(body.report).toContain('testpulse_case_key');
    expect(body.attachments).toEqual([]);
  });

  it('fails the run when failOnUnmatched is set and the server reports unmatched cases', async () => {
    server = await startStubImportServer(207, {
      unmatched: [{ caseKey: 'LOGIN-1' }, { caseKey: 'LOGIN-2' }],
    });

    const result = await runNestedJest(FIXTURE_DIR, CONFIG_PATH, {
      TESTPULSE_URL: server.url,
      TESTPULSE_PROJECT: 'FIXTURE',
      TESTPULSE_TOKEN: 't0k3n',
      TESTPULSE_FAIL_ON_UNMATCHED: 'true',
    });

    expect(result.exitCode).not.toBe(0);
  });

  it('succeeds (default config) even when the server reports unmatched cases', async () => {
    server = await startStubImportServer(207, {
      unmatched: [{ caseKey: 'LOGIN-1' }],
    });

    const result = await runNestedJest(FIXTURE_DIR, CONFIG_PATH, {
      TESTPULSE_URL: server.url,
      TESTPULSE_PROJECT: 'FIXTURE',
      TESTPULSE_TOKEN: 't0k3n',
    });

    expect(result.exitCode).toBe(0);
  });
});
