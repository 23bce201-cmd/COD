import app from '../../mock-ads-api/src/app.js';

function normalizeMockAdsUrl(url = '/') {
  if (url.startsWith('/api/mock-ads/')) {
    return url.replace('/api/mock-ads/', '/');
  }

  if (url === '/api/mock-ads') {
    return '/';
  }

  return url;
}

export default function handler(req, res) {
  req.url = normalizeMockAdsUrl(req.url);
  return app(req, res);
}
