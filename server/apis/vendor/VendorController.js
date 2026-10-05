const VendorModel = require("./VendorModel");
const userModel = require("../user/userModel");
const ProductModel = require("../product/ProductModel");
const OrderModel = require("../order/OrderModel");
const ReviewModel = require("../review/ReviewModel");
const CouponModel = require("../coupons/CouponsModel");
const NotificationModel = require("../notification/NotificationModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const skey = "SecreteKey";

module.exports = {
    registerVendor,
    getVendorProfile,
    updateVendorProfile,
    getDashboardStats,
    getWalletDetails,
    requestPayout,

    // Admin features
    getAllVendors,
    approveVendor,
    rejectVendor,
    toggleBlockVendor,
    allotRank,
    revokeRank,
    checkRankReward,
    dismissRewardPopup,
    getAllSettlements,
    updateSettlementStatus,

    // Predictive Stock Intelligence
    getStockIntelligence,
    getProductStockForecast
};

// 1. Vendor Public Registration
async function registerVendor(req, res) {
    try {
        const {
            businessName, ownerName, email, password, phone,
            gstNumber, panNumber, address, bankDetails,
            logo, banner, description, returnPolicy, socialLinks
        } = req.body;

        if (!businessName || !ownerName || !email || !password) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Business Name, Owner Name, Email and Password are required."
            });
        }

        // Check if user already exists
        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Email is already registered. Please login or use another email."
            });
        }

        // Hash password and create User entry with usertype = "3"
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new userModel({
            name: ownerName,
            email: email,
            password: hashedPassword,
            usertype: "3",
            isBlocked: false
        });

        const savedUser = await newUser.save();

        // Parse bank details and social links if passed as strings
        let parsedBank = bankDetails;
        if (typeof bankDetails === 'string') {
            try { parsedBank = JSON.parse(bankDetails); } catch (e) { parsedBank = {}; }
        }
        let parsedSocial = socialLinks;
        if (typeof socialLinks === 'string') {
            try { parsedSocial = JSON.parse(socialLinks); } catch (e) { parsedSocial = {}; }
        }

        const newVendor = new VendorModel({
            userId: savedUser._id,
            businessName,
            ownerName,
            email,
            phone: phone || "",
            gstNumber: gstNumber || "",
            panNumber: panNumber || "",
            address: address || "",
            bankDetails: parsedBank || {},
            logo: logo || "",
            banner: banner || "",
            description: description || "",
            returnPolicy: returnPolicy || "Standard 7-day return policy applies.",
            socialLinks: parsedSocial || {},
            status: "Pending" // Requires admin approval
        });

        await newVendor.save();

        return res.status(201).json({
            success: true,
            status: 201,
            message: "Vendor registration submitted successfully! Your account is pending Admin approval."
        });
    } catch (err) {
        console.error("registerVendor error:", err);
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message || "Registration failed"
        });
    }
}

