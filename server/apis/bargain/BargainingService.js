const path = require("path");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");
const ProductModel = require("../product/ProductModel");
const VendorModel = require("../vendor/VendorModel");
const CustomerModel = require("../customer/CustomerModel");
const CouponModel = require("../coupons/CouponsModel");
const NegotiationModel = require("./NegotiationModel");

function getApiKey() {
  let key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    const envPath = path.resolve(__dirname, "../../../.env");
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match && match[1]) {
          key = match[1].trim().replace(/^['"]|['"]$/g, '');
          process.env.GEMINI_API_KEY = key;
        }
      } catch (e) {
        console.error("Error reading backend .env file:", e.message);
      }
    }
  }
  return (key || "").trim();
}

function getAiClient() {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI in BargainingService:", err.message);
    return null;
  }
}

/**
 * Calculates floor price and allowed discount percentage based on Price & Supply dynamics
 */
function calculateSupplyPriceFloor(product, quantity = 1, customer = null) {
  const originalPrice = Number(product.price) || 0;
  const stock = Number(product.stock) || 0;

  // 1. Supply Elasticity
  let supplyConcession = 5; // default 5%
  if (stock >= 35) {
    supplyConcession = 16; // High inventory: clear stock incentive
  } else if (stock >= 15) {
    supplyConcession = 10; // Healthy inventory: moderate flexibility
  } else if (stock >= 5) {
    supplyConcession = 5;  // Limited stock: firm margins
  } else {
    supplyConcession = 2;  // Critical stock (<=4): minimal flexibility
  }

  // 2. Volume Elasticity (Quantity)
  let volumeConcession = 0;
  if (quantity >= 5) {
    volumeConcession = 4;
  } else if (quantity >= 3) {
    volumeConcession = 2;
  }

  // 3. Customer Loyalty / Rank concession
  let rankConcession = 0;
  if (customer && customer.rank && customer.rank >= 2) {
    rankConcession = 1.5;
  }

  const totalMaxDiscountPercent = Math.min(22, Math.max(2, supplyConcession + volumeConcession + rankConcession));
  const floorPrice = Math.max(1, Math.round(originalPrice * (1 - totalMaxDiscountPercent / 100)));

  return {
    originalPrice,
    stock,
    totalMaxDiscountPercent,
    floorPrice,
    supplyLevel: stock >= 35 ? "high" : stock >= 15 ? "moderate" : "constrained"
  };
}

/**
 * Start or resume a bargaining session for a customer and product
 */
async function startBargainingSession({ userId, productId, quantity = 1 }) {
  const product = await ProductModel.findById(productId)
    .populate("category_id", "name")
    .populate("vendorId", "businessName userId");

  if (!product) {
    throw new Error("Product not found");
  }

  const customer = await CustomerModel.findOne({ userId });
  const vendor = product.vendorId ? await VendorModel.findById(product.vendorId._id || product.vendorId) : null;
  const originalPrice = Number(product.price) || 0;
  const stock = Number(product.stock) || 0;

  // Check if an active negotiation already exists within expiry
  let session = await NegotiationModel.findOne({
    userId,
    productId,
    status: { $in: ["waiting_vendor_approval", "in_progress", "deal_accepted"] },
    expiresAt: { $gt: new Date() }
  });

  if (!session) {
    if (vendor) {
      // 1. If product belongs to a Vendor: Firstly ask Vendor for Margin and Max Discount
      session = new NegotiationModel({
        userId,
        customerId: customer?._id || null,
        vendorId: vendor._id,
        productId,
        originalPrice,
        quantity,
        currentStock: stock,
        floorPrice: originalPrice, // Will be established by vendor margin & discount
        targetDiscountPercent: 0,
        status: "waiting_vendor_approval",
        isVendorApproved: false,
        currentRound: 1,
        maxRounds: 3,
        history: []
      });

      await session.save();

      // Notify vendor so they can provide their margin and maximum allowable discount
      if (vendor.userId) {
        try {
          const NotificationModel = require("../notification/NotificationModel");
          await NotificationModel.create({
            senderId: userId,
            recipientId: vendor.userId._id || vendor.userId,
            productId: product._id,
            type: "bargain_request",
            status: "pending",
            message: `🔔 Customer ${customer?.name || "Shopper"} requested bargaining on "${product.name}" (Qty: ${quantity}, Price: ₹${originalPrice}). Please specify your margin and discount limit to start bargaining.`
          });
        } catch (notifErr) {
          console.error("Error creating vendor bargain notification:", notifErr);
        }
      }
    } else {
      // 2. Fallback for store-direct products without vendor
      const pricing = calculateSupplyPriceFloor(product, quantity, customer);
      const welcomeMsg = `Hello ${customer?.name || "Shopper"}! I am the automated Price & Supply negotiation assistant for Aventra Store. 

The list price is ₹${pricing.originalPrice} per unit. We currently have ${pricing.stock} units in inventory. 
For a quantity of ${quantity}, make me an offer you think is fair and let's see if we can strike a deal!`;

      session = new NegotiationModel({
        userId,
        customerId: customer?._id || null,
        vendorId: null,
        productId,
        originalPrice: pricing.originalPrice,
        quantity,
        currentStock: pricing.stock,
        floorPrice: pricing.floorPrice,
        targetDiscountPercent: pricing.totalMaxDiscountPercent,
        status: "in_progress",
        isVendorApproved: true,
        currentRound: 1,
        maxRounds: 3,
        history: [
          {
            sender: "ai_vendor",
            message: welcomeMsg,
            offeredPrice: pricing.originalPrice
          }
        ]
      });

      await session.save();
    }
  }

  return {
    sessionId: session._id,
    product: {
      _id: product._id,
      name: product.name,
      price: session.originalPrice,
      stock: session.currentStock,
      image: product.image
    },
    vendor: vendor ? {
      _id: vendor._id,
      businessName: vendor.businessName || "Vendor Store"
    } : null,
    quantity,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    status: session.status,
    isVendorApproved: session.isVendorApproved,
    vendorMarginPercent: session.vendorMarginPercent,
    vendorMaxDiscountPercent: session.vendorMaxDiscountPercent,
    history: session.history,
    floorPrice: session.floorPrice
  };
}

