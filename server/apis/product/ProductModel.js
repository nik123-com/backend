const mongoose=require("mongoose")

const ProductSchema= new mongoose.Schema({
    name:{type:String,default:""},
    description:{type:String, default:""},
    image:{type:[String], default:[]},
    price:{type:String, default:""},
    category_id: {type:mongoose.Schema.Types.ObjectId, ref: "categories"},
    brand_id: {type:mongoose.Schema.Types.ObjectId, ref: "brands"},
    status:{type:Boolean, default:true},
    rating:{type:Number, default:0},
    create_at:{type:Date, default:Date.now()}
})

module.exports= mongoose.model("Product",ProductSchema)