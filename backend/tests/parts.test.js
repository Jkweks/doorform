const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Parts API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('lists parts', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          door_id: null,
          manufacturer: 'Acme',
          system: 'SysA',
          product_number: 'E0086',
          part_lz: null,
          part_ly: null,
          data: null,
          requires: null
        }
      ]
    });

    const res = await request(app).get('/api/parts');

    expect(res.status).toBe(200);
    expect(res.body.parts).toEqual([
      {
        id: 1,
        door_id: null,
        manufacturer: 'Acme',
        system: 'SysA',
        product_number: 'E0086',
        part_lz: null,
        part_ly: null,
        data: null,
        requires: null
      }
    ]);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM door_parts WHERE door_id IS NULL ORDER BY manufacturer, system, product_number'
    );
  });

  test('adds a part', async () => {
    const part = {
      id: 1,
      door_id: null,
      manufacturer: 'Acme',
      system: 'SysA',
      product_number: 'E0057',
      part_lz: 1,
      part_ly: 2,
      data: null,
      requires: { E0002: 3 }
    };
    pool.query.mockResolvedValueOnce({ rows: [part] });

    const res = await request(app)
      .post('/api/parts')
      .send({
        productNumber: 'E0057',
        manufacturer: 'Acme',
        system: 'SysA',
        partLz: 1,
        partLy: 2,
        data: null,
        requires: { E0002: 3 }
      });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO door_parts (door_id, manufacturer, system, product_number, part_lz, part_ly, data, requires) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [null, 'Acme', 'SysA', 'E0057', 1, 2, null, JSON.stringify({ E0002: 3 })]
    );
  });

  test('updates a part', async () => {
    const part = {
      id: 1,
      door_id: null,
      manufacturer: 'Acme',
      system: 'SysA',
      product_number: 'E0057',
      part_lz: 1,
      part_ly: 2,
      data: null,
      requires: { E0002: 3 }
    };
    pool.query.mockResolvedValueOnce({ rows: [part], rowCount: 1 });

    const res = await request(app)
      .put('/api/parts/1')
      .send({
        productNumber: 'E0057',
        manufacturer: 'Acme',
        system: 'SysA',
        partLz: 1,
        partLy: 2,
        data: null,
        requires: { E0002: 3 }
      });

    expect(res.status).toBe(200);
    expect(res.body.part).toEqual(part);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE door_parts SET manufacturer = $1, system = $2, product_number = $3, part_lz = $4, part_ly = $5, data = $6, requires = $7 WHERE id = $8 AND door_id IS NULL RETURNING *',
      ['Acme', 'SysA', 'E0057', 1, 2, null, JSON.stringify({ E0002: 3 }), '1']
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

