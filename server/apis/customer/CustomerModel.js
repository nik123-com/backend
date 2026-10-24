const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name:{type:String,default:""},
    email:{type:String, default:""},
    userId:{type:mongoose.Schema.Types.ObjectId, ref:"user"},
    Contact:{type:String, default:""},
    countryCode:{type:String, default:"+91"},
    evidence:{type:String, default:""},
    GovtID:{type:String, default:""},
    Address:{type:String, default:""},
    gender:{type:String, enum:['Male', 'Female', 'Other', ''], default:""},
    status:{type:Boolean, default:true},
    rank:{type:Number, default:null},
    rewardPopupShown:{type:Boolean, default:false},
    latestRewardCoupon:{type:String, default:""},
    created_at:{type:Date, default:Date.now()}
})

module.exports = mongoose.model('customer', CustomerSchema )