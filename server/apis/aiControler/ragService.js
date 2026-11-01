const path = require("path");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");
const mongoose = require("mongoose");
const ProductModel = require("../product/ProductModel");
const CategoryModel = require("../category/categoryModel");
const BrandModel = require("../brand/BrandModel");
const UserProfileModel = require("../behavior/UserProfileModel");
const CartModel = require("../cart/CartModel");
const RecommendationService = require("../recommendation/RecommendationService");
const CouponsModel = require("../coupons/CouponsModel");
const OrderModel = require("../order/OrderModel");

const isDbReady = () => mongoose.connection && mongoose.connection.readyState === 1;

// -------------------------------------------------------------
// 1. Google GenAI Client Helper
// -------------------------------------------------------------
function getApiKey() {
  let key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    const envPath = path.resolve(__dirname, "../../../.env");
    if (fs.existsSync(envPath)) {
      try {
        const envContent = fs.readFileSync(envPath, "utf-8");
        const match = envContent.match(/^\s*GEMINI_API_KEY\s*=\s*(.+)$/m);
        if (match && match[1]) {
          key = match[1].trim().replace(/^['"]|['"]$/g, "");
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
    console.error("Failed to initialize GoogleGenAI:", err.message);
    return null;
  }
}

// -------------------------------------------------------------
// 2. Curated Knowledge Base (Grounding Documents for RAG)
// -------------------------------------------------------------
const KNOWLEDGE_BASE = [
  {
    id: "cart_and_checkout",
    title: "Shopping Cart, Add to Cart & Free Shipping Guide",
    category: "cart_checkout",
    keywords: [
      "cart", "add to cart", "open cart", "open add to cart", "view cart",
      "shopping cart", "my cart", "basket", "bag", "checkout", "buy now",
      "place order", "how to buy", "empty cart", "modify cart", "free shipping threshold"
    ],
    summary: "Instructions on cart management, free shipping unlocked at ₹499, and checkout.",
    content: `
Customers can view and manage all added items anytime by visiting the Shopping Cart at /cart.
Cart & Savings Features:
- Real-time review of items, quantities, and subtotal.
- Free Shipping Threshold: Automatic FREE delivery on all orders totaling ₹499 or more (flat ₹40 shipping fee below ₹499).
- Instant coupon application for extra discounts before payment.
- Seamless one-click progression to checkout at /checkout.
How to Add to Cart:
Click "Add to Cart" or "🛒 Add" on any product card or detail page. The item instantly updates your cart counter in the top header.
    `.trim(),
    actions: [
      { label: "🛒 Open Cart", action: "NAVIGATE", target: "/cart", primary: true },
      { label: "💳 Proceed to Checkout", action: "NAVIGATE", target: "/checkout", primary: false }
    ]
  },
  {
    id: "coupons_deals_savings",
    title: "Active Store Coupons, Deals & Promotional Offers",
    category: "coupons",
    keywords: [
      "coupon", "coupons", "promo code", "discount code", "offers", "deals",
      "discounts", "how to save", "best deal", "sale", "bargain", "voucher"
    ],
    summary: "Active platform promo codes (WELCOME10, FREESHIP, SAVE50), seasonal deals, and discount application.",
    content: `
Aventra Smart Shopping Savings & Coupons:
- WELCOME10: 10% instant discount on orders of ₹299 or more for customers.
- FREESHIP: Free delivery automatically applied on all carts valued at ₹499 and above.
- SAVE50: Flat ₹50 off on grocery and electronics baskets over ₹799.
- Smart Bargaining: Available on eligible vendor products directly on the product detail page!
How to Redeem:
Enter the promo code in the coupon field in your Cart (/cart) or Checkout page (/checkout) and click Apply.
    `.trim(),
    actions: [
      { label: "🏷️ Open Cart & Apply Coupon", action: "NAVIGATE", target: "/cart", primary: true },
      { label: "🛍️ Explore Deals", action: "NAVIGATE", target: "/CardProduct", primary: false }
    ]
  },
  {
    id: "orders_and_tracking",
    title: "My Orders, Live Tracking & Order History",
    category: "orders",
    keywords: [
      "order", "orders", "my orders", "track order", "tracking", "order status",
      "where is my order", "past orders", "order history", "cancel order", "invoice"
    ],
    summary: "Live order tracking, delivery timelines (2-4 business days), order status stages, and cancellation.",
    content: `
Customers can track active shipments and review order history at /myorders.
Order Status Stages:
1. Pending: Order placed, awaiting payment/store verification.
2. Confirmed: Payment verified, vendor preparing package.
3. Shipped: Package dispatched with active courier tracking link.
4. Delivered: Package safely handed over at customer doorstep.
5. Cancelled: Order cancelled with refund immediately initiated.
Cancellation Policy: Orders can be cancelled easily from My Orders before dispatch.
    `.trim(),
    actions: [
      { label: "📦 View My Orders", action: "NAVIGATE", target: "/myorders", primary: true }
    ]
  },
  {
    id: "shipping_and_delivery",
    title: "Shipping Timelines, Delivery Charges & Express Options",
    category: "shipping",
    keywords: [
      "shipping", "delivery", "delivery time", "shipping fee", "delivery charges",
      "free delivery", "free shipping", "courier", "how long", "speed", "dispatch"
    ],
    summary: "Standard delivery (2-4 business days), express metro delivery, and ₹499 free shipping threshold.",
    content: `
Aventra delivery guidelines:
- Standard Delivery: 2 to 4 business days across all serviceable pin codes.
- Express Metro Delivery: Next-day delivery available in major metro hubs.
- Free Shipping: Zero delivery charges on orders totaling ₹499 or more.
- Flat Shipping: Just ₹40 on orders below ₹499.
- Safe & Contactless: Sealed tamper-proof packaging on all orders.
    `.trim(),
    actions: [
      { label: "🛍️ Browse Products", action: "NAVIGATE", target: "/CardProduct", primary: true }
    ]
  },
  {
    id: "returns_refunds_cancellation",
    title: "7-Day Return, Replacement & Refund Policy",
    category: "returns",
    keywords: [
      "return", "returns", "refund", "refunds", "replacement", "exchange",
      "money back", "damaged item", "wrong item", "return policy", "warranty"
    ],
    summary: "7-day return window, instant replacement for perishables, and 3-5 days refund turnaround.",
    content: `
Aventra customer protection policy:
- 7-Day Hassle-Free Returns: Eligible non-perishable products can be returned or exchanged within 7 days.
- Fresh & Perishable Items: Damaged or expired dairy, bakery, or fruits qualify for instant replacement or refund with photo proof.
- Refund Timeline: Approved refunds credited within 3-5 business days to original payment method or instant Aventra Wallet credit.
- Doorstep Pickup: Delivery agent collects return items directly from your address.
    `.trim(),
    actions: [
      { label: "📞 Contact Support", action: "NAVIGATE", target: "/contact", primary: true }
    ]
  },
  {
    id: "payment_methods_security",
    title: "Payment Methods, UPI & 256-Bit SSL Security",
    category: "payments",
    keywords: [
      "payment", "pay", "payment methods", "upi", "gpay", "google pay", "phonepe",
      "paytm", "credit card", "debit card", "cod", "cash on delivery", "net banking",
      "security", "safe", "secure"
    ],
    summary: "UPI, Cards, Net Banking, and COD with 256-bit SSL encryption.",
    content: `
Supported Payment Options:
- UPI: Instant payment via Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
- Credit / Debit Cards: Visa, MasterCard, RuPay with secure OTP confirmation.
- Net Banking: Major national and private banks supported.
- Cash on Delivery (COD): Pay at doorstep via cash or digital UPI upon delivery.
- Security: Complete 256-bit SSL end-to-end transaction encryption.
    `.trim(),
    actions: [
      { label: "💳 Go to Checkout", action: "NAVIGATE", target: "/checkout", primary: true }
    ]
  },
  {
    id: "customer_support_queries",
    title: "Customer Support, Helpdesk & Support Tickets",
    category: "support",
    keywords: [
      "contact", "support", "help", "customer service", "customer care", "helpdesk",
      "ticket", "complaint", "queries", "email support", "phone support"
    ],
    summary: "Help portal at /queries, contact form at /contact, and support email.",
    content: `
Aventra Customer Care:
- Support Portal: Submit and track support tickets directly at /queries.
- General Inquiries: Contact form available at /contact.
- Email: support@aventra.com
- Working Hours: Monday to Saturday, 9:00 AM – 8:00 PM IST (Average 2-4 hours resolution).
    `.trim(),
    actions: [
      { label: "💬 Submit Query", action: "NAVIGATE", target: "/queries", primary: true },
      { label: "📍 Contact Us", action: "NAVIGATE", target: "/contact", primary: false }
    ]
  },
  {
    id: "vendor_partner_program",
    title: "Become a Seller / Vendor Partner",
    category: "vendor",
    keywords: [
      "become seller", "become vendor", "sell on aventra", "vendor registration",
      "seller account", "register vendor", "partner", "merchant"
    ],
    summary: "Merchant registration at /vendor/register and dedicated vendor dashboard.",
    content: `
Sell on Aventra:
- Register online at /vendor/register with business and GST details.
- Once approved, access the Vendor Dashboard at /vendor to list products, track warehouse stock, set coupons, and receive automated payouts.
    `.trim(),
    actions: [
      { label: "🏪 Register as Vendor", action: "NAVIGATE", target: "/vendor/register", primary: true }
    ]
  },
  {
    id: "about_stellar_shopping_assistant",
    title: "Stellar Personal AI Shopping Assistant Capabilities",
    category: "about",
    keywords: [
      "stellar", "shopping assistant", "assistant", "what can you do", "features",
      "help me shop", "recommendations", "budget"
    ],
    summary: "Personal shopping assistant capabilities: budget filtering, product comparison, cart advice, and deals.",
    content: `
I am Stellar, your personal AI Shopping Assistant on Aventra:
1. Product Discovery: Find products matching your exact budget ("under ₹500"), category, or specs.
2. Product Comparisons: Compare two or more items side-by-side with clear shopping verdicts.
3. Cart & Free Shipping Advisor: Tell you how much more you need to reach ₹499 for free shipping.
4. Smart Coupon Advisor: Suggest the best active coupon code to save the most on your cart.
5. Order Tracking: Give live updates on your recent orders and delivery status.
6. Zero Hallucination: Grounded strictly in real-time verified store inventory.
    `.trim(),
    actions: [
      { label: "🛍️ Explore Catalog", action: "NAVIGATE", target: "/CardProduct", primary: true },
      { label: "📂 Browse Categories", action: "NAVIGATE", target: "/CardCategory", primary: false }
    ]
  }
];

// -------------------------------------------------------------
// 3. Conversational Context & Intent Analysis
// -------------------------------------------------------------
function analyzeQueryIntent(query, conversationHistory = []) {
  const lower = query.toLowerCase().trim();

  // 3.1 Security check
  const blockedKeywords = [
    "hack", "hacking", "ddos", "sql injection", "xss", "csrf", "exploit",
    "admin password", "admin panel", "free products", "free order", "bypass payment",
    "steal account", "refund abuse", "coupon exploit", "crack", "phishing",
    "database access", "steal data", "customer data", "credential stuffing", "bot attack",
    "ignore previous instructions", "jailbreak"
  ];
  if (blockedKeywords.some(b => lower.includes(b))) {
    return { intent: "SECURITY_BLOCK", confidence: 1.0 };
  }

  // 3.2 Direct Task Execution: Add To Cart or Order Something
  const isAddToCartTask =
    lower.includes("add to cart") ||
    lower.includes("add this to cart") ||
    lower.includes("add it to cart") ||
    lower.includes("put in cart") ||
    lower.includes("add into cart") ||
    /^(?:please\s+)?add\s+(?:the\s+)?(.+?)\s+(?:to|into|in)\s+(?:my\s+)?cart/i.test(lower);

  if (isAddToCartTask) {
    return { intent: "EXECUTE_ADD_TO_CART", targetDoc: "cart_and_checkout", confidence: 0.98 };
  }

  const isOrderTask =
    lower.includes("buy now") ||
    lower.includes("order this") ||
    lower.includes("buy this") ||
    lower.includes("place order") ||
    /^(?:please\s+)?(?:order|buy|purchase)\s+(?:the\s+)?(.+)/i.test(lower);

  if (isOrderTask && !lower.includes("track") && !lower.includes("where is my order") && !lower.includes("order status")) {
    return { intent: "EXECUTE_ORDER", targetDoc: "cart_and_checkout", confidence: 0.98 };
  }

  // 3.3 Action / Navigation
  const actionPatterns = [
    { pattern: /(?:open|go\s+to|show|view|check)\s*(?:add\s+to\s+)?(?:cart|shopping\s*cart|basket|bag)/i, targetDoc: "cart_and_checkout", intent: "ACTION_NAVIGATION" },
    { pattern: /(?:open|go\s+to|proceed\s+to)\s*checkout/i, targetDoc: "cart_and_checkout", intent: "ACTION_NAVIGATION" },
    { pattern: /(?:open|view|show|track|where\s+is\s+my|check\s+status\s+of)\s*(?:my\s*)?orders?/i, targetDoc: "orders_and_tracking", intent: "ORDER_TRACKING" },
    { pattern: /(?:open|view|show)\s*(?:my\s*)?wishlist/i, targetDoc: "wishlist_and_favorites", intent: "ACTION_NAVIGATION" },
    { pattern: /(?:open|view|show|go\s+to)\s*(?:my\s*)?profile/i, targetDoc: "user_account_profile", intent: "ACTION_NAVIGATION" },
    { pattern: /(?:contact|call|email|reach)\s*(?:support|help|customer\s*care)/i, targetDoc: "customer_support_queries", intent: "ACTION_NAVIGATION" },
    { pattern: /(?:become|register\s+as|sign\s+up\s+as)\s*(?:a\s*)?(?:vendor|seller)/i, targetDoc: "vendor_partner_program", intent: "ACTION_NAVIGATION" }
  ];

  for (const act of actionPatterns) {
    if (act.pattern.test(lower)) {
      return {
        intent: act.intent,
        targetDoc: act.targetDoc,
        confidence: 0.95
      };
    }
  }

  // 3.3 Cart Insights & Free Shipping queries
  if (
    lower.includes("cart total") ||
    lower.includes("in my cart") ||
    lower.includes("items in cart") ||
    lower.includes("free shipping") ||
    lower.includes("how much more for free shipping") ||
    lower.includes("reach free shipping")
  ) {
    return { intent: "CART_INSIGHTS", targetDoc: "cart_and_checkout", confidence: 0.92 };
  }

  // 3.4 Deals & Coupons queries
  if (
    lower.includes("coupon") ||
    lower.includes("promo") ||
    lower.includes("discount code") ||
    lower.includes("offers") ||
    lower.includes("deals") ||
    lower.includes("how to save") ||
    lower.includes("any discount")
  ) {
    return { intent: "DEALS_COUPONS", targetDoc: "coupons_deals_savings", confidence: 0.92 };
  }

  // 3.5 Store Policies / FAQs
  const policyKeywords = [
    "return policy", "returns", "refund", "refund policy", "replacement",
    "shipping fee", "delivery time", "how long does delivery take", "delivery charges",
    "payment method", "payment options", "cash on delivery", "cod", "accepted payment",
    "customer support", "contact support", "helpline", "how to buy", "how to checkout"
  ];

  for (const kw of policyKeywords) {
    if (lower.includes(kw)) {
      return { intent: "STORE_POLICY_FAQ", keyword: kw, confidence: 0.9 };
    }
  }

  // 3.6 Product Comparison & Verdicts
  if (
    lower.includes("which is better") ||
    lower.includes("which one is better") ||
    lower.includes("compare") ||
    lower.includes("difference between") ||
    lower.includes("which should i buy") ||
    lower.includes("vs")
  ) {
    return { intent: "PRODUCT_COMPARISON", confidence: 0.88 };
  }

  // 3.7 Why recommend / Explainability
  if (
    lower.includes("why are you recommending") ||
    lower.includes("why recommend") ||
    lower.includes("why this product") ||
    lower.includes("why is this recommended") ||
    lower.includes("is this good")
  ) {
    return { intent: "RECOMMENDATION_EXPLANATION", confidence: 0.85 };
  }

  // 3.8 Follow-up relative query (e.g. "show cheaper ones", "cheapest", "best rated")
  if (
    lower.includes("cheaper") ||
    lower.includes("cheapest") ||
    lower.includes("higher rating") ||
    lower.includes("best rated") ||
    lower.includes("more expensive") ||
    lower.includes("another one") ||
    lower.includes("more options")
  ) {
    return { intent: "PRODUCT_SEARCH_FOLLOWUP", confidence: 0.85 };
  }

  // 3.9 Conversational Greetings
  if (
    /^(hi|hello|hey|greetings|namaste|good\s+morning|good\s+afternoon|good\s+evening|good\s+night|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.]*$/i.test(lower)
  ) {
    return { intent: "CONVERSATION", confidence: 0.9 };
  }

  return { intent: "PRODUCT_SEARCH", confidence: 0.75 };
}

// -------------------------------------------------------------
// 4. Multi-Turn Context Resolver
// -------------------------------------------------------------
function resolveMultiTurnContext(query, history = []) {
  const lower = query.toLowerCase().trim();
  let contextualCategory = null;
  let contextualBudget = null;

  if (Array.isArray(history) && history.length > 0) {
    // Traverse backwards through conversation history to discover active product context
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      const text = (msg.text || "").toLowerCase();

      // Check category terms
      const candidateCategories = [
        "bulb", "led", "electronic", "electronics", "rice", "atta", "dal", "oil",
        "snack", "snacks", "biscuit", "biscuits", "dairy", "milk", "tea", "coffee",
        "juice", "drink", "fruit", "vegetable", "chicken", "meat", "fish", "cleaning",
        "soap", "shampoo", "personal care", "office", "home"
      ];

      for (const cat of candidateCategories) {
        if (text.includes(cat) && !contextualCategory) {
          contextualCategory = cat;
          break;
        }
      }

      // Check price mentioned previously
      const priceMatch = text.match(/(?:under|below|less than|rs\.?|₹)\s*(\d+)/i);
      if (priceMatch && priceMatch[1] && !contextualBudget) {
        contextualBudget = Number(priceMatch[1]);
      }

      if (contextualCategory) break;
    }
  }

  return { contextualCategory, contextualBudget };
}

// -------------------------------------------------------------
// 5. Knowledge Base Retrieval (Grounding Documents)
// -------------------------------------------------------------
function retrieveStoreKnowledge(query, intentInfo, maxDocs = 2) {
  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery.replace(/[^\w\s]/gi, " ").split(/\s+/).filter(t => t.length > 2);

  const scoredDocs = KNOWLEDGE_BASE.map(doc => {
    let score = 0;

    if (intentInfo.targetDoc === doc.id) {
      score += 100;
    }
    if (doc.category && lowerQuery.includes(doc.category)) {
      score += 25;
    }
    for (const kw of doc.keywords) {
      if (lowerQuery.includes(kw)) {
        score += 30;
      }
    }
    for (const token of queryTokens) {
      if (doc.title.toLowerCase().includes(token)) score += 5;
      if (doc.summary.toLowerCase().includes(token)) score += 3;
    }

    return { doc, score };
  });

  scoredDocs.sort((a, b) => b.score - a.score);
  return scoredDocs.filter(d => d.score > 5).slice(0, maxDocs).map(d => d.doc);
}

// -------------------------------------------------------------
// 6. Intelligent Product Catalog Retrieval
// -------------------------------------------------------------
async function retrieveVerifiedProducts(query, {
  maxPrice = null,
  minPrice = null,
  limit = 6,
  currentProductId = null,
  contextualCategory = null,
  isCheaperRequest = false,
  isBestRatedRequest = false
} = {}) {
  const lowerQuery = query.toLowerCase().trim();

  // If user is currently looking at a product detail page
  if (currentProductId && isDbReady()) {
    try {
      const curr = await ProductModel.findById(currentProductId)
        .populate("category_id", "name")
        .populate("brand_id", "name");
      if (curr) {
        // Find complementary products or alternatives
        const comp = await RecommendationService.getComplementaryRecommendations(currentProductId, 3);
        const list = [curr];
        comp.forEach(c => {
          if (c.product && c.product._id.toString() !== currentProductId.toString()) {
            list.push(c.product);
          }
        });
        return list.slice(0, limit);
      }
    } catch (e) {
      console.warn("Product detail lookup warning:", e.message);
    }
  }

  // Parse price constraints
  if (maxPrice === null) {
    const priceUnderMatch = lowerQuery.match(/(?:under|below|less than|within|cheaper than)\s*(?:rs\.?|₹)?\s*(\d+)/i);
    if (priceUnderMatch && priceUnderMatch[1]) {
      maxPrice = Number(priceUnderMatch[1]);
    }
    const priceBetweenMatch = lowerQuery.match(/(?:between)\s*(?:rs\.?|₹)?\s*(\d+)\s*(?:and|to|-)\s*(?:rs\.?|₹)?\s*(\d+)/i);
    if (priceBetweenMatch && priceBetweenMatch[1] && priceBetweenMatch[2]) {
      minPrice = Number(priceBetweenMatch[1]);
      maxPrice = Number(priceBetweenMatch[2]);
    }
  }

  let effectiveSearchText = lowerQuery;
  if (contextualCategory && !lowerQuery.includes(contextualCategory)) {
    effectiveSearchText = `${lowerQuery} ${contextualCategory}`;
  }

  // Match categories & brands
  let matchedCats = [];
  let matchedBrands = [];
  if (isDbReady()) {
    try {
      const allCategories = await CategoryModel.find({ status: true }).select("_id name");
      matchedCats = allCategories.filter(c => effectiveSearchText.includes(c.name.toLowerCase()));

      const allBrands = await BrandModel.find({ status: true }).select("_id name");
      matchedBrands = allBrands.filter(b => effectiveSearchText.includes(b.name.toLowerCase()));
    } catch (e) {}
  }

  const stopWords = new Set([
    "provide", "me", "list", "of", "all", "the", "category", "categories", "and", "or",
    "what", "is", "are", "show", "please", "products", "items", "available", "in", "for",
    "can", "you", "give", "display", "get", "find", "looking", "want", "search", "a", "an",
    "with", "under", "below", "above", "price", "store", "buy", "best", "some", "any", "which",
    "open", "add", "to", "cart", "orders", "my", "how", "much", "cheaper", "ones", "better", "recommend"
  ]);

  const rawTokens = effectiveSearchText.replace(/[^\w\s]/gi, " ").split(/\s+/);
  const tokens = rawTokens.filter(t => t.length > 2 && !stopWords.has(t));

  const filterConditions = {
    status: true,
    stock: { $gt: 0 },
    isDraft: { $ne: true }
  };

  if (matchedCats.length > 0) {
    filterConditions.category_id = { $in: matchedCats.map(c => c._id) };
  }
  if (matchedBrands.length > 0) {
    filterConditions.brand_id = { $in: matchedBrands.map(b => b._id) };
  }

  let candidates = [];
  if (isDbReady()) {
    try {
      candidates = await ProductModel.find(filterConditions)
        .populate("category_id", "name")
        .populate("brand_id", "name")
        .limit(30);

      if (candidates.length === 0 && tokens.length > 0 && matchedCats.length === 0) {
        const orTokens = tokens.map(t => ({
          $or: [
            { name: { $regex: t, $options: "i" } },
            { seoKeywords: { $regex: t, $options: "i" } },
            { description: { $regex: t, $options: "i" } }
          ]
        }));

        candidates = await ProductModel.find({
          status: true,
          stock: { $gt: 0 },
          isDraft: { $ne: true },
          $or: orTokens
        })
          .populate("category_id", "name")
          .populate("brand_id", "name")
          .limit(20);
      }
    } catch (err) {
      console.warn("Product retrieval warning:", err.message);
    }
  }

  // Price filtering
  if (maxPrice !== null) {
    candidates = candidates.filter(p => {
      const pr = Number(p.price) || 0;
      return pr <= maxPrice && (minPrice === null || pr >= minPrice);
    });
  }

  // Sort by price or rating if requested
  if (isCheaperRequest) {
    candidates.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
  } else if (isBestRatedRequest) {
    candidates.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0));
  }

  return candidates.slice(0, limit);
}

// -------------------------------------------------------------
// 7. Context Augmentation & Shopping Prompt Construction (The "A" in RAG)
// -------------------------------------------------------------
function buildShoppingPrompt({
  query,
  customerName,
  intentInfo,
  retrievedDocs,
  retrievedProducts,
  userProfile,
  cartDetails,
  activeCoupons,
  latestOrder,
  currentProductObj
}) {
  const userContextStr = `
Customer Profile:
- Customer Name: ${customerName || "Valued Shopper"}
- Active Cart Summary: ${cartDetails.count} items (Subtotal: ₹${cartDetails.total})
- Free Shipping Status: ${cartDetails.total >= 499 ? "QUALIFIED for FREE Shipping! 🎉" : `Needs ₹${cartDetails.freeShippingRemaining} more to reach ₹499 free shipping threshold.`}
${cartDetails.items.length > 0 ? `- Cart Items: ${cartDetails.items.map(i => `${i.name} (x${i.qty})`).join(", ")}` : ""}
- Inferred Preferences: ${(userProfile?.preferredCategories || []).map(c => c.categoryName || "").filter(Boolean).join(", ") || "General"}
- Inferred Budget: ₹${userProfile?.averagePriceRange?.min || 0} - ₹${userProfile?.averagePriceRange?.max || "Flexible"}
  `.trim();

  const couponContextStr = activeCoupons.length > 0
    ? activeCoupons.map(c => `• Code "${c.code}": ${c.discount} (${c.type}) on minimum spend ₹${c.minSpend}`).join("\n")
    : "No active coupons currently.";

  const orderContextStr = latestOrder
    ? `Latest Order: #${latestOrder.autoId || latestOrder._id.toString().slice(-6)} | Status: ${latestOrder.orderStatus} | Total: ₹${latestOrder.grandTotal} | Date: ${new Date(latestOrder.createdAt).toLocaleDateString()}`
    : "No recent order history found.";

  const currentProductContextStr = currentProductObj
    ? `Customer is currently viewing product page: "${currentProductObj.name}" | Price: ₹${currentProductObj.price} | Stock: ${currentProductObj.stock} units | Category: ${currentProductObj.category_id?.name || "General"} | Rating: ${currentProductObj.rating || "New"}★`
    : "";

  const knowledgeContextStr = retrievedDocs.length > 0
    ? retrievedDocs.map((doc, idx) => `
[Knowledge Document ${idx + 1}: ${doc.title}]
Summary: ${doc.summary}
Content:
${doc.content}
`).join("\n")
    : "No matching store policy or guide documents retrieved.";

  const productsContextStr = retrievedProducts.length > 0
    ? retrievedProducts.map((p, idx) => `
[Product ${idx + 1}: "${p.name}"]
- ID: ${p._id}
- Price: ₹${p.price}
- Stock: ${p.stock} units available
- Rating: ${p.rating ? `${p.rating} / 5 stars` : "New / Not yet rated"}
- Category: ${p.category_id?.name || "General"}
- Brand: ${p.brand_id?.name || "Standard"}
- Description: ${(p.description || "").slice(0, 200)}
`).join("\n")
    : "No verified matching in-stock products found.";

  return `
You are Stellar, the personal AI Shopping Assistant for Aventra E-Commerce.
Act as an intelligent, helpful, proactive personal shopping concierge.

=== REAL-TIME STORE GROUND TRUTH (RAG DATA) ===
${knowledgeContextStr}

=== VERIFIED PRODUCT INVENTORY (IN STOCK ONLY) ===
${productsContextStr}

=== CUSTOMER REAL-TIME SHOPPING CONTEXT ===
${userContextStr}

=== ACTIVE STORE COUPONS & SAVINGS ===
${couponContextStr}

=== LATEST ORDER TRACKING ===
${orderContextStr}

${currentProductContextStr ? `=== CURRENT PRODUCT BEING VIEWED ===\n${currentProductContextStr}\n` : ""}

Detected User Intent: ${intentInfo.intent}
Customer Query: "${query}"

CONCIERGE SHOPPING INSTRUCTIONS:
1. CART & FREE SHIPPING ADVICE:
   - If customer asks about cart, savings, or free shipping, inform them of their cart subtotal (₹${cartDetails.total}).
   - If they are close to ₹499 (e.g. need ₹${cartDetails.freeShippingRemaining} more), encourage them to add a low-cost daily item to unlock FREE shipping!
2. SMART COUPON ADVISOR:
   - If customer asks about discounts, coupons, or deals, suggest the best eligible code (e.g. WELCOME10, FREESHIP, or SAVE50) based on their cart subtotal.
3. LIVE ORDER TRACKING:
   - If customer asks about their order status, provide their latest order details (#${latestOrder ? latestOrder.autoId || latestOrder._id.toString().slice(-6) : "N/A"}) and explain the current stage politely.
4. PRODUCT INQUIRIES & COMPARISONS:
   - If customer asks which product is better or asks for a comparison, provide a crisp, explainable Shopping Verdict comparing value, specs, and rating.
   - ONLY mention products from the verified list above. Never hallucinate fake products or out-of-stock items.
   - If NO products match, politely state: "Sorry sir/Ma'am, We don't have this in our stock right now." and suggest related categories.
5. ACTIONS & NAVIGATION:
   - For actions like "Open add to cart" or "view orders", explain clearly and inform them that interactive buttons are provided below.
6. TONE & FORMAT:
   - Warm, concise, professional (under 120 words).
   - Address the customer respectfully by name.
   - Use clean text formatting (bolding key terms like **Cart** or **FREE Shipping**).
`.trim();
}

// -------------------------------------------------------------
// 8. Deterministic Fallback Generation (Zero Hallucination)
// -------------------------------------------------------------
function generateFallbackResponse({
  customerName,
  intentInfo,
  retrievedDocs,
  retrievedProducts,
  cartDetails,
  activeCoupons,
  latestOrder
}) {
  const salutation = `Hello ${customerName || "Customer"}`;

  if (intentInfo.intent === "CART_INSIGHTS") {
    if (cartDetails.count === 0) {
      return `${salutation}! Your cart is currently empty. Add items totaling ₹499 or more to enjoy automatic FREE shipping!`;
    }
    if (cartDetails.total >= 499) {
      return `${salutation}! You currently have ${cartDetails.count} items in your cart totaling **₹${cartDetails.total.toLocaleString()}**. You've qualified for **FREE Shipping**! Click below to proceed to checkout.`;
    }
    return `${salutation}! You have ${cartDetails.count} item(s) in your cart totaling **₹${cartDetails.total.toLocaleString()}**. You're just **₹${cartDetails.freeShippingRemaining}** away from unlocking **FREE Shipping**!`;
  }

  if (intentInfo.intent === "DEALS_COUPONS") {
    const couponList = activeCoupons.map(c => `**${c.code}** (${c.discount})`).join(", ");
    return `${salutation}! Here are our top verified store coupons: ${couponList}. Apply them at checkout to save instantly on your order!`;
  }

  if (intentInfo.intent === "ORDER_TRACKING" && latestOrder) {
    return `${salutation}! Your recent order **#${latestOrder.autoId || latestOrder._id.toString().slice(-6)}** is currently **${latestOrder.orderStatus.toUpperCase()}** (Total: ₹${latestOrder.grandTotal}). Click below to view detailed tracking updates!`;
  }

  if (intentInfo.intent === "ACTION_NAVIGATION") {
    if (intentInfo.targetDoc === "cart_and_checkout") {
      return `${salutation}! You can review and manage your shopping cart anytime. Click below to view your cart items or proceed to checkout!`;
    }
    if (intentInfo.targetDoc === "orders_and_tracking") {
      return `${salutation}! You can track shipments and view past order history on your My Orders page.`;
    }
  }

  if (intentInfo.intent === "STORE_POLICY_FAQ" && retrievedDocs.length > 0) {
    const doc = retrievedDocs[0];
    return `${salutation}! Regarding **${doc.title}**:\n\n${doc.content}`;
  }

  if (retrievedProducts.length > 0) {
    return `${salutation}, here are the verified in-stock products matching your request:`;
  }

  return `Sorry sir/Ma'am, We don't have this in our stock right now. None of the products in this category are currently available. Please explore our other categories or check back soon!`;
}

// -------------------------------------------------------------
// 9. Main Shopping Assistant RAG Pipeline
// -------------------------------------------------------------
async function executeRagQuery({
  query,
  customerName = "Shopper",
  userId = null,
  currentProductId = null,
  conversationHistory = []
}) {
  const trimmedQuery = (query || "").trim();
  if (!trimmedQuery) {
    return {
      success: false,
      message: "Query is required"
    };
  }

  // Step 1: Intent Classification
  const intentInfo = analyzeQueryIntent(trimmedQuery, conversationHistory);

  if (intentInfo.intent === "SECURITY_BLOCK") {
    return {
      success: true,
      status: 200,
      type: "security_block",
      intent: intentInfo.intent,
      message: `Hello ${customerName || "there"}, I cannot assist with actions that compromise platform integrity or security policies. I am here to help you find products, check orders, or explore store offers!`,
      products: [],
      reasons: [],
      actions: [],
      grounding: {
        sources: ["Platform Security Policy"],
        retrievedDocsCount: 0,
        retrievedProductsCount: 0
      }
    };
  }

  // Step 2: Multi-Turn Context Resolution
  const multiTurnContext = resolveMultiTurnContext(trimmedQuery, conversationHistory);

  // Step 3: Fetch Real-Time User & Store Context
  let userProfile = null;
  let cartDetails = { count: 0, total: 0, items: [], freeShippingRemaining: 499 };
  let latestOrder = null;
  let activeCoupons = [];
  let currentProductObj = null;

  // 3a. Current Product lookup if on product detail page
  if (currentProductId && isDbReady()) {
    try {
      currentProductObj = await ProductModel.findById(currentProductId)
        .populate("category_id", "name")
        .populate("brand_id", "name");
    } catch (e) {}
  }

  // 3b. User Cart & Profile
  if (userId && isDbReady()) {
    try {
      userProfile = await UserProfileModel.findOne({ userId });
    } catch (e) {}

    try {
      const cartRecords = await CartModel.find({ user_id: userId, status: true }).populate("product_id");
      let total = 0;
      const items = [];
      cartRecords.forEach(c => {
        const p = c.product_id;
        if (p) {
          const itemPrice = Number(p.price) || 0;
          const q = Number(c.qty) || 1;
          total += itemPrice * q;
          items.push({ name: p.name, price: itemPrice, qty: q, id: p._id });
        }
      });
      cartDetails = {
        count: cartRecords.length,
        total,
        items,
        freeShippingRemaining: Math.max(0, 499 - total)
      };
    } catch (e) {}

    // 3c. Order lookup if asking about orders
    if (intentInfo.intent === "ORDER_TRACKING") {
      try {
        latestOrder = await OrderModel.findOne({
          $or: [{ addedById: userId }, { customerId: userId }],
          isDeleted: false
        }).sort({ createdAt: -1 });
      } catch (e) {}
    }
  }

  // 3d. Active Coupons
  if (isDbReady()) {
    try {
      const rawCoupons = await CouponsModel.find({ status: true }).limit(4);
      if (rawCoupons && rawCoupons.length > 0) {
        activeCoupons = rawCoupons.map(c => ({
          code: c.code,
          discount: c.discount,
          type: c.discountType || "Discount",
          minSpend: c.minAmoutSpend || 0
        }));
      }
    } catch (e) {}
  }
  if (activeCoupons.length === 0) {
    activeCoupons = [
      { code: "WELCOME10", discount: "10% OFF", type: "Percentage", minSpend: 299 },
      { code: "FREESHIP", discount: "FREE Delivery", type: "Shipping", minSpend: 499 },
      { code: "SAVE50", discount: "₹50 OFF", type: "Flat", minSpend: 799 }
    ];
  }

  // Step 4: Knowledge Base Retrieval
  const retrievedDocs = retrieveStoreKnowledge(trimmedQuery, intentInfo, 2);

  // Step 5: Product Inventory Retrieval
  let retrievedProducts = [];
  const isPureActionOrPolicy =
    (intentInfo.intent === "ACTION_NAVIGATION" || intentInfo.intent === "STORE_POLICY_FAQ") &&
    retrievedDocs.length > 0;

  const isOrderTrackingOnly = intentInfo.intent === "ORDER_TRACKING";

  if (!isPureActionOrPolicy && !isOrderTrackingOnly && intentInfo.intent !== "CONVERSATION") {
    try {
      const isCheaper = trimmedQuery.toLowerCase().includes("cheap") || intentInfo.intent === "PRODUCT_SEARCH_FOLLOWUP";
      const isBestRated = trimmedQuery.toLowerCase().includes("best") || trimmedQuery.toLowerCase().includes("rating");

      retrievedProducts = await retrieveVerifiedProducts(trimmedQuery, {
        currentProductId,
        contextualCategory: multiTurnContext.contextualCategory,
        isCheaperRequest: isCheaper,
        isBestRatedRequest: isBestRated,
        limit: 6
      });
    } catch (prodErr) {
      console.error("Product retrieval error:", prodErr);
    }
  }

  // Step 6: Gather Genuine Recommendation Reasons
  const productReasons = [];
  for (const prod of retrievedProducts) {
    const pPrice = Number(prod.price) || 0;
    const reasons = [];

    if (prod.category_id?.name) {
      reasons.push(`Category: ${prod.category_id.name}`);
    }
    reasons.push(`Verified Price: ₹${pPrice.toLocaleString()}`);
    if (Number(prod.rating) >= 4) {
      reasons.push(`Top Rated: ${Number(prod.rating).toFixed(1)}★ customer rating`);
    }
    reasons.push(`Ready to Ship: ${prod.stock} units in stock`);

    productReasons.push({
      productId: prod._id,
      name: prod.name,
      reasons
    });
  }

  // Step 6b: Resolve Target Product for Direct Add To Cart or Order Tasks
  let targetProduct = null;
  let actionTask = null;

  if (intentInfo.intent === "EXECUTE_ADD_TO_CART" || intentInfo.intent === "EXECUTE_ORDER") {
    // 1. Check if user is currently viewing a product detail page
    if (currentProductObj) {
      targetProduct = currentProductObj;
    }

    // 2. Search by product name extracted from user message
    if (!targetProduct) {
      const cleanSearch = trimmedQuery
        .replace(/add\s+to\s+cart|add\s+this\s+to\s+cart|add\s+it\s+to\s+cart|add\s+into\s+cart|put\s+in\s+cart/gi, "")
        .replace(/order\s+this|buy\s+now|buy\s+this|place\s+order\s+for|order|buy/gi, "")
        .replace(/please|can\s+you|for\s+me|my\s+cart|to\s+cart|in\s+cart/gi, "")
        .trim();

      if (cleanSearch.length > 1) {
        try {
          const candidates = await retrieveVerifiedProducts(cleanSearch, { limit: 1 });
          if (candidates.length > 0) {
            targetProduct = candidates[0];
          }
        } catch (e) {}
      }
    }

    // 3. Fallback to candidate list or conversation history
    if (!targetProduct && retrievedProducts.length > 0) {
      targetProduct = retrievedProducts[0];
    } else if (!targetProduct && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
      for (let i = conversationHistory.length - 1; i >= 0; i--) {
        const msg = conversationHistory[i];
        if (msg.products && Array.isArray(msg.products) && msg.products.length > 0) {
          targetProduct = msg.products[0];
          break;
        }
      }
    }

    // 4. Construct Action Task
    if (targetProduct) {
      actionTask = {
        type: intentInfo.intent === "EXECUTE_ORDER" ? "ORDER_NOW" : "ADD_TO_CART",
        product: {
          _id: targetProduct._id,
          name: targetProduct.name,
          price: targetProduct.price,
          image: targetProduct.image,
          category_id: targetProduct.category_id,
          stock: targetProduct.stock
        },
        target: intentInfo.intent === "EXECUTE_ORDER" ? "/checkout" : "/cart"
      };

      if (!retrievedProducts.some(p => p._id.toString() === targetProduct._id.toString())) {
        retrievedProducts.unshift(targetProduct);
      }
    }
  }

  // Step 7: Determine Contextual Action Buttons
  const actions = [];
  if (actionTask) {
    if (actionTask.type === "ORDER_NOW") {
      actions.push(
        { label: "💳 Proceed to Checkout", action: "NAVIGATE", target: "/checkout", primary: true },
        { label: "🛒 View Cart", action: "NAVIGATE", target: "/cart", primary: false }
      );
    } else {
      actions.push(
        { label: "🛒 Open Cart", action: "NAVIGATE", target: "/cart", primary: true },
        { label: "💳 Checkout", action: "NAVIGATE", target: "/checkout", primary: false }
      );
    }
  } else if (intentInfo.intent === "EXECUTE_ADD_TO_CART" || intentInfo.intent === "EXECUTE_ORDER") {
    actions.push(
      { label: "🛍️ Browse Products", action: "NAVIGATE", target: "/CardProduct", primary: true },
      { label: "📂 View Categories", action: "NAVIGATE", target: "/CardCategory", primary: false }
    );
  } else if (intentInfo.intent === "ACTION_NAVIGATION" && retrievedDocs.length > 0 && retrievedDocs[0].actions) {
    actions.push(...retrievedDocs[0].actions);
  } else if (intentInfo.intent === "CART_INSIGHTS") {
    actions.push(
      { label: "🛒 Open Cart", action: "NAVIGATE", target: "/cart", primary: true },
      { label: "💳 Checkout", action: "NAVIGATE", target: "/checkout", primary: false }
    );
  } else if (intentInfo.intent === "DEALS_COUPONS") {
    actions.push(
      { label: "🏷️ Open Cart & Apply Code", action: "NAVIGATE", target: "/cart", primary: true },
      { label: "🛍️ View Deals", action: "NAVIGATE", target: "/CardProduct", primary: false }
    );
  } else if (intentInfo.intent === "ORDER_TRACKING") {
    actions.push(
      { label: "📦 View My Orders", action: "NAVIGATE", target: "/myorders", primary: true }
    );
  } else if (retrievedDocs.length > 0 && retrievedDocs[0].actions) {
    actions.push(...retrievedDocs[0].actions);
  }

  // Fallback explore action if no products found
  if (intentInfo.intent === "PRODUCT_SEARCH" && retrievedProducts.length === 0) {
    actions.push(
      { label: "🛍️ View Catalog", action: "NAVIGATE", target: "/CardProduct", primary: true },
      { label: "📂 Browse Categories", action: "NAVIGATE", target: "/CardCategory", primary: false }
    );
  }

  // Step 8: Build Augmented Grounded Prompt & Generate
  const prompt = buildShoppingPrompt({
    query: trimmedQuery,
    customerName,
    intentInfo,
    retrievedDocs,
    retrievedProducts,
    userProfile,
    cartDetails,
    activeCoupons,
    latestOrder,
    currentProductObj
  });

  let generatedMessage = "";
  const ai = getAiClient();

  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt
      });
      generatedMessage = response.text ? response.text.trim() : "";
    } catch (genErr) {
      console.warn("Gemini generation failed, falling back to deterministic RAG synthesis:", genErr.message);
    }
  }

  if (actionTask) {
    if (actionTask.type === "ORDER_NOW") {
      generatedMessage = `I'm preparing your order for **${actionTask.product.name}** (₹${actionTask.product.price}) and taking you to checkout to place your order!`;
    } else {
      generatedMessage = `I'm adding **${actionTask.product.name}** (₹${actionTask.product.price}) to your shopping cart right away!`;
    }
  } else if (intentInfo.intent === "EXECUTE_ADD_TO_CART" || intentInfo.intent === "EXECUTE_ORDER") {
    generatedMessage = `Which product would you like me to add to your cart or order? Please specify the product name (for example, "Add Philips bulb to cart")!`;
  } else if (!generatedMessage) {
    generatedMessage = generateFallbackResponse({
      customerName,
      intentInfo,
      retrievedDocs,
      retrievedProducts,
      cartDetails,
      activeCoupons,
      latestOrder
    });
  }

  // Step 9: Grounding Sources
  const sources = [];
  if (retrievedDocs.length > 0) {
    sources.push(...retrievedDocs.map(d => `Store Knowledge: ${d.title}`));
  }
  if (retrievedProducts.length > 0) {
    sources.push(`Live Catalog (${retrievedProducts.length} verified in-stock items)`);
  }
  if (cartDetails.count > 0) {
    sources.push(`Active Cart Context (${cartDetails.count} items)`);
  }
  if (activeCoupons.length > 0) {
    sources.push(`Verified Store Coupons (${activeCoupons.length} active)`);
  }
  if (sources.length === 0) {
    sources.push("Aventra Personal Shopping Assistant");
  }

  let responseType = "rag_response";
  if (actionTask) responseType = "action_execution";
  else if (intentInfo.intent === "ACTION_NAVIGATION") responseType = "action_navigation";
  else if (intentInfo.intent === "CART_INSIGHTS") responseType = "cart_insights";
  else if (intentInfo.intent === "DEALS_COUPONS") responseType = "deals_coupons";
  else if (intentInfo.intent === "ORDER_TRACKING") responseType = "order_tracking";
  else if (intentInfo.intent === "STORE_POLICY_FAQ") responseType = "store_policy_faq";
  else if (retrievedProducts.length > 0) responseType = "product_recommendation";
  else if (intentInfo.intent === "PRODUCT_COMPARISON") responseType = "product_comparison";
  else responseType = "general_answer";

  return {
    success: true,
    status: 200,
    type: responseType,
    intent: intentInfo.intent,
    actionTask: actionTask,
    message: generatedMessage,
    products: retrievedProducts,
    reasons: productReasons,
    actions: actions,
    grounding: {
      sources: sources,
      retrievedDocsCount: retrievedDocs.length,
      retrievedProductsCount: retrievedProducts.length,
      cartSubtotal: cartDetails.total,
      freeShippingQualified: cartDetails.total >= 499
    }
  };
}

module.exports = {
  executeRagQuery,
  analyzeQueryIntent,
  retrieveStoreKnowledge,
  retrieveVerifiedProducts,
  KNOWLEDGE_BASE
};
