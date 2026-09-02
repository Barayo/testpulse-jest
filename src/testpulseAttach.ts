import * as fs from 'fs';
import { getScratchDir } from './scratchDir';
import { readCaseMetadata } from './caseStore';
import { isSupportedContentType, writeAttachment, SUPPORTED_CONTENT_TYPES } from './attachmentStore';
import { getCurrentTestName } from './jestState';

export interface TestpulseAttachOptions {
  filename: string;
  contentType: string;
}

/**
 * Registers an attachment for the currently-running testpulse()-wrapped
 * test. Content-type validation happens synchronously (before any I/O),
 * so an invalid content type throws immediately even though the overall
 * function returns a Promise for the (potentially async) file read.
 */
export function testpulseAttach(bufferOrPath: Buffer | string, opts: TestpulseAttachOptions): Promise<void> {
  if (!isSupportedContentType(opts.contentType)) {
    throw new Error(
      `testpulse-jest: testpulseAttach() only supports ${SUPPORTED_CONTENT_TYPES.join(', ')}, got: ${opts.contentType}`
    );
  }
  return attach(bufferOrPath, opts);
}

async function attach(bufferOrPath: Buffer | string, opts: TestpulseAttachOptions): Promise<void> {
  const scratchDir = getScratchDir();
  const fullName = getCurrentTestName();

  const existingCase = readCaseMetadata(scratchDir, fullName);
  if (!existingCase) {
    // eslint-disable-next-line no-console
    console.warn(
      `testpulse-jest: testpulseAttach() called from "${fullName}", which has no testpulse() case key -- dropping the attachment.`
    );
    return;
  }

  const data = Buffer.isBuffer(bufferOrPath) ? bufferOrPath : await fs.promises.readFile(bufferOrPath);
  writeAttachment(scratchDir, fullName, data, opts.filename, opts.contentType);
}
