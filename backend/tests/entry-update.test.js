const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('PUT /api/entries/:id', () => {
  let client;
  beforeEach(() => {
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('adds B leaf when updating from single to double handing', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ handing: 'RHR' }], rowCount: 1 }) // SELECT handing
      .mockResolvedValueOnce({}) // UPDATE entries
      .mockResolvedValueOnce({ rows: [{ data: { foo: 'bar' } }] }) // SELECT door data
      .mockResolvedValueOnce({}) // INSERT B leaf
      .mockResolvedValueOnce({}) // COMMIT
      .mockResolvedValueOnce({ rows: [{ id: 1, handing: 'RHRA', data: 'new' }] }); // SELECT updated

    const res = await request(app)
      .put('/api/entries/1')
      .send({ handing: 'RHRA', data: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.entry).toEqual({ id: 1, handing: 'RHRA', data: 'new' });
    expect(client.query).toHaveBeenCalledWith(
      "INSERT INTO doors (entry_id, leaf, data) VALUES ($1, 'B', $2)",
      ['1', { foo: 'bar' }]
    );
  });

  test('removes B leaf when updating from double to single handing', async () => {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({ rows: [{ handing: 'RHRA' }], rowCount: 1 }) // SELECT handing
      .mockResolvedValueOnce({}) // UPDATE entries
      .mockResolvedValueOnce({}) // DELETE B leaf
      .mockResolvedValueOnce({}) // COMMIT
      .mockResolvedValueOnce({ rows: [{ id: 1, handing: 'RHR', data: 'new' }] }); // SELECT updated

    const res = await request(app)
      .put('/api/entries/1')
      .send({ handing: 'RHR', data: 'new' });

    expect(res.status).toBe(200);
    expect(res.body.entry).toEqual({ id: 1, handing: 'RHR', data: 'new' });
    expect(client.query).toHaveBeenCalledWith(
      "DELETE FROM doors WHERE entry_id = $1 AND leaf = 'B'",
      ['1']
    );
  });
});

