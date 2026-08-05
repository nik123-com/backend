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

const CustomerModel = require('../customer/CustomerModel');
const OrderModel = require('../order/OrderModel');
const ReviewModel = require('../review/ReviewModel');
const VendorModel = require('../vendor/VendorModel');
const CouponModel = require('../coupons/CouponsModel');
const ProductModel = require('../product/ProductModel');
const NotificationModel = require('../notification/NotificationModel');

const computeHeuristicCustomerRank = (metrics) => {
  const { totalOrders, acceptedOrders, cancelledOrders, totalSpend, reviewCount, avgRating, daysSinceLastOrder } = metrics;
  
  let acceptanceRate = totalOrders > 0 ? (acceptedOrders / totalOrders) * 100 : 100;
  let acceptanceScore = (acceptanceRate / 100) * 35;
  let spendScore = Math.min(30, (totalSpend / 5000) * 30);
  let reviewScore = Math.min(20, reviewCount * 4 + (avgRating || 0) * 2);
  let recencyScore = daysSinceLastOrder <= 14 ? 15 : daysSinceLastOrder <= 45 ? 10 : daysSinceLastOrder <= 90 ? 5 : 0;
  let penalty = cancelledOrders * 10;
  
  let rawScore = Math.round(acceptanceScore + spendScore + reviewScore + recencyScore - penalty);
  let rankScore = Math.max(0, Math.min(100, rawScore));
  
  let rank = "Bronze";
  if (rankScore >= 85) rank = "VIP Premium";
  else if (rankScore >= 70) rank = "Platinum";
  else if (rankScore >= 50) rank = "Gold";
  else if (rankScore >= 30) rank = "Silver";
  
  let activityStatus = "Dormant";
  if (daysSinceLastOrder <= 14 || totalOrders >= 5) activityStatus = "Highly Active";
  else if (daysSinceLastOrder <= 60 || totalOrders >= 1) activityStatus = "Moderately Active";
  
  let aiSummary = `Customer activity evaluation: ${totalOrders} order(s) placed (${acceptedOrders} accepted, ${cancelledOrders} cancelled), Rs.${totalSpend} total spent, ${reviewCount} review(s) written. Awarded ${rank} rank with ${activityStatus} status.`;
  
  let couponCode = `${rank.replace(/\s+/g, '').toUpperCase()}${Math.floor(100 + Math.random() * 900)}`;
  let discountVal = rank === "VIP Premium" ? "30%" : rank === "Platinum" ? "25%" : rank === "Gold" ? "20%" : rank === "Silver" ? "15%" : "10%";
  
  return {
    rank,
    rankScore,
    activityStatus,
    activityScore: rankScore,
    aiSummary,
    recommendedCoupon: {
      code: couponCode,
      discount: discountVal,
      discountType: "percentage",
      minAmoutSpend: rank === "VIP Premium" ? 300 : 200,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }
  };
};

