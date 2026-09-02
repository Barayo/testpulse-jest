import * as fs from 'fs';
import * as path from 'path';
import { attachmentsDir, hashFullName } from './scratchDir';

export const SUPPORTED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type SupportedContentType = (typeof SUPPORTED_CONTENT_TYPES)[number];

// A screenshot this large is almost certainly a mistake (wrong file, an
// uncompressed capture) -- failing fast here with a clear message beats
// finding out via a slow timeout or a 413 from the server after the whole
// base64 payload has already been built and sent.
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export interface AttachmentMetadata {
  fullName: string;
  filename: string;
  contentType: SupportedContentType;
}

export interface WrittenAttachment extends AttachmentMetadata {
  dataPath: string;
}

export function isSupportedContentType(contentType: string): contentType is SupportedContentType {
  return (SUPPORTED_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export function writeAttachment(
  scratchDir: string,
  fullName: string,
  data: Buffer,
  filename: string,
  contentType: string
): void {
  if (!isSupportedContentType(contentType)) {
    throw new Error(
      `testpulse-jest: testpulseAttach() only supports ${SUPPORTED_CONTENT_TYPES.join(', ')}, got: ${contentType}`
    );
  }
  if (data.length > MAX_ATTACHMENT_BYTES) {
    throw new Error(
      `testpulse-jest: testpulseAttach() attachment is ${data.length} bytes, exceeding the ${MAX_ATTACHMENT_BYTES}-byte limit.`
    );
  }

  const dir = attachmentsDir(scratchDir);
  fs.mkdirSync(dir, { recursive: true });
  const hashed = hashFullName(fullName);
  const metadata: AttachmentMetadata = { fullName, filename, contentType };
  fs.writeFileSync(path.join(dir, `${hashed}.json`), JSON.stringify(metadata), 'utf8');
  fs.writeFileSync(path.join(dir, `${hashed}.data`), data);
}

export function readAllAttachments(scratchDir: string): WrittenAttachment[] {
  const dir = attachmentsDir(scratchDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const metadata = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as AttachmentMetadata;
      const dataPath = path.join(dir, f.replace(/\.json$/, '.data'));
      return { ...metadata, dataPath };
    });
}
