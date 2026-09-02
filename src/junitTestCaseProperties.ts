import { getScratchDir } from './scratchDir';
import { readCaseMetadata } from './caseStore';
import { reconstructFullName } from './jestState';

interface JestJunitTestCase {
  title: string;
  ancestorTitles: string[];
}

type JunitProperties = Record<string, string>;

/**
 * jest-junit's `testCasePropertiesFile` hook. Called synchronously, once
 * per testcase, while jest-junit builds its <properties> block -- reads
 * the scratch dir's case-key sidecars (already flushed to disk by the
 * time jest-junit's own onRunComplete runs) rather than anything on `tc`
 * itself.
 */
function getTestCaseProperties(tc: JestJunitTestCase): JunitProperties {
  const fullName = reconstructFullName(tc.ancestorTitles ?? [], tc.title);
  const metadata = readCaseMetadata(getScratchDir(), fullName);
  if (!metadata) return {};

  const properties: JunitProperties = { testpulse_case_key: metadata.caseKey };
  if (metadata.platform) properties.testpulse_platform = metadata.platform;
  if (metadata.version) properties.testpulse_version = metadata.version;
  if (metadata.tags && metadata.tags.length > 0) properties.testpulse_tags = metadata.tags.join(',');
  return properties;
}

export = getTestCaseProperties;
