const { testpulse } = require('../../../dist/index');

testpulse('LOGIN-1')('a tagged test', () => {
  expect(true).toBe(true);
});
