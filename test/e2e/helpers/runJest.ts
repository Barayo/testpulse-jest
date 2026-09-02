import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface JestRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Spawns a real nested `jest` process against a fixture project's own config. */
export async function runNestedJest(
  cwd: string,
  configPath: string,
  extraEnv: Record<string, string> = {}
): Promise<JestRunResult> {
  const jestBin = require.resolve('jest/bin/jest');
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [jestBin, '--config', configPath, '--ci'], {
      cwd,
      env: { ...process.env, ...extraEnv },
    });
    return { exitCode: 0, stdout, stderr };
  } catch (err) {
    const e = err as { code?: number; stdout?: string; stderr?: string };
    return { exitCode: e.code ?? 1, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
}
