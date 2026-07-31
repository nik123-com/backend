const userModel = require("../user/userModel")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const Joi = require("joi");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

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
                    massage: "User not found",
                    message: "User not found",
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
                        massage: "Enter the correct Password",
                        message: "Enter the correct Password",
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
    newPassword: Joi.string().max(30).required(),
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

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.send({ success: false, status: 400, message: "Email is required" });
    }

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.send({ success: false, status: 404, message: "User not found" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      to: user.email,
      from: process.env.SMTP_USER,
      subject: "Password Reset Request",
      text: `You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n
        Please click on the following link, or paste this into your browser to complete the process:\n\n
        http://localhost:5173/reset-password/${token}\n\n
        If you did not request this, please ignore this email and your password will remain unchanged.\n`,
    };

    transporter.sendMail(mailOptions, (err) => {
      if (err) {
        console.error("Error sending email:", err);
        return res.send({ success: false, status: 500, message: "Error sending email" });
      }
      res.send({ success: true, status: 200, message: "An e-mail has been sent to " + user.email + " with further instructions." });
    });
  } catch (err) {
    console.error(err);
    res.send({ success: false, status: 500, message: "Internal server error" });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    const user = await userModel.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.send({ success: false, status: 400, message: "Password reset token is invalid or has expired." });
    }

    if (!newPassword) {
        return res.send({ success: false, status: 400, message: "Password is required." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.send({ success: true, status: 200, message: "Success! Your password has been changed." });
  } catch (err) {
    console.error(err);
    res.send({ success: false, status: 500, message: "Internal server error" });
  }
};

module.exports = { login, changepassword, forgotPassword, resetPassword }