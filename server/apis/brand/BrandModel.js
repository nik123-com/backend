const mongoose = require('mongoose');

const brandSchema = new mongoose.Schema({
    name: {type: String, default: ""},
    logo :{type: String,default:""},
    status:{type:Boolean,default: true},
    createdAt: {type: Date, default: Date.now()}

})

module.exports = mongoose.model('brands', brandSchema )