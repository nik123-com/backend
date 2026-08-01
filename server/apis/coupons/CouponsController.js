const CouponModel = require('../coupons/CouponsModel')
//Add
const add = async (req,res) => {
    try{
        const incomingData = req.body || {};
        const existingData = await CouponModel.findOne({code: incomingData.code});
        if(existingData){
            return res.json({
                status:400,
                success:false,
                message:"Data Already Exists"
            })
        }
        let coupon = new CouponModel();
        coupon.code = req.body.code;
        coupon.discount = req.body.discount;
        coupon.discountType = req.body.discountType;
        coupon.minAmoutSpend = req.body.minAmoutSpend;
        coupon.expiryDate = req.body.expiryDate;

         await coupon.save();
        res.json({
            status:201,
            success:true,
            message: "Coupon Added Successfully",
            data:coupon
        })

        }catch(err){
            console.log(err);
            
        }

       
    }
//All
const all = async(req,res) =>{
    try{
        const allData = await CouponModel.find({});
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
    }
}
//Single
const single = async (req,res)=>{
    try{
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
        res.json({
            status:404,
            message:errmsg,
            success:false
        });
    }else{
        CouponModel.findOne({_id:req.body._id}).then((existCoupon)=>{
            if(existCoupon == null){
                res.json({
                    status:404,
                    success:false,
                    message:"Coupon Not Found"
                });
            }else{
                CouponModel.deleteOne({_id:req.body._id}).then(()=>{
                    res.json({
                        status:200,
                        success:true,
                        message:"Coupon Deleted Successfully"
                    });
                }).catch((err)=>{
                    console.log(err);                    
                })
            }
        }).catch((err)=>{
            res.json({
            status:500,
            success:false,
            message:"Internal server"
        })
        })
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

        if (!code || !discount) {
            return res.status(400).json({ success: false, status: 400, message: "Code and discount are required" });
        }

        const existing = await CouponModel.findOne({ code: code.toUpperCase() });
        if (existing) {
            return res.status(400).json({ success: false, status: 400, message: "Coupon code already exists" });
        }

        const newCoupon = new CouponModel({
            code: code.toUpperCase(),
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
    vendorAdd, vendorAll, vendorDelete
}