const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {type: String, default: ""},
    discount:{type:String,default: ""},
    discountType: {type: String, default: ""},
    minAmoutSpend:{type:Number,default: 0},
    expiryDate:{type:String,default: ""},
    vendorId: {type: mongoose.Schema.Types.ObjectId, ref: 'vendor', default: null},
    status: {type: Boolean,default:true},
})

module.exports = mongoose.model('coupon', couponSchema )