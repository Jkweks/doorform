const request = require('supertest');
const app = require('../src/server');
const pool = require('../src/db');

jest.mock('../src/db');

describe('Door cut list API', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('generates cut list for door', async () => {
    const doorData = { topRail: 'TR-1', bottomRail: 'BR-1', hingeRail: 'HR-1', lockRail: 'LR-1' };
    const entryData = { openingWidth: 36, openingHeight: 84, hingeGap: 0.0625, strikeGap: 0.125 };

    // first query: door and entry data
    pool.query.mockResolvedValueOnce({
      rows: [{ door_data: doorData, entry_data: entryData }],
      rowCount: 1,
    });

    // second query: parts dimensions
    pool.query.mockResolvedValueOnce({
      rows: [
        { part_type: 'TR-1', part_ly: 5 },
        { part_type: 'BR-1', part_ly: 10 },
        { part_type: 'HR-1', part_ly: 4 },
        { part_type: 'LR-1', part_ly: 4 },
      ],
    });

    const res = await request(app).get('/api/doors/1/cut-list');
    expect(res.status).toBe(200);
    expect(res.body.cutList).toEqual({
      hingeRail: { length: 69 },
      lockRail: { length: 69 },
      topRail: { length: 27.8125 },
      bottomRail: { length: 27.8125 },
    });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT d.data AS door_data, e.data AS entry_data FROM doors d JOIN entries e ON d.entry_id = e.id WHERE d.id = $1',
      ['1']
    );
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT part_type, part_ly FROM door_parts WHERE door_id IS NULL AND part_type = ANY($1::text[])',
      [['TR-1', 'BR-1', 'HR-1', 'LR-1']]
    );
  });
});
