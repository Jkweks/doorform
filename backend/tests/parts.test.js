const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Parts API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('lists parts', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, door_id: null, part_type: 'E0086', part_lz: null, part_ly: null, data: null, requires: null, quantity: 1 }] });

    const res = await request(app).get('/api/parts');

    expect(res.status).toBe(200);
    expect(res.body.parts).toEqual([{ id: 1, door_id: null, part_type: 'E0086', part_lz: null, part_ly: null, data: null, requires: null, quantity: 1 }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM door_parts WHERE door_id IS NULL ORDER BY part_type');
  });

  test('adds a part', async () => {
    const part = { id: 1, door_id: null, part_type: 'E0057', part_lz: 1, part_ly: 2, data: null, requires: null, quantity: 1 };
    pool.query.mockResolvedValueOnce({ rows: [part] });

    const res = await request(app)
      .post('/api/parts')
      .send({ partType: 'E0057', partLz: 1, partLy: 2, data: null });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO door_parts (door_id, part_type, part_lz, part_ly, data, requires, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [null, 'E0057', 1, 2, null, null, 1]
    );
  });

  test('updates a part', async () => {
    const part = { id: 1, door_id: null, part_type: 'E0057', part_lz: 1, part_ly: 2, data: null, requires: null, quantity: 1 };
    pool.query.mockResolvedValueOnce({ rows: [part], rowCount: 1 });

    const res = await request(app)
      .put('/api/parts/1')
      .send({ partType: 'E0057', partLz: 1, partLy: 2, data: null });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE door_parts SET part_type = $1, part_lz = $2, part_ly = $3, data = $4, requires = $5, quantity = $6 WHERE id = $7 AND door_id IS NULL RETURNING *',
      ['E0057', 1, 2, null, null, 1, '1']
    );
  });

  test('deletes a part', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/parts/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Part deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM door_parts WHERE id = $1 AND door_id IS NULL', ['1']);
  });
});
