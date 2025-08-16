const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Door Parts API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('adds a door part', async () => {
    const part = {
      id: 1,
      door_id: 1,
      part_type: 'hinge',
      part_lz: 1.25,
      part_ly: 2.5,
      data: { foo: 'bar' },
    };

    pool.query.mockResolvedValueOnce({ rows: [part] });

    const res = await request(app)
      .post('/api/door-parts')
      .send({ doorId: 1, partType: 'hinge', partLz: 1.25, partLy: 2.5, data: { foo: 'bar' } });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO door_parts (door_id, part_type, part_lz, part_ly, data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [1, 'hinge', 1.25, 2.5, { foo: 'bar' }]
    );
  });

  test('updates a door part', async () => {
    const part = {
      id: 1,
      door_id: 1,
      part_type: 'hinge',
      part_lz: 2,
      part_ly: 3,
      data: { baz: 'qux' },
    };

    pool.query.mockResolvedValueOnce({ rows: [part], rowCount: 1 });

    const res = await request(app)
      .put('/api/door-parts/1')
      .send({ partType: 'hinge', partLz: 2, partLy: 3, data: { baz: 'qux' } });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE door_parts SET part_type = $1, part_lz = $2, part_ly = $3, data = $4 WHERE id = $5 RETURNING *',
      ['hinge', 2, 3, { baz: 'qux' }, '1']
    );
  });

  test('deletes a door part', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/door-parts/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Door part deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM door_parts WHERE id = $1', ['1']);
  });
});
