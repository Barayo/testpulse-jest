import * as fs from 'fs';
import { setScratchDir, casesDir, attachmentsDir } from './scratchDir';
import { readAllCaseMetadata } from './caseStore';
import { readAllAttachments } from './attachmentStore';
import { resolveConfig, ReporterOptions, ResolvedConfig } from './config';
import { postImport, getCases, ImportAttachment } from './httpClient';

export default class TestPulseReporter {
  private readonly config: ResolvedConfig;

  constructor(_globalConfig: unknown, options: ReporterOptions = {}) {
    this.config = resolveConfig(options);
    setScratchDir(this.config.scratchDir);
  }

  /**
   * Runs exactly once, in the main process, before any worker starts
   * executing tests -- the correct place to clear stale scratch-dir
   * contents from a prior (possibly crashed) run. `testpulse()`/
   * `testpulseAttach()` run inside per-test-file worker processes and
   * cannot coordinate a "first call wins" check with each other; see
   * design.md for why that approach was rejected.
   */
  onRunStart(): void {
    fs.rmSync(this.config.scratchDir, { recursive: true, force: true });
    fs.mkdirSync(casesDir(this.config.scratchDir), { recursive: true });
    fs.mkdirSync(attachmentsDir(this.config.scratchDir), { recursive: true });
  }

  async onRunComplete(_contexts?: unknown, results?: { startTime?: number }): Promise<void> {
    const config = this.config;

    if (config.dryRun) {
      await this.runDryRun(config);
      return;
    }

    if (!config.url || !config.project) {
      throw new Error(
        'testpulse-jest: no url/project configured (TESTPULSE_URL/TESTPULSE_PROJECT env vars, or `url`/`project` reporter options in jest.config.js).'
      );
    }

    const junitReport = this.readJunitReport(config.junitFile, results?.startTime);
    const attachments = this.buildAttachments(config.scratchDir);

    let status: number;
    let body: unknown;
    try {
      ({ status, body } = await postImport(config.url, config.project, config.token, junitReport, attachments));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`testpulse-jest: submission request failed: ${(err as Error).message}`);
      process.exitCode = 1;
      return;
    }
    const succeeded = this.handleSubmissionResult(status, body, config);
    // Only clean up on a successful submission (201/207) -- a failed one
    // leaves the scratch dir in place (subject to keepScratchDir's normal
    // meaning) so its contents are actually inspectable when debugging the
    // one situation you'd most want them: a failure.
    if (succeeded) this.cleanup(config);
  }

  private readJunitReport(junitFile: string, runStartTime?: number): string {
    if (!fs.existsSync(junitFile)) {
      throw new Error(
        `testpulse-jest: no JUnit report found at "${junitFile}". Check that "testpulse-jest" is listed AFTER ` +
          '"jest-junit" in your jest.config.js "reporters" array, and that jest-junit is configured to write to this path.'
      );
    }

    // A reporters-ordering mistake ("testpulse-jest" before "jest-junit")
    // combined with a pre-existing junit.xml from a prior run (a common,
    // ordinary situation -- local dev re-running jest in the same
    // directory, a reused CI workspace) would otherwise mean this reporter
    // reads and silently submits the OLD report, with no error at all,
    // even though the current run's real results are different. Comparing
    // the file's mtime against this run's own startTime catches that.
    if (typeof runStartTime === 'number') {
      const mtimeMs = fs.statSync(junitFile).mtimeMs;
      if (mtimeMs < runStartTime) {
        throw new Error(
          `testpulse-jest: the JUnit report at "${junitFile}" is older than this test run -- it wasn't ` +
            'refreshed by jest-junit before this reporter read it. Check that "testpulse-jest" is listed AFTER ' +
            '"jest-junit" in your jest.config.js "reporters" array. Refusing to submit a stale report.'
        );
      }
    }

    return fs.readFileSync(junitFile, 'utf8');
  }

  private buildAttachments(scratchDir: string): ImportAttachment[] {
    const caseKeyByFullName = new Map(readAllCaseMetadata(scratchDir).map((c) => [c.fullName, c.caseKey]));
    const attachments: ImportAttachment[] = [];
    for (const attachment of readAllAttachments(scratchDir)) {
      const caseKey = caseKeyByFullName.get(attachment.fullName);
      if (!caseKey) continue;
      attachments.push({
        caseKey,
        filename: attachment.filename,
        contentType: attachment.contentType,
        data: fs.readFileSync(attachment.dataPath).toString('base64'),
      });
    }
    return attachments;
  }

  /** Returns whether the submission itself succeeded (a run was created), independent of failOnUnmatched's effect on exit code. */
  private handleSubmissionResult(status: number, body: unknown, config: ResolvedConfig): boolean {
    if (status === 201) {
      const run = body as { id?: string } | undefined;
      // eslint-disable-next-line no-console
      console.log(`testpulse-jest: submitted successfully (run ${run?.id ?? '?'})`);
      return true;
    }

    if (status === 207) {
      const info = body as { unmatched?: { caseKey: string }[] } | undefined;
      const unmatchedKeys = (info?.unmatched ?? []).map((u) => u.caseKey);
      // eslint-disable-next-line no-console
      console.warn(
        `testpulse-jest: ${unmatchedKeys.length} case(s) unmatched: ${unmatchedKeys.join(', ')}. ` +
          'Set failOnUnmatched (or TESTPULSE_FAIL_ON_UNMATCHED) to make this a hard failure.'
      );
      if (config.failOnUnmatched) process.exitCode = 1;
      return true;
    }

    // eslint-disable-next-line no-console
    console.error(`testpulse-jest: submission failed (status ${status}): ${JSON.stringify(body)}`);
    process.exitCode = 1;
    return false;
  }

  private async runDryRun(config: ResolvedConfig): Promise<void> {
    if (!config.url || !config.project) {
      throw new Error(
        'testpulse-jest: dryRun requires url/project to be configured (TESTPULSE_URL/TESTPULSE_PROJECT env vars, or `url`/`project` reporter options).'
      );
    }
    const cases = readAllCaseMetadata(config.scratchDir);
    const { status, body } = await getCases(config.url, config.project, config.token);
    if (status >= 300) {
      // eslint-disable-next-line no-console
      console.error(`testpulse-jest: dry run failed to fetch cases (status ${status})`);
      return;
    }
    const existingKeys = new Set(((body as { key: string }[] | undefined) ?? []).map((c) => c.key));
    const unmatched = cases.filter((c) => !existingKeys.has(c.caseKey));
    const matchedCount = cases.length - unmatched.length;
    // eslint-disable-next-line no-console
    console.log(
      `testpulse-jest: dry run -- ${matchedCount} would match, ${unmatched.length} would not` +
        (unmatched.length > 0 ? `: ${unmatched.map((c) => c.caseKey).join(', ')}` : '')
    );
  }

  private cleanup(config: ResolvedConfig): void {
    if (config.keepScratchDir) return;
    fs.rmSync(config.scratchDir, { recursive: true, force: true });
  }
}
