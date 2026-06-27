const mongoose = require('mongoose');

const enquirySchema = new mongoose.Schema({
    userId: {type: mongoose.Schema.Types.ObjectId,ref:"user"},
    subject: {type:String,default: ""},
    message: {type:String,default: ""},
    status: {type:Boolean,default: true},
    createdAt: {type: Date, default: Date.now()},
})

module.exports = mongoose.model('enquiry', enquirySchema )