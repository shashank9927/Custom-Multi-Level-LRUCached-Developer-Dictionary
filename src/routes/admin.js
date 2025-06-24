const express = require('express');
const adminController = require('../controllers/adminController');

const router = express.Router();

router.get('/cache-warmer', adminController.getCacheWarmerStatus);

router.post('/cache-warmer/trigger', adminController.triggerCacheWarmer);

module.exports = router;