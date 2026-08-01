const mongoose = require("mongoose");
const queryModel = require("./QueryModel");
const customerModel = require("../customer/CustomerModel");
const vendorModel = require("../vendor/VendorModel");
const { uploadImg } = require("../../../utilities/helper");

// Add query (Customer or Vendor) to MongoDB
const addQuery = async (req, res) => {
  try {
    const { userId, subject, description, name, email, userType } = req.body;

    if (!subject || !description) {
      return res.json({
        status: 400,
        success: false,
        message: "Subject and Description are required",
      });
    }

    let customer = null;
    let vendor = req.vendor || null;
    let resolvedUserType = userType || (vendor ? "Vendor" : "Customer");

    const validUserId = (userId && mongoose.Types.ObjectId.isValid(userId)) 
      ? userId 
      : (req.decoded && mongoose.Types.ObjectId.isValid(req.decoded.userId) ? req.decoded.userId : null);

    if (validUserId) {
      if (!vendor) {
        vendor = await vendorModel.findOne({ userId: validUserId });
      }
      if (vendor) {
        resolvedUserType = "Vendor";
      } else {
        customer = await customerModel.findOne({ userId: validUserId });
      }
    }

    let totalCount = await queryModel.countDocuments();
    let nextNum = 1000 + totalCount + 1;
    let queryId = `QRY-${nextNum}`;
    while (await queryModel.exists({ queryId })) {
      nextNum++;
      queryId = `QRY-${nextNum}`;
    }

    let evidenceFileUrl = "";
    if (req.file) {
      try {
        evidenceFileUrl = await uploadImg(req.file.buffer);
      } catch (fileErr) {
        console.error("Cloudinary upload error during query submission:", fileErr);
      }
    }

    const senderName = name || (resolvedUserType === "Vendor" ? (vendor ? vendor.businessName : "Vendor") : (customer ? customer.name : "Customer"));
    const senderEmail = email || (resolvedUserType === "Vendor" ? (vendor ? vendor.email : "") : (customer ? customer.email : ""));

    const newQuery = new queryModel({
      queryId,
      userId: validUserId || null,
      customerId: customer ? customer._id : null,
      vendorId: vendor ? vendor._id : null,
      userType: resolvedUserType,
      name: senderName,
      email: senderEmail,
      subject,
      description,
      evidenceFile: evidenceFileUrl,
      replies: [
        {
          sender: "Customer",
          senderName: senderName,
          message: description,
          attachment: evidenceFileUrl,
          createdAt: Date.now(),
        },
      ],
      createdAt: Date.now(),
    });

    const saved = await newQuery.save();

    return res.json({
      status: 201,
      success: true,
      message: "Query stored in database successfully",
      data: saved,
    });
  } catch (err) {
    console.error("Error adding query:", err);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

// Get queries for logged in user (Customer or Vendor) from MongoDB (Latest first)
const getCustomerQueries = async (req, res) => {
  try {
    const rawUserId = req.body.userId || (req.decoded ? req.decoded.userId : null);
    const email = req.body.email;
    let filter = {};

    const orConditions = [];
    if (rawUserId && mongoose.Types.ObjectId.isValid(rawUserId)) {
      const customer = await customerModel.findOne({ userId: rawUserId });
      const vendor = req.vendor || (await vendorModel.findOne({ userId: rawUserId }));
      
      orConditions.push({ userId: rawUserId });
      if (customer) orConditions.push({ customerId: customer._id });
      if (vendor) orConditions.push({ vendorId: vendor._id });
    }
    if (email) {
      orConditions.push({ email: email });
    }

    if (orConditions.length > 0) {
      filter = { $or: orConditions };
    }

    const queries = await queryModel.find(filter).sort({ createdAt: -1 });

    return res.json({
      status: 200,
      success: true,
      message: "Queries loaded successfully from database",
      data: queries,
    });
  } catch (err) {
    console.error("Error loading queries:", err);
    return res.status(500).json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

// Get all queries for Admin from MongoDB (Latest first)
const getAllQueries = async (req, res) => {
  try {
    const queries = await queryModel.find({}).sort({ createdAt: -1 });

    return res.json({
      status: 200,
      success: true,
      message: "All queries loaded successfully from database",
      data: queries,
    });
  } catch (err) {
    console.error("Error loading all queries:", err);
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

// Admin Reply to Query - Store reply in MongoDB
const replyQuery = async (req, res) => {
  try {
    const { _id, adminReplyDescription, meetLink } = req.body;

    if (!_id) {
      return res.json({
        status: 400,
        success: false,
        message: "Query _id is required",
      });
    }

    const queryItem = await queryModel.findById(_id);
    if (!queryItem) {
      return res.json({
        status: 404,
        success: false,
        message: "Query not found in database",
      });
    }

    let adminDocUrl = queryItem.adminAttachment || "";
    if (req.file) {
      adminDocUrl = await uploadImg(req.file.buffer);
    }

    const now = Date.now();
    queryItem.adminReplyDescription = adminReplyDescription || queryItem.adminReplyDescription;
    queryItem.meetLink = meetLink || queryItem.meetLink;
    queryItem.adminAttachment = adminDocUrl;
    queryItem.adminReplyDate = now;
    queryItem.status = "Replied";

    // Store admin reply entry in replies array in database
    if (!queryItem.replies) queryItem.replies = [];
    queryItem.replies.push({
      sender: "Admin",
      senderName: "Admin Support",
      message: adminReplyDescription || "",
      meetLink: meetLink || "",
      attachment: adminDocUrl,
      createdAt: now,
    });

    const updated = await queryItem.save();

    return res.json({
      status: 200,
      success: true,
      message: "Admin reply stored in database successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error replying to query:", err);
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

// Customer Feedback on Admin Decision - Store feedback in MongoDB
const submitFeedback = async (req, res) => {
  try {
    const { _id, rating, ratingFeedback } = req.body;

    if (!_id) {
      return res.json({
        status: 400,
        success: false,
        message: "Query _id is required",
      });
    }

    const queryItem = await queryModel.findById(_id);
    if (!queryItem) {
      return res.json({
        status: 404,
        success: false,
        message: "Query not found in database",
      });
    }

    const now = Date.now();
    queryItem.rating = Number(rating) || queryItem.rating;
    queryItem.ratingFeedback = ratingFeedback || queryItem.ratingFeedback;
    queryItem.ratingDate = now;

    // Push feedback as message into replies array in database
    if (!queryItem.replies) queryItem.replies = [];
    queryItem.replies.push({
      sender: "Customer",
      senderName: queryItem.name || "Customer",
      message: `[Decision Feedback Rating: ${rating}/5 Stars] ${ratingFeedback || ""}`,
      createdAt: now,
    });

    const updated = await queryItem.save();

    return res.json({
      status: 200,
      success: true,
      message: "Feedback stored in database successfully",
      data: updated,
    });
  } catch (err) {
    console.error("Error submitting query feedback:", err);
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

module.exports = {
  addQuery,
  getCustomerQueries,
  getAllQueries,
  replyQuery,
  submitFeedback,
};
