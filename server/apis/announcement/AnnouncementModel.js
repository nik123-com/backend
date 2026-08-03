const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  targetAudience: {
    type: String,
    enum: ["Customers", "Vendors", "Both"],
    required: true,
  },
  priority: {
    type: String,
    enum: ["Normal", "Important", "Urgent"],
    default: "Normal",
  },
  createdBy: {
    type: String,
    default: "Admin",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("announcement", announcementSchema);
