const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`Mock Ads API Server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log('Available platforms:');
    console.log(`  - Google Ads:   http://localhost:${PORT}/api/google-ads`);
    console.log(`  - Meta Ads:     http://localhost:${PORT}/api/meta-ads`);
    console.log(`  - LinkedIn Ads: http://localhost:${PORT}/api/linkedin-ads`);
    console.log(`  - Twitter Ads:  http://localhost:${PORT}/api/twitter-ads`);
});
