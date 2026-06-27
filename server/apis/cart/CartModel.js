const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    product_id: {type:mongoose.Schema.Types.ObjectId, ref: "Product"},
    user_id:{type: mongoose.Schema.Types.ObjectId,ref:"user"},
    qty:{type: Number,default:0},
    price:{type:Number,default: 0},

    createdAt: {type: Date, default: Date.now()},
    status:{type:Boolean,default:true}
})

module.exports = mongoose.model('cart', cartSchema)