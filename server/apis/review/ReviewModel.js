const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId, ref: "user"},
    productId: {type: mongoose.Schema.Types.ObjectId, ref: "Product"},
    rating: {type: Number, default: 0},
    comment: {type: String, default: ""},
    reply: {type: String, default: ""},
    repliedAt: {type: Date, default: null},
    status: {type: Boolean, default: true},
    createdAt: {type: Date, default: Date.now},
})

module.exports = mongoose.model('review', reviewSchema )