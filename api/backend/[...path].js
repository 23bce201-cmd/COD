import app from '../../backend/src/app.js';

function normalizeBackendUrl(url = '/') {
  if (url.startsWith('/api/backend/api/')) {
    return url.replace('/api/backend/api/', '/api/');
  }

  if (url === '/api/backend/api') {
    return '/api';
  }

  if (url.startsWith('/api/backend/')) {
    return url.replace('/api/backend/', '/api/');
  }

  if (url === '/api/backend') {
    return '/api';
  }

  return url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
}

export default function handler(req, res) {
  req.url = normalizeBackendUrl(req.url);
  return app(req, res);
}
