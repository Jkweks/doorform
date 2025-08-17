# Frontend Configuration

The frontend makes requests to a backend API under the `/api` path.

## API base URL

By default, requests are sent to the same origin that served the frontend. If the
API is hosted on a different origin, define `window.APP_CONFIG.apiBase` before
loading any application scripts:

```html
<script>
  window.APP_CONFIG = {
    apiBase: 'https://backend.example.com'
  };
</script>
<script src="js/app.js"></script>
```

If the configured `apiBase` matches the current page's origin, the scripts fall
back to relative paths so the frontend and backend can share the same origin
without additional configuration.

## Deployments

Override `apiBase` in each deployment environment to point the frontend to the
appropriate backend server.
