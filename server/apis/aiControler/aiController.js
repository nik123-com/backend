const { GoogleGenAI } = require("@google/genai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const main = async (req, res) => {
  if (!req.body.prompt) {
    res.send({
      message: "prompt is required",
      status: 403,
      success: false,
    });
  } else {
    try {
      let prompt = req.body.prompt + " according to Ecommerce Website Guide"

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });
      console.log(response.text);

      res.send({
        message: response.text,
        status: 200,
        success: true,
      });
    } catch (err) {
      res.send({
        message: err,
        status: 500,
        success: false,
      });
    }
  }
};

const generateProductDescription = async (req, res) => {
  try {
    const { name, category, features } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, status: 400, message: "Product name is required" });
    }

    const prompt = `Write an engaging, professional e-commerce product description for a product named "${name}" in category "${category || 'General'}". Key features: ${features || 'Premium quality, durable, stylish'}. Keep it under 20 words strictly. Do not use markdown headers or formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      description: response.text
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const generateSeoData = async (req, res) => {
  try {
    const { name, category, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, status: 400, message: "Product name is required" });
    }

    const prompt = `For an e-commerce product named "${name}" in category "${category || 'General'}" with description "${description || ''}", generate:
1. SEO Title (max 60 chars)
2. 8 comma-separated SEO Keywords
3. SEO Meta Description (max 150 chars)

Format response as JSON:
{"seoTitle": "...", "seoKeywords": "...", "seoDescription": "..."}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    let result = { seoTitle: `${name} | Online Store`, seoKeywords: `${name}, buy online, ${category}`, seoDescription: `Buy ${name} at the best price online.` };
    try {
      const cleanJson = response.text.replace(/```json|```/g, '').trim();
      result = JSON.parse(cleanJson);
    } catch (e) {
      console.error("JSON parse error for SEO:", e);
    }

    return res.status(200).json({
      success: true,
      status: 200,
      data: result
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const generateMarketingCaption = async (req, res) => {
  try {
    const { name, category, price } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, status: 400, message: "Product name is required" });
    }

    const prompt = `Write a viral, catchy social media marketing caption with emojis and hashtags for launching "${name}" priced at Rs.${price || 999} in "${category || 'Store'}".`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      caption: response.text
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const suggestPrice = async (req, res) => {
  try {
    const { name, category, features } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, status: 400, message: "Product name is required" });
    }

    const prompt = `Provide a competitive e-commerce pricing suggestion (in INR / Rs.) for product "${name}" in category "${category || 'General'}" with features: "${features || 'standard'}". Return a brief rationale and suggested numeric price value.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      suggestion: response.text
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const generateAnnouncementDescription = async (req, res) => {
  try {
    const { title, targetAudience, priority } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, status: 400, message: "Announcement title is required" });
    }

    const audienceGreeting = targetAudience && targetAudience.toLowerCase().includes("vendor")
      ? "Dear vendor,"
      : targetAudience && targetAudience.toLowerCase().includes("customer")
      ? "Dear customer,"
      : "Dear Everyone,";

    const prompt = `You are writing an official platform announcement notice for the e-commerce platform "Aventra".
Announcement Title: "${title}"
Target Audience: "${targetAudience || 'Everyone'}"
Priority Level: "${priority || 'Normal'}"

Strict Rules:
1. Platform Name: Always refer to the platform as "Aventra".
2. Length: Word count MUST be strictly between 50 and 300 words.
3. Starting Sentence: You MUST start the text exactly with '${audienceGreeting} This is to inform you that...'
4. Plain Text: Do not use any markdown bold (**), italics (*), or heading (#) symbols. Return pure plain text.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      description: response.text
    });
  } catch (err) {
    console.error("Error generating announcement description:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message || "Failed to generate AI description" });
  }
};

