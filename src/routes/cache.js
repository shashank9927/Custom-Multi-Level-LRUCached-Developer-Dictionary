const express = require('express');
const cacheController = require('../controllers/cacheController');

const router = express.Router();

router.get('/', cacheController.getCacheContents);
router.get('/stats', cacheController.getCacheStats);
router.get('/:term', cacheController.checkTermInCache);

router.post('/:term', cacheController.addTermToCache);

router.delete('/:term', cacheController.removeTermFromCache);
router.delete('/', cacheController.clearCache);

module.exports = router;
