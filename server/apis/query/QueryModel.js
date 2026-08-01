const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  sender: { type: String, enum: ["Customer", "Admin", "Vendor"], required: true },
  senderName: { type: String, default: "" },
  message: { type: String, required: true },
  meetLink: { type: String, default: "" },
  attachment: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now }
});

const querySchema = new mongoose.Schema({
  queryId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "customer" },
  vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "vendor" },
  userType: { type: String, enum: ["Customer", "Vendor"], default: "Customer" },
  name: { type: String, default: "" },
  email: { type: String, default: "" },
  subject: { type: String, required: true },
  description: { type: String, required: true },
  evidenceFile: { type: String, default: "" },
  
  // Latest Admin Reply Summary
  adminReplyDescription: { type: String, default: "" },
  adminReplyDate: { type: Date },
  meetLink: { type: String, default: "" },
  adminAttachment: { type: String, default: "" },

  // Array storing all queries and replies history in MongoDB
  replies: [replySchema],

  status: { type: String, enum: ["Pending", "Replied", "Closed"], default: "Pending" },
  
  // Customer Rating / Feedback on Decision
  rating: { type: Number, default: 0 },
  ratingFeedback: { type: String, default: "" },
  ratingDate: { type: Date },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Query", querySchema);
