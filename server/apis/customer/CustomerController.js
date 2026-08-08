const CustomerModel = require('../customer/CustomerModel');
const CouponModel = require('../coupons/CouponsModel');
const NotificationModel = require('../notification/NotificationModel');
const userModel = require('../user/userModel');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')
const skey = "secret"
const nodemailer = require("nodemailer");
const Register = (req, res) => {
  let errMsg = [];
  if (!req.body.name) {
    errMsg.push("Name is Required");
  }
  if (!req.body.email) {
    errMsg.push("email is Required");
  }
  if (!req.body.Contact) {
    errMsg.push("Contact is Required");
  }
  if (!req.body.Address) {
    errMsg.push("Address is Required");
  }
  if (!req.body?.evidence) {
    errMsg.push("Evidence is Required");
  }
  if (!req.body.GovtID) {
    errMsg.push("GovtID is Required");
  }
  if (!req.body.password) {
    errMsg.push("password is Required");
  }
  if (errMsg.length > 0) {
    return res.send({
      message: errMsg,
      success: false,
      status: 404,
    });
  } else {
    userModel.findOne({ email: req.body.email }).then((userData) => {
      if (userData == null) {
        let userobj = new userModel();
        userobj.name = req.body.name;
        userobj.email = req.body.email;
        userobj.password = bcrypt.hashSync(req.body.password, 10);


        userobj.usertype = "2";
        userobj.save().then((userData) => {

          let payload = {
            userId: userData._id,
            email: userData.email,
            userType: userData.usertype,
            name: userData.name,
            GovtID: userData.GovtID
          }
          let token = jwt.sign(payload, skey)

          let customerobj = new CustomerModel();
          customerobj.name = req.body.name;
          customerobj.email = req.body.email;
          customerobj.userId = userData._id;
          customerobj.Contact = req.body.Contact;
          customerobj.Address = req.body.Address;
          customerobj.evidence = req.body.evidence;
          customerobj.GovtID = req.body.GovtID;
          token
          customerobj.save().then(async(customer) => {

            const transporter = nodemailer.createTransport({
              service: "Gmail",
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
            });
            transporter.sendMail({
              from: '"Our Team" <nikhilxe@gmail.com>', // sender address
              to: customerobj.email, // list of recipients
              subject: "Regarding Testing", // subject line
              text: "Someone Registered with your Email Id", // plain text body
              html: "<b>Someone Registered with your Email Id</b>", // HTML body
            }).catch((err) => {
              console.error("Error while sending mail:", err);
            });

            return res.send({
              message: "Customer added successfully",
              status: 201,
              success: true,
              data: customer

            })
          }).catch((err) => {
            return res.send({
              message: "Internal Server Error",
              success: false,
              status: 580,
              error: err
            });
          })

        })
          .catch((err) => {
            return res.send({
              message: "Internal Server Error",
              success: false,
              status: 570,
              error: err
            });
          });
      } else {
        return res.send({
          message: "user already exist",
          success: false,
          status: 403,
        });
      }
    }).catch((err) => {
      console.log(err)
      return res.send({
        message: "Internal Server Error",
        success: false,
        status: 540,
        error: err
      });
    });
  }
};

// READ OPERATION
// To GET ALL DOCUMENTS

const all = async (req, res) => {
  try {
    const userData = await CustomerModel.find({status: true}).populate("userId") //find({status: true})
    if (userData.length === 0) {
      return res.send({
        status: 404,
        message: "Customer Not Found",
        success: false,
      });
    }

    return res.send({
      status: 200,
      message: "All customers",
      success: true,
      totalcate: userData.length,
      data: userData,
    });

  } catch (err) {
    return res.send({
      status: 500,
      message: "Internal Server Error",
      success: false,
    });
  }
};

const single = async (req, res) => {
  try {
    const customerId = req.body?._id;

    if (!customerId) {
      return res.json({
        status: 400,
        success: false,
        message: "_id is required"
      })
    }

    const customer = await customerModel.findOne({ _id: customerId })

    if (!customer) {
      return res.json({
        status: 404,
        success: false,
        message: "customer not found"
      })
    } else {
      return res.json({
        status: 200,
        success: true,
        message: "customer fetched",
        data: customer
      })
    }
  } catch (err) {
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err,
    })
  }
}

