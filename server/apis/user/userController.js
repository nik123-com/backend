const userModel = require("../user/userModel")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const Joi = require("joi");

const skey = "SecreteKey"
const login = (req, res) => {

    if (!req.body.email || !req.body.password) {
        res.send({
            massage: "Email and password is required",
            success: false,
            status: 403
        })

    } else {
        userModel.findOne({ email: req.body.email }).then((userData) => {
            if (userData == null) {
                res.send({
                    massage: "user Not found",
                    success: false,
                    status: 404
                })
            } else if (userData.isBlocked === true) {
                res.send({
                    massage: "Your account is blocked. Please contact support.",
                    message: "Your account is blocked. Please contact support.",
                    success: false,
                    status: 403
                })
            } else {
                let confirm = bcrypt.compareSync(req.body.password, userData.password);
                let payload = {
                    userId: userData._id,
                    addedById: userData._id,
                    email: userData.email,
                    userType: userData.usertype,
                    name: userData.name
                }
                let token = jwt.sign(payload, skey)
                if (confirm == true) {
                    res.send({
                        massage: "Login Successfully",
                        success: true,
                        status: 200,
                        data: payload,
                        token: token
                    })
                } else {
                    res.send({
                        massage: "Invaild password",
                        success: false,
                        status: 404
                    })
                }
            }

        }).catch((err) => {
            console.log(err);
            res.send({
                massage: "internal server error",
                success: false,
                status: 404,
                err: err
            })

        })
    }

}

const changepassword = async (req, res) => {
  let formData = req.body;

  const userSchema = Joi.object({
    email: Joi.string().email().required(),
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(30).required(),
    confirmPassword: Joi.string().required(),
  });

  const { error, value } = userSchema.validate(formData);

  if (error) {
    console.log(error.details[0].message);
    return res.send({
      message: error.details[0].message,
      status: 404,
      success: false,
    });
  } else {
    // console.log(value);
    try {
      if (formData.newPassword !== formData.confirmPassword) {
        return res.send({
          message: "New and confirm pass is not same",
          status: 404,
          success: false,
        });
      }
      let existuser = await userModel.findOne({ email: formData.email });

      if (existuser == null) {
        return res.send({
          message: "User Not Found",
          status: 404,
          success: false,
        });
      }

      //   console.log(existuser);

      let isCon = await bcrypt.compare(
        formData.oldPassword,
        existuser.password,
      );

      console.log(isCon);

      if (!isCon) {
        return res.send({
          message: "Password doesn't match",
          status: 404,
          success: false,
        });
      }

      existuser.password = await bcrypt.hash(formData.newPassword, 10);

      let saveduser = existuser.save();

      return res.send({
        message: "Password is changed",
        status: 200,
        success: true,
        data: saveduser,
      });
    } catch (err) {
      return res.send({
        message: err.message,
        status: 200,
        success: true,
        err: err,
      });
    }
  }
};
module.exports = { login,changepassword }