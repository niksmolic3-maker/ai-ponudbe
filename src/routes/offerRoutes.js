const express = require('express');
const { createOffer } = require('../controllers/offerController');
const router = express.Router();

router.post('/create', createOffer);

router.get('/test', (req, res) => {
  res.json({ message: 'Routes delujejo!' });
});

module.exports = router;