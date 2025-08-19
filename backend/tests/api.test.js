describe('api helper', () => {
  afterEach(() => {
    delete global.APP_CONFIG;
    delete global.fetch;
    delete global.location;
    jest.resetModules();
  });

  test('uses relative path when apiBase matches origin', () => {
    global.location = { origin: 'http://localhost' };
    global.APP_CONFIG = { apiBase: 'http://localhost' };
    jest.resetModules();
    const { API_BASE } = require('../../frontend/js/api.js');
    expect(API_BASE).toBe('');
  });

  test('prefixes requests with apiBase when provided', async () => {
    global.location = { origin: 'http://localhost' };
    global.APP_CONFIG = { apiBase: 'https://backend.example.com' };
    jest.resetModules();
    const { API_BASE, api } = require('../../frontend/js/api.js');
    expect(API_BASE).toBe('https://backend.example.com');
    global.fetch = jest.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve('{}'), status: 200 });
    await api('/jobs');
    expect(global.fetch).toHaveBeenCalledWith('https://backend.example.com/api/jobs', {});
  });
});
