const CouponModel = require('../coupons/CouponsModel');
const NotificationModel = require('../notification/NotificationModel');
const VendorModel = require('../vendor/VendorModel');
const CustomerModel = require('../customer/CustomerModel');

// Auto Hard Delete Expired Coupons
const deleteExpiredCoupons = async () => {
    try {
        const coupons = await CouponModel.find({ expiryDate: { $ne: "", $exists: true } });
        const now = new Date();
        const expiredIds = [];

        for (const c of coupons) {
            if (!c.expiryDate) continue;
            let exp = new Date(c.expiryDate);
            if (isNaN(exp.getTime())) continue;

            // If expiryDate is YYYY-MM-DD (10 chars), set time to end of day 23:59:59.999
            if (/^\d{4}-\d{2}-\d{2}$/.test(c.expiryDate)) {
                exp.setHours(23, 59, 59, 999);
            }

            if (exp < now) {
                expiredIds.push(c._id);
            }
        }

        if (expiredIds.length > 0) {
            await CouponModel.deleteMany({ _id: { $in: expiredIds } });
            console.log(`[Auto Hard Delete] Deleted ${expiredIds.length} expired coupon(s).`);
        }
    } catch (err) {
        console.error("Error in deleteExpiredCoupons:", err);
    }
};

// Run cleanup on module initialization and every 10 minutes
deleteExpiredCoupons();
setInterval(deleteExpiredCoupons, 10 * 60 * 1000);

const generateUniqueCode = async (prefix = "SAVE") => {
    let unique = false;
    let code = "";
    let attempts = 0;
    while (!unique && attempts < 100) {
        attempts++;
        const randomNum = Math.floor(100 + Math.random() * 900);
        code = `${prefix}${randomNum}`;
        const existing = await CouponModel.findOne({ code });
        if (!existing) {
            unique = true;
        }
    }
    return code;
};

