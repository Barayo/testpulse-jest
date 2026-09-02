import * as crypto from 'crypto';
import * as path from 'path';

export const DEFAULT_SCRATCH_DIR = '.testpulse';

let scratchDir = DEFAULT_SCRATCH_DIR;

/** Overrides the scratch directory path. Exposed for the reporter's config resolution. */
export function setScratchDir(dir: string): void {
  scratchDir = dir;
}

export function getScratchDir(): string {
  return scratchDir;
}

export function casesDir(base: string = scratchDir): string {
  return path.join(base, 'cases');
}

export function attachmentsDir(base: string = scratchDir): string {
  return path.join(base, 'attachments');
}

/**
 * Sidecar filenames are a hash of the fullName, never the fullName itself
 * or any derivative of it used as a path component -- Jest test titles are
 * fully user-controlled strings with no character restrictions, so a name
 * containing `/` or `..` must not be able to influence where the sidecar
 * is written.
 */
export function hashFullName(fullName: string): string {
  return crypto.createHash('sha256').update(fullName, 'utf8').digest('hex');
}

/** Reset the module-level override -- test-only helper. */
export function __resetScratchDirForTests(): void {
  scratchDir = DEFAULT_SCRATCH_DIR;
}
