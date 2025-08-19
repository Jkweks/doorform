(function(root){
  const API_ORIGIN = root.APP_CONFIG?.apiBase || root.location.origin;
  const API_BASE = API_ORIGIN === root.location.origin ? '' : API_ORIGIN;
  async function api(path, opts = {}) {
    const r = await fetch(API_BASE + '/api' + path, opts);
    const txt = await r.text();
    try { return { ok: r.ok, json: JSON.parse(txt), status: r.status }; }
    catch (e) { return { ok: r.ok, text: txt, status: r.status }; }
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { api, API_BASE, API_ORIGIN };
  } else {
    root.api = api;
    root.API_BASE = API_BASE;
    root.API_ORIGIN = API_ORIGIN;
  }
})(typeof window !== 'undefined' ? window : globalThis);