//Add
const add = async (req,res) => {
    try{
        const incomingData = req.body || {};
        let finalCode = incomingData.code && incomingData.code.trim() !== "" 
            ? incomingData.code.trim().toUpperCase() 
            : await generateUniqueCode("SAVE");

        const existingData = await CouponModel.findOne({code: finalCode});
        if(existingData){
            return res.json({
                status:400,
                success:false,
                message:"Coupon Code Already Exists"
            })
        }
        let coupon = new CouponModel();
        coupon.code = finalCode;
        coupon.discount = req.body.discount;
        coupon.discountType = req.body.discountType || "1";
        coupon.minAmoutSpend = req.body.minAmoutSpend || 0;
        coupon.expiryDate = req.body.expiryDate || "";
        if (req.body.vendorId) coupon.vendorId = req.body.vendorId;
        if (req.body.customerId) coupon.customerId = req.body.customerId;
        if (req.body.isReward) coupon.isReward = req.body.isReward;
        if (req.body.rewardType) coupon.rewardType = req.body.rewardType;

        await coupon.save();

        const discText = (coupon.discountType === "2" || coupon.discountType === "Percentage")
            ? `${coupon.discount}% OFF`
            : `₹${coupon.discount} OFF`;

        // Send notification to Vendor if granted specifically
        if (coupon.vendorId) {
            try {
                const vendor = await VendorModel.findById(coupon.vendorId);
                if (vendor && vendor.userId) {
                    const recipientId = vendor.userId._id || vendor.userId;
                    await NotificationModel.create({
                        senderId: req.decoded ? req.decoded.userId : null,
                        recipientId: recipientId,
                        type: 'rank_allotment',
                        status: 'pending',
                        message: `🎟️ Admin has granted your store "${vendor.businessName || 'Vendor'}" an exclusive coupon: '${coupon.code}' (${discText})!`
                    });
                }
            } catch (vNotifErr) {
                console.error("Error creating vendor coupon notification:", vNotifErr);
            }
        }

        // Send notification to Customer if granted specifically
        if (coupon.customerId) {
            try {
                const customer = await CustomerModel.findById(coupon.customerId);
                if (customer && customer.userId) {
                    const recipientId = customer.userId._id || customer.userId;
                    await NotificationModel.create({
                        senderId: req.decoded ? req.decoded.userId : null,
                        recipientId: recipientId,
                        type: 'rank_allotment',
                        status: 'pending',
                        message: `🎟️ Admin has granted you an exclusive discount coupon: '${coupon.code}' (${discText})!`
                    });
                }
            } catch (cNotifErr) {
                console.error("Error creating customer coupon notification:", cNotifErr);
            }
        }

        res.json({
            status:201,
            success:true,
            message: "Coupon Added Successfully",
            data:coupon
        })
    }catch(err){
        console.log(err);
        res.json({ status: 500, success: false, message: err.message });
    }
}
//All
const all = async(req,res) =>{
    try{
        await deleteExpiredCoupons();
        const allData = await CouponModel.find({})
            .populate('vendorId', 'businessName ownerName email')
            .populate('customerId', 'name email')
            .sort({ _id: -1 });
        const total = await CouponModel.countDocuments({});
        res.json({
            status:200,
            success:true,
            message:"Coupons Loaded Successfully",
            total:total,
            data: allData
        })
    }catch(err){
        console.log(err);
        res.json({
            status:500,
            success:false,
            message:"Internal server error"
        });
    }
}
//Single
const single = async (req,res)=>{
    try{
        await deleteExpiredCoupons();
        const Coupon_id = req.body?._id;
        if(!Coupon_id){
            res.json({
                status:400,
                success:false,
                message: "_id is Required"
            })
        } 
        const coupon = await CouponModel.findOne({_id:Coupon_id});
        if(!coupon){
            res.json({
                status:404,
                success:false,
                message:"Coupon Not Found"
            })
        }else{
            res.json({
                status:200,
                success:true,
                message: "Coupon Found Successfully",
                data : coupon
            })
        }
    }catch(err){
        console.log(err);
    }
}
//Update
const update = async(req,res)=>{
    try{
        const coupon_id = req.body?._id;
        const incomingData = req.body;

        if(!coupon_id){
            res.json({
                status:400,
                success:false,
                message:"_id is Required"
            })
        }

        const couponData = await CouponModel.findOne({_id:coupon_id})
        if(!couponData){
            res.json({
            status:404,
            success: false,
            message: "Coupon Not Found"
            })
        }else{
            if(incomingData.code){
                couponData.code = incomingData.code;
            }
            if(incomingData.discount){
                couponData.discount = incomingData.discount;
            }
            if(incomingData.discountType){
                couponData.discountType = incomingData.discountType;          
            }
            if(incomingData.minAmoutSpend){
                couponData.minAmoutSpend = incomingData.minAmoutSpend;
            }
            couponData.updateAt = Date.now()
            let updatedCoupon = await couponData.save();
        }

    }catch(err){
        console.log(err)
    }
}
//Hard Delete
const DeleteOne = async(req,res)=>{
    let errmsg = [];
    if(!req.body._id){
        errmsg.push("_id is Required");
    }
    if(errmsg.length>0){
        return res.json({
            status:400,
            message:errmsg,
            success:false
        });
    }else{
        try {
            const existCoupon = await CouponModel.findOne({_id:req.body._id});
            if(!existCoupon){
                return res.json({
                    status:404,
                    success:false,
                    message:"Coupon Not Found"
                });
            }

            // If coupon belongs to vendor, clear reward coupon and autodelete rank notifications
            if (existCoupon.vendorId) {
                const vendor = await VendorModel.findById(existCoupon.vendorId);
                if (vendor) {
                    if (vendor.latestRewardCoupon === existCoupon.code) {
                        vendor.latestRewardCoupon = "";
                        if (existCoupon.isReward) vendor.rank = null;
                        await vendor.save();
                    }
                    if (vendor.userId) {
                        const recipientId = vendor.userId._id || vendor.userId;
                        await NotificationModel.deleteMany({
                            recipientId: recipientId,
                            type: { $in: ['rank_allotment', 'rank_revocation'] }
                        });
                    }
                }
            }

            // If coupon belongs to customer, clear reward coupon and autodelete rank notifications
            if (existCoupon.customerId) {
                const customer = await CustomerModel.findById(existCoupon.customerId);
                if (customer) {
                    if (customer.latestRewardCoupon === existCoupon.code) {
                        customer.latestRewardCoupon = "";
                        if (existCoupon.isReward) customer.rank = null;
                        await customer.save();
                    }
                    if (customer.userId) {
                        const recipientId = customer.userId._id || customer.userId;
                        await NotificationModel.deleteMany({
                            recipientId: recipientId,
                            type: { $in: ['rank_allotment', 'rank_revocation'] }
                        });
                    }
                }
            }

            await CouponModel.deleteOne({_id:req.body._id});
            return res.json({
                status:200,
                success:true,
                message:"Coupon Deleted & Rank Notifications Cleared Successfully"
            });
        }catch(err){
            console.log(err);
            return res.json({
                status:500,
                success:false,
                message:"Internal server error"
            });
        }
    }
};