const generateReviewReply = async (req, res) => {
  try {
    const { comment, rating, productName } = req.body;
    if (!comment) {
      return res.status(400).json({ success: false, status: 400, message: "Review comment is required" });
    }

    const prompt = `You are a polite, appreciative store owner/vendor on an e-commerce platform.
A customer wrote the following review for the product "${productName || 'our product'}":
Rating: ${rating || 5} out of 5 stars
Review comment: "${comment}"

Write a warm, polite, professional, and helpful official store reply to this customer review.
Keep it concise (1 to 3 sentences max). Include friendly emojis if appropriate. Return pure plain text only without markdown formatting.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return res.status(200).json({
      success: true,
      status: 200,
      reply: response.text ? response.text.trim() : "Thank you for your feedback!"
    });
  } catch (err) {
    console.error("Error generating review reply:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message || "Failed to generate AI reply" });
  }
};

const ProductModel = require("../product/ProductModel");
const CategoryModel = require("../category/categoryModel");
const BrandModel = require("../brand/BrandModel");
const UserProfileModel = require("../behavior/UserProfileModel");
const CartModel = require("../cart/CartModel");
const RecommendationService = require("../recommendation/RecommendationService");

const blockedKeywords = [
  "hack", "hacking", "ddos", "sql injection", "xss", "csrf", "exploit",
  "admin password", "admin panel", "free products", "free order", "bypass payment",
  "steal account", "refund abuse", "coupon exploit", "crack", "phishing",
  "database access", "steal data", "customer data", "credential stuffing", "bot attack",
  "ignore previous instructions", "jailbreak"
];

function isBlocked(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return blockedKeywords.some((word) => lower.includes(word));
}

const contextualShoppingQuery = async (req, res) => {
  try {
    const { query, customerName, userId, currentProductId, conversationHistory } = req.body;

    if (!query || typeof query !== "string" || !query.trim()) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "query is required"
      });
    }

    const trimmedQuery = query.trim();

    // 1. Security check
    if (isBlocked(trimmedQuery)) {
      return res.status(200).json({
        success: true,
        status: 200,
        type: "security_block",
        message: `Hello ${customerName || "there"}, I cannot assist with actions that compromise platform integrity or security policies. I am here to help you find products, check orders, or explore offers!`,
        products: [],
        reasons: []
      });
    }

    const lowerQuery = trimmedQuery.toLowerCase();

    // 2. Fetch User Context
    let userProfile = null;
    let userCartCount = 0;
    if (userId) {
      userProfile = await UserProfileModel.findOne({ userId });
      userCartCount = await CartModel.countDocuments({ user_id: userId, status: true });
    }

    // 3. Extract Intent & Filters from Query
    // Price constraint extraction (e.g. "under 70000", "below 500", "under rs 2000")
    let maxPrice = null;
    let minPrice = null;
    const priceUnderMatch = lowerQuery.match(/(?:under|below|less than|within)\s*(?:rs\.?|₹)?\s*(\d+)/i);
    if (priceUnderMatch && priceUnderMatch[1]) {
      maxPrice = Number(priceUnderMatch[1]);
    }
    const priceBetweenMatch = lowerQuery.match(/(?:between)\s*(?:rs\.?|₹)?\s*(\d+)\s*(?:and|to|-)\s*(?:rs\.?|₹)?\s*(\d+)/i);
    if (priceBetweenMatch && priceBetweenMatch[1] && priceBetweenMatch[2]) {
      minPrice = Number(priceBetweenMatch[1]);
      maxPrice = Number(priceBetweenMatch[2]);
    }

    // Identify if user is asking "Why are you recommending this?"
    const isWhyRecommend = lowerQuery.includes("why are you recommending") ||
      lowerQuery.includes("why recommend") ||
      lowerQuery.includes("why this product") ||
      lowerQuery.includes("why is this recommended");

    // Identify if user is asking "Which one is better for me?"
    const isComparison = lowerQuery.includes("which one is better") ||
      lowerQuery.includes("which is better") ||
      lowerQuery.includes("recommend between") ||
      lowerQuery.includes("which should i buy");

    // 4. Retrieve candidate products from DB
    let matchedProducts = [];

    if (currentProductId && (isWhyRecommend || isComparison)) {
      // Focus on current product or complementary items
      const curr = await ProductModel.findById(currentProductId)
        .populate("category_id", "name")
        .populate("brand_id", "name");
      if (curr) {
        matchedProducts.push(curr);
        const comp = await RecommendationService.getComplementaryRecommendations(currentProductId, 3);
        comp.forEach((c) => {
          if (c.product && c.product._id.toString() !== currentProductId.toString()) {
            matchedProducts.push(c.product);
          }
        });
      }
    } else {
      // Find matching categories or brands
      const allCategories = await CategoryModel.find({ status: true }).select("_id name");
      const matchedCats = allCategories.filter((c) =>
        lowerQuery.includes(c.name.toLowerCase())
      );

      const allBrands = await BrandModel.find({ status: true }).select("_id name");
      const matchedBrands = allBrands.filter((b) =>
        lowerQuery.includes(b.name.toLowerCase())
      );

      // Clean query tokens
      const stopWords = new Set([
        "provide", "me", "list", "of", "all", "the", "category", "categories", "and", "or",
        "what", "is", "are", "show", "please", "products", "items", "available", "in", "for",
        "can", "you", "give", "display", "get", "find", "looking", "want", "search", "a", "an",
        "with", "under", "below", "above", "price", "store", "buy", "best", "some", "any", "which"
      ]);
      const tokens = lowerQuery.replace(/[^\w\s]/gi, " ").split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t));

      // Build MongoDB query
      const filterConditions = {
        status: true,
        stock: { $gt: 0 },
        isDraft: { $ne: true }
      };

      if (matchedCats.length > 0) {
        filterConditions.category_id = { $in: matchedCats.map((c) => c._id) };
      }
      if (matchedBrands.length > 0) {
        filterConditions.brand_id = { $in: matchedBrands.map((b) => b._id) };
      }

      let candidateList = await ProductModel.find(filterConditions)
        .populate("category_id", "name")
        .populate("brand_id", "name")
        .limit(30);

      // If category/brand filter didn't match, search by token in name/description
      if (candidateList.length === 0 && tokens.length > 0 && matchedCats.length === 0) {
        const regexOrs = tokens.map((t) => ({ name: { $regex: t, $options: "i" } }));
        candidateList = await ProductModel.find({
          status: true,
          stock: { $gt: 0 },
          isDraft: { $ne: true },
          $or: regexOrs
        })
          .populate("category_id", "name")
          .populate("brand_id", "name")
          .limit(20);
      }

      // If nothing is in stock for this category/search, do NOT fallback to unrelated products!
      // Only in-stock verified matches should be returned.

      // Apply price filter strictly in memory to guarantee price compliance
      if (maxPrice !== null) {
        candidateList = candidateList.filter((p) => {
          const pr = Number(p.price) || 0;
          return pr <= maxPrice && (minPrice === null || pr >= minPrice);
        });
      }

      matchedProducts = candidateList.slice(0, 6);
    }

    // 5. Gather Genuine Recommendation Reasons
    const productReasons = [];
    for (const prod of matchedProducts) {
      const pPrice = Number(prod.price) || 0;
      const reasons = [];

      if (prod.category_id?.name) {
        reasons.push(`Category: ${prod.category_id.name}`);
      }
      if (maxPrice && pPrice <= maxPrice) {
        reasons.push(`Budget-friendly: ₹${pPrice.toLocaleString()} (within your ₹${maxPrice.toLocaleString()} limit)`);
      } else {
        reasons.push(`Current Price: ₹${pPrice.toLocaleString()}`);
      }
      if (Number(prod.rating) >= 4) {
        reasons.push(`Customer favorite: ${Number(prod.rating).toFixed(1)}★ rating`);
      }
      reasons.push(`In stock: ${prod.stock} units ready to ship`);

      productReasons.push({
        productId: prod._id,
        name: prod.name,
        reasons
      });
    }

    // 6. Build Context for Gemini
    const userContextStr = `
Customer Profile Context:
- Customer Name: ${customerName || "Valued Shopper"}
- Items in Cart: ${userCartCount}
- Inferred Preferred Categories: ${(userProfile?.preferredCategories || []).map((c) => c.categoryName || "").filter(Boolean).join(", ") || "General"}
- Inferred Budget Preference: ₹${userProfile?.averagePriceRange?.min || 0} - ₹${userProfile?.averagePriceRange?.max || "Flexible"}
`;

    const productsContextStr = matchedProducts.length > 0
      ? matchedProducts.map((p, idx) => {
          return `${idx + 1}. "${p.name}"
   - Price: ₹${p.price}
   - Stock: ${p.stock > 0 ? `${p.stock} units available` : "Out of stock"}
   - Rating: ${p.rating ? `${p.rating} / 5 stars` : "New / Not yet rated"}
   - Category: ${p.category_id?.name || "General"}
   - Brand: ${p.brand_id?.name || "Standard"}
   - Description: ${(p.description || "").slice(0, 150)}`;
        }).join("\n\n")
      : "No in-stock matching products found in store inventory.";

    const prompt = `
You are Stellar, the intelligent, explainable, context-aware AI shopping assistant for Aventra e-commerce.

${userContextStr}

Customer Message:
"${trimmedQuery}"

Actual Database Verified Products Retrieved:
${productsContextStr}

CRITICAL RULES:
1. ONLY reference product information from the verified in-stock products list above.
2. If NO in-stock products are available for the requested category or item, NEVER recommend random or unrelated products. Politely say: "Sorry sir/Ma'am, We don't Found it in our stock right now. None of the products in this category are currently available."
3. NEVER hallucinate price, stock, ratings, or specs.
4. If products are available, keep the response polite, conversational, professional, and concise (under 100 words).
5. Address the customer respectfully.
`;

    let aiMessage = "";
    try {
      if (matchedProducts.length === 0) {
        aiMessage = `Sorry sir/Ma'am, We don't Found it in our stock right now. None of the products in this category are currently available. Please explore our other categories or check back soon!`;
      } else {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        aiMessage = response.text ? response.text.trim() : "";
      }
    } catch (genErr) {
      console.error("Gemini API call error in contextual query:", genErr);
      if (matchedProducts.length > 0) {
        aiMessage = `Hello ${customerName || "Customer"}, here are the verified products in stock matching your request:`;
      } else {
        aiMessage = `Sorry sir/Ma'am, We don't Found it in our stock right now. None of the products in this category are currently available.`;
      }
    }

    if (matchedProducts.length === 0) {
      return res.status(200).json({
        success: true,
        status: 200,
        type: "general_answer",
        message: "Sorry sir/Ma'am, We don't Found it in our stock right now.",
        products: [],
        reasons: []
      });
    }

    let responseType = "product_recommendation";
    if (isComparison) responseType = "comparison";
    else if (isWhyRecommend) responseType = "explanation";

    return res.status(200).json({
      success: true,
      status: 200,
      type: responseType,
      message: aiMessage,
      products: matchedProducts,
      reasons: productReasons
    });
  } catch (err) {
    console.error("contextualShoppingQuery error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Failed to process query"
    });
  }
};

module.exports = {
  main,
  generateProductDescription,
  generateSeoData,
  generateMarketingCaption,
  suggestPrice,
  generateAnnouncementDescription,
  generateReviewReply,
  contextualShoppingQuery
};



