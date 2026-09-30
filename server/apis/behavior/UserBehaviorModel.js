const mongoose = require("mongoose");

const UserBehaviorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  sessionId: { type: String, default: "" },
  eventType: {
    type: String,
    enum: [
      "product_view",
      "product_search",
      "cart_add",
      "cart_remove",
      "wishlist_add",
      "product_purchase",
      "category_interaction",
      "brand_interaction",
      "price_interaction"
    ],
    required: true
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories", default: null },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: "brands", default: null },
  metadata: {
    searchQuery: { type: String, default: "" },
    price: { type: Number, default: 0 },
    dwellTimeSeconds: { type: Number, default: 0 },
    rating: { type: Number, default: 0 }
  },
  timestamp: { type: Date, default: Date.now }
});

UserBehaviorSchema.index({ userId: 1, eventType: 1, timestamp: -1 });
UserBehaviorSchema.index({ sessionId: 1, timestamp: -1 });
UserBehaviorSchema.index({ productId: 1, eventType: 1 });

module.exports = mongoose.model("UserBehavior", UserBehaviorSchema);
