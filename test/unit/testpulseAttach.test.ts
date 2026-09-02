import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { testpulseAttach } from '../../src/testpulseAttach';
import { writeCaseMetadata } from '../../src/caseStore';
import { setScratchDir, __resetScratchDirForTests, hashFullName, attachmentsDir } from '../../src/scratchDir';
import { MAX_ATTACHMENT_BYTES } from '../../src/attachmentStore';

function withMockedCurrentTestName<T>(name: string, fn: () => T): T {
  const originalExpect = (global as unknown as { expect?: unknown }).expect;
  (global as unknown as { expect: unknown }).expect = {
    getState: () => ({ currentTestName: name }),
  };
  try {
    return fn();
  } finally {
    (global as unknown as { expect: unknown }).expect = originalExpect;
  }
}

describe('testpulseAttach()', () => {
  let tmpDir: string;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'testpulse-jest-attach-'));
    setScratchDir(tmpDir);
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    __resetScratchDirForTests();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    warnSpy.mockRestore();
  });

  it('registers an attachment for a test with an existing case key', async () => {
    writeCaseMetadata(tmpDir, 'fails with bad password', 'LOGIN-42');
    const buffer = Buffer.from('fake-png-bytes');

    await withMockedCurrentTestName('fails with bad password', () =>
      testpulseAttach(buffer, { filename: 'failure.png', contentType: 'image/png' })
    );

    const hashed = hashFullName('fails with bad password');
    const metadataPath = path.join(attachmentsDir(tmpDir), `${hashed}.json`);
    const dataPath = path.join(attachmentsDir(tmpDir), `${hashed}.data`);
    expect(fs.existsSync(metadataPath)).toBe(true);
    expect(fs.readFileSync(dataPath)).toEqual(buffer);
    expect(JSON.parse(fs.readFileSync(metadataPath, 'utf8'))).toEqual({
      fullName: 'fails with bad password',
      filename: 'failure.png',
      contentType: 'image/png',
    });
  });

  it('reads a file path when given a string instead of a Buffer', async () => {
    writeCaseMetadata(tmpDir, 'a test', 'LOGIN-1');
    const srcFile = path.join(tmpDir, 'source.png');
    fs.writeFileSync(srcFile, 'file-contents');

    await withMockedCurrentTestName('a test', () =>
      testpulseAttach(srcFile, { filename: 'a.png', contentType: 'image/png' })
    );

    const hashed = hashFullName('a test');
    expect(fs.readFileSync(path.join(attachmentsDir(tmpDir), `${hashed}.data`), 'utf8')).toBe('file-contents');
  });

  it('drops the attachment and warns when the current test has no case key', async () => {
    const buffer = Buffer.from('fake-png-bytes');

    await withMockedCurrentTestName('untagged test', () =>
      testpulseAttach(buffer, { filename: 'x.png', contentType: 'image/png' })
    );

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('untagged test'));
    const entries = fs.existsSync(attachmentsDir(tmpDir)) ? fs.readdirSync(attachmentsDir(tmpDir)) : [];
    expect(entries).toEqual([]);
  });

  it('rejects an attachment larger than the size cap, without writing it', async () => {
    writeCaseMetadata(tmpDir, 'a test', 'LOGIN-1');
    const tooBig = Buffer.alloc(MAX_ATTACHMENT_BYTES + 1);

    await expect(
      withMockedCurrentTestName('a test', () => testpulseAttach(tooBig, { filename: 'huge.png', contentType: 'image/png' }))
    ).rejects.toThrow(/exceeding/);

    const entries = fs.existsSync(attachmentsDir(tmpDir)) ? fs.readdirSync(attachmentsDir(tmpDir)) : [];
    expect(entries).toEqual([]);
  });

  it('rejects an unsupported content type synchronously, before any I/O', () => {
    writeCaseMetadata(tmpDir, 'a test', 'LOGIN-1');
    const buffer = Buffer.from('data');

    expect(() =>
      withMockedCurrentTestName('a test', () => testpulseAttach(buffer, { filename: 'x.pdf', contentType: 'application/pdf' }))
    ).toThrow(/only supports/);

    const entries = fs.existsSync(attachmentsDir(tmpDir)) ? fs.readdirSync(attachmentsDir(tmpDir)) : [];
    expect(entries).toEqual([]);
  });
});
