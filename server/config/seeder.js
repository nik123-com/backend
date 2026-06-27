const userModel = require("../apis/user/userModel")
const bcrypt = require('bcrypt')

module.exports=()=>{
    userModel.findOne({email:"admin@gmail.com"}).then((data)=>{
        if(data==null){
            let userobj=new userModel()

            userobj.name="admin",
            userobj.email="admin@gmail.com",
           userobj.password = bcrypt.hashSync("123", 10);
            userobj.usertype="1",
            userobj.save().then(()=>{

            }).catch(()=>{

            })
        }else{
            console.log("admin already exist");
        }
    }).catch((err)=>{

    })
}