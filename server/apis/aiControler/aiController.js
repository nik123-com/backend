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

const ragService = require("./ragService");

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

    const ragResult = await ragService.executeRagQuery({
      query,
      customerName,
      userId,
      currentProductId,
      conversationHistory
    });

    return res.status(200).json(ragResult);
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