// UPDATE
const update = async (req, res) => {
  try {
    const customerId = req.body?._id;
    const incomingData = req.body;
    if (!customerId) {
      return res.json({
        status: 400,
        success: false,
        message: "_id is required"
      })
    }

    const customerData = await customerModel.findOne({ _id: customerId })

    if (!customerData) {
      return res.json({
        status: 404,
        success: false,
        message: "customer not found"
      })
    } else {

      if (incomingData.name) {
        customerData.name = incomingData.name;
      }
      if (incomingData.email) {
        customerData.email = incomingData.email;
      }
      if (incomingData.Contact) {
        customerData.Contact = incomingData.Contact;
      }
      if (incomingData.Address) {
        customerData.Address = incomingData.Address;
      }
      if (incomingData.evidence) {
        customerData.evidence = incomingData.evidence;
      }
      if (incomingData.GovtID) {
        customerData.GovtID = incomingData.GovtID;
      }
      customerData.updatedAt = Date.now()
      let updatedcustomer = await customerData.save()

      return res.json({
        status: 200,
        success: true,
        message: "customer Updated Successfully",
        data: updatedcustomer
      })
    }
  } catch (err) {
    return res.json({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err,
    })
  }
}

// DeleteOne
const DeleteOne = (req, res) => {
  let ErrMsg = [];

  if (!req.body._id) {
    ErrMsg.push("_id is required");
  }

  if (ErrMsg.length > 0) {
    return res.send({
      status: 404,
      message: ErrMsg,
      success: false,
    });
  } else {
    customerModel
      .findOne({ _id: req.body._id })
      .then((userData) => {
        if (userData == null) {
          return res.send({
            status: 404,
            message: "Not Found",
            success: false,
          });
        } else {
          customerModel.deleteOne({ _id: req.body._id }).then(() => {
            return res.send({
              status: 200,
              message: "delete",
              success: true,
            });
          }).catch((err) => {
            return res.send({
              status: 500,
              message: "Internal Server Error",
              success: false,
            });
          })
        }
      })
      .catch((err) => {
        return res.send({
          status: 500,
          message: "Internal Server Error",
          success: false,
        });
      });
  }
};

const softDelete = async (req, res) => {
  try {
    const customer = await CustomerModel.findById(req.body._id);

    if (!customer) {
      return res.send({
        success: false,
        message: "Customer not found"
      });
    }

    customer.status = !customer.status;

    await customer.save();

    res.send({
      success: true,
      message: customer.status
        ? "Customer Unblocked Successfully"
        : "Customer Blocked Successfully"
    });

  } catch (err) {
    res.send({
      success: false,
      message: err.message
    });
  }
};

const toggleBlock = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.send({
        status: 400,
        success: false,
        message: "User ID is required"
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.send({
        status: 404,
        success: false,
        message: "User not found"
      });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    return res.send({
      status: 200,
      success: true,
      message: user.isBlocked ? "Customer Blocked Successfully" : "Customer Unblocked Successfully",
      data: user
    });
  } catch (err) {
    return res.send({
      status: 500,
      success: false,
      message: "Internal Server Error: " + err.message
    });
  }
};

const allotRank = async (req, res) => {
  try {
    const { customerId, rank } = req.body;
    if (!customerId) {
      return res.send({ status: 400, success: false, message: "Customer ID is required" });
    }

    const numericRank = parseInt(rank, 10);
    if (isNaN(numericRank) || numericRank < 1) {
      return res.send({ status: 400, success: false, message: "Rank must be a valid positive number" });
    }

    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.send({ status: 404, success: false, message: "Customer not found" });
    }

    // Check if another customer already has this rank (especially Rank 1)
    const existingRankCustomer = await CustomerModel.findOne({ rank: numericRank, _id: { $ne: customerId } });
    if (existingRankCustomer) {
      const msg = numericRank === 1
        ? `Rank 1 is already allotted to customer "${existingRankCustomer.name}". Please revoke Rank 1 from "${existingRankCustomer.name}" first before allotting it to another customer.`
        : `Rank #${numericRank} is already allotted to customer "${existingRankCustomer.name}". Each rank must be unique.`;
      return res.send({ status: 400, success: false, message: msg });
    }

    customer.rank = numericRank;

    let generatedCoupon = null;
    // Automatically generate Reward Coupon if customer is allotted Rank 1
    if (numericRank === 1) {
      const { discount, discountType, minAmoutSpend, expiryDate, couponCode: customCode } = req.body;
      const randomCode = Math.floor(100 + Math.random() * 900);
      const couponCode = customCode && customCode.trim() !== ""
        ? customCode.trim().toUpperCase()
        : `RANK1REWARD-${randomCode}`;

      let defaultExp = new Date();
      defaultExp.setDate(defaultExp.getDate() + 30);
      const defaultExpStr = defaultExp.toISOString().split('T')[0];

      const newCoupon = new CouponModel({
        code: couponCode,
        discount: discount ? String(discount) : "20",
        discountType: discountType || "Percentage",
        minAmoutSpend: minAmoutSpend ? Number(minAmoutSpend) : 0,
        expiryDate: expiryDate || defaultExpStr,
        customerId: customer._id,
        isReward: true,
        rewardType: "Rank 1 Special Reward",
        status: true
      });

      await newCoupon.save();
      customer.rewardPopupShown = false;
      customer.latestRewardCoupon = couponCode;
      generatedCoupon = couponCode;
    }

    await customer.save();

    // Create Notification for Customer
    if (customer.userId) {
      try {
        const recipientId = customer.userId._id || customer.userId;
        // Delete previous rank notifications first to keep notification list clean
        await NotificationModel.deleteMany({
          recipientId: recipientId,
          type: { $in: ['rank_allotment', 'rank_revocation'] }
        });

        const notifMsg = numericRank === 1
          ? `🏆 You have been allotted Rank #1! You received an exclusive Reward Coupon: '${generatedCoupon}'`
          : `🏆 Admin has allotted Rank #${numericRank} to your customer account.`;

        await NotificationModel.create({
          senderId: req.decoded ? req.decoded.userId : null,
          recipientId: recipientId,
          type: 'rank_allotment',
          status: 'pending',
          message: notifMsg
        });
      } catch (notifErr) {
        console.error("Error creating rank notification:", notifErr);
      }
    }

    return res.send({
      status: 200,
      success: true,
      message: numericRank === 1
        ? `Rank 1 allotted to ${customer.name || 'Customer'}! Reward coupon '${generatedCoupon}' automatically generated.`
        : `Rank ${numericRank} allotted to ${customer.name || 'Customer'} successfully.`,
      data: customer,
      rewardCoupon: generatedCoupon
    });
  } catch (err) {
    return res.send({ status: 500, success: false, message: err.message });
  }
};

