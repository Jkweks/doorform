const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Work order PDF API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('saves a production pdf', async () => {
    pool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
    const buf = Buffer.from('PDFDATA');
    const res = await request(app)
      .post('/api/work-orders/1/pdf')
      .set('Content-Type', 'application/pdf')
      .set('x-print-tag', 'production')
      .send(buf);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 5 });
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO work_order_pdfs (work_order_id, tag, pdf) VALUES ($1, $2, $3) RETURNING id',
      ['1', 'production', buf]
    );
  });
});
