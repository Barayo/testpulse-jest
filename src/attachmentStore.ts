import * as fs from 'fs';
import * as path from 'path';
import { attachmentsDir, hashFullName } from './scratchDir';

export const SUPPORTED_CONTENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type SupportedContentType = (typeof SUPPORTED_CONTENT_TYPES)[number];

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
