const express = require('express');
const router = express.Router();
const { sites } = require('../controllers');
const { protect } = require('../middleware');

router.use(protect);
router.get('/', sites.listSites);

module.exports = router;