/**
 * Process a customer's price offer using Gemini and Price-Supply rules
 */
async function processOffer({ sessionId, userId, offeredPrice, customerMessage = "" }) {
  const session = await NegotiationModel.findOne({
    _id: sessionId,
    userId,
    status: "in_progress"
  }).populate("productId").populate("vendorId");

  if (!session) {
    throw new Error("Active negotiation session not found or already closed");
  }

  const product = session.productId;
  const vendor = session.vendorId;
  const originalPrice = session.originalPrice;
  const floorPrice = session.floorPrice;
  const stock = session.currentStock;
  const quantity = session.quantity;
  const offer = Math.round(Number(offeredPrice));

  if (!offer || offer <= 0) {
    throw new Error("Valid offer price is required");
  }

  // Record customer message
  session.customerLatestOffer = offer;
  session.history.push({
    sender: "customer",
    message: customerMessage || `I'd like to offer ₹${offer} per unit for ${quantity} unit(s).`,
    offeredPrice: offer
  });

  // Evaluate Decision
  let decision = "COUNTER_OFFER"; // 'ACCEPT' | 'COUNTER_OFFER' | 'REJECT'
  let counterOffer = 0;

  if (offer >= floorPrice) {
    // Deal accepted! Customer's offer meets or exceeds floor price
    decision = "ACCEPT";
    session.finalAgreedPrice = offer;
    session.status = "deal_accepted";
  } else if (session.currentRound >= session.maxRounds) {
    // Reached final round: Offer final compromise at floor price
    decision = "FINAL_OFFER";
    counterOffer = floorPrice;
    session.aiLatestCounterOffer = counterOffer;
  } else {
    // Round 1 or 2: Make reasonable counter-offer between current offer and list price
    decision = "COUNTER_OFFER";
    const gap = originalPrice - floorPrice;
    // Step concession
    const concessionStep = session.currentRound === 1 ? gap * 0.5 : gap * 0.8;
    counterOffer = Math.round(originalPrice - concessionStep);
    session.aiLatestCounterOffer = counterOffer;
  }

  // Construct Gemini Prompt with Ground Truth
  const supplyCondition = stock >= 35
    ? `High inventory surplus (${stock} units in stock) - Vendor is willing to offer healthy volume discounts to move stock.`
    : stock >= 15
    ? `Moderate inventory (${stock} units in stock) - Moderate discount flexibility.`
    : `Low inventory (${stock} units remaining) - Firm margins because product is in high demand with limited supply.`;

  const prompt = `
You are the AI Pricing & Supply Negotiation Agent representing "${vendor?.businessName || "Aventra Store"}".
You are bargaining with a customer in an e-commerce store.

Vendor Stated Constraints & Profit Margin:
- Vendor Profit Margin: ${session.vendorMarginPercent != null ? session.vendorMarginPercent + "%" : "Dynamic"}
- Vendor Authorized Maximum Discount: ${session.vendorMaxDiscountPercent != null ? session.vendorMaxDiscountPercent + "%" : "Dynamic"}
- Internal Minimum Acceptable Price (Floor): ₹${floorPrice}

Order & Context:
- Product: "${product?.name}"
- List Price: ₹${originalPrice}
- Current Inventory / Supply: ${stock} units
- Supply State: ${supplyCondition}
- Order Quantity: ${quantity} units
- Customer's Proposed Offer: ₹${offer}
- Negotiation Round: ${session.currentRound} of ${session.maxRounds}
- Mathematical Decision: ${decision}
${decision !== "ACCEPT" ? `- Your Counter-Offer Price: ₹${counterOffer}` : ""}

Rules for Response:
1. If decision is ACCEPT: Celebrate the deal warmly! Confirm that you accept their offer of ₹${offer} per unit within the vendor's authorized margin and discount parameters.
2. If decision is COUNTER_OFFER: Politely explain why ₹${offer} is below the vendor's acceptable margin, referencing the current supply level (${stock} units) and profit margin. Propose your counter-offer of ₹${counterOffer}.
3. If decision is FINAL_OFFER: Inform them this is your absolute best final offer of ₹${counterOffer} given the vendor's margin limitations.
4. Keep the tone friendly, professional, and commercial.
5. Max length: 60 words strictly. Return plain text only.
`;

  let aiText = "";
  const ai = getAiClient();
  if (ai) {
    try {
      const res = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      aiText = res.text ? res.text.trim() : "";
    } catch (aiErr) {
      console.error("Gemini bargaining error:", aiErr);
    }
  }

  if (!aiText) {
    if (decision === "ACCEPT") {
      aiText = `Deal struck! We accept your offer of ₹${offer} per unit. Enjoy your savings!`;
    } else {
      aiText = `Based on our current supply of ${stock} units and margin floor, we cannot accept ₹${offer}. The best we can offer is ₹${counterOffer} per unit.`;
    }
  }

  // If deal accepted, create a single-use exclusive coupon code for the customer
  let dealCouponCode = "";
  if (decision === "ACCEPT") {
    const unitSavings = originalPrice - offer;
    const totalSavings = unitSavings * quantity;
    dealCouponCode = `DEAL${Math.floor(1000 + Math.random() * 9000)}`;

    const coupon = new CouponModel({
      code: dealCouponCode,
      discount: String(totalSavings),
      discountType: "1", // Flat discount in ₹
      minAmoutSpend: Math.max(1, offer * quantity),
      expiryDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split("T")[0],
      customerId: session.customerId,
      vendorId: session.vendorId,
      status: true
    });
    await coupon.save();

    session.dealCouponCode = dealCouponCode;
    session.dealCouponId = coupon._id;
  }

  session.history.push({
    sender: "ai_vendor",
    message: aiText,
    offeredPrice: decision === "ACCEPT" ? offer : counterOffer
  });

  session.currentRound += 1;
  await session.save();

  return {
    sessionId: session._id,
    decision,
    aiMessage: aiText,
    counterOffer: decision === "ACCEPT" ? offer : counterOffer,
    dealCouponCode,
    status: session.status,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    history: session.history
  };
}

