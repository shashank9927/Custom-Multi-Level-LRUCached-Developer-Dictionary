const express = require('express');

const router = express.Router();

const wordRoutes = require('./words');
const cacheRoutes = require('./cache');
const capacityRoutes = require('./capacity');
const adminRoutes = require('./admin');

// Mount all API routes
router.use('/words', wordRoutes);
router.use('/cache', cacheRoutes);
router.use('/capacity', capacityRoutes);
router.use('/admin', adminRoutes);

module.exports = router;