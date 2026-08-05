const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
    name:{type:String,default:""},
    email:{type:String, default:""},
    userId:{type:mongoose.Schema.Types.ObjectId, ref:"user"},
    Contact:{type:String, default:""},
    evidence:{type:String, default:""},
    GovtID:{type:String, default:""},
    Address:{type:String, default:""},
    status:{type:Boolean, default:true},
    rank:{type:String, enum:['Bronze', 'Silver', 'Gold', 'Platinum', 'VIP Premium'], default:'Bronze'},
    rankScore:{type:Number, default:0},
    activityStatus:{type:String, enum:['Highly Active', 'Moderately Active', 'Dormant'], default:'Moderately Active'},
    activityScore:{type:Number, default:50},
    lastActiveAt:{type:Date, default:Date.now},
    aiSummary:{type:String, default:""},
    rankUpdatedAt:{type:Date, default:null},
    assignedCoupons:[{type:mongoose.Schema.Types.ObjectId, ref:"coupon"}],
    pendingRank:{type:String, enum:['Bronze', 'Silver', 'Gold', 'Platinum', 'VIP Premium'], default:null},
    pendingRankScore:{type:Number, default:null},
    pendingActivityStatus:{type:String, enum:['Highly Active', 'Moderately Active', 'Dormant'], default:null},
    pendingAiSummary:{type:String, default:""},
    pendingRewardCoupon:{type:Object, default:null},
    aiEvaluationStatus:{type:String, enum:['None', 'Pending Approval', 'Approved', 'Rejected'], default:'None'},
    created_at:{type:Date, default:Date.now()}
})

module.exports = mongoose.model('customer', CustomerSchema )