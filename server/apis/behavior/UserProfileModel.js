const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, unique: true },
  preferredCategories: [
    {
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
      categoryName: { type: String, default: "" },
      weight: { type: Number, default: 1 }
    }
  ],
  preferredBrands: [
    {
      brandId: { type: mongoose.Schema.Types.ObjectId, ref: "brands" },
      brandName: { type: String, default: "" },
      weight: { type: Number, default: 1 }
    }
  ],
  averagePriceRange: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 100000 },
    avg: { type: Number, default: 1000 }
  },
  frequentlyViewedProducts: [
    {
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      viewCount: { type: Number, default: 1 },
      lastViewed: { type: Date, default: Date.now }
    }
  ],
  frequentlyPurchasedCategories: [
    {
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "categories" },
      purchaseCount: { type: Number, default: 1 }
    }
  ],
  purchasedProductIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Product" }
  ],
  priceSensitivity: {
    type: String,
    enum: ["budget", "mid-range", "premium", "unspecified"],
    default: "unspecified"
  },
  recentSearches: [{ type: String }],
  lastActive: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("UserProfile", UserProfileSchema);
