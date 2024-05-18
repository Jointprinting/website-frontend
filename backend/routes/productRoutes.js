const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Define routes for product management

module.exports = router;

router.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new product
router.post('/api/products', async (req, res) => {
  try {
    const product = new Product({
      name: req.body.name,
      vendor: req.body.vendor,
      style: req.body.style,
      description: req.body.description,
      sizeRangeBottom: req.body.sizeRangeBottom,
      sizeRangeTop: req.body.sizeRangeTop,
      priceRangeBottom: req.body.priceRangeBottom,
      priceRangeTop: req.body.priceRangeTop,
      colors: req.body.colors,
      colorCodes: req.body.colorCodes,
      productImagesFront: req.body.productImagesFront,
      productImagesBack: req.body.productImagesBack,
      rating: req.body.rating,
      tag: req.body.tag,
      category: req.body.category,
      type: req.body.type,
    });
    await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
