const ProductModel = require("../product/ProductModel");
const OrderModel = require("../order/OrderModel");
const config = require("../../config/recommendationConfig");

/**
 * Predictive Stock-Out Intelligence Service
 * Uses statistical demand forecasting on historical order trends
 */
async function getVendorStockIntelligence(vendorId) {
  try {
    if (!vendorId) {
      throw new Error("vendorId is required");
    }

    // 1. Fetch vendor's active products
    const products = await ProductModel.find({
      vendorId: vendorId,
      status: true,
      isDraft: { $ne: true }
    }).populate("category_id", "name");

    if (!products || products.length === 0) {
      return {
        summary: {
          totalProducts: 0,
          criticalStockCount: 0,
          warningStockCount: 0,
          adequateStockCount: 0,
          averageStockOutDaysPlatform: null
        },
        forecasts: []
      };
    }

    const productIds = products.map((p) => p._id);
    const productMap = new Map();
    products.forEach((p) => productMap.set(p._id.toString(), p));

    // 2. Fetch orders from the last 90 days involving these products
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const orders = await OrderModel.find({
      "products.productId": { $in: productIds },
      createdAt: { $gte: ninetyDaysAgo },
      isDeleted: false,
      orderStatus: { $ne: "cancelled" }
    }).select("products createdAt orderStatus");

    // 3. Accumulate sales metrics per product
    const salesMetrics = new Map();
    products.forEach((p) => {
      salesMetrics.set(p._id.toString(), {
        units90d: 0,
        units30d: 0,
        units7d: 0,
        firstSaleDate: null,
        lastSaleDate: null,
        orderDates: []
      });
    });

    orders.forEach((order) => {
      const orderDate = new Date(order.createdAt);
      (order.products || []).forEach((item) => {
        if (!item.productId) return;
        const pIdStr = item.productId.toString();
        const metrics = salesMetrics.get(pIdStr);
        if (metrics) {
          const qty = Number(item.quantity) || 1;
          metrics.units90d += qty;
          if (orderDate >= thirtyDaysAgo) {
            metrics.units30d += qty;
          }
          if (orderDate >= sevenDaysAgo) {
            metrics.units7d += qty;
          }

          if (!metrics.firstSaleDate || orderDate < metrics.firstSaleDate) {
            metrics.firstSaleDate = orderDate;
          }
          if (!metrics.lastSaleDate || orderDate > metrics.lastSaleDate) {
            metrics.lastSaleDate = orderDate;
          }
          metrics.orderDates.push(orderDate);
        }
      });
    });

    const leadTime = config.stockIntelligence.defaultLeadTimeDays; // 14 days
    const criticalThreshold = config.stockIntelligence.criticalStockDaysThreshold; // 5 days
    const warningThreshold = config.stockIntelligence.warningStockDaysThreshold; // 14 days

    let criticalStockCount = 0;
    let warningStockCount = 0;
    let adequateStockCount = 0;

    // 4. Calculate statistical forecast for each product
    const forecasts = products.map((prod) => {
      const pIdStr = prod._id.toString();
      const metrics = salesMetrics.get(pIdStr);
      const currentStock = Math.max(0, Number(prod.stock) || 0);

      // Average Daily Sales calculation:
      // Weight 30-day velocity (70%) and 7-day velocity (30%) if active
      const daily7d = metrics.units7d / 7;
      const daily30d = metrics.units30d / 30;

      let avgDailySales = 0;
      if (metrics.units7d > 0 && metrics.units30d > 0) {
        avgDailySales = 0.65 * daily30d + 0.35 * daily7d;
      } else if (metrics.units30d > 0) {
        avgDailySales = daily30d;
      } else if (metrics.units90d > 0) {
        avgDailySales = metrics.units90d / 90;
      }

      // Trend Indicator calculation:
      // Compare 7-day run rate vs 30-day run rate
      let demandTrend = "stable";
      if (daily7d > daily30d * config.stockIntelligence.highDemandGrowthThreshold && daily7d >= 0.5) {
        demandTrend = "increasing";
      } else if (daily7d < daily30d * config.stockIntelligence.lowDemandDropThreshold && daily30d >= 0.5) {
        demandTrend = "decreasing";
      }

      // Forecast Confidence Score (0 to 1) based on data density & age
      let confidence = 0.3; // baseline for low data
      if (metrics.units90d >= config.stockIntelligence.minSalesForHighConfidence) {
        confidence = 0.85;
        if (metrics.units30d >= 5) confidence = 0.92;
      } else if (metrics.units90d >= 3) {
        confidence = 0.60;
      } else if (currentStock === 0) {
        confidence = 0.95;
      }

      // Estimated Stock-Out Days
      let estimatedStockOutDays = null;
      let stockStatus = "adequate";
      let suggestedAction = "Adequate stock maintained.";

      if (currentStock <= 0) {
        estimatedStockOutDays = 0;
        stockStatus = "out_of_stock";
        suggestedAction = "Product is out of stock. Restock immediately to capture lost sales.";
        criticalStockCount++;
      } else if (avgDailySales <= 0) {
        estimatedStockOutDays = null; // No sales velocity to predict depletion
        stockStatus = "low_velocity";
        suggestedAction = "Low recent sales volume. Monitor demand trends.";
        adequateStockCount++;
      } else {
        estimatedStockOutDays = Number((currentStock / avgDailySales).toFixed(1));

        if (estimatedStockOutDays <= criticalThreshold) {
          stockStatus = "critical";
          suggestedAction = `Critical risk! Expected stock-out in ~${estimatedStockOutDays} days. Restock urgently.`;
          criticalStockCount++;
        } else if (estimatedStockOutDays <= warningThreshold) {
          stockStatus = "warning";
          suggestedAction = `Stock depleting steadily. Consider ordering replenishment within ${Math.max(1, Math.floor(estimatedStockOutDays - leadTime))} days.`;
          warningStockCount++;
        } else {
          stockStatus = "adequate";
          suggestedAction = `Sufficient inventory for ~${Math.round(estimatedStockOutDays)} days of typical sales.`;
          adequateStockCount++;
        }
      }

      // Suggested Reorder Quantity:
      // Safety stock formula: (Avg Daily Sales * Lead Time) + Safety Buffer (3 days) - Current Stock
      let suggestedReorderQty = 0;
      if (avgDailySales > 0) {
        const targetHolding = Math.ceil(avgDailySales * (leadTime + 3));
        suggestedReorderQty = Math.max(0, targetHolding - currentStock);
      } else if (currentStock <= 0) {
        suggestedReorderQty = 10; // Default sensible initial batch for stock-out items
      }

      return {
        productId: prod._id,
        name: prod.name,
        categoryName: prod.category_id?.name || "General",
        sku: prod.sku || "N/A",
        currentStock,
        price: prod.price,
        unitsSold30d: metrics.units30d,
        unitsSold7d: metrics.units7d,
        averageDailySales: Number(avgDailySales.toFixed(2)),
        demandTrend,
        estimatedStockOutDays,
        confidence: Number(confidence.toFixed(2)),
        suggestedReorderQuantity: suggestedReorderQty,
        stockStatus,
        suggestedAction
      };
    });

    // Sort by urgency: Out of stock & critical first, then warning, then adequate
    const statusPriority = { out_of_stock: 0, critical: 1, warning: 2, low_velocity: 3, adequate: 4 };
    forecasts.sort((a, b) => {
      const pDiff = (statusPriority[a.stockStatus] ?? 5) - (statusPriority[b.stockStatus] ?? 5);
      if (pDiff !== 0) return pDiff;
      if (a.estimatedStockOutDays !== null && b.estimatedStockOutDays !== null) {
        return a.estimatedStockOutDays - b.estimatedStockOutDays;
      }
      return a.currentStock - b.currentStock;
    });

    return {
      summary: {
        totalProducts: products.length,
        criticalStockCount,
        warningStockCount,
        adequateStockCount
      },
      forecasts
    };
  } catch (err) {
    console.error("Error in getVendorStockIntelligence:", err);
    throw err;
  }
}

/**
 * Get individual product stock forecast for vendor
 */
async function getSingleProductForecast(vendorId, productId) {
  const result = await getVendorStockIntelligence(vendorId);
  const found = result.forecasts.find((f) => f.productId.toString() === productId.toString());
  if (!found) {
    throw new Error("Product not found in vendor catalog");
  }
  return found;
}

module.exports = {
  getVendorStockIntelligence,
  getSingleProductForecast
};
