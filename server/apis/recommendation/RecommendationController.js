const RecommendationService = require("./RecommendationService");
const UserBehaviorModel = require("../behavior/UserBehaviorModel");
const UserProfileModel = require("../behavior/UserProfileModel");
const RecommendationMetricsModel = require("./RecommendationMetricsModel");
const ProductModel = require("../product/ProductModel");

// Get personalized recommendations for user (or cold start)
const getRecommendations = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const limit = Number(req.body?.limit) || 8;
    const currentProductId = req.body?.currentProductId || null;

    const recommendations = await RecommendationService.getPersonalizedRecommendations({
      userId,
      limit,
      currentProductId
    });

    return res.status(200).json({
      success: true,
      status: 200,
      data: recommendations
    });
  } catch (err) {
    console.error("Error in getRecommendations:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Get recommendations for Product Details page
const getProductDetailRecommendations = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "productId is required"
      });
    }

    const recommendations = await RecommendationService.getComplementaryRecommendations(productId, 4);

    return res.status(200).json({
      success: true,
      status: 200,
      data: recommendations
    });
  } catch (err) {
    console.error("Error in getProductDetailRecommendations:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Get explanation for a specific product
const getExplanation = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const productId = req.body?.productId || req.params?.productId;

    if (!productId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "productId is required"
      });
    }

    const product = await ProductModel.findById(productId)
      .populate("category_id", "name")
      .populate("brand_id", "name");

    if (!product) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Product not found"
      });
    }

    // Get calculated score from recommendation service
    const recs = await RecommendationService.getPersonalizedRecommendations({
      userId,
      limit: 20
    });

    const match = recs.find((r) => r.productId.toString() === productId.toString());

    if (match) {
      return res.status(200).json({
        success: true,
        status: 200,
        data: {
          productId,
          score: match.score,
          matchPercentage: match.matchPercentage,
          reasons: match.reasons,
          breakdown: match.breakdown || null
        }
      });
    }

    // Fallback explanation if product wasn't in top 20
    const reasons = [
      product.category_id?.name ? `Category interest in ${product.category_id.name}` : "Relevant catalog item",
      Number(product.rating) >= 4 ? `Customer favorite (${Number(product.rating).toFixed(1)}★)` : "Trending product"
    ];

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        productId,
        score: 0.85,
        matchPercentage: 85,
        reasons
      }
    });
  } catch (err) {
    console.error("Error in getExplanation:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Track user behavior event
const trackEvent = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { eventType, productId, categoryId, brandId, metadata, sessionId } = req.body;

    if (!eventType) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "eventType is required"
      });
    }

    const event = new UserBehaviorModel({
      userId,
      sessionId: sessionId || "",
      eventType,
      productId: productId || null,
      categoryId: categoryId || null,
      brandId: brandId || null,
      metadata: metadata || {}
    });

    await event.save();

    // Trigger profile sync in background for registered user
    if (userId) {
      RecommendationService.syncUserProfile(userId).catch((e) =>
        console.error("Async profile sync error:", e)
      );
    }

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Behavior event tracked"
    });
  } catch (err) {
    console.error("Error in trackEvent:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Retrieve customer's inferred preference profile
const getUserProfile = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    if (!userId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "userId is required"
      });
    }

    let profile = await UserProfileModel.findOne({ userId })
      .populate("preferredCategories.categoryId", "name")
      .populate("preferredBrands.brandId", "name")
      .populate("frequentlyViewedProducts.productId", "name price image");

    if (!profile) {
      profile = await RecommendationService.syncUserProfile(userId);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      data: profile
    });
  } catch (err) {
    console.error("Error in getUserProfile:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Track recommendation interaction metric (impression, click, conversion)
const trackMetric = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { recommendationType, productId, action, metadata, sessionId } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "action is required"
      });
    }

    const metric = new RecommendationMetricsModel({
      userId,
      sessionId: sessionId || "",
      recommendationType: recommendationType || "for_you",
      productId: productId || null,
      action,
      metadata: metadata || {}
    });

    await metric.save();

    return res.status(201).json({
      success: true,
      status: 201,
      message: "Recommendation metric recorded"
    });
  } catch (err) {
    console.error("Error in trackMetric:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

// Admin aggregate analytics on recommendation performance
const getAnalytics = async (req, res) => {
  try {
    const impressions = await RecommendationMetricsModel.countDocuments({ action: "impression" });
    const clicks = await RecommendationMetricsModel.countDocuments({ action: "click" });
    const conversions = await RecommendationMetricsModel.countDocuments({ action: "conversion" });
    const smartCartApplied = await RecommendationMetricsModel.countDocuments({ action: "smart_cart_applied" });

    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    const conversionRate = clicks > 0 ? Number(((conversions / clicks) * 100).toFixed(2)) : 0;

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        totalImpressions: impressions,
        totalClicks: clicks,
        totalConversions: conversions,
        ctrPercentage: ctr,
        conversionRatePercentage: conversionRate,
        smartCartOptimizationsApplied: smartCartApplied
      }
    });
  } catch (err) {
    console.error("Error in getAnalytics:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

module.exports = {
  getRecommendations,
  getProductDetailRecommendations,
  getExplanation,
  trackEvent,
  getUserProfile,
  trackMetric,
  getAnalytics
};
