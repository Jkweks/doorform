const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('DELETE endpoints', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('DELETE /api/entries/:id removes entry', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/entries/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Entry deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM entries WHERE id = $1', ['1']);
  });

  test('DELETE /api/work-orders/:id removes work order', async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    const res = await request(app).delete('/api/work-orders/1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Work order deleted' });
    expect(pool.query).toHaveBeenCalledWith('DELETE FROM work_orders WHERE id = $1', ['1']);
  });
});