const revokeRank = async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.send({ status: 400, success: false, message: "Customer ID is required" });
    }

    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.send({ status: 404, success: false, message: "Customer not found" });
    }

    customer.rank = null;
    customer.rewardPopupShown = true;
    customer.latestRewardCoupon = "";
    await customer.save();

    // Delete any rank reward coupons associated with this customer
    await CouponModel.deleteMany({ customerId: customer._id, isReward: true });

    // Auto-delete Rank Notifications from Customer
    if (customer.userId) {
      try {
        const recipientId = customer.userId._id || customer.userId;
        await NotificationModel.deleteMany({
          recipientId: recipientId,
          type: { $in: ['rank_allotment', 'rank_revocation'] }
        });
      } catch (notifErr) {
        console.error("Error autodeleting customer rank notifications:", notifErr);
      }
    }

    return res.send({
      status: 200,
      success: true,
      message: `Rank revoked from ${customer.name || 'Customer'} successfully.`,
      data: customer
    });
  } catch (err) {
    return res.send({ status: 500, success: false, message: err.message });
  }
};

const checkRankReward = async (req, res) => {
  try {
    const userId = req.body.userId || (req.decoded && req.decoded.userId);
    const email = req.decoded && req.decoded.email;

    let customer = null;
    if (userId) {
      customer = await CustomerModel.findOne({ userId });
    }
    if (!customer && email) {
      customer = await CustomerModel.findOne({ email });
    }

    if (!customer) {
      return res.send({ status: 404, success: false, message: "Customer not found" });
    }

    if (!customer.rank || customer.rewardPopupShown) {
      return res.send({ status: 200, success: false, message: "No active rank notification" });
    }

    let couponDetails = null;
    if (customer.latestRewardCoupon) {
      couponDetails = await CouponModel.findOne({ code: customer.latestRewardCoupon });
    }
    if (!couponDetails && customer.rank === 1) {
      couponDetails = await CouponModel.findOne({ customerId: customer._id, isReward: true }).sort({ _id: -1 });
    }

    return res.send({
      status: 200,
      success: true,
      rank: customer.rank,
      customerName: customer.name || "Customer",
      coupon: couponDetails ? {
        code: couponDetails.code,
        discount: couponDetails.discount,
        discountType: couponDetails.discountType,
        minAmoutSpend: couponDetails.minAmoutSpend,
        expiryDate: couponDetails.expiryDate
      } : null
    });
  } catch (err) {
    return res.send({ status: 500, success: false, message: err.message });
  }
};

const dismissRewardPopup = async (req, res) => {
  try {
    const userId = req.body.userId || (req.decoded && req.decoded.userId);
    const email = req.decoded && req.decoded.email;

    let customer = null;
    if (userId) {
      customer = await CustomerModel.findOne({ userId });
    }
    if (!customer && email) {
      customer = await CustomerModel.findOne({ email });
    }

    if (customer) {
      customer.rewardPopupShown = true;
      await customer.save();
    }

    return res.send({ status: 200, success: true, message: "Reward popup dismissed" });
  } catch (err) {
    return res.send({ status: 500, success: false, message: err.message });
  }
};

module.exports = {
  Register, all, single, update, DeleteOne, softDelete, toggleBlock, allotRank, revokeRank, checkRankReward, dismissRewardPopup
}