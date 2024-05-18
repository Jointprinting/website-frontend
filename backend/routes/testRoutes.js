const express = require('express');
const router = express.Router();
const Test = require('../models/Test');

// Define routes for product management

module.exports = router;

// POST a new product
router.post('/api/test', async (req, res) => {
  try {
    const product = new Test({
      name: req.body.name,
    });
    await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
module.exports = router;

