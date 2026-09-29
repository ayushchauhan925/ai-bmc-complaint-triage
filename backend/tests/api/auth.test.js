const request = require('supertest');
const app = require('../../src/app');

describe('Auth API', () => {
  const uniqueEmail = `test.user.${Date.now()}@example.demo`;

  test('POST /api/auth/register creates a CITIZEN account and returns a token', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Automated Test User',
      email: uniqueEmail,
      password: 'Password123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('CITIZEN');
    expect(res.body.data.token).toBeTruthy();
  });

  test('POST /api/auth/register rejects a duplicate email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Automated Test User',
      email: uniqueEmail,
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
  });

  test('POST /api/auth/register rejects weak/invalid input', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'A',
      email: 'not-an-email',
      password: '123',
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: uniqueEmail,
      password: 'WrongPassword!',
    });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/login succeeds and GET /api/auth/me returns the profile', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({
      email: uniqueEmail,
      password: 'Password123!',
    });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.data.token;

    const meRes = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.user.email).toBe(uniqueEmail);
  });

  test('GET /api/auth/me without a token is rejected', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