/**
 * Customer accepts the AI's counter-offer
 */
async function acceptCounterOffer({ sessionId, userId }) {
  const session = await NegotiationModel.findOne({
    _id: sessionId,
    userId,
    status: "in_progress"
  });

  if (!session) {
    throw new Error("Active negotiation session not found");
  }

  const agreedPrice = session.aiLatestCounterOffer || session.floorPrice;
  const originalPrice = session.originalPrice;
  const quantity = session.quantity;

  const unitSavings = originalPrice - agreedPrice;
  const totalSavings = unitSavings * quantity;
  const dealCouponCode = `DEAL${Math.floor(1000 + Math.random() * 9000)}`;

  const coupon = new CouponModel({
    code: dealCouponCode,
    discount: String(totalSavings),
    discountType: "1",
    minAmoutSpend: Math.max(1, agreedPrice * quantity),
    expiryDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().split("T")[0],
    customerId: session.customerId,
    vendorId: session.vendorId,
    status: true
  });
  await coupon.save();

  session.finalAgreedPrice = agreedPrice;
  session.status = "deal_accepted";
  session.dealCouponCode = dealCouponCode;
  session.dealCouponId = coupon._id;

  session.history.push({
    sender: "customer",
    message: `I accept your counter-offer of ₹${agreedPrice}! Let's lock it in.`,
    offeredPrice: agreedPrice
  });

  session.history.push({
    sender: "ai_vendor",
    message: `Fantastic! Your price of ₹${agreedPrice} is locked with code "${dealCouponCode}". You can apply it directly at checkout!`,
    offeredPrice: agreedPrice
  });

  await session.save();

  return {
    sessionId: session._id,
    status: session.status,
    finalAgreedPrice: agreedPrice,
    dealCouponCode,
    history: session.history
  };
}

