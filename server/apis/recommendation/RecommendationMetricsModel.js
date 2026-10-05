const mongoose = require("mongoose");

const RecommendationMetricsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", default: null },
  sessionId: { type: String, default: "" },
  recommendationType: {
    type: String,
    enum: [
      "for_you",
      "cold_start",
      "product_detail_similar",
      "cart_cross_sell",
      "smart_cart_coupon",
      "Stellar_ai_agent"
    ],
    default: "for_you"
  },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
  action: {
    type: String,
    enum: ["impression", "click", "conversion", "smart_cart_applied"],
    required: true
  },
  metadata: {
    matchScore: { type: Number, default: 0 },
    savedAmount: { type: Number, default: 0 },
    couponCode: { type: String, default: "" }
  },
  timestamp: { type: Date, default: Date.now }
});

RecommendationMetricsSchema.index({ recommendationType: 1, action: 1, timestamp: -1 });

module.exports = mongoose.model("RecommendationMetrics", RecommendationMetricsSchema);
