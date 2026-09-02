const { testpulse } = require('../../../dist/index');

testpulse('LOGIN-1')('first tagged test', () => {
  expect(true).toBe(true);
});

testpulse('LOGIN-2')('second tagged test', () => {
  expect(true).toBe(true);
});
