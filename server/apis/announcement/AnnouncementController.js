const Announcement = require("./AnnouncementModel");

// Admin creates and broadcasts an announcement
const addAnnouncement = async (req, res) => {
  try {
    const { title, message, targetAudience, priority } = req.body;

    if (!title || !message || !targetAudience) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Title, message, and targetAudience are required",
      });
    }

    if (!["Customers", "Vendors", "Both"].includes(targetAudience)) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "targetAudience must be 'Customers', 'Vendors', or 'Both'",
      });
    }

    const newAnnouncement = new Announcement({
      title,
      message,
      targetAudience,
      priority: priority || "Normal",
      createdBy: "Admin",
      createdAt: Date.now(),
    });

    const saved = await newAnnouncement.save();

    // Broadcast via socket IO
    const io = req.app.get("io");
    if (io) {
      io.emit("new_announcement", saved);
      io.emit("new_notification", {
        title: `📢 ${title}`,
        message: message,
        targetAudience: targetAudience,
        announcementId: saved._id,
      });
    }

    return res.status(201).json({
      success: true,
      status: 201,
      message: `Announcement broadcasted to ${targetAudience} successfully!`,
      data: saved,
    });
  } catch (err) {
    console.error("Error creating announcement:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Internal server error creating announcement",
    });
  }
};

// Admin gets all announcements
const getAllAnnouncements = async (req, res) => {
  try {
    const list = await Announcement.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      status: 200,
      data: list,
    });
  } catch (err) {
    console.error("Error fetching all announcements:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Error fetching announcements",
    });
  }
};

// Admin deletes an announcement
const deleteAnnouncement = async (req, res) => {
  try {
    const { _id } = req.body;
    if (!_id) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "Announcement ID (_id) is required",
      });
    }

    await Announcement.findByIdAndDelete(_id);
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Announcement deleted successfully!",
    });
  } catch (err) {
    console.error("Error deleting announcement:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Error deleting announcement",
    });
  }
};

// Fetch announcements targeted to a specific audience (Customers or Vendors)
const getUserAnnouncements = async (req, res) => {
  try {
    const { targetAudience } = req.body; // "Customers" or "Vendors"
    let filter = {};

    if (targetAudience) {
      filter = { targetAudience: { $in: [targetAudience, "Both"] } };
    }

    const list = await Announcement.find(filter).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      status: 200,
      data: list,
    });
  } catch (err) {
    console.error("Error fetching user announcements:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Error fetching announcements",
    });
  }
};

module.exports = {
  addAnnouncement,
  getAllAnnouncements,
  deleteAnnouncement,
  getUserAnnouncements,
};