const evaluateSingleCustomerAi = async (customer) => {
  const customerId = customer._id;
  const orders = await OrderModel.find({ customerId, isDeleted: false });
  const reviews = customer.userId ? await ReviewModel.find({ userId: customer.userId }) : [];
  
  let totalOrders = orders.length;
  let acceptedOrders = 0;
  let cancelledOrders = 0;
  let totalSpend = 0;
  let lastOrderDate = customer.created_at || new Date();
  
  orders.forEach(o => {
    let isCancelled = o.orderStatus === 'cancelled' || o.products?.some(p => p.itemStatus === 'cancelled');
    if (isCancelled) {
      cancelledOrders++;
    } else {
      acceptedOrders++;
      totalSpend += (o.grandTotal || 0);
    }
    if (o.createdAt && new Date(o.createdAt) > new Date(lastOrderDate)) {
      lastOrderDate = o.createdAt;
    }
  });
  
  let reviewCount = reviews.length;
  let avgRating = reviewCount > 0 ? Number((reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviewCount).toFixed(1)) : 0;
  let sampleComments = reviews.map(r => r.comment).filter(Boolean).slice(0, 5).join("; ");
  
  let daysSinceLastOrder = Math.max(0, Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)));
  let acceptanceRate = totalOrders > 0 ? Math.round((acceptedOrders / totalOrders) * 100) : 100;
  
  const metrics = {
    totalOrders,
    acceptedOrders,
    cancelledOrders,
    acceptanceRate,
    totalSpend,
    reviewCount,
    avgRating,
    daysSinceLastOrder
  };
  
  let evaluationResult = computeHeuristicCustomerRank(metrics);
  
  try {
    const prompt = `Evaluate customer performance for an e-commerce platform.
Customer Name: ${customer.name}
Total Orders: ${totalOrders}
Accepted/Delivered Orders: ${acceptedOrders}
Cancelled Orders: ${cancelledOrders}
Acceptance Rate: ${acceptanceRate}%
Total Spend: Rs. ${totalSpend}
Days Since Last Activity: ${daysSinceLastOrder} days
Reviews Written: ${reviewCount}
Average Rating Given by Customer: ${avgRating}/5 stars
Sample Review Comments: "${sampleComments || 'No reviews written yet'}"

Rules for Ranking & Activity:
1. Rank MUST be one of: ["VIP Premium", "Platinum", "Gold", "Silver", "Bronze"]
2. ActivityStatus MUST be one of: ["Highly Active", "Moderately Active", "Dormant"]
3. RankScore (0 to 100) based on spend, reliability, and completion rate.
4. Provide a warm, professional 1-2 sentence AI summary explaining why this rank was awarded.
5. Provide a reward coupon recommendation with code, discount percentage, minAmoutSpend, and expiryDate (YYYY-MM-DD format).

Return JSON ONLY in this format:
{
  "rank": "Gold",
  "rankScore": 85,
  "activityStatus": "Highly Active",
  "activityScore": 85,
  "aiSummary": "...",
  "recommendedCoupon": {
    "code": "GOLD85",
    "discount": "20%",
    "discountType": "percentage",
    "minAmoutSpend": 500,
    "expiryDate": "2026-12-31"
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    if (response && response.text) {
      const cleanJson = response.text.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanJson);
      if (parsed.rank && parsed.aiSummary) {
        evaluationResult = {
          ...evaluationResult,
          ...parsed,
          recommendedCoupon: {
            ...evaluationResult.recommendedCoupon,
            ...(parsed.recommendedCoupon || {})
          }
        };
      }
    }
  } catch (err) {
    console.error("Gemini AI Customer Rank fallback used:", err.message);
  }
  
  // Set as Pending Admin Approval
  customer.pendingRank = evaluationResult.rank;
  customer.pendingRankScore = evaluationResult.rankScore;
  customer.pendingActivityStatus = evaluationResult.activityStatus;
  customer.pendingAiSummary = evaluationResult.aiSummary;
  customer.pendingRewardCoupon = evaluationResult.recommendedCoupon;
  customer.aiEvaluationStatus = "Pending Approval";
  customer.lastActiveAt = lastOrderDate;
  
  await customer.save();

  return { customer, metrics, evaluationResult };
};

const evaluateCustomerRank = async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, status: 400, message: "Customer ID is required" });
    }
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, status: 404, message: "Customer not found" });
    }

    const { metrics, evaluationResult } = await evaluateSingleCustomerAi(customer);
    const updatedCustomer = await CustomerModel.findById(customerId).populate("assignedCoupons");

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Customer AI evaluation completed! Assigned Rank: ${evaluationResult.rank}`,
      data: updatedCustomer,
      metrics,
      evaluationResult
    });
  } catch (err) {
    console.error("Error in evaluateCustomerRank:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const evaluateAllCustomersRank = async (req, res) => {
  try {
    const customers = await CustomerModel.find({ status: true });
    let evaluatedCount = 0;
    const results = [];

    for (const cust of customers) {
      try {
        const resObj = await evaluateSingleCustomerAi(cust);
        results.push(resObj);
        evaluatedCount++;
      } catch (e) {
        console.error("Error evaluating customer:", cust._id, e);
      }
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Successfully AI evaluated ${evaluatedCount} customer(s)!`,
      evaluatedCount,
      data: results
    });
  } catch (err) {
    console.error("Error in evaluateAllCustomersRank:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const evaluateVendorActivity = async (req, res) => {
  try {
    const { vendorId } = req.body;
    if (!vendorId) {
      return res.status(400).json({ success: false, status: 400, message: "Vendor ID is required" });
    }

    const vendor = await VendorModel.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
    }

    const products = await ProductModel.find({ addedById: vendor.userId, status: true });
    const productCount = products.length;
    let lastProductDate = vendor.created_at || new Date();
    products.forEach(p => {
      if (p.created_at && new Date(p.created_at) > new Date(lastProductDate)) {
        lastProductDate = p.created_at;
      }
    });

    const daysSinceLastProduct = Math.max(0, Math.floor((Date.now() - new Date(lastProductDate).getTime()) / (1000 * 60 * 60 * 24)));
    
    let activityStatus = "Dormant";
    let activityScore = 40;
    if (daysSinceLastProduct <= 14 || productCount >= 5) {
      activityStatus = "Highly Active";
      activityScore = 90;
    } else if (daysSinceLastProduct <= 60 || productCount >= 1) {
      activityStatus = "Moderately Active";
      activityScore = 65;
    }

    let aiActivitySummary = `Vendor has ${productCount} active product listing(s). Last active listing update was ${daysSinceLastProduct} day(s) ago. Evaluated as ${activityStatus}.`;

    try {
      const prompt = `Evaluate e-commerce vendor activity status.
Business Name: ${vendor.businessName}
Owner: ${vendor.ownerName}
Active Products Count: ${productCount}
Days Since Last Product Activity: ${daysSinceLastProduct} days

Determine:
1. ActivityStatus: ["Highly Active", "Moderately Active", "Dormant"]
2. ActivityScore: 0 to 100
3. AI Summary: 1-2 sentences concise analysis.

Return JSON ONLY:
{
  "activityStatus": "Highly Active",
  "activityScore": 90,
  "aiActivitySummary": "..."
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      if (response && response.text) {
        const cleanJson = response.text.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed.activityStatus && parsed.aiActivitySummary) {
          activityStatus = parsed.activityStatus;
          activityScore = parsed.activityScore || activityScore;
          aiActivitySummary = parsed.aiActivitySummary;
        }
      }
    } catch (e) {
      console.error("Gemini AI Vendor Activity fallback used:", e.message);
    }

    vendor.activityStatus = activityStatus;
    vendor.activityScore = activityScore;
    vendor.lastActiveAt = lastProductDate;
    vendor.aiActivitySummary = aiActivitySummary;

    await vendor.save();

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Vendor AI activity evaluation completed: ${activityStatus}`,
      data: vendor
    });
  } catch (err) {
    console.error("Error in evaluateVendorActivity:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
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
  evaluateCustomerRank,
  evaluateAllCustomersRank,
  evaluateVendorActivity
};


