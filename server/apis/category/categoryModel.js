const mongoose=require("mongoose")

const categorySchema= new mongoose.Schema({
    name:{type:String,default:""},
    description:{type:String, default:""},
    image:{type:String, default:""},
    status:{type:Boolean, default:true},
    create_at:{type:Date, default:Date.now()}
})

module.exports= mongoose.model("categories",categorySchema)