const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('GET /api/templates', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('retrieves templates from the database', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Template A', parts: { foo: 'bar' } }] });

    const res = await request(app).get('/api/templates');

    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual([{ id: 1, name: 'Template A', parts: { foo: 'bar' } }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM door_part_templates');
  });
});
