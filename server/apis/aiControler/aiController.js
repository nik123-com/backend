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

module.exports = {
  main,
  generateProductDescription,
  generateSeoData,
  generateMarketingCaption,
  suggestPrice,
  generateAnnouncementDescription,
  generateReviewReply
};


