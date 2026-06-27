const jwt = require("jsonwebtoken")
const skey = "SecreteKey"

module.exports=(req,res,next)=>{
    // console.log(req.headers["authorization"]);
    let token = req.headers["authorization"];

    jwt.verify(token,skey,function(err,decoded){
        if(err){

            res.json({
                message:"Token Not Found",
                status:404,
                success:false,
                err:err
            })
        }else{
            console.log("decoded",decoded);
      if(decoded.userType=="1"){
        req.decoded=decoded
        next()
      }else{
          res.send({
            message:"Invaild Token",
            status:404,
            success:false,
            
        })
      }
    }
  });
};