// 2. Get Logged-in Vendor Profile
async function getVendorProfile(req, res) {
    try {
        const vendor = req.vendor;
        return res.status(200).json({
            success: true,
            status: 200,
            data: vendor
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
}

// 3. Update Vendor Store Settings & Profile
async function updateVendorProfile(req, res) {
    try {
        const vendorId = req.vendor._id;
        const updates = req.body;

        if (updates.bankDetails && typeof updates.bankDetails === 'string') {
            try { updates.bankDetails = JSON.parse(updates.bankDetails); } catch (e) { }
        }
        if (updates.socialLinks && typeof updates.socialLinks === 'string') {
            try { updates.socialLinks = JSON.parse(updates.socialLinks); } catch (e) { }
        }

        const updatedVendor = await VendorModel.findByIdAndUpdate(
            vendorId,
            { $set: updates },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Store settings updated successfully",
            data: updatedVendor
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
}

// 4. Vendor Dashboard Analytics (Revenue, Orders, Products, Chart.js)
async function getDashboardStats(req, res) {
    try {
        const vendorId = req.vendor._id;

        // Fetch products by this vendor
        const products = await ProductModel.find({ vendorId: vendorId });
        const productIds = products.map(p => p._id);

        // Low stock threshold <= 5
        const lowStockProducts = products.filter(p => (p.stock || 0) <= 5);

        // Fetch orders containing products by this vendor
        // Fetch orders containing products by this vendor
        const orders = await OrderModel.find({
            $or: [
                { "products.vendorId": vendorId },
                { "products.productId": { $in: productIds } }
            ]
        }).populate("products.productId");

        let totalRevenue = 0;
        let totalOrdersCount = 0;
        let pendingOrdersCount = 0;
        let completedOrdersCount = 0;

        // Monthly sales tracking (12 months array for Chart.js)
        const monthlySales = Array(12).fill(0);
        const currentYear = new Date().getFullYear();

        orders.forEach(order => {
            let isVendorOrder = false;
            let vendorOrderTotal = 0;
            let isPending = false;
            let isCompleted = false;

            const orderStatusLower = (order.orderStatus || "").toLowerCase();

            order.products.forEach(item => {
                const itemVendorId = (item.vendorId || item.productId?.vendorId || "").toString();
                if (itemVendorId === vendorId.toString()) {
                    isVendorOrder = true;
                    const rawPrice = (item.price && Number(item.price) > 0) ? item.price : (item.productId?.price || 0);
                    const itemPrice = Number(rawPrice);
                    const subtotal = itemPrice * (item.quantity || 1);
                    vendorOrderTotal += subtotal;

                    const itemStatusLower = (item.itemStatus || "").toLowerCase();
                    if (itemStatusLower === 'delivered' || orderStatusLower === 'delivered') {
                        isCompleted = true;
                    } else if (['pending', 'accepted', 'packed', 'shipped', 'placed'].includes(itemStatusLower || orderStatusLower)) {
                        isPending = true;
                    }
                }
            });

            if (isVendorOrder) {
                totalOrdersCount++;
                if (isCompleted) {
                    completedOrdersCount++;
                    totalRevenue += vendorOrderTotal;
                    const orderDate = new Date(order.createdAt);
                    if (orderDate.getFullYear() === currentYear) {
                        const monthIndex = orderDate.getMonth(); // 0 to 11
                        monthlySales[monthIndex] += vendorOrderTotal;
                    }
                } else if (isPending) {
                    pendingOrdersCount++;
                }
            }
        });

        // Customer ratings for vendor products
        const reviews = await ReviewModel.find({ productId: { $in: productIds } });
        let avgRating = 0;
        let ratingBreakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => {
                const rat = Math.round(r.rating || 0);
                if (ratingBreakdown[rat] !== undefined) ratingBreakdown[rat]++;
                return acc + (r.rating || 0);
            }, 0);
            avgRating = (sum / reviews.length).toFixed(1);
        }

        return res.status(200).json({
            success: true,
            status: 200,
            data: {
                totalRevenue,
                totalOrders: totalOrdersCount,
                totalProducts: products.length,
                pendingOrders: pendingOrdersCount,
                completedOrders: completedOrdersCount,
                lowStockCount: lowStockProducts.length,
                lowStockProducts: lowStockProducts.map(p => ({
                    _id: p._id,
                    name: p.name,
                    stock: p.stock,
                    sku: p.sku
                })),
                averageRating: Number(avgRating),
                totalReviews: reviews.length,
                ratingBreakdown,
                monthlySalesChart: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    data: monthlySales
                }
            }
        });
    } catch (err) {
        console.error("getDashboardStats error:", err);
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
}

// 5. Vendor Wallet & Settlements
async function getWalletDetails(req, res) {
    try {
        const vendorId = req.vendor._id;
        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor profile not found" });
        }

        // Fetch products by this vendor
        const products = await ProductModel.find({ vendorId: vendorId });
        const productIds = products.map(p => p._id);

        // Fetch non-deleted orders containing products by this vendor
        const orders = await OrderModel.find({
            $or: [
                { "products.vendorId": vendorId },
                { "products.productId": { $in: productIds } }
            ],
            isDeleted: false
        })
            .populate("customerId", "name email")
            .populate("products.productId")
            .sort({ createdAt: -1 });

        let totalOrderEarnings = 0;
        const orderHistory = [];

        orders.forEach(order => {
            const orderStatusLower = (order.orderStatus || "").toLowerCase();
            if (orderStatusLower === 'cancelled') return;

            let vendorOrderTotal = 0;
            let hasVendorProducts = false;
            let isItemDelivered = false;

            order.products.forEach(item => {
                const itemVendorId = (item.vendorId || item.productId?.vendorId || "").toString();
                if (itemVendorId === vendorId.toString()) {
                    hasVendorProducts = true;
                    const rawPrice = (item.price && Number(item.price) > 0) ? item.price : (item.productId?.price || 0);
                    const itemPrice = Number(rawPrice);
                    vendorOrderTotal += itemPrice * (item.quantity || 1);

                    const itemStatusLower = (item.itemStatus || "").toLowerCase();
                    if (itemStatusLower === 'delivered' || orderStatusLower === 'delivered') {
                        isItemDelivered = true;
                    }
                }
            });

            if (hasVendorProducts && vendorOrderTotal > 0) {
                if (isItemDelivered) {
                    totalOrderEarnings += vendorOrderTotal;
                }
                const custName = order.customerId?.name || "Customer";
                orderHistory.push({
                    _id: order._id,
                    amount: vendorOrderTotal,
                    type: 'credit',
                    description: `Order #${order.autoId || order._id.toString().slice(-6)} Sale (${custName})`,
                    status: isItemDelivered ? 'completed' : 'pending',
                    createdAt: order.createdAt || new Date()
                });
            }
        });

        // Calculate payout request totals (debits) from vendor.wallet.history
        const existingHistory = vendor.wallet?.history || [];
        let pendingSettlements = 0;
        let completedSettlements = 0;

        existingHistory.forEach(tx => {
            if (tx.type === 'debit') {
                if (tx.status === 'pending') {
                    pendingSettlements += Number(tx.amount || 0);
                } else if (tx.status === 'completed') {
                    completedSettlements += Number(tx.amount || 0);
                }
            }
        });

        const availableEarnings = Math.max(0, totalOrderEarnings - pendingSettlements - completedSettlements);

        // Combine order earnings (credits) and payout requests (debits)
        const combinedHistory = [
            ...orderHistory,
            ...existingHistory.map(tx => (tx.toObject ? tx.toObject() : tx))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({
            success: true,
            status: 200,
            data: {
                earnings: availableEarnings,
                pendingSettlements: pendingSettlements,
                completedSettlements: completedSettlements,
                history: combinedHistory
            }
        });
    } catch (err) {
        console.error("getWalletDetails error:", err);
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function requestPayout(req, res) {
    try {
        const vendorId = req.vendor._id;
        const { amount, description } = req.body;
        const vendor = await VendorModel.findById(vendorId);

        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor profile not found" });
        }

        const payoutAmt = Number(amount);
        if (!payoutAmt || payoutAmt <= 0) {
            return res.status(400).json({ success: false, status: 400, message: "Valid withdrawal amount is required" });
        }

        // Calculate actual available earnings balance
        const products = await ProductModel.find({ vendorId: vendorId });
        const productIds = products.map(p => p._id);
        const orders = await OrderModel.find({
            "products.productId": { $in: productIds },
            isDeleted: false
        }).populate("products.productId");

        let totalOrderEarnings = 0;
        orders.forEach(order => {
            if ((order.orderStatus || "").toLowerCase() === 'cancelled') return;
            order.products.forEach(item => {
                if (
                    item.productId &&
                    item.productId.vendorId &&
                    item.productId.vendorId.toString() === vendorId.toString()
                ) {
                    const itemPrice = Number(item.price || item.productId.price || 0);
                    totalOrderEarnings += itemPrice * (item.quantity || 1);
                }
            });
        });

        const existingHistory = vendor.wallet?.history || [];
        let pendingSettlements = 0;
        let completedSettlements = 0;

        existingHistory.forEach(tx => {
            if (tx.type === 'debit') {
                if (tx.status === 'pending') {
                    pendingSettlements += Number(tx.amount || 0);
                } else if (tx.status === 'completed') {
                    completedSettlements += Number(tx.amount || 0);
                }
            }
        });

        const baseEarnings = Math.max(totalOrderEarnings, vendor.wallet?.earnings || 0);
        const availableEarnings = Math.max(0, baseEarnings - pendingSettlements - completedSettlements);

        if (payoutAmt > availableEarnings) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: `Insufficient earnings balance. Maximum available for payout: ₹${availableEarnings.toLocaleString()}`
            });
        }

        if (!vendor.wallet) {
            vendor.wallet = { earnings: 0, pendingSettlements: 0, completedSettlements: 0, history: [] };
        }

        vendor.wallet.pendingSettlements = pendingSettlements + payoutAmt;
        vendor.wallet.history.unshift({
            amount: payoutAmt,
            type: 'debit',
            description: description || 'Payout request to bank account',
            status: 'pending',
            createdAt: new Date()
        });

        await vendor.save();

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Payout request submitted successfully!",
            data: {
                earnings: availableEarnings - payoutAmt,
                pendingSettlements: pendingSettlements + payoutAmt,
                completedSettlements: completedSettlements,
                history: vendor.wallet.history
            }
        });
    } catch (err) {
        console.error("requestPayout error:", err);
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

// 6. Admin Features: Vendor Management
async function getAllVendors(req, res) {
    try {
        const vendors = await VendorModel.find().populate('userId', 'name email usertype isBlocked').sort({ created_at: -1 });
        return res.status(200).json({
            success: true,
            status: 200,
            data: vendors
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function approveVendor(req, res) {
    try {
        const { vendorId } = req.body;
        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
        }
        vendor.status = 'Approved';
        await vendor.save();

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Vendor approved successfully!",
            data: vendor
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function rejectVendor(req, res) {
    try {
        const { vendorId } = req.body;
        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
        }
        vendor.status = 'Rejected';
        await vendor.save();

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Vendor registration rejected.",
            data: vendor
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function toggleBlockVendor(req, res) {
    try {
        const { vendorId } = req.body;
        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
        }
        vendor.isBlocked = !vendor.isBlocked;
        if (vendor.isBlocked) {
            vendor.status = 'Blocked';
        } else {
            vendor.status = 'Approved';
        }
        await vendor.save();

        // Also update the underlying User block status
        if (vendor.userId) {
            await userModel.findByIdAndUpdate(vendor.userId, { isBlocked: vendor.isBlocked });
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: `Vendor has been ${vendor.isBlocked ? 'blocked' : 'unblocked'}.`,
            data: vendor
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function allotRank(req, res) {
    try {
        const { vendorId, rank, discount, discountType, minAmoutSpend, expiryDate, couponCode: customCode } = req.body;
        if (!vendorId) {
            return res.status(400).json({ success: false, status: 400, message: "Vendor ID is required" });
        }

        const numericRank = parseInt(rank, 10);
        if (isNaN(numericRank) || numericRank < 1) {
            return res.status(400).json({ success: false, status: 400, message: "Rank must be a valid positive number" });
        }

        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
        }

        // Check if another vendor already has this rank (especially Rank 1)
        const existingRankVendor = await VendorModel.findOne({ rank: numericRank, _id: { $ne: vendorId } });
        if (existingRankVendor) {
            const vName = existingRankVendor.businessName || existingRankVendor.ownerName || "another vendor";
            const msg = numericRank === 1
                ? `Rank 1 is already allotted to vendor "${vName}". Please revoke Rank 1 from "${vName}" first before allotting it to another vendor.`
                : `Rank #${numericRank} is already allotted to vendor "${vName}". Each rank must be unique.`;
            return res.status(400).json({ success: false, status: 400, message: msg });
        }

        vendor.rank = numericRank;
        vendor.rewardPopupShown = false;

        let generatedCoupon = null;
        // Automatically generate Reward Coupon if vendor is allotted Rank 1
        if (numericRank === 1) {
            const randomCode = Math.floor(100 + Math.random() * 900);
            const couponCode = customCode && customCode.trim() !== ""
                ? customCode.trim().toUpperCase()
                : `VENDOR-RANK1-${randomCode}`;

            let defaultExp = new Date();
            defaultExp.setDate(defaultExp.getDate() + 30);
            const defaultExpStr = defaultExp.toISOString().split('T')[0];

            const newCoupon = new CouponModel({
                code: couponCode,
                discount: discount ? String(discount) : "20",
                discountType: discountType || "Percentage",
                minAmoutSpend: minAmoutSpend ? Number(minAmoutSpend) : 0,
                expiryDate: expiryDate || defaultExpStr,
                vendorId: vendor._id,
                isReward: true,
                rewardType: "Vendor Rank 1 Special Reward",
                status: true
            });

            await newCoupon.save();
            vendor.latestRewardCoupon = couponCode;
            generatedCoupon = couponCode;
        }

        await vendor.save();

        // Create Notification for Vendor
        if (vendor.userId) {
            try {
                const recipientId = vendor.userId._id || vendor.userId;
                // Delete previous rank notifications first to keep notification list clean
                await NotificationModel.deleteMany({
                    recipientId: recipientId,
                    type: { $in: ['rank_allotment', 'rank_revocation'] }
                });

                const notifMsg = numericRank === 1
                    ? `🏆 Your store "${vendor.businessName}" has been allotted Rank #1! You received an exclusive Reward Coupon: '${generatedCoupon}'`
                    : `🏆 Admin has allotted Rank #${numericRank} to your store "${vendor.businessName}".`;

                await NotificationModel.create({
                    senderId: req.decoded ? req.decoded.userId : null,
                    recipientId: recipientId,
                    type: 'rank_allotment',
                    status: 'pending',
                    message: notifMsg
                });
            } catch (notifErr) {
                console.error("Error creating vendor rank notification:", notifErr);
            }
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: numericRank === 1
                ? `Rank 1 allotted to store "${vendor.businessName}"! Reward coupon '${generatedCoupon}' automatically generated.`
                : `Rank ${numericRank} allotted to store "${vendor.businessName}" successfully.`,
            data: vendor,
            rewardCoupon: generatedCoupon
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function revokeRank(req, res) {
    try {
        const { vendorId } = req.body;
        if (!vendorId) {
            return res.status(400).json({ success: false, status: 400, message: "Vendor ID is required" });
        }

        const vendor = await VendorModel.findById(vendorId);
        if (!vendor) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor not found" });
        }

        vendor.rank = null;
        vendor.rewardPopupShown = true;
        vendor.latestRewardCoupon = "";
        await vendor.save();
        await VendorModel.findByIdAndUpdate(vendorId, {
            $set: { rank: null, rewardPopupShown: true, latestRewardCoupon: "" }
        });

        // Delete any rank reward coupons associated with this vendor
        await CouponModel.deleteMany({ vendorId: vendor._id, isReward: true });

        // Auto-delete Rank Notifications from Vendor
        if (vendor.userId) {
            try {
                const recipientId = vendor.userId._id || vendor.userId;
                await NotificationModel.deleteMany({
                    recipientId: recipientId,
                    type: { $in: ['rank_allotment', 'rank_revocation'] }
                });
            } catch (notifErr) {
                console.error("Error autodeleting vendor rank notifications:", notifErr);
            }
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: `Rank revoked from store "${vendor.businessName || 'Vendor'}" successfully.`,
            data: vendor
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function checkRankReward(req, res) {
    try {
        const userId = req.body.userId || (req.decoded && req.decoded.userId);
        const email = req.decoded && req.decoded.email;

        let vendor = null;
        if (userId) {
            vendor = await VendorModel.findOne({ userId });
        }
        if (!vendor && email) {
            vendor = await VendorModel.findOne({ email });
        }

        if (!vendor) {
            return res.status(404).json({ status: 404, success: false, message: "Vendor not found" });
        }

        if (!vendor.rank || vendor.rewardPopupShown) {
            return res.status(200).json({ status: 200, success: false, message: "No active rank notification" });
        }

        let couponDetails = null;
        if (vendor.latestRewardCoupon) {
            couponDetails = await CouponModel.findOne({ code: vendor.latestRewardCoupon });
        }
        if (!couponDetails && vendor.rank === 1) {
            couponDetails = await CouponModel.findOne({ vendorId: vendor._id, isReward: true }).sort({ _id: -1 });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            rewardPopupShown: vendor.rewardPopupShown,
            rank: vendor.rank,
            businessName: vendor.businessName || "Vendor Store",
            ownerName: vendor.ownerName || "Vendor Owner",
            coupon: couponDetails ? {
                code: couponDetails.code,
                discount: couponDetails.discount,
                discountType: couponDetails.discountType,
                minAmoutSpend: couponDetails.minAmoutSpend,
                expiryDate: couponDetails.expiryDate
            } : null
        });
    } catch (err) {
        return res.status(500).json({ status: 500, success: false, message: err.message });
    }
}

async function dismissRewardPopup(req, res) {
    try {
        const userId = req.body.userId || (req.decoded && req.decoded.userId);
        const email = req.decoded && req.decoded.email;

        let vendor = null;
        if (userId) {
            vendor = await VendorModel.findOne({ userId });
        }
        if (!vendor && email) {
            vendor = await VendorModel.findOne({ email });
        }

        if (vendor) {
            vendor.rewardPopupShown = true;
            await vendor.save();
        }

        return res.status(200).json({ status: 200, success: true, message: "Vendor reward popup dismissed" });
    } catch (err) {
        return res.status(500).json({ status: 500, success: false, message: err.message });
    }
}

async function getAllSettlements(req, res) {
    try {
        const vendors = await VendorModel.find({ isDeleted: { $ne: true } });
        let allSettlements = [];

        vendors.forEach(vendor => {
            const history = vendor.wallet?.history || [];
            history.forEach((tx, index) => {
                if (tx.type === 'debit') {
                    allSettlements.push({
                        _id: tx._id || `${vendor._id}_${index}`,
                        txIndex: index,
                        vendorId: vendor._id,
                        businessName: vendor.businessName || "Vendor Store",
                        ownerName: vendor.ownerName || "Vendor",
                        email: vendor.email || "",
                        phone: vendor.phone || "",
                        bankAccountNo: vendor.bankDetails?.accountNo || vendor.bankDetails?.accountNumber || vendor.bankAccountNo || "N/A",
                        bankIfsc: vendor.bankDetails?.ifsc || vendor.bankDetails?.ifscCode || vendor.bankIfsc || "N/A",
                        bankName: vendor.bankDetails?.bankName || vendor.bankName || "N/A",
                        amount: tx.amount,
                        description: tx.description,
                        status: tx.status || 'pending',
                        createdAt: tx.createdAt || new Date(),
                        remarks: tx.remarks || ""
                    });
                }
            });
        });

        allSettlements.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return res.status(200).json({
            success: true,
            status: 200,
            data: allSettlements
        });
    } catch (err) {
        console.error("getAllSettlements error:", err);
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function updateSettlementStatus(req, res) {
    try {
        const { vendorId, txIndex, txId, status, remarks } = req.body;
        if (!vendorId || !status || (!['completed', 'rejected', 'cancelled'].includes(status))) {
            return res.status(400).json({ success: false, status: 400, message: "Valid vendorId and target status (completed/rejected) are required" });
        }

        const vendor = await VendorModel.findById(vendorId);
        if (!vendor || !vendor.wallet || !vendor.wallet.history) {
            return res.status(404).json({ success: false, status: 404, message: "Vendor or wallet transaction history not found" });
        }

        let targetTx = null;
        if (typeof txIndex === 'number' && vendor.wallet.history[txIndex]) {
            targetTx = vendor.wallet.history[txIndex];
        } else if (txId) {
            targetTx = vendor.wallet.history.find(tx => tx._id && tx._id.toString() === txId.toString());
        }

        if (!targetTx) {
            return res.status(404).json({ success: false, status: 404, message: "Settlement transaction record not found" });
        }

        const oldStatus = targetTx.status;
        targetTx.status = status;
        if (remarks) {
            targetTx.remarks = remarks;
        }

        let pending = 0;
        let completed = 0;
        vendor.wallet.history.forEach(tx => {
            if (tx.type === 'debit') {
                if (tx.status === 'pending') {
                    pending += Number(tx.amount || 0);
                } else if (tx.status === 'completed') {
                    completed += Number(tx.amount || 0);
                }
            }
        });

        vendor.wallet.pendingSettlements = pending;
        vendor.wallet.completedSettlements = completed;

        await vendor.save();

        return res.status(200).json({
            success: true,
            status: 200,
            message: `Settlement payout status updated from '${oldStatus}' to '${status}' successfully!`,
            data: vendor.wallet
        });
    } catch (err) {
        console.error("updateSettlementStatus error:", err);
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

const InventoryIntelligenceService = require("./InventoryIntelligenceService");

// 11. Vendor Predictive Stock-Out Intelligence
async function getStockIntelligence(req, res) {
    try {
        const vendorId = req.vendor._id;
        const result = await InventoryIntelligenceService.getVendorStockIntelligence(vendorId);

        return res.status(200).json({
            success: true,
            status: 200,
            data: result
        });
    } catch (err) {
        console.error("getStockIntelligence error:", err);
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
}

async function getProductStockForecast(req, res) {
    try {
        const vendorId = req.vendor._id;
        const productId = req.body?.productId || req.body?._id;

        if (!productId) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "productId is required"
            });
        }

        const forecast = await InventoryIntelligenceService.getSingleProductForecast(vendorId, productId);

        return res.status(200).json({
            success: true,
            status: 200,
            data: forecast
        });
    } catch (err) {
        console.error("getProductStockForecast error:", err);
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
}

