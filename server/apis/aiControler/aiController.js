const path = require("path");
const fs = require("fs");
const { GoogleGenAI } = require("@google/genai");

function getApiKey() {
  let key = (process.env.GEMINI_API_KEY || "").trim();
  if (!key) {
    // Actively load from backend .env file on disk
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

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  try {
    return new GoogleGenAI({ apiKey });
  } catch (err) {
    console.error("Failed to initialize GoogleGenAI:", err.message);
    return null;
  }
};

const main = async (req, res) => {
  if (!req.body.prompt) {
    return res.send({
      message: "prompt is required",
      status: 403,
      success: false,
    });
  } else {
    try {
      const prompt = req.body.prompt + " according to Ecommerce Website Guide";
      const ai = getAiClient();
      if (!ai) {
        return res.send({
          message: "Gemini AI assistant is in fallback mode. Please configure GEMINI_API_KEY.",
          status: 200,
          success: true,
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      return res.send({
        message: response.text,
        status: 200,
        success: true,
      });
    } catch (err) {
      return res.send({
        message: err.message || "Failed to process prompt",
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

    let descriptionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
        const prompt = `Write an engaging, professional e-commerce product description for a product named "${name}" in category "${category || 'General'}". Key features: ${features || 'Premium quality, durable, stylish'}. Keep it under 25 words strictly. Do not use markdown headers or formatting.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        descriptionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API description generation warning:", aiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `Experience exceptional quality with the ${name}. Engineered for durability, high performance, and everyday convenience in ${category || 'your lifestyle'}.`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      description: descriptionText
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

    let result = null;
    const ai = getAiClient();
    if (ai) {
      try {
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

        const cleanJson = response.text.replace(/```json|```/g, '').trim();
        result = JSON.parse(cleanJson);
      } catch (aiErr) {
        console.warn("Gemini API SEO generation warning:", aiErr.message);
      }
    }

    if (!result || !result.seoTitle) {
      result = {
        seoTitle: `${name.slice(0, 45)} | Buy Online Best Deals`,
        seoKeywords: `${name}, buy ${name}, best ${category || 'deals'}, discount, quality, online shopping`,
        seoDescription: `Shop the latest ${name} at competitive prices. Discover top quality and fast delivery for ${category || 'your lifestyle'}.`
      };
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

    let captionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
        const prompt = `Write a viral, catchy social media marketing caption with emojis and hashtags for launching "${name}" priced at Rs.${price || 999} in "${category || 'Store'}".`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        captionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API caption warning:", aiErr.message);
      }
    }

    if (!captionText) {
      const cleanCat = (category || 'Shopping').replace(/[^a-zA-Z0-9]/g, '');
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 15);
      captionText = `✨ Elevate your routine with the all-new ${name}! 🚀\n\nNow available for just ₹${price || 999}! Don't miss out on premium quality and style at an unbeatable value. Tap to shop yours now! 🛍️✨\n\n#NewArrival #${cleanCat} #MustHave #BestDeals #${cleanName}`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      caption: captionText
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

    let suggestionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
        const prompt = `Provide a competitive e-commerce pricing suggestion (in INR / Rs.) for product "${name}" in category "${category || 'General'}" with features: "${features || 'standard'}". Return a brief rationale and suggested numeric price value.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        suggestionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API price suggest warning:", aiErr.message);
      }
    }

    if (!suggestionText) {
      suggestionText = `💡 AI Pricing Insight for "${name}":\n• Benchmark Category: ${category || 'General'}\n• Recommended Pricing Strategy: Competitive Value\n• Suggested Target Price: ₹999 – ₹1,499 depending on variant and packaging.\n• Rationale: This price tier maximizes conversion while preserving healthy vendor gross margins.`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      suggestion: suggestionText
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

    let descriptionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
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
        descriptionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API announcement warning:", aiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `${audienceGreeting} This is to inform you that Aventra is updating operations regarding "${title}". We are dedicated to providing the highest quality experience, streamlined tools, and reliable services across the platform. Please review your account for relevant updates. Thank you for your continued partnership.`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      description: descriptionText
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

    let replyText = "";
    const ai = getAiClient();
    if (ai) {
      try {
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
        replyText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API review reply warning:", aiErr.message);
      }
    }

    if (!replyText) {
      if (Number(rating) >= 4) {
        replyText = `Thank you so much for your positive review! We are delighted that you had a great experience with ${productName || 'our product'} and look forward to serving you again. 😊`;
      } else {
        replyText = `Thank you for sharing your candid review. We sincerely apologize that your experience with ${productName || 'this item'} did not meet expectations, and we are working hard to make improvements. 🙏`;
      }
    }

    return res.status(200).json({
      success: true,
      status: 200,
      reply: replyText
    });
  } catch (err) {
    console.error("Error generating review reply:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message || "Failed to generate AI reply" });
  }
};

const generateCategoryDescription = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, status: 400, message: "Category name is required" });
    }

    let descriptionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
        const prompt = `Write an engaging, professional e-commerce category description for the category "${name}". Keep it under 30 words strictly. Highlight the breadth of products, quality, and appeal to online shoppers. Do not use markdown headers or formatting.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        descriptionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API category description warning:", aiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `Explore our curated ${name} collection featuring premium products, top brands, and unmatched value designed to elevate your everyday shopping experience.`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      description: descriptionText
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const generateStoreDescription = async (req, res) => {
  try {
    const { businessName, category, city } = req.body;
    if (!businessName) {
      return res.status(400).json({ success: false, status: 400, message: "Store / business name is required" });
    }

    let descriptionText = "";
    const ai = getAiClient();
    if (ai) {
      try {
        const prompt = `Write a trustworthy, welcoming e-commerce store description for a vendor named "${businessName}" specializing in "${category || 'Quality Goods'}" based in "${city || 'India'}". Keep it under 40 words strictly. Mention quality products, reliable service, and fast delivery. Do not use markdown headers or formatting.`;
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
        });
        descriptionText = response.text ? response.text.trim() : "";
      } catch (aiErr) {
        console.warn("Gemini API store description warning:", aiErr.message);
      }
    }

    if (!descriptionText) {
      descriptionText = `Welcome to ${businessName}! We are dedicated to offering top-quality ${category || 'products'} with exceptional customer service, verified authenticity, and swift doorstep delivery.`;
    }

    return res.status(200).json({
      success: true,
      status: 200,
      description: descriptionText
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
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
    const ai = getAiClient();
    try {
      if (matchedProducts.length === 0) {
        aiMessage = `Sorry sir/Ma'am, We don't Found it in our stock right now. None of the products in this category are currently available. Please explore our other categories or check back soon!`;
      } else if (ai) {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        aiMessage = response.text ? response.text.trim() : "";
      } else {
        aiMessage = `Hello ${customerName || "Customer"}, here are the verified products in stock matching your request:`;
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
  generateCategoryDescription,
  generateStoreDescription,
  generateSeoData,
  generateMarketingCaption,
  suggestPrice,
  generateAnnouncementDescription,
  generateReviewReply,
  contextualShoppingQuery
};



