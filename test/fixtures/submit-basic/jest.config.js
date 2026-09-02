// Fixture project for the submission end-to-end test
// (test/e2e/submission.e2e.test.ts). url/project/token are supplied via
// TESTPULSE_URL/TESTPULSE_PROJECT/TESTPULSE_TOKEN env vars by the spawning
// test, not hardcoded here, since the stub server's port is dynamic.
const path = require('path');

const propsPath = path.join(__dirname, '../../../dist/junitTestCaseProperties.js');
const reporterPath = path.join(__dirname, '../../../dist/reporter.js');

module.exports = {
  rootDir: __dirname,
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: __dirname,
        outputName: 'junit.xml',
        testCasePropertiesDirectory: path.dirname(propsPath),
        testCasePropertiesFile: path.basename(propsPath),
      },
    ],
    [reporterPath, { scratchDir: path.join(__dirname, '.testpulse') }],
  ],
};
