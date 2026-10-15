import test from 'node:test';
import assert from 'node:assert/strict';
import { listenConfig } from '../backend/server.js';

test('listening defaults are loopback-only and configurable for container networking', () => {
  assert.deepEqual(listenConfig({}), { host: '127.0.0.1', port: 3000 });
  assert.deepEqual(listenConfig({ HOST: '0.0.0.0', PORT: '8080' }), { host: '0.0.0.0', port: 8080 });
});
test('invalid ports fail closed instead of binding an unintended endpoint', () => {
  for (const port of ['0', '-1', '65536', 'NaN', '3.5', '']) {
    assert.throws(() => listenConfig({ PORT: port }), /PORT/);
  }
});
