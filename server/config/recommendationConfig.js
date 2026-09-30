// Configuration for Explainable Personalized Recommendation Engine
module.exports = {
  // Recommendation Scoring Weights (Must sum to 1.0)
  weights: {
    categorySimilarity: 0.30,
    priceCompatibility: 0.25,
    behavioralSimilarity: 0.20,
    productRating: 0.15,
    popularity: 0.10
  },

  // Cold Start Strategy Limits
  coldStartLimit: 8,

  // Default number of recommendations returned
  defaultLimit: 8,

  // Inventory & Stock-Out Intelligence Settings
  stockIntelligence: {
    defaultLeadTimeDays: 14,
    criticalStockDaysThreshold: 5,
    warningStockDaysThreshold: 14,
    highDemandGrowthThreshold: 1.15,
    lowDemandDropThreshold: 0.85,
    minSalesForHighConfidence: 10

  }
};
