const mongoose = require('mongoose');

const BankDetailsSchema = new mongoose.Schema({
    accountNo: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    bankName: { type: String, default: "" },
    branch: { type: String, default: "" },
    holderName: { type: String, default: "" }
}, { _id: false });

const SocialLinksSchema = new mongoose.Schema({
    website: { type: String, default: "" },
    instagram: { type: String, default: "" },
    facebook: { type: String, default: "" },
    twitter: { type: String, default: "" }
}, { _id: false });

const WalletHistorySchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    type: { type: String, enum: ['credit', 'debit'], default: 'credit' },
    description: { type: String, default: "" },
    status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
    createdAt: { type: Date, default: Date.now }
});

const VendorSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    businessName: { type: String, required: true, trim: true },
    ownerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, default: "" },
    gstNumber: { type: String, default: "", uppercase: true },
    panNumber: { type: String, default: "", uppercase: true },
    address: { type: String, default: "" },
    bankDetails: { type: BankDetailsSchema, default: () => ({}) },
    logo: { type: String, default: "" },
    banner: { type: String, default: "" },
    description: { type: String, default: "" },
    returnPolicy: { type: String, default: "Standard 7-day return policy applies." },
    socialLinks: { type: SocialLinksSchema, default: () => ({}) },
    status: { 
        type: String, 
        enum: ['Pending', 'Approved', 'Rejected', 'Blocked'], 
        default: 'Pending' 
    },
    isBlocked: { type: Boolean, default: false },
    rank: { type: Number, default: 1 },
    rewardPopupShown: { type: Boolean, default: false },
    latestRewardCoupon: { type: String, default: "" },
    wallet: {
        earnings: { type: Number, default: 0 },
        pendingSettlements: { type: Number, default: 0 },
        completedSettlements: { type: Number, default: 0 },
        history: [WalletHistorySchema]
    },
    created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('vendor', VendorSchema);
