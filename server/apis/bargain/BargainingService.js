const { GoogleGenAI } = require("@google/genai");
const ProductModel = require("../product/ProductModel");
const VendorModel = require("../vendor/VendorModel");
const CustomerModel = require("../customer/CustomerModel");
const CouponModel = require("../coupons/CouponsModel");
const NegotiationModel = require("./NegotiationModel");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
    .populate("vendorId", "businessName");

  if (!product) {
    throw new Error("Product not found");
  }

  const customer = await CustomerModel.findOne({ userId });
  const vendor = product.vendorId ? await VendorModel.findById(product.vendorId._id || product.vendorId) : null;

  const pricing = calculateSupplyPriceFloor(product, quantity, customer);

  // Check if an active negotiation exists within expiry
  let session = await NegotiationModel.findOne({
    userId,
    productId,
    status: "in_progress",
    expiresAt: { $gt: new Date() }
  });

  if (!session) {
    const welcomeMsg = `Hello ${customer?.name || "Shopper"}! I am the automated Price & Supply negotiation assistant for ${vendor?.businessName || "Aventra Store"}. 

The list price is ₹${pricing.originalPrice} per unit. We currently have ${pricing.stock} units in inventory. 
For a quantity of ${quantity}, make me an offer you think is fair and let's see if we can strike a deal!`;

    session = new NegotiationModel({
      userId,
      customerId: customer?._id || null,
      vendorId: vendor?._id || null,
      productId,
      originalPrice: pricing.originalPrice,
      quantity,
      currentStock: pricing.stock,
      floorPrice: pricing.floorPrice,
      targetDiscountPercent: pricing.totalMaxDiscountPercent,
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

  return {
    sessionId: session._id,
    product: {
      _id: product._id,
      name: product.name,
      price: pricing.originalPrice,
      stock: pricing.stock,
      image: product.image
    },
    quantity,
    currentRound: session.currentRound,
    maxRounds: session.maxRounds,
    status: session.status,
    history: session.history,
    supplyLevel: pricing.supplyLevel
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

Context:
- Product: "${product?.name}"
- List Price: ₹${originalPrice}
- Current Inventory / Supply: ${stock} units
- Supply State: ${supplyCondition}
- Order Quantity: ${quantity} units
- Customer's Proposed Offer: ₹${offer}
- Negotiation Round: ${session.currentRound} of ${session.maxRounds}
- Minimum Allowable Price (Internal Floor): ₹${floorPrice}
- Mathematical Decision: ${decision}
${decision !== "ACCEPT" ? `- Your Counter-Offer Price: ₹${counterOffer}` : ""}

Rules for Response:
1. If decision is ACCEPT: Celebrate the deal warmly! Confirm that you accept their offer of ₹${offer} per unit. Mention how the order quantity or inventory helped make this deal work.
2. If decision is COUNTER_OFFER: Politely explain why ₹${offer} is below margin, referencing the current supply level (${stock} units) and costs. Propose your counter-offer of ₹${counterOffer}.
3. If decision is FINAL_OFFER: Inform them this is your absolute best final offer of ₹${counterOffer} given current supply limitations.
4. Keep the tone friendly, professional, and commercial.
5. Max length: 60 words strictly. Return plain text only.
`;

  let aiText = "";
  try {
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt
    });
    aiText = res.text ? res.text.trim() : "";
  } catch (aiErr) {
    console.error("Gemini bargaining error:", aiErr);
    if (decision === "ACCEPT") {
      aiText = `Deal struck! We accept your offer of ₹${offer} per unit. Enjoy your savings!`;
    } else {
      aiText = `Based on our current supply of ${stock} units, we cannot accept ₹${offer}. The best we can offer is ₹${counterOffer} per unit.`;
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

module.exports = {
  startBargainingSession,
  processOffer,
  acceptCounterOffer
};
