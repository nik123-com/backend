const ProductModel = require("../product/ProductModel");
const OrderModel = require("../order/OrderModel");
const CategoryModel = require("../category/categoryModel");
const BrandModel = require("../brand/BrandModel");
const UserBehaviorModel = require("../behavior/UserBehaviorModel");
const UserProfileModel = require("../behavior/UserProfileModel");
const config = require("../../config/recommendationConfig");

/**
 * Update or build user profile asynchronously based on new behavior events
 */
async function syncUserProfile(userId) {
  if (!userId) return null;
  try {
    const behaviors = await UserBehaviorModel.find({ userId })
      .sort({ timestamp: -1 })
      .limit(200)
      .populate("productId", "price category_id brand_id name");

    if (!behaviors || behaviors.length === 0) return null;

    const categoryCounts = {};
    const brandCounts = {};
    const prices = [];
    const viewedProductsMap = {};
    const recentSearches = [];

    behaviors.forEach((b) => {
      // Category interaction
      const catId = b.categoryId || b.productId?.category_id;
      if (catId) {
        const catKey = catId.toString();
        categoryCounts[catKey] = (categoryCounts[catKey] || 0) + (b.eventType === "product_purchase" ? 5 : b.eventType === "cart_add" ? 3 : 1);
      }

      // Brand interaction
      const bId = b.brandId || b.productId?.brand_id;
      if (bId) {
        const brandKey = bId.toString();
        brandCounts[brandKey] = (brandCounts[brandKey] || 0) + (b.eventType === "product_purchase" ? 5 : b.eventType === "cart_add" ? 3 : 1);
      }

      // Price tracking
      const pr = Number(b.metadata?.price || b.productId?.price);
      if (pr && !isNaN(pr) && pr > 0) {
        prices.push(pr);
      }

      // Viewed products
      if (b.productId?._id) {
        const pKey = b.productId._id.toString();
        if (!viewedProductsMap[pKey]) {
          viewedProductsMap[pKey] = { productId: b.productId._id, viewCount: 0, lastViewed: b.timestamp };
        }
        viewedProductsMap[pKey].viewCount += 1;
      }

      // Search query tracking
      if (b.eventType === "product_search" && b.metadata?.searchQuery) {
        const q = b.metadata.searchQuery.trim().toLowerCase();
        if (q && !recentSearches.includes(q)) {
          recentSearches.push(q);
        }
      }
    });

    // Compute average price range
    let minPrice = 0, maxPrice = 50000, avgPrice = 1000;
    if (prices.length > 0) {
      minPrice = Math.min(...prices);
      maxPrice = Math.max(...prices);
      avgPrice = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
    }

    // Determine price sensitivity
    let priceSensitivity = "mid-range";
    if (avgPrice < 500) priceSensitivity = "budget";
    else if (avgPrice > 3000) priceSensitivity = "premium";

    // Ranked categories
    const preferredCategories = Object.keys(categoryCounts)
      .map((catId) => ({ categoryId: catId, weight: categoryCounts[catId] }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // Ranked brands
    const preferredBrands = Object.keys(brandCounts)
      .map((bId) => ({ brandId: bId, weight: brandCounts[bId] }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);

    // Purchased products from orders
    const pastOrders = await OrderModel.find({
      addedById: userId,
      isDeleted: false,
      orderStatus: { $ne: "cancelled" }
    }).select("products");

    const purchasedProductIds = [];
    const purchasedCatSet = new Set();
    pastOrders.forEach((o) => {
      (o.products || []).forEach((p) => {
        if (p.productId) purchasedProductIds.push(p.productId);
      });
    });

    const profileData = {
      userId,
      preferredCategories,
      preferredBrands,
      averagePriceRange: {
        min: Math.max(0, Math.floor(minPrice * 0.8)),
        max: Math.ceil(maxPrice * 1.2),
        avg: avgPrice
      },
      frequentlyViewedProducts: Object.values(viewedProductsMap).slice(0, 10),
      purchasedProductIds,
      priceSensitivity,
      recentSearches: recentSearches.slice(0, 8),
      lastActive: new Date(),
      updatedAt: new Date()
    };

    return await UserProfileModel.findOneAndUpdate(
      { userId },
      { $set: profileData },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Error in syncUserProfile:", err);
    return null;
  }
}

/**
 * Fetch Cold-Start recommendations (for new users or guests without behavior)
 */
async function getColdStartRecommendations(limit = config.coldStartLimit, excludeIds = []) {
  try {
    const products = await ProductModel.find({
      status: true,
      stock: { $gt: 0 },
      isDraft: { $ne: true },
      _id: { $nin: excludeIds }
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ rating: -1, stock: -1 })
      .limit(limit);

    return products.map((prod) => {
      const reasons = [];
      const rating = Number(prod.rating) || 0;
      if (rating >= 4.0) {
        reasons.push(`Highly rated by Aventra customers (${rating.toFixed(1)}★)`);
      } else {
        reasons.push("Popular trending choice on Aventra");
      }
      if (prod.category_id?.name) {
        reasons.push(`Top pick in ${prod.category_id.name}`);
      }
      reasons.push("Fast fulfillment & reliable in-stock item");

      // Baseline score for cold start (75% - 90%)
      const score = Math.min(0.92, Math.max(0.72, 0.70 + (rating / 5) * 0.20));

      return {
        product: prod,
        productId: prod._id,
        score: Number(score.toFixed(2)),
        matchPercentage: Math.round(score * 100),
        reasons,
        isColdStart: true
      };
    });
  } catch (err) {
    console.error("Error in getColdStartRecommendations:", err);
    return [];
  }
}

/**
 * Main Explainable Personalized Recommendation Calculation
 */
async function getPersonalizedRecommendations({
  userId = null,
  sessionId = null,
  currentProductId = null,
  limit = config.defaultLimit,
  excludePurchased = true
}) {
  try {
    // 1. Retrieve or build user profile
    let profile = null;
    if (userId) {
      profile = await UserProfileModel.findOne({ userId });
      if (!profile) {
        profile = await syncUserProfile(userId);
      }
    }

    // Determine products to exclude
    const excludeIds = [];
    if (currentProductId) excludeIds.push(currentProductId);
    if (excludePurchased && profile && profile.purchasedProductIds?.length > 0) {
      profile.purchasedProductIds.forEach((id) => excludeIds.push(id.toString()));
    }

    // If insufficient user profile data, fallback to cold-start strategy
    const hasSufficientData =
      profile &&
      ((profile.preferredCategories && profile.preferredCategories.length > 0) ||
        (profile.frequentlyViewedProducts && profile.frequentlyViewedProducts.length > 0) ||
        (profile.averagePriceRange && profile.averagePriceRange.avg > 0));

    if (!hasSufficientData) {
      return await getColdStartRecommendations(limit, excludeIds);
    }

    // 2. Fetch available candidate products from database
    const candidates = await ProductModel.find({
      status: true,
      stock: { $gt: 0 },
      isDraft: { $ne: true },
      _id: { $nin: excludeIds }
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .limit(60);

    if (!candidates || candidates.length === 0) {
      return await getColdStartRecommendations(limit, excludeIds);
    }

    // 3. Prepare scoring references
    const preferredCatMap = new Map();
    let maxCatWeight = 1;
    (profile.preferredCategories || []).forEach((c) => {
      const catId = (c.categoryId?._id || c.categoryId || "").toString();
      preferredCatMap.set(catId, c.weight || 1);
      if ((c.weight || 1) > maxCatWeight) maxCatWeight = c.weight || 1;
    });

    const preferredBrandMap = new Map();
    let maxBrandWeight = 1;
    (profile.preferredBrands || []).forEach((b) => {
      const bId = (b.brandId?._id || b.brandId || "").toString();
      preferredBrandMap.set(bId, b.weight || 1);
      if ((b.weight || 1) > maxBrandWeight) maxBrandWeight = b.weight || 1;
    });

    const viewedProdIds = new Set(
      (profile.frequentlyViewedProducts || []).map((p) => (p.productId?._id || p.productId || "").toString())
    );

    const userBudgetAvg = profile.averagePriceRange?.avg || 1000;
    const userBudgetMin = profile.averagePriceRange?.min || 0;
    const userBudgetMax = profile.averagePriceRange?.max || userBudgetAvg * 2.5;

    // Weights from central configuration
    const W = config.weights;

    // 4. Score each candidate
    const scoredList = candidates.map((prod) => {
      const reasons = [];
      const prodPrice = Number(prod.price) || 0;
      const catId = (prod.category_id?._id || prod.category_id || "").toString();
      const brandId = (prod.brand_id?._id || prod.brand_id || "").toString();
      const catName = prod.category_id?.name || "Category";
      const brandName = prod.brand_id?.name || "";

      // 1. Category Similarity (0 to 1)
      let catSim = 0.2; // default base similarity
      if (preferredCatMap.has(catId)) {
        const catWeight = preferredCatMap.get(catId);
        catSim = Math.min(1.0, 0.5 + 0.5 * (catWeight / maxCatWeight));
        reasons.push(`Matches your interest in ${catName}`);
      }

      // 2. Price Compatibility (0 to 1)
      let priceComp = 0.3;
      if (prodPrice >= userBudgetMin && prodPrice <= userBudgetMax) {
        // Fits right within user's usual budget range
        const priceDiff = Math.abs(prodPrice - userBudgetAvg);
        const maxDiff = Math.max(1, userBudgetMax - userBudgetMin);
        priceComp = Math.max(0.4, 1.0 - (priceDiff / maxDiff) * 0.6);
        reasons.push(`Within your typical price preference (~₹${userBudgetAvg.toLocaleString()})`);
      } else if (prodPrice < userBudgetMin) {
        priceComp = 0.6; // Affordable/budget-friendly
        reasons.push("Budget-friendly value option");
      } else {
        priceComp = 0.25; // Exceeds budget
      }

      // 3. Behavioral Similarity (0 to 1)
      let behavSim = 0.2;
      let isBrandMatch = false;
      let isViewedMatch = false;

      if (brandId && preferredBrandMap.has(brandId)) {
        isBrandMatch = true;
        behavSim += 0.4;
        if (brandName) reasons.push(`From your favored brand ${brandName}`);
      }

      if (viewedProdIds.has(prod._id.toString())) {
        isViewedMatch = true;
        behavSim += 0.4;
        reasons.push("Similar to products you recently browsed");
      }

      behavSim = Math.min(1.0, behavSim);

      // 4. Product Rating (0 to 1)
      const rating = Number(prod.rating) || 0;
      const ratingScore = Math.min(1.0, Math.max(0.2, rating / 5.0));
      if (rating >= 4.0) {
        reasons.push(`Highly rated by customers (${rating.toFixed(1)}★)`);
      }

      // 5. Popularity / Stock Availability (0 to 1)
      let popularityScore = 0.5;
      if (prod.stock > 10) {
        popularityScore = 0.8;
      } else if (prod.stock > 0) {
        popularityScore = 0.6;
      }

      // Calculate composite score
      const totalScore =
        W.categorySimilarity * catSim +
        W.priceCompatibility * priceComp +
        W.behavioralSimilarity * behavSim +
        W.productRating * ratingScore +
        W.popularity * popularityScore;

      // Normalization safeguard (keep between 0.60 and 0.98 for realistic presentation)
      const normalizedScore = Math.min(0.98, Math.max(0.60, Number(totalScore.toFixed(2))));

      // Ensure at least 2 genuine reasons exist
      if (reasons.length === 0) {
        reasons.push(`Selected for quality in ${catName}`);
        reasons.push("Verified in-stock product");
      } else if (reasons.length === 1) {
        reasons.push("Verified available for immediate delivery");
      }

      return {
        product: prod,
        productId: prod._id,
        score: normalizedScore,
        matchPercentage: Math.round(normalizedScore * 100),
        reasons: reasons.slice(0, 4),
        breakdown: {
          categorySimilarity: Number(catSim.toFixed(2)),
          priceCompatibility: Number(priceComp.toFixed(2)),
          behavioralSimilarity: Number(behavSim.toFixed(2)),
          productRating: Number(ratingScore.toFixed(2)),
          popularity: Number(popularityScore.toFixed(2))
        }
      };
    });

    // 5. Sort descending by score and pick top N
    scoredList.sort((a, b) => b.score - a.score);
    return scoredList.slice(0, limit);
  } catch (err) {
    console.error("Error in getPersonalizedRecommendations:", err);
    return await getColdStartRecommendations(limit);
  }
}

/**
 * Recommendations for Product Detail page (Frequently Bought Together / Complementary)
 */
async function getComplementaryRecommendations(productId, limit = 4) {
  try {
    const current = await ProductModel.findById(productId);
    if (!current) return [];

    // Find products in same category or complementary price range
    const complementary = await ProductModel.find({
      _id: { $ne: current._id },
      category_id: current.category_id,
      status: true,
      stock: { $gt: 0 },
      isDraft: { $ne: true }
    })
      .populate("category_id", "name")
      .populate("brand_id", "name")
      .sort({ rating: -1, stock: -1 })
      .limit(limit);

    return complementary.map((prod) => {
      const reasons = [
        `Frequently explored alongside ${current.name}`,
        `Matching category: ${prod.category_id?.name || 'General'}`
      ];
      if (Number(prod.rating) >= 4) {
        reasons.push(`Top-rated item (${Number(prod.rating).toFixed(1)}★)`);
      }

      return {
        product: prod,
        productId: prod._id,
        score: 0.90,
        matchPercentage: 90,
        reasons
      };
    });
  } catch (err) {
    console.error("Error in getComplementaryRecommendations:", err);
    return [];
  }
}

module.exports = {
  syncUserProfile,
  getColdStartRecommendations,
  getPersonalizedRecommendations,
  getComplementaryRecommendations
};
