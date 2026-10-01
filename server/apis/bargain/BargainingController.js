const BargainingService = require("./BargainingService");
const NegotiationModel = require("./NegotiationModel");
const ProductModel = require("../product/ProductModel");
const userModel = require("../user/userModel");
const VendorModel = require("../vendor/VendorModel");
const CustomerModel = require("../customer/CustomerModel");

const start = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { productId, quantity } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Please log in to negotiate prices."
      });
    }

    if (!productId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "productId is required"
      });
    }

    const session = await BargainingService.startBargainingSession({
      userId,
      productId,
      quantity: Number(quantity) || 1
    });

    return res.status(200).json({
      success: true,
      status: 200,
      data: session
    });
  } catch (err) {
    console.error("Bargain start error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const submitOffer = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { sessionId, offeredPrice, customerMessage } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Please log in to continue."
      });
    }

    if (!sessionId || !offeredPrice) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "sessionId and offeredPrice are required"
      });
    }

    const result = await BargainingService.processOffer({
      sessionId,
      userId,
      offeredPrice: Number(offeredPrice),
      customerMessage
    });

    return res.status(200).json({
      success: true,
      status: 200,
      data: result
    });
  } catch (err) {
    console.error("Bargain submitOffer error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const accept = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { sessionId } = req.body;

    if (!userId || !sessionId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "sessionId is required"
      });
    }

    const result = await BargainingService.acceptCounterOffer({
      sessionId,
      userId
    });

    return res.status(200).json({
      success: true,
      status: 200,
      data: result
    });
  } catch (err) {
    console.error("Bargain accept error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const getVendorNegotiations = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    if (!vendorId) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: "Vendor authentication required"
      });
    }

    // 1. Get all products owned by this vendor
    const vendorProducts = await ProductModel.find({ vendorId }, "_id");
    const productIds = vendorProducts.map((p) => p._id);

    // 2. Query negotiations matching this vendorId directly OR any of vendor's products
    const negotiations = await NegotiationModel.find({
      $or: [
        { vendorId: vendorId },
        { productId: { $in: productIds } }
      ]
    })
      .populate("productId", "name price image stock sku")
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      status: 200,
      data: negotiations
    });
  } catch (err) {
    console.error("getVendorNegotiations error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const checkActiveDeal = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { productId } = req.body;

    if (!userId || !productId) {
      return res.status(200).json({
        success: true,
        hasActiveDeal: false
      });
    }

    // Find active accepted negotiation that has NOT been purchased yet and hasn't expired
    const activeDeal = await NegotiationModel.findOne({
      userId,
      productId,
      status: "deal_accepted",
      isPurchased: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    if (!activeDeal) {
      return res.status(200).json({
        success: true,
        hasActiveDeal: false
      });
    }

    return res.status(200).json({
      success: true,
      hasActiveDeal: true,
      deal: {
        sessionId: activeDeal._id,
        negotiatedPrice: activeDeal.finalAgreedPrice,
        originalPrice: activeDeal.originalPrice,
        quantity: activeDeal.quantity,
        dealCouponCode: activeDeal.dealCouponCode,
        expiresAt: activeDeal.expiresAt
      }
    });
  } catch (err) {
    console.error("checkActiveDeal error:", err);
    return res.status(500).json({
      success: false,
      hasActiveDeal: false,
      message: err.message
    });
  }
};

const getAllNegotiationsForAdmin = async (req, res) => {
  try {
    const negotiations = await NegotiationModel.find({})
      .populate("productId", "name price image stock sku vendorId")
      .populate("userId", "name email")
      .populate("vendorId", "name email")
      .sort({ createdAt: -1 })
      .limit(200);

    return res.status(200).json({
      success: true,
      status: 200,
      data: negotiations
    });
  } catch (err) {
    console.error("getAllNegotiationsForAdmin error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const deleteNegotiation = async (req, res) => {
  try {
    const { negotiationId } = req.body;
    if (!negotiationId) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "negotiationId is required"
      });
    }

    const deleted = await NegotiationModel.findByIdAndDelete(negotiationId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        status: 404,
        message: "Bargaining record not found"
      });
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Bargaining record permanently deleted successfully"
    });
  } catch (err) {
    console.error("deleteNegotiation error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message || "Failed to delete bargaining record"
    });
  }
};

const vendorAuthorize = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    const { negotiationId, marginPercent, maxDiscountPercent, vendorNote } = req.body;

    if (!vendorId) {
      return res.status(401).json({ success: false, status: 401, message: "Vendor authentication required" });
    }
    if (!negotiationId) {
      return res.status(400).json({ success: false, status: 400, message: "negotiationId is required" });
    }

    const session = await BargainingService.vendorAuthorizeBargainSession({
      negotiationId,
      vendorId,
      marginPercent,
      maxDiscountPercent,
      vendorNote
    });

    // Real-time broadcast if socket available
    const io = req.app.get("io");
    if (io) {
      io.emit("bargain_updated", { sessionId: session._id, status: session.status });
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Bargaining authorized with ${maxDiscountPercent}% max discount.`,
      data: session
    });
  } catch (err) {
    console.error("vendorAuthorize error:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const vendorDecline = async (req, res) => {
  try {
    const vendorId = req.vendor?._id;
    const { negotiationId, reason } = req.body;

    if (!vendorId) {
      return res.status(401).json({ success: false, status: 401, message: "Vendor authentication required" });
    }
    if (!negotiationId) {
      return res.status(400).json({ success: false, status: 400, message: "negotiationId is required" });
    }

    const session = await BargainingService.vendorDeclineBargainSession({
      negotiationId,
      vendorId,
      reason
    });

    const io = req.app.get("io");
    if (io) {
      io.emit("bargain_updated", { sessionId: session._id, status: session.status });
    }

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Bargaining request declined",
      data: session
    });
  } catch (err) {
    console.error("vendorDecline error:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const sessionStatus = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ success: false, status: 400, message: "sessionId is required" });
    }

    const session = await BargainingService.getSessionStatus({ sessionId, userId });
    return res.status(200).json({ success: true, status: 200, data: session });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

module.exports = {
  start,
  submitOffer,
  accept,
  getVendorNegotiations,
  checkActiveDeal,
  getAllNegotiationsForAdmin,
  deleteNegotiation,
  vendorAuthorize,
  vendorDecline,
  sessionStatus
};
