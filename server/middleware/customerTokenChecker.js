const jwt = require("jsonwebtoken");
const skey = "SecreteKey"
const userModel = require("../apis/user/userModel");


module.exports = (req, res, next) => {
  // console.log(req.headers["authorization"]);
  let token = req.headers["authorization"];
  jwt.verify(token, skey, function (err, decoded) {
    if(err){
        res.send({
            message:"Token NOt Found",
            status:404,
            success:false,
            err:err
        })
    }else{
      console.log("decoded",decoded);
      if(decoded.userType=="2"){
        userModel.findById(decoded.userId).then((user) => {
          if (!user || user.isBlocked === true) {
            return res.send({
              message: "Your account has been blocked. Access denied.",
              status: 403,
              success: false
            });
          }
          req.decoded=decoded
          next()
        }).catch((dbErr) => {
          res.send({
            message: "Authentication error",
            status: 500,
            success: false,
            err: dbErr
          });
        });
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
