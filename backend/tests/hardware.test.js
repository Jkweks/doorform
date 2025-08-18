const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Hardware API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('lists hardware categories', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'hinges' }] });

    const res = await request(app).get('/api/hardware-categories');

    expect(res.status).toBe(200);
    expect(res.body.categories).toEqual([{ id: 1, name: 'hinges' }]);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM hardware_categories ORDER BY name');
  });

  test('adds a hardware category', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'hinges' }] });

    const res = await request(app)
      .post('/api/hardware-categories')
      .send({ name: 'hinges' });

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ id: 1, name: 'hinges' });
    expect(pool.query).toHaveBeenCalledWith('INSERT INTO hardware_categories (name) VALUES ($1) RETURNING *', ['hinges']);
  });

  test('updates a hardware category', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'pivots' }], rowCount: 1 });

    const res = await request(app)
      .put('/api/hardware-categories/1')
      .send({ name: 'pivots' });

    expect(res.status).toBe(200);
    expect(res.body.category).toEqual({ id: 1, name: 'pivots' });
    expect(pool.query).toHaveBeenCalledWith('UPDATE hardware_categories SET name = $1 WHERE id = $2 RETURNING *', ['pivots', '1']);
  });

  test('deletes a hardware category', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/hardware-categories/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Category deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM hardware_categories WHERE id = $1', ['1']);
  });

  test('lists hardware items', async () => {
    const rows = [{ id: 1, category_id: 2, manufacturer: 'Acme', model_number: 'H123', features: ['fire-rated'] }];
    pool.query.mockResolvedValueOnce({ rows });

    const res = await request(app).get('/api/hardware');

    expect(res.status).toBe(200);
    expect(res.body.hardware).toEqual(rows);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM hardware_items ORDER BY id', []);
  });

  test('adds a hardware item', async () => {
    const item = { id: 1, category_id: 2, manufacturer: 'Acme', model_number: 'H123', features: ['fire-rated'] };
    pool.query.mockResolvedValueOnce({ rows: [item] });

    const res = await request(app)
      .post('/api/hardware')
      .send({ categoryId: 2, manufacturer: 'Acme', modelNumber: 'H123', features: ['fire-rated'] });

    expect(res.status).toBe(200);
    expect(res.body.hardware).toEqual(item);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO hardware_items (category_id, manufacturer, model_number, features) VALUES ($1, $2, $3, $4) RETURNING *',
      [2, 'Acme', 'H123', ['fire-rated']]
    );
  });

  test('updates a hardware item', async () => {
    const item = { id: 1, category_id: 3, manufacturer: 'Acme', model_number: 'P200', features: [] };
    pool.query.mockResolvedValueOnce({ rows: [item], rowCount: 1 });

    const res = await request(app)
      .put('/api/hardware/1')
      .send({ categoryId: 3, manufacturer: 'Acme', modelNumber: 'P200', features: [] });

    expect(res.status).toBe(200);
    expect(res.body.hardware).toEqual(item);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE hardware_items SET category_id = $1, manufacturer = $2, model_number = $3, features = $4 WHERE id = $5 RETURNING *',
      [3, 'Acme', 'P200', [], '1']
    );
  });

  test('deletes a hardware item', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app).delete('/api/hardware/1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Hardware deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM hardware_items WHERE id = $1', ['1']);
  });
});