/**
 * Vendor authorizes customer bargaining demand by providing their margin (%) and max discount (%)
 */
async function vendorAuthorizeBargainSession({ negotiationId, vendorId, marginPercent, maxDiscountPercent, vendorNote = "" }) {
  const session = await NegotiationModel.findById(negotiationId)
    .populate("productId")
    .populate("customerId")
    .populate("userId");

  if (!session) {
    throw new Error("Bargaining session not found");
  }

  if (session.vendorId && session.vendorId.toString() !== vendorId.toString()) {
    throw new Error("Unauthorized: You do not own this bargaining session");
  }

  const margin = Number(marginPercent);
  const maxDiscount = Number(maxDiscountPercent);

  if (isNaN(margin) || margin < 0) {
    throw new Error("Please specify a valid profit margin percentage (0% or more)");
  }
  if (isNaN(maxDiscount) || maxDiscount < 0 || maxDiscount > 90) {
    throw new Error("Please specify a valid maximum discount percentage between 0% and 90%");
  }

  const originalPrice = Number(session.originalPrice);
  const floorPrice = Math.max(1, Math.round(originalPrice * (1 - maxDiscount / 100)));

  session.vendorMarginPercent = margin;
  session.vendorMaxDiscountPercent = maxDiscount;
  session.floorPrice = floorPrice;
  session.targetDiscountPercent = maxDiscount;
  session.isVendorApproved = true;
  session.status = "in_progress";
  session.vendorNote = vendorNote;

  const vendor = await VendorModel.findById(vendorId);
  const customerName = session.userId?.name || session.customerId?.name || "Shopper";

  const welcomeMsg = `Hello ${customerName}! The vendor "${vendor?.businessName || "Store"}" has authorized your bargaining demand with up to ${maxDiscount}% allowable discount (Margin: ${margin}%). 

The list price is ₹${originalPrice} per unit. We currently have ${session.currentStock} units in stock. For a quantity of ${session.quantity}, make me an offer you think is fair and let's see if we can strike a deal!`;

  session.history = [
    {
      sender: "ai_vendor",
      message: welcomeMsg,
      offeredPrice: originalPrice
    }
  ];

  await session.save();
  return session;
}

/**
 * Vendor declines customer bargaining demand
 */
async function vendorDeclineBargainSession({ negotiationId, vendorId, reason = "" }) {
  const session = await NegotiationModel.findById(negotiationId);
  if (!session) {
    throw new Error("Bargaining session not found");
  }

  if (session.vendorId && session.vendorId.toString() !== vendorId.toString()) {
    throw new Error("Unauthorized");
  }

  session.status = "vendor_declined";
  session.vendorNote = reason || "The vendor is unable to offer additional discounts on this product at this time due to tight margins.";
  await session.save();
  return session;
}

/**
 * Get active session status for customer modal polling
 */
async function getSessionStatus({ sessionId, userId }) {
  const query = { _id: sessionId };
  if (userId) query.userId = userId;

  const session = await NegotiationModel.findOne(query)
    .populate("productId", "name price image stock")
    .populate("vendorId", "businessName");

  if (!session) {
    throw new Error("Bargaining session not found");
  }

  return {
    sessionId: session._id,
    status: session.status,
    isVendorApproved: session.isVendorApproved,
    vendorMarginPercent: session.vendorMarginPercent,
    vendorMaxDiscountPercent: session.vendorMaxDiscountPercent,
    vendorNote: session.vendorNote,
    originalPrice: session.originalPrice,
    floorPrice: session.floorPrice,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    finalAgreedPrice: session.finalAgreedPrice,
    dealCouponCode: session.dealCouponCode,
    history: session.history,
    product: session.productId ? {
      _id: session.productId._id,
      name: session.productId.name,
      price: session.productId.price,
      stock: session.productId.stock,
      image: session.productId.image
    } : null,
    vendor: session.vendorId ? {
      _id: session.vendorId._id,
      businessName: session.vendorId.businessName
    } : null
  };
}

module.exports = {
  startBargainingSession,
  processOffer,
  acceptCounterOffer,
  vendorAuthorizeBargainSession,
  vendorDeclineBargainSession,
  getSessionStatus
};
