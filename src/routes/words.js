const express = require('express');
const wordController = require('../controllers/wordController');

const router = express.Router();

router.get('/:term', wordController.getWord);
router.get('/',wordController.getAllWords);

router.post('/',wordController.createWord);
router.post('/bulk', wordController.createBulkWords);

router.put('/:term', wordController.updateWord);

router.delete('/:term', wordController.deleteWord);

module.exports = router;