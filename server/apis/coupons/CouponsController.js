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
module.exports = {
    add,all,update,single,DeleteOne,softDelete
}