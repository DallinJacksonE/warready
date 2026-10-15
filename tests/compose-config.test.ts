import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const composeAvailable = spawnSync('docker', ['compose', 'version']).status === 0;

/** Render with disposable values, never reading the checkout's private .env. No daemon is needed. */
function composeConfig(overrides: Record<string, string> = {}) {
  const result = spawnSync(
    'docker',
    ['compose', '--env-file', '/dev/null', 'config', '--format', 'json'],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        MYSQL_PASSWORD: 'test-database-password',
        MYSQL_ROOT_PASSWORD: 'test-root-password',
        ADMIN1_PASSWORD: 'test-first-password',
        ADMIN2_PASSWORD: 'test-second-password',
        ...overrides,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

const skip = composeAvailable ? false : 'Docker Compose CLI is not installed';

test('Compose defaults expose only the loopback app port, not MySQL', { skip }, () => {
  const { services } = composeConfig();
  assert.deepEqual(services.app.ports, [
    { mode: 'ingress', host_ip: '127.0.0.1', target: 3000, published: '8080', protocol: 'tcp' },
  ]);
  assert.equal(services.mysql.ports, undefined);
  assert.equal(services.app.environment.MYSQL_HOST, 'mysql');
  assert.equal(services.app.environment.MYSQL_PORT, '3306');
});

test(
  'changing APP_PORT also changes the default local origin without changing internal ports',
  { skip },
  () => {
    const { services } = composeConfig({ APP_PORT: '18080' });
    assert.equal(services.app.ports[0].published, '18080');
    assert.equal(services.app.ports[0].target, 3000);
    assert.equal(services.app.environment.PORT, '3000');
    assert.equal(services.app.environment.APP_ORIGIN, 'http://localhost:18080');
  },
);

test('a public HTTPS origin and secure cookies override local defaults', { skip }, () => {
  const { services } = composeConfig({
    APP_PORT: '18080',
    APP_ORIGIN: 'https://training.example.com',
    COOKIE_SECURE: 'true',
  });
  assert.equal(services.app.environment.APP_ORIGIN, 'https://training.example.com');
  assert.equal(services.app.environment.COOKIE_SECURE, 'true');
  assert.equal(services.app.ports[0].host_ip, '127.0.0.1');
});
