const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Parts API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('lists parts filtered by usage', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, number: 'E0086', usages: ['topRail', 'bottomRail'], requires: null }] });

    const res = await request(app).get('/api/parts?usage=topRail');

    expect(res.status).toBe(200);
    expect(res.body.parts).toEqual([{ id: 1, number: 'E0086', usages: ['topRail', 'bottomRail'], requires: null }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM parts WHERE $1 = ANY(usages) ORDER BY number', ['topRail']);
  });

  test('adds a part', async () => {
    const part = { id: 1, number: 'E0057', description: null, usages: ['hingeRail'], requires: [] };
    pool.query.mockResolvedValueOnce({ rows: [part] });

    const res = await request(app)
      .post('/api/parts')
      .send({ number: 'E0057', description: null, usages: ['hingeRail'], requires: [] });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO parts (number, description, usages, requires) VALUES ($1, $2, $3, $4) RETURNING *',
      ['E0057', null, ['hingeRail'], []]
    );
  });

  test('updates a part', async () => {
    const part = { id: 1, number: 'E0057', description: '', usages: ['hingeRail'], requires: [] };
    pool.query.mockResolvedValueOnce({ rows: [part], rowCount: 1 });

    const res = await request(app)
      .put('/api/parts/1')
      .send({ number: 'E0057', description: '', usages: ['hingeRail'], requires: [] });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE parts SET number = $1, description = $2, usages = $3, requires = $4 WHERE id = $5 RETURNING *',
      ['E0057', '', ['hingeRail'], [], '1']
    );
  });

  test('deletes a part', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/parts/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Part deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM parts WHERE id = $1', ['1']);
  });
});
