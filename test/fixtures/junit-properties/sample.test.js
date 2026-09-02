const { testpulse } = require('../../../dist/index');

testpulse('LOGIN-42', { platform: 'linux', tags: ['smoke'] })('logs in successfully', () => {
  expect(1 + 1).toBe(2);
});

test('an untagged test', () => {
  expect(true).toBe(true);
});
