const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({ 
    name: {
        type: String,
        required: true
    },
    vendor: {
        type: String,
        default: 'Joint Printing',
    },
    style: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    sizeRangeBottom: {
        type: String,
        default: 'S'
    },
    sizeRangeTop: {
        type: String,
        default: 'XL'
    },
    priceRangeBottom: {
        type: Number,
        default: 20
    },
    priceRangeTop: {
        type: Number,
        default: 28
    },
    colors: [
        {
            type: String
        }
    ],
    colorCodes: [
        {
            type: String
        }
    ],
    productFrontImages: [
        {
            type: String
        }
    ],
    productBackImages: [
        {
            type: String
        }
    ],
    rating: {
        type: Number,
        default: 5
    },
    tag: {
        type: String,
        default: 'New Arrival'
    },
    category: {
        type: String,
        default: 'Shirts'
    },
    type: {
        type: String,
        default: 'Unisex'
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
});

const Product = mongoose.model("Product", ProductSchema);

module.exports = Product;