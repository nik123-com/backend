const mongoose = require("mongoose");

const NegotiationMessageSchema = new mongoose.Schema(
  {
    sender: { type: String, enum: ["customer", "ai_vendor"], required: true },
    message: { type: String, required: true },
    offeredPrice: { type: Number, default: null },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const NegotiationSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "customer", default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "vendor", default: null },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  
  // Pricing & Supply Context
  originalPrice: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  currentStock: { type: Number, default: 0 },
  floorPrice: { type: Number, required: true }, // Internal minimum acceptable price
  targetDiscountPercent: { type: Number, default: 0 },

  // Vendor Defined Margin & Maximum Discount Constraints
  vendorMarginPercent: { type: Number, default: null }, // Margin provided by vendor (%)
  vendorMaxDiscountPercent: { type: Number, default: null }, // Maximum discount vendor allows (%)
  isVendorApproved: { type: Boolean, default: false },
  vendorNote: { type: String, default: "" },

  // Negotiation State
  customerLatestOffer: { type: Number, default: 0 },
  aiLatestCounterOffer: { type: Number, default: 0 },
  finalAgreedPrice: { type: Number, default: null },
  status: {
    type: String,
    enum: ["waiting_vendor_approval", "in_progress", "deal_accepted", "deal_rejected", "expired", "vendor_declined"],
    default: "waiting_vendor_approval"
  },
  currentRound: { type: Number, default: 1 },
  maxRounds: { type: Number, default: 3 },
  
  // Reward / Unlock Coupon
  dealCouponCode: { type: String, default: "" },
  dealCouponId: { type: mongoose.Schema.Types.ObjectId, ref: "coupon", default: null },

  // Purchase / Consumption State (Single-use locked deal)
  isPurchased: { type: Boolean, default: false },
  purchasedAt: { type: Date, default: null },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "orders", default: null },

  history: [NegotiationMessageSchema],
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours validity
  },
  createdAt: { type: Date, default: Date.now }
});

NegotiationSchema.index({ userId: 1, productId: 1, status: 1 });
NegotiationSchema.index({ vendorId: 1, status: 1 });

module.exports = mongoose.model("Negotiation", NegotiationSchema);
