const AddressModel = require("./AddressModel")

//Add
const add = async (req,res) => {
    try{
        const incomingData = req.body || {};
        const existingData = await AddressModel.findOne({houseno: incomingData.houseno});
        if(existingData){
            return res.json({
                status:400,
                success:false,
                message:"House No Already Exists"
            })
        }
        let address = new AddressModel();
        address.houseno = req.body.houseno;
        address.city = req.body.city;
        address.district = req.body.district;
        address.state = req.body.state;
        address.country = req.body.country;
        address.pin = req.body.pin;
        address.landmark = req.body.landmark;
        address.contact = req.body.contact;
        address.altercontact = req.body.altercontact;
        address.editbyid = req.body.editbyid;
         await address.save();
        res.json({
            status:201,
            success:true,
            message: "Address Added Successfully",
            data:address
        })

        }catch(err){
            console.log(err);
            
        }       
    }


//All
const all = async(req,res) =>{
    try{
        if(!req.body.userId){
            return res.json({success:false, status:400, message:"User Id is Required"})
        }
        const allData = await AddressModel.find({editbyid : req.body.userId});
        const total = await AddressModel.countDocuments({});
        res.json({
            status:200,
            success:true,
            message:"Address Loaded Successfully",
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
        const address_id = req.body?._id;
        if(!address_id){
            res.json({
                status:400,
                success:false,
                message: "_id is Required"
            })
        } 
        const address = await AddressModel.findOne({_id:address_id});
        if(!address){
            res.json({
                status:404,
                success:false,
                message:"Address Not Found"
            })
        }else{
            res.json({
                status:200,
                success:true,
                message: "Address Found Successfully",
                data : address
            })
        }
    }catch(err){
        console.log(err);
    }
}
//Update
const update = async(req,res)=>{
    try{
        const address_id = req.body?._id;
        const incomingData = req.body;

        if(!address_id){
            res.json({
                status:400,
                success:false,
                message:"_id is Required"
            })
        }

        const addressData = await AddressModel.findOne({_id:address_id})
        if(!addressData){
            res.json({
            status:404,
            success: false,
            message: "Coupon Not Found"
            })
        }else{
            if(incomingData.houseno){
                addressData.houseno = incomingData.houseno;
            }
            if(incomingData.city){
                addressData.city = incomingData.city;
            }
            if(incomingData.district){
                addressData.district = incomingData.district;          
            }
            if(incomingData.state){
            addressData.state = incomingData.state;
            }
            if(incomingData.country){
            addressData.country = incomingData.country;
            }
            if(incomingData.pin){
            addressData.pin = incomingData.pin;
            }
            if(incomingData.landmark){
            addressData.landmark = incomingData.landmark;
            }
            addressData.updateAt = Date.now()
            let updatedaddress = await addressData.save();
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
        AddressModel.findOne({_id:req.body._id}).then((existAddress)=>{
            if(existAddress == null){
                res.json({
                    status:404,
                    success:false,
                    message:"Address Not Found"
                });
            }else{
                AddressModel.deleteOne({_id:req.body._id}).then(()=>{
                    res.json({
                        status:200,
                        success:true,
                        message:"Address Deleted Successfully"
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
        const existAddress = await AddressModel.findOne({ _id: req.body._id });

        if (!existAddress) {
            return res.status(404).json({
                success: false,
                message: "Address Not Found"
            });
        }

        existAddress.status = false;
        await existAddress.save();

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