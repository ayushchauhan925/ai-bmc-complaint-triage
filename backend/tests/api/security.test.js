// Account security (lockout, password reset, email verification), push, TLS options,
// recurring-problem analytics and job locking. Email is mocked so links can be captured.

const sentMails = [];
jest.mock('../../src/services/notification/mailer', () => ({
  isEnabled: () => true,
  sendMail: jest.fn(async (mail) => {
    sentMails.push(mail);
    return true;
  }),
}));
jest.mock('../../src/services/ai/complaintAnalysis.service', () => ({ analyzeComplaint: jest.fn().mockResolvedValue({ success: false, failureReason: 'off' }) }));
jest.mock('../../src/services/ai/embedding.service', () => ({
  generateAndStoreEmbedding: jest.fn().mockResolvedValue({ success: false }),
  generateEmbedding: jest.fn().mockResolvedValue({ success: false }),
}));

const request = require('supertest');
const app = require('../../src/app');
const { pool } = require('../../src/config/db');

jest.setTimeout(60000);

const PW = 'Password123!';
const tokenFrom = (mail) => mail.text.match(/token=([A-Za-z0-9_-]+)/)[1];
const lastMailTo = (email) => [...sentMails].reverse().find((m) => m.to === email);
const newEmail = (p) => `${p}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.demo`;

async function register(email) {
  const res = await request(app).post('/api/auth/register').send({ name: 'Sec Test', email, password: PW });
  expect(res.status).toBe(201);
  return res.body.data;
}
const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });

describe('login lockout', () => {
  test('5 wrong passwords lock the account, even for the right password, until reset', async () => {
    const email = newEmail('lock');
    await register(email);

    for (let i = 0; i < 5; i += 1) {
      const r = await login(email, 'WrongPass!1');
      expect(r.status).toBe(401);
    }
    const locked = await login(email, PW);
    expect(locked.status).toBe(429);
    expect(locked.body.message).toMatch(/too many failed attempts/i);

    // Audit trail records the lock; the response never exposes lock bookkeeping fields.
    const [[row]] = await pool.query('SELECT locked_until FROM users WHERE email = ?', [email]);
    expect(row.locked_until).toBeTruthy();
  });

  test('a successful login resets the failure counter; responses never leak security fields', async () => {
    const email = newEmail('reset-counter');
    await register(email);
    await login(email, 'nope');
    await login(email, 'nope');
    const ok = await login(email, PW);
    expect(ok.status).toBe(200);
    expect(ok.body.data.user).not.toHaveProperty('password_hash');
    expect(ok.body.data.user).not.toHaveProperty('failed_login_attempts');
    expect(ok.body.data.user).not.toHaveProperty('locked_until');
    const [[row]] = await pool.query('SELECT failed_login_attempts FROM users WHERE email = ?', [email]);
    expect(row.failed_login_attempts).toBe(0);
  });

  test('unknown email gets the same generic error as a wrong password', async () => {
    const r = await login(newEmail('ghost'), PW);
    expect(r.status).toBe(401);
    expect(r.body.message).toBe('Invalid email or password.');
  });
});

