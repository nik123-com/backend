const userModel = require("../user/userModel");
const CustomerModel = require("../customer/CustomerModel");
const VendorModel = require("../vendor/VendorModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const Joi = require("joi");
const crypto = require("crypto");
const { sendOtpEmail, sendPasswordResetEmail } = require("../../../utilities/mailer");

const skey = "SecreteKey";

const login = async (req, res) => {
  if (!req.body.email || !req.body.password) {
    return res.send({
      massage: "Email and password is required",
      message: "Email and password is required",
      success: false,
      status: 403,
    });
  } else {
    try {
      const userData = await userModel.findOne({ email: req.body.email.trim().toLowerCase() });
      if (userData == null) {
        return res.send({
          massage: "User not found",
          message: "User not found",
          success: false,
          status: 404,
        });
      } else if (userData.isBlocked === true) {
        return res.send({
          massage: "Your account is blocked. Please contact support.",
          message: "Your account is blocked. Please contact support.",
          success: false,
          status: 403,
        });
      } else {
        let confirm = bcrypt.compareSync(req.body.password, userData.password);
        if (confirm !== true) {
          return res.send({
            massage: "Enter the correct Password",
            message: "Enter the correct Password",
            success: false,
            status: 404,
          });
        }

        let gender = userData.gender || "";
        if (!gender) {
          if (userData.usertype === "2") {
            const cust = await CustomerModel.findOne({ userId: userData._id });
            if (cust && cust.gender) gender = cust.gender;
          } else if (userData.usertype === "3") {
            const vend = await VendorModel.findOne({ userId: userData._id });
            if (vend && vend.gender) gender = vend.gender;
          }
          if (gender) {
            userData.gender = gender;
            await userData.save();
          }
        }

        let payload = {
          userId: userData._id,
          addedById: userData._id,
          email: userData.email,
          userType: userData.usertype,
          name: userData.name,
          gender: gender,
        };
        let token = jwt.sign(payload, skey);

        return res.send({
          massage: "Login Successfully",
          message: "Login Successfully",
          success: true,
          status: 200,
          data: payload,
          token: token,
        });
      }
    } catch (err) {
      console.error("Login DB error:", err);
      return res.send({
        massage: "Internal Server Error",
        message: "Internal Server Error",
        success: false,
        status: 500,
      });
    }
  }
};

/**
 * Send OTP to customer's registered email for portal login
 */
const sendLoginOtp = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    if (!rawEmail || !rawEmail.trim()) {
      return res.send({
        success: false,
        status: 400,
        message: "Registered email address is required",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = await userModel.findOne({ email });

    if (!user) {
      return res.send({
        success: false,
        status: 404,
        message: "No account found with this email. Please register first.",
      });
    }

    if (user.isBlocked === true) {
      return res.send({
        success: false,
        status: 403,
        message: "Your account has been blocked. Please contact customer support.",
      });
    }

    // Generate random 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    await user.save();

    // Send via Nodemailer
    await sendOtpEmail({
      to: user.email,
      otp: otp,
      name: user.name || "Valued Customer",
      purpose: "Customer Portal Login",
    });

    return res.send({
      success: true,
      status: 200,
      message: `A 6-digit OTP has been sent to your registered email (${user.email}).`,
    });
  } catch (err) {
    console.error("Error in sendLoginOtp:", err);
    return res.send({
      success: false,
      status: 500,
      message: "Failed to send OTP email. Please verify SMTP settings and try again.",
      error: err.message,
    });
  }
};

/**
 * Verify OTP and authenticate customer to open portal
 */
const verifyOtpLogin = async (req, res) => {
  try {
    const { email: rawEmail, otp } = req.body;

    if (!rawEmail || !rawEmail.trim()) {
      return res.send({
        success: false,
        status: 400,
        message: "Email is required",
      });
    }

    if (!otp || !otp.trim()) {
      return res.send({
        success: false,
        status: 400,
        message: "Please enter the 6-digit OTP",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.send({
        success: false,
        status: 404,
        message: "User not found",
      });
    }

    if (user.isBlocked === true) {
      return res.send({
        success: false,
        status: 403,
        message: "Your account is blocked. Please contact support.",
      });
    }

    if (!user.otp || !user.otpExpires) {
      return res.send({
        success: false,
        status: 400,
        message: "No OTP was requested or OTP has expired. Please request a new OTP.",
      });
    }

    if (Date.now() > new Date(user.otpExpires).getTime()) {
      return res.send({
        success: false,
        status: 400,
        message: "This OTP has expired. Please request a new code.",
      });
    }

    if (user.otp !== cleanOtp) {
      return res.send({
        success: false,
        status: 400,
        message: "Invalid OTP code. Please enter the correct 6-digit code.",
      });
    }

    // Clear used OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    let gender = user.gender || "";
    if (!gender) {
      if (user.usertype === "2") {
        const cust = await CustomerModel.findOne({ userId: user._id });
        if (cust && cust.gender) gender = cust.gender;
      } else if (user.usertype === "3") {
        const vend = await VendorModel.findOne({ userId: user._id });
        if (vend && vend.gender) gender = vend.gender;
      }
      if (gender) {
        user.gender = gender;
        await user.save();
      }
    }

    // Create session token
    const payload = {
      userId: user._id,
      addedById: user._id,
      email: user.email,
      userType: user.usertype,
      name: user.name,
      gender: gender,
    };
    const token = jwt.sign(payload, skey);

    return res.send({
      success: true,
      status: 200,
      message: "OTP verified successfully! Welcome to your portal.",
      massage: "OTP verified successfully! Welcome to your portal.",
      data: payload,
      token: token,
    });
  } catch (err) {
    console.error("Error in verifyOtpLogin:", err);
    return res.send({
      success: false,
      status: 500,
      message: "Internal server error during OTP verification",
      error: err.message,
    });
  }
};

const changepassword = async (req, res) => {
  let formData = req.body;

  const userSchema = Joi.object({
    email: Joi.string().email().required(),
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().max(30).required(),
    confirmPassword: Joi.string().required(),
  });

  const { error } = userSchema.validate(formData);

  if (error) {
    return res.send({
      message: error.details[0].message,
      status: 404,
      success: false,
    });
  } else {
    try {
      if (formData.newPassword !== formData.confirmPassword) {
        return res.send({
          message: "New and confirm password do not match",
          status: 404,
          success: false,
        });
      }
      let existuser = await userModel.findOne({ email: formData.email.trim().toLowerCase() });

      if (existuser == null) {
        return res.send({
          message: "User Not Found",
          status: 404,
          success: false,
        });
      }

      let isCon = await bcrypt.compare(formData.oldPassword, existuser.password);
      if (!isCon) {
        return res.send({
          message: "Password doesn't match",
          status: 404,
          success: false,
        });
      }

      existuser.password = await bcrypt.hash(formData.newPassword, 10);
      let saveduser = await existuser.save();

      return res.send({
        message: "Password is changed",
        status: 200,
        success: true,
        data: saveduser,
      });
    } catch (err) {
      return res.send({
        message: err.message,
        status: 500,
        success: false,
        err: err,
      });
    }
  }
};

const forgotPassword = async (req, res) => {
  try {
    const rawEmail = req.body.email;
    if (!rawEmail || !rawEmail.trim()) {
      return res.send({ success: false, status: 400, message: "Email is required" });
    }

    const email = rawEmail.trim().toLowerCase();
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.send({ success: false, status: 404, message: "User not found with this email" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    user.otp = otp;
    user.otpExpires = Date.now() + 3600000; // 1 hour

    await user.save();

    let clientUrl = process.env.CLIENT_URL;
    if (!clientUrl && req.headers.origin) {
      clientUrl = req.headers.origin;
    }
    if (!clientUrl && req.headers.referer) {
      try {
        const parsed = new URL(req.headers.referer);
        clientUrl = parsed.origin;
      } catch (e) {
        clientUrl = req.headers.referer;
      }
    }
    if (!clientUrl) {
      clientUrl = "http://localhost:5173";
    }
    clientUrl = clientUrl.replace(/\/+$/, "");

    const resetUrl = `${clientUrl}/reset-password/${token}`;

    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        name: user.name,
      });

      return res.send({
        success: true,
        status: 200,
        message: `An email has been sent to ${user.email} with instructions to reset your password.`,
      });
    } catch (mailErr) {
      console.error("Error sending reset email:", mailErr);
      return res.send({
        success: false,
        status: 500,
        message: "Failed to send reset email. Please ensure SMTP configuration is correct.",
        error: mailErr.message,
      });
    }
  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.send({ success: false, status: 500, message: "Internal server error" });
  }
};

/**
 * Verify OTP directly for password reset
 */
const verifyResetOtp = async (req, res) => {
  try {
    const { email: rawEmail, otp, newPassword } = req.body;

    if (!rawEmail || !otp || !newPassword) {
      return res.send({
        success: false,
        status: 400,
        message: "Email, OTP, and new password are required",
      });
    }

    const email = rawEmail.trim().toLowerCase();
    const cleanOtp = otp.trim();

    const user = await userModel.findOne({ email });
    if (!user) {
      return res.send({ success: false, status: 404, message: "User not found" });
    }

    if (!user.otp || !user.otpExpires || Date.now() > new Date(user.otpExpires).getTime()) {
      return res.send({
        success: false,
        status: 400,
        message: "OTP has expired. Please request a new OTP.",
      });
    }

    if (user.otp !== cleanOtp) {
      return res.send({
        success: false,
        status: 400,
        message: "Invalid OTP. Please check the 6-digit code received in your email.",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = undefined;
    user.otpExpires = undefined;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    // Auto-generate login token so the user can directly enter their portal
    const payload = {
      userId: user._id,
      addedById: user._id,
      email: user.email,
      userType: user.usertype,
      name: user.name,
    };
    const token = jwt.sign(payload, skey);

    return res.send({
      success: true,
      status: 200,
      message: "Password reset successfully! You are now logged in.",
      data: payload,
      token: token,
    });
  } catch (err) {
    console.error("verifyResetOtp error:", err);
    return res.send({ success: false, status: 500, message: "Internal server error" });
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
      return res.send({
        success: false,
        status: 400,
        message: "Password reset token is invalid or has expired.",
      });
    }

    if (!newPassword) {
      return res.send({ success: false, status: 400, message: "Password is required." });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;

    await user.save();

    res.send({
      success: true,
      status: 200,
      message: "Success! Your password has been changed.",
    });
  } catch (err) {
    console.error(err);
    res.send({ success: false, status: 500, message: "Internal server error" });
  }
};

module.exports = {
  login,
  sendLoginOtp,
  verifyOtpLogin,
  changepassword,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
};