const softDelete = async (req, res) => {
    let ErrMsg = [];

    if (!req.body._id) {
        ErrMsg.push("_id is Required");
    }

    if (ErrMsg.length > 0) {
        return res.status(400).json({
            success: false,
            message: ErrMsg
        });
    }

    try {
        const existCoupon = await CouponModel.findOne({ _id: req.body._id });

        if (!existCoupon) {
            return res.status(404).json({
                success: false,
                message: "Coupon Not Found"
            });
        }

        existCoupon.status = false;
        await existCoupon.save();

        // Autodelete rank notifications when coupon is deactivated
        if (existCoupon.vendorId) {
            const vendor = await VendorModel.findById(existCoupon.vendorId);
            if (vendor && vendor.userId) {
                const recipientId = vendor.userId._id || vendor.userId;
                await NotificationModel.deleteMany({
                    recipientId: recipientId,
                    type: { $in: ['rank_allotment', 'rank_revocation'] }
                });
            }
        }
        if (existCoupon.customerId) {
            const customer = await CustomerModel.findById(existCoupon.customerId);
            if (customer && customer.userId) {
                const recipientId = customer.userId._id || customer.userId;
                await NotificationModel.deleteMany({
                    recipientId: recipientId,
                    type: { $in: ['rank_allotment', 'rank_revocation'] }
                });
            }
        }

        return res.status(200).json({
            success: true,
            message: "Status Updated Successfully"
        });

    } catch (err) {
        return res.json({
            status:200,
            success: false,
            message: "Server Error",
            error: err.message
        });
    }
};
// VENDOR SPECIFIC COUPONS
const vendorAdd = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { code, discount, discountType, minAmoutSpend, expiryDate } = req.body;

        if (!discount) {
            return res.status(400).json({ success: false, status: 400, message: "Discount value is required" });
        }

        let finalCode = code && code.trim() !== "" 
            ? code.trim().toUpperCase() 
            : await generateUniqueCode("STORE");

        const existing = await CouponModel.findOne({ code: finalCode });
        if (existing) {
            return res.status(400).json({ success: false, status: 400, message: "Coupon code already exists" });
        }

        const newCoupon = new CouponModel({
            code: finalCode,
            discount,
            discountType: discountType || "Percentage",
            minAmoutSpend: Number(minAmoutSpend) || 0,
            expiryDate: expiryDate || "",
            vendorId: vendorId,
            status: true
        });

        await newCoupon.save();

        return res.status(201).json({
            success: true,
            status: 201,
            message: "Vendor coupon created successfully!",
            data: newCoupon
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

const vendorAll = async (req, res) => {
    try {
        await deleteExpiredCoupons();
        const vendorId = req.vendor._id;
        const coupons = await CouponModel.find({
            $or: [
                { vendorId: vendorId },
                { vendorId: null },
                { vendorId: { $exists: false } }
            ]
        }).sort({ _id: -1 });

        return res.status(200).json({
            success: true,
            status: 200,
            data: coupons
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

const vendorDelete = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({ success: false, status: 400, message: "_id is required" });
        }

        const coupon = await CouponModel.findOneAndDelete({ _id, vendorId });
        if (!coupon) {
            return res.status(404).json({ success: false, status: 404, message: "Coupon not found or access denied" });
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Coupon deleted successfully"
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

module.exports = {
    add, all, update, single, DeleteOne, softDelete,
    vendorAdd, vendorAll, vendorDelete, deleteExpiredCoupons
}