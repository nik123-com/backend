const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    wishlistId: { type: mongoose.Schema.Types.ObjectId, ref: 'wishlist' },
    type: { 
        type: String, 
        enum: ['wishlist_invite', 'invite_accepted', 'invite_rejected', 'general'], 
        default: 'wishlist_invite' 
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
