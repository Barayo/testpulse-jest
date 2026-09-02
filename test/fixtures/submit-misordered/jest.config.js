// Deliberately WRONG reporter order (testpulse-jest before jest-junit) --
// used by test/e2e/submission.e2e.test.ts's staleness-detection test to
// prove a pre-existing junit.xml doesn't get silently resubmitted.
const path = require('path');

const propsPath = path.join(__dirname, '../../../dist/junitTestCaseProperties.js');
const reporterPath = path.join(__dirname, '../../../dist/reporter.js');

module.exports = {
  rootDir: __dirname,
  reporters: [
    'default',
    [reporterPath, { scratchDir: path.join(__dirname, '.testpulse') }],
    [
      'jest-junit',
      {
        outputDirectory: __dirname,
        outputName: 'junit.xml',
        suiteNameTemplate: '{filepath}',
        testCasePropertiesDirectory: path.dirname(propsPath),
        testCasePropertiesFile: path.basename(propsPath),
      },
    ],
  ],
};
