const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    houseno: {type : String,default:""},
    city: {type : String,default:""},
    district: {type : String,default:""},
    state: {type : String,default:""},
    country: {type : String,default:""},
    pin: {type : String,default:""},
    landmark: {type : String,default:""},
    contact: {type : String,default:""},
    altercontact: {type : String,default:""},
    editbyid: {type:String},
    // editbyid: {type:mongoose.Schema.Types.ObjectId, ref: "users"},
})

module.exports= mongoose.model("Addresses",addressSchema)