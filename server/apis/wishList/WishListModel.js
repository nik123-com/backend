const mongoose = require('mongoose')
const wishlistSchema = mongoose.Schema({
    addedById: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }, // Owner of the wishlist
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            addedAt: { type: Date, default: Date.now }
        }
    ],
    sharedWith: [
        {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' }, // Friends with whom it's shared
            sharedAt: { type: Date, default: Date.now }
        }
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: null },
    listName: { type: String, default:null},
    messages: [{
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        content: { type:String, default:null}, // Text message
        type: { type: String, enum: ['text', 'link'],default:'text' },
        timestamp: { type: Date, default: Date.now },
    }],
    isPublic:{ type: Number,default:0 }// 0 means private, 1 means public

});

module.exports = mongoose.model('wishlist', wishlistSchema);