const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    wishlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'wishlist' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    type: {
        type: String,
        enum: ['wishlist_invite', 'invite_accepted', 'invite_rejected', 'stock_available', 'general', 'review_reply', 'rank_allotment', 'rank_revocation', 'bargain_request'],
        default: 'general'
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'read'],
        default: 'pending'
    },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('notification', notificationSchema);
