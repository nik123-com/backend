const VendorModel = require("./VendorModel");
const userModel = require("../user/userModel");
const ProductModel = require("../product/ProductModel");
const OrderModel = require("../order/OrderModel");
const ReviewModel = require("../review/ReviewModel");
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
    toggleBlockVendor
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
            try { updates.bankDetails = JSON.parse(updates.bankDetails); } catch (e) {}
        }
        if (updates.socialLinks && typeof updates.socialLinks === 'string') {
            try { updates.socialLinks = JSON.parse(updates.socialLinks); } catch (e) {}
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
        const orders = await OrderModel.find({
            "products.productId": { $in: productIds }
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

            order.products.forEach(item => {
                if (item.productId && item.productId.vendorId && item.productId.vendorId.toString() === vendorId.toString()) {
                    isVendorOrder = true;
                    const itemPrice = Number(item.price || item.productId.price || 0);
                    const subtotal = itemPrice * item.quantity;
                    vendorOrderTotal += subtotal;

                    if (item.itemStatus === 'delivered' || order.orderStatus === 'delivered') {
                        isCompleted = true;
                    } else if (['pending', 'accepted', 'packed', 'shipped'].includes(item.itemStatus || order.orderStatus)) {
                        isPending = true;
                    }
                }
            });

            if (isVendorOrder) {
                totalOrdersCount++;
                totalRevenue += vendorOrderTotal;
                if (isCompleted) completedOrdersCount++;
                else if (isPending) pendingOrdersCount++;

                const orderDate = new Date(order.createdAt);
                if (orderDate.getFullYear() === currentYear) {
                    const monthIndex = orderDate.getMonth(); // 0 to 11
                    monthlySales[monthIndex] += vendorOrderTotal;
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
        const vendor = await VendorModel.findById(req.vendor._id);
        return res.status(200).json({
            success: true,
            status: 200,
            data: vendor.wallet || {
                earnings: 0,
                pendingSettlements: 0,
                completedSettlements: 0,
                history: []
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
}

async function requestPayout(req, res) {
    try {
        const { amount, description } = req.body;
        const vendor = await VendorModel.findById(req.vendor._id);

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, status: 400, message: "Valid amount is required" });
        }

        if (vendor.wallet.earnings < amount) {
            return res.status(400).json({ success: false, status: 400, message: "Insufficient earnings balance for payout." });
        }

        vendor.wallet.earnings -= amount;
        vendor.wallet.pendingSettlements += amount;
        vendor.wallet.history.unshift({
            amount: amount,
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
            data: vendor.wallet
        });
    } catch (err) {
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
