const queryModel = require("./QueryModel");
const customerModel = require("../customer/CustomerModel");
const { uploadImg } = require("../../../utilities/helper");

// Add customer query to MongoDB
const addQuery = async (req, res) => {
  try {
    const { userId, subject, description, name, email } = req.body;

    if (!subject || !description) {
      return res.json({
        status: 400,
        success: false,
        message: "Subject and Description are required",
      });
    }

    let customer = null;
    if (userId) {
      customer = await customerModel.findOne({ userId: userId });
    }

    const totalCount = await queryModel.countDocuments();
    const queryId = `QRY-${1000 + totalCount + 1}`;

    let evidenceFileUrl = "";
    if (req.file) {
      evidenceFileUrl = await uploadImg(req.file.buffer);
    }

    const customerName = name || (customer ? customer.name : "Customer");
    const customerEmail = email || (customer ? customer.email : "");

    const newQuery = new queryModel({
      queryId,
      userId: userId || null,
      customerId: customer ? customer._id : null,
      name: customerName,
      email: customerEmail,
      subject,
      description,
      evidenceFile: evidenceFileUrl,
      replies: [
        {
          sender: "Customer",
          senderName: customerName,
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
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message,
    });
  }
};

// Get queries for logged in customer from MongoDB (Latest first)
const getCustomerQueries = async (req, res) => {
  try {
    const { userId } = req.body;
    let filter = {};

    if (userId) {
      const customer = await customerModel.findOne({ userId: userId });
      if (customer) {
        filter = { $or: [{ userId: userId }, { customerId: customer._id }] };
      } else {
        filter = { userId: userId };
      }
    }

    const queries = await queryModel.find(filter).sort({ createdAt: -1 });

    return res.json({
      status: 200,
      success: true,
      message: "Queries loaded successfully from database",
      data: queries,
    });
  } catch (err) {
    console.error("Error loading customer queries:", err);
    return res.json({
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
