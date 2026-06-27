const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId,ref:"user"},
    productId: {type: mongoose.Schema.Types.ObjectId,ref:"products"},
    rating: {type: Number, default: 0},
    comment: {type: String, default: ""},
    status: {type: Boolean,default:true},
   
    createdAt: {type: Date, default: Date.now()},
})

module.exports = mongoose.model('review', reviewSchema )