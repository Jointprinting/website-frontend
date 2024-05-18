const axios = require('axios');
const express = require('express');
const cors = require('cors');
const app = express();

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const mongoose = require('mongoose');
const MONGODB_URI_ = "mongodb+srv://milobarkow:ZigcHvPpoJfzNWGD@nate-site-test.tncmmsb.mongodb.net/?retryWrites=true&w=majority&appName=nate-site-test";
const MONGODB_URI = "mongodb+srv://admin:password@nate-site-test.tncmmsb.mongodb.net/?retryWrites=true&w=majority&appName=nate-site-test";

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const productRoutes = require('./routes/productRoutes');
const testRoutes = require('./routes/testRoutes');
app.use('/api/products', productRoutes);

app.listen(PORT, () => {
  console.log(`Mongoose server is running on port ${PORT}`);
});