describe('password reset', () => {
  test('forgot-password answers identically for known and unknown emails', async () => {
    const email = newEmail('forgot');
    await register(email);
    const known = await request(app).post('/api/auth/forgot-password').send({ email });
    const unknown = await request(app).post('/api/auth/forgot-password').send({ email: newEmail('nobody') });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(lastMailTo(email)).toBeTruthy();
  });

  test('reset link changes the password, unlocks the account, and works exactly once', async () => {
    const email = newEmail('resetflow');
    await register(email);
    for (let i = 0; i < 5; i += 1) await login(email, 'bad-password');
    expect((await login(email, PW)).status).toBe(429);

    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = tokenFrom(lastMailTo(email));

    const short = await request(app).post('/api/auth/reset-password').send({ token, password: 'short' });
    expect(short.status).toBe(400); // weak password rejected, and the token is NOT consumed by validation failure

    const done = await request(app).post('/api/auth/reset-password').send({ token, password: 'BrandNewPass9!' });
    expect(done.status).toBe(200);

    expect((await login(email, PW)).status).toBe(401); // old password no longer works
    expect((await login(email, 'BrandNewPass9!')).status).toBe(200); // and the lock is cleared

    const reuse = await request(app).post('/api/auth/reset-password').send({ token, password: 'AnotherPass9!' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.message).toMatch(/invalid or has expired/i);
  });

  test('a newer reset link invalidates the previous one; forged tokens are refused; only a hash is stored', async () => {
    const email = newEmail('relink');
    await register(email);
    await request(app).post('/api/auth/forgot-password').send({ email });
    const first = tokenFrom(lastMailTo(email));
    await request(app).post('/api/auth/forgot-password').send({ email });
    const second = tokenFrom(lastMailTo(email));
    expect(second).not.toBe(first);

    expect((await request(app).post('/api/auth/reset-password').send({ token: first, password: 'Whatever123!' })).status).toBe(400);
    expect((await request(app).post('/api/auth/reset-password').send({ token: 'x'.repeat(43), password: 'Whatever123!' })).status).toBe(400);

    const [rows] = await pool.query('SELECT token_hash FROM auth_tokens WHERE token_hash IN (?, ?)', [first, second]);
    expect(rows).toHaveLength(0); // clear-text token is never stored
    expect((await request(app).post('/api/auth/reset-password').send({ token: second, password: 'Whatever123!' })).status).toBe(200);
  });

  test('an expired token is refused', async () => {
    const email = newEmail('expired');
    await register(email);
    await request(app).post('/api/auth/forgot-password').send({ email });
    const token = tokenFrom(lastMailTo(email));
    await pool.query("UPDATE auth_tokens SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE user_id = (SELECT id FROM users WHERE email = ?)", [email]);
    expect((await request(app).post('/api/auth/reset-password').send({ token, password: 'Whatever123!' })).status).toBe(400);
  });
});

describe('email verification', () => {
  test('verification link marks the email verified once; /me reflects it', async () => {
    const email = newEmail('verify');
    const { token: jwt } = await register(email);
    const before = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${jwt}`);
    expect(before.body.data.user.email_verified_at).toBeNull();

    await request(app).post('/api/auth/resend-verification').set('Authorization', `Bearer ${jwt}`);
    const token = tokenFrom(lastMailTo(email));
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(200);

    const after = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${jwt}`);
    expect(after.body.data.user.email_verified_at).toBeTruthy();
    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(400); // single use
  });

  test('config endpoint tells the UI which capabilities exist', async () => {
    const res = await request(app).get('/api/auth/config');
    expect(res.body.data).toEqual({ emailEnabled: true, pushPublicKey: null });
  });
});

describe('push notifications', () => {
  test('subscription endpoints need login and refuse when the server has no VAPID keys', async () => {
    expect((await request(app).post('/api/notifications/push/subscribe').send({})).status).toBe(401);
    const { token } = await register(newEmail('push'));
    const status = await request(app).get('/api/notifications/push').set('Authorization', `Bearer ${token}`);
    expect(status.body.data.enabled).toBe(false);
    const sub = await request(app)
      .post('/api/notifications/push/subscribe')
      .set('Authorization', `Bearer ${token}`)
      .send({ endpoint: 'https://push.example.com/abc', keys: { p256dh: 'p'.repeat(20), auth: 'a'.repeat(10) } });
    expect(sub.status).toBe(503);
  });

  test('push channel delivers to each device and prunes subscriptions the push service reports gone', async () => {
    jest.resetModules();
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    const sendNotification = jest.fn(async (sub) => {
      if (sub.endpoint.includes('dead')) {
        const e = new Error('gone');
        e.statusCode = 410;
        throw e;
      }
    });
    jest.doMock('web-push', () => ({ setVapidDetails: jest.fn(), sendNotification }));
    const removeByEndpoint = jest.fn();
    jest.doMock('../../src/models/pushSubscription.model', () => ({
      listForUser: async () => [
        { endpoint: 'https://push.example.com/live', p256dh: 'k', auth: 'a' },
        { endpoint: 'https://push.example.com/dead', p256dh: 'k', auth: 'a' },
      ],
      removeByEndpoint,
    }));
    const channel = require('../../src/services/notification/channels/push.channel');
    expect(channel.isEnabled()).toBe(true);
    const out = await channel.send({ userId: 1, title: 'T', message: 'M', relatedComplaintId: 7 });
    expect(out).toEqual({ delivered: true, devices: 1 });
    expect(JSON.parse(sendNotification.mock.calls[0][1]).url).toBe('/complaints/7');
    expect(removeByEndpoint).toHaveBeenCalledWith('https://push.example.com/dead');
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    jest.dontMock('web-push');
    jest.dontMock('../../src/models/pushSubscription.model');
  });
});

describe('error responses and TLS options', () => {
  test('error details are exposed only when NODE_ENV is explicitly development/test', () => {
    // Stop dotenv from re-populating NODE_ENV from a local .env file during this test.
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    jest.resetModules();
    process.env.NODE_ENV = 'production';
    expect(require('../../src/config/env').exposeErrorDetails).toBe(false);
    jest.resetModules();
    delete process.env.NODE_ENV;
    expect(require('../../src/config/env').exposeErrorDetails).toBe(false); // unset is treated as safe
    jest.resetModules();
    process.env.NODE_ENV = 'test';
    expect(require('../../src/config/env').exposeErrorDetails).toBe(true);
    jest.dontMock('dotenv');
  });

  test('DB_SSL_CA turns on certificate verification; without it TLS is encrypt-only; local is plain', () => {
    const { buildSslOptions } = require('../../src/config/sslOptions');
    expect(buildSslOptions({ sslMode: '', sslCa: '' })).toEqual({});
    expect(buildSslOptions({ sslMode: 'REQUIRED', sslCa: '' })).toEqual({ ssl: { rejectUnauthorized: false } });
    const pem = '-----BEGIN CERTIFICATE-----\\nABC\\n-----END CERTIFICATE-----';
    const v = buildSslOptions({ sslMode: 'REQUIRED', sslCa: pem });
    expect(v.ssl.rejectUnauthorized).toBe(true);
    expect(v.ssl.ca).toContain('\nABC\n');
  });
});

