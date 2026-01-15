const express = require('express');
const router = express.Router();

// Example route
router.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to FosssilProcure API',
    version: '1.0.0'
  });
});

// Example: Users routes (placeholder)
// const usersRouter = require('./users');
// router.use('/users', usersRouter);

// Example: Products routes (placeholder)
// const productsRouter = require('./products');
// router.use('/products', productsRouter);

module.exports = router;

