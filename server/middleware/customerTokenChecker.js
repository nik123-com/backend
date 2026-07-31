const jwt = require("jsonwebtoken");
const skey = "SecreteKey";
const userModel = require("../apis/user/userModel");

module.exports = (req, res, next) => {
  let token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({
      message: "Please login to continue.",
      status: 401,
      success: false
    });
  }

  jwt.verify(token, skey, function (err, decoded) {
    if (err) {
      return res.status(401).json({
        message: "Token expired or invalid. Please login again.",
        status: 401,
        success: false,
        err: err
      });
    } else {
      if (decoded.userType == "2") {
        userModel.findById(decoded.userId).then((user) => {
          if (!user || user.isBlocked === true) {
            return res.status(403).json({
              message: "Your account has been blocked. Access denied.",
              status: 403,
              success: false
            });
          }
          req.decoded = decoded;
          next();
        }).catch((dbErr) => {
          res.status(500).json({
            message: "Authentication error",
            status: 500,
            success: false,
            err: dbErr
          });
        });
      } else {
        res.status(403).json({
          message: "Invalid token or access denied.",
          status: 403,
          success: false
        });
      }
    }
  });
};