describe('recurring problems & resolution effectiveness', () => {
  const LAT = 18.5204;
  const LNG = 73.8567; // isolated test location
  let adminToken;

  beforeAll(async () => {
    adminToken = (await login('admin@civicconnect.demo', PW)).body.data.token;
    await pool.query("DELETE FROM complaints WHERE description LIKE 'RECUR-TEST%'");
    const [[u]] = await pool.query("SELECT id FROM users WHERE role = 'CITIZEN' LIMIT 1");
    const ins = (n, status, createdDaysAgo, resolvedDaysAgo) =>
      pool.query(
        `INSERT INTO complaints (complaint_number, user_id, description, category, latitude, longitude, address, status, priority_level, created_at, resolved_at)
         VALUES (?, ?, ?, 'POTHOLE', ?, ?, 'Recurring Test Road', ?, 'MEDIUM', DATE_SUB(NOW(), INTERVAL ? DAY), ${resolvedDaysAgo === null ? 'NULL' : 'DATE_SUB(NOW(), INTERVAL ? DAY)'})`,
        resolvedDaysAgo === null
          ? [`RCT-${Date.now()}-${n}`, u.id, `RECUR-TEST ${n}`, LAT + n * 0.00002, LNG, status, createdDaysAgo]
          : [`RCT-${Date.now()}-${n}`, u.id, `RECUR-TEST ${n}`, LAT + n * 0.00002, LNG, status, createdDaysAgo, resolvedDaysAgo]
      );
    // Three reports, fixed ~40 days ago...
    await ins(1, 'RESOLVED', 60, 40);
    await ins(2, 'RESOLVED', 55, 40);
    await ins(3, 'RESOLVED', 50, 40);
    // ...and the problem comes back: two new reports within the following 30 days.
    await ins(4, 'ASSIGNED', 20, null);
    await ins(5, 'ASSIGNED', 10, null);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM complaints WHERE description LIKE 'RECUR-TEST%'");
  });

  test('flags the location as recurring with interventions, recurrence and ACTIVE status', async () => {
    const res = await request(app).get('/api/analytics/recurring?days=180').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const p = res.body.data.problems.find((x) => x.landmark === 'Recurring Test Road');
    expect(p).toBeTruthy();
    expect(p).toEqual(expect.objectContaining({ category: 'POTHOLE', reports: 5, interventions: 3, recurredAfterResolution: 2, openNow: 2, status: 'ACTIVE' }));
  });

  test('effectiveness compares the 30 days before and after the first resolution, without claiming causation', async () => {
    const res = await request(app).get('/api/analytics/effectiveness?window=30').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.caveat).toMatch(/does not prove/i);
    const loc = d.results.find((r) => Math.abs(r.location.latitude - LAT) < 0.001 && Math.abs(r.location.longitude - LNG) < 0.001);
    expect(loc).toBeTruthy();
    expect(loc.before).toBe(3);
    expect(loc.after).toBe(2);
    expect(loc.changePct).toBe(-33);
  });

  test('both endpoints are admin-only', async () => {
    const citizen = (await request(app).post('/api/auth/register').send({ name: 'Cit Zen', email: newEmail('rc'), password: PW })).body.data.token;
    for (const p of ['recurring', 'effectiveness']) {
      expect((await request(app).get(`/api/analytics/${p}`)).status).toBe(401);
      expect((await request(app).get(`/api/analytics/${p}`).set('Authorization', `Bearer ${citizen}`)).status).toBe(403);
    }
  });
});

describe('background job locking', () => {
  test('a job is skipped when another instance holds the database lock', async () => {
    const scheduler = require('../../src/services/jobs/scheduler');
    const holder = await pool.getConnection();
    await holder.query("SELECT GET_LOCK('civic:anomaly_scan', 0)");
    try {
      const out = await scheduler.runNow('anomaly_scan');
      expect(out).toEqual({ skipped: true, reason: 'another instance is running this job' });
    } finally {
      await holder.query("SELECT RELEASE_LOCK('civic:anomaly_scan')");
      holder.release();
    }
    const again = await scheduler.runNow('anomaly_scan');
    expect(again.ok).toBe(true);
  });
});
