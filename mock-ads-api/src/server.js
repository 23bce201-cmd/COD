require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

const googleAdsRoutes = require('./routes/google-ads');
const metaAdsRoutes = require('./routes/meta-ads');
const linkedinAdsRoutes = require('./routes/linkedin-ads');
const twitterAdsRoutes = require('./routes/twitter-ads');

const app = express();
const PORT = process.env.PORT || 4000;

// Global middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use(logger);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platforms: {
            google_ads: { status: 'online', base: '/api/google-ads' },
            meta_ads: { status: 'online', base: '/api/meta-ads' },
            linkedin_ads: { status: 'online', base: '/api/linkedin-ads' },
            twitter_ads: { status: 'online', base: '/api/twitter-ads' }
        }
    });
});

// Mount platform routers
app.use('/api/google-ads', googleAdsRoutes);
app.use('/api/meta-ads', metaAdsRoutes);
app.use('/api/linkedin-ads', linkedinAdsRoutes);
app.use('/api/twitter-ads', twitterAdsRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} does not exist`,
        availablePlatforms: [
            '/api/google-ads',
            '/api/meta-ads',
            '/api/linkedin-ads',
            '/api/twitter-ads'
        ]
    });
});

// Global error handler
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`\n🚀 Mock Ads API Server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`\nAvailable platforms:`);
    console.log(`  • Google Ads:   http://localhost:${PORT}/api/google-ads`);
    console.log(`  • Meta Ads:     http://localhost:${PORT}/api/meta-ads`);
    console.log(`  • LinkedIn Ads: http://localhost:${PORT}/api/linkedin-ads`);
    console.log(`  • Twitter Ads:  http://localhost:${PORT}/api/twitter-ads`);
});

module.exports = app;
