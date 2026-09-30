const CartModel = require("./CartModel");
const CouponModel = require("../coupons/CouponsModel");
const CustomerModel = require("../customer/CustomerModel");
const ProductModel = require("../product/ProductModel");

/**
 * Authoritative Smart Cart & Coupon Optimization Engine
 */
async function optimizeCart({ userId, currentCouponCode = null }) {
  try {
    // 1. Fetch active cart items for the user
    let cartItems = [];
    if (userId) {
      cartItems = await CartModel.find({ user_id: userId, status: true })
        .populate("product_id")
        .populate("user_id");
    }

    // Calculate actual subtotal
    const subtotal = cartItems.reduce((acc, item) => {
      const price = Number(item.price || item.product_id?.price || 0);
      const qty = Number(item.qty || 1);
      return acc + price * qty;
    }, 0);

    if (subtotal <= 0) {
      return {
        hasOptimization: false,
        currentSubtotal: 0,
        currentDiscount: 0,
        message: "Cart is empty"
      };
    }

    // 2. Fetch customer details for rank & reward eligibility
    let customer = null;
    if (userId) {
      customer = await CustomerModel.findOne({ userId });
    }

    // 3. Fetch all active and non-expired coupons
    const now = new Date();
    const vendorIdsInCart = new Set(
      cartItems
        .map((item) => (item.product_id?.vendorId ? item.product_id.vendorId.toString() : null))
        .filter(Boolean)
    );

    const allCoupons = await CouponModel.find({ status: true });

    const validCoupons = allCoupons.filter((c) => {
      // Check expiry
      if (c.expiryDate) {
        const exp = new Date(c.expiryDate);
        if (/^\d{4}-\d{2}-\d{2}$/.test(c.expiryDate)) {
          exp.setHours(23, 59, 59, 999);
        }
        if (exp < now) return false;
      }

      // Check customer specificity
      if (c.customerId && customer) {
        if (c.customerId.toString() !== customer._id.toString()) return false;
      } else if (c.customerId && !customer) {
        return false;
      }

      // Check vendor specificity (at least one product from that vendor must be in cart)
      if (c.vendorId) {
        if (!vendorIdsInCart.has(c.vendorId.toString())) return false;
      }

      return true;
    });

    // Helper to calculate numeric discount for a coupon given a cart amount
    const calculateDiscount = (couponObj, amount) => {
      if (!couponObj) return 0;
      const discVal = Number(couponObj.discount) || 0;
      if (couponObj.discountType === "2" || couponObj.discountType === "Percentage") {
        return Math.round((amount * discVal) / 100);
      }
      return discVal; // Flat amount
    };

    // 4. Determine currently applied or currently best qualifying coupon
    let currentCoupon = null;
    if (currentCouponCode) {
      currentCoupon = validCoupons.find(
        (c) => c.code.toUpperCase() === currentCouponCode.toUpperCase()
      );
    }

    // If no coupon provided, check if any coupon qualifies right now with current subtotal
    const qualifyingCoupons = validCoupons.filter(
      (c) => subtotal >= (Number(c.minAmoutSpend) || 0)
    );

    // Best currently qualifying coupon
    let bestCurrentCoupon = currentCoupon;
    if (!bestCurrentCoupon && qualifyingCoupons.length > 0) {
      bestCurrentCoupon = qualifyingCoupons.reduce((best, curr) => {
        const currDisc = calculateDiscount(curr, subtotal);
        const bestDisc = calculateDiscount(best, subtotal);
        return currDisc > bestDisc ? curr : best;
      }, qualifyingCoupons[0]);
    }

    const currentDiscount = bestCurrentCoupon ? calculateDiscount(bestCurrentCoupon, subtotal) : 0;

    // 5. Look for target "Next Tier" coupons that require a higher spend but unlock greater savings
    // Condition: minAmoutSpend > subtotal AND discount potential > currentDiscount
    const targetOpportunities = [];

    for (const c of validCoupons) {
      const minSpend = Number(c.minAmoutSpend) || 0;
      if (minSpend > subtotal) {
        const spendGap = minSpend - subtotal;
        const potentialDiscount = calculateDiscount(c, minSpend);
        const netSavings = potentialDiscount - currentDiscount;

        // Realistic condition: user shouldn't have to spend ₹10,000 more just to save ₹50
        // Net savings must be positive, and spendGap should not exceed 2.5x current subtotal (or max ₹3,000)
        if (netSavings > 0 && spendGap <= Math.max(3000, subtotal * 1.5)) {
          targetOpportunities.push({
            targetCoupon: c,
            spendGap,
            potentialDiscount,
            netSavings
          });
        }
      }
    }

    // Sort opportunities by highest net savings, then smallest spend gap
    targetOpportunities.sort((a, b) => {
      if (b.netSavings !== a.netSavings) return b.netSavings - a.netSavings;
      return a.spendGap - b.spendGap;
    });

    if (targetOpportunities.length > 0) {
      const bestOpportunity = targetOpportunities[0];
      const targetC = bestOpportunity.targetCoupon;
      const discText =
        targetC.discountType === "2" || targetC.discountType === "Percentage"
          ? `${targetC.discount}%`
          : `₹${targetC.discount}`;

      // 6. Find suggested products around or close to the spendGap (±40%)
      const minP = Math.max(10, Math.floor(bestOpportunity.spendGap * 0.4));
      const maxP = Math.ceil(bestOpportunity.spendGap * 1.6);

      const suggestedProducts = await ProductModel.find({
        status: true,
        stock: { $gt: 0 },
        isDraft: { $ne: true },
        price: { $gte: String(minP), $lte: String(maxP) }
      })
        .populate("category_id", "name")
        .limit(4);

      return {
        hasOptimization: true,
        currentSubtotal: subtotal,
        currentDiscount,
        currentCouponCode: bestCurrentCoupon?.code || "",
        optimizedDiscount: bestOpportunity.potentialDiscount,
        recommendedAdditionalSpend: bestOpportunity.spendGap,
        estimatedSavings: bestOpportunity.netSavings,
        targetCoupon: {
          code: targetC.code,
          minAmoutSpend: targetC.minAmoutSpend,
          discount: targetC.discount,
          discountType: targetC.discountType
        },
        explanation: `Add ₹${bestOpportunity.spendGap.toLocaleString()} more to cart and unlock ${discText} off with code '${targetC.code}'!`,
        suggestedProducts
      };
    }

    // No higher tier coupon, return current state
    return {
      hasOptimization: false,
      currentSubtotal: subtotal,
      currentDiscount,
      currentCouponCode: bestCurrentCoupon?.code || "",
      explanation: bestCurrentCoupon
        ? `You have unlocked ₹${currentDiscount} off with coupon '${bestCurrentCoupon.code}'.`
        : "Add more items to unlock exclusive tier discounts.",
      suggestedProducts: []
    };
  } catch (err) {
    console.error("Error in SmartCartService:", err);
    throw err;
  }
}

module.exports = {
  optimizeCart
};
