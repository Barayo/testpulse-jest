// Fixture project for the "does jest-junit actually write our property?"
// end-to-end test (test/e2e/junitProperties.e2e.test.ts). A real npm
// consumer references `testpulse-jest`/`testpulse-jest/junitTestCaseProperties`
// by package name once installed -- this fixture points at the repo's own
// built dist/ directly, since it isn't itself an installed package.
const path = require('path');

// jest-junit joins testCasePropertiesDirectory + testCasePropertiesFile with
// path.join(), which does NOT special-case an absolute second argument the
// way path.resolve() does -- so this must be split into directory + bare
// filename, not passed as one combined path.
const propsPath = path.join(__dirname, '../../../dist/junitTestCaseProperties.js');

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
  ],
};
