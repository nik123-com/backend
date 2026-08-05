const CustomerModel = require('../customer/CustomerModel');
const userModel = require('../user/userModel')
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
    const userData = await CustomerModel.find({status: true}).populate("userId").populate("assignedCoupons");
    if (userData.length === 0) {
      return res.send({
        status: 404,
        message: "Customer Not Found",
        success: false,
      });
    }

    const OrderModel = require('../order/OrderModel');
    const ReviewModel = require('../review/ReviewModel');

    const customerList = await Promise.all(userData.map(async (cust) => {
      const custObj = cust.toObject();
      const orders = await OrderModel.find({ customerId: cust._id, isDeleted: false });
      const reviews = cust.userId ? await ReviewModel.find({ userId: cust.userId._id || cust.userId }) : [];

      let totalOrders = orders.length;
      let acceptedOrders = 0;
      let cancelledOrders = 0;
      let totalSpend = 0;
      let lastOrderDate = cust.created_at || new Date();

      orders.forEach(o => {
        let isCancelled = o.orderStatus === 'cancelled' || o.products?.some(p => p.itemStatus === 'cancelled');
        if (isCancelled) {
          cancelledOrders++;
        } else {
          acceptedOrders++;
          totalSpend += (o.grandTotal || 0);
        }
        if (o.createdAt && new Date(o.createdAt) > new Date(lastOrderDate)) {
          lastOrderDate = o.createdAt;
        }
      });

      let reviewCount = reviews.length;
      let avgRating = reviewCount > 0 ? Number((reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / reviewCount).toFixed(1)) : 0;
      let daysSinceLastOrder = Math.max(0, Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)));
      let acceptanceRate = totalOrders > 0 ? Math.round((acceptedOrders / totalOrders) * 100) : 100;

      custObj.metrics = {
        totalOrders,
        acceptedOrders,
        cancelledOrders,
        totalSpend,
        reviewCount,
        avgRating,
        daysSinceLastOrder,
        acceptanceRate
      };

      return custObj;
    }));

    return res.send({
      status: 200,
      message: "All customers",
      success: true,
      totalcate: customerList.length,
      data: customerList,
    });

  } catch (err) {
    console.error("Error in customer all:", err);
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

    const customer = await CustomerModel.findOne({ _id: customerId }).populate("assignedCoupons");

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

    const customerData = await CustomerModel.findOne({ _id: customerId })

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
    CustomerModel
      .findOne({ _id: req.body._id })
      .then((userData) => {
        if (userData == null) {
          return res.send({
            status: 404,
            message: "Not Found",
            success: false,
          });
        } else {
          CustomerModel.deleteOne({ _id: req.body._id }).then(() => {
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

const updateRank = async (req, res) => {
  try {
    const { customerId, rank, rankScore, activityStatus, activityScore, aiSummary } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, status: 400, message: "CustomerId is required" });
    }
    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, status: 404, message: "Customer not found" });
    }

    if (rank) customer.rank = rank;
    if (rankScore !== undefined) customer.rankScore = Number(rankScore);
    if (activityStatus) customer.activityStatus = activityStatus;
    if (activityScore !== undefined) customer.activityScore = Number(activityScore);
    if (aiSummary !== undefined) customer.aiSummary = aiSummary;
    customer.rankUpdatedAt = new Date();

    await customer.save();
    return res.status(200).json({
      success: true,
      status: 200,
      message: "Customer rank and activity status updated successfully!",
      data: customer
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const CouponModel = require('../coupons/CouponsModel');

const getRankAndRewards = async (req, res) => {
  try {
    const userId = req.customer?.userId || req.customer?._id;
    let customer = await CustomerModel.findOne({ userId: userId }).populate("assignedCoupons");
    if (!customer && req.customer?.email) {
      customer = await CustomerModel.findOne({ email: req.customer.email }).populate("assignedCoupons");
    }

    if (!customer) {
      return res.status(404).json({ success: false, status: 404, message: "Customer profile not found" });
    }

    const tierCoupons = await CouponModel.find({
      status: true,
      $or: [
        { targetTier: customer.rank },
        { targetTier: 'All' },
        { targetCustomerId: customer._id },
        { _id: { $in: customer.assignedCoupons || [] } }
      ]
    });

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        customerName: customer.name,
        email: customer.email,
        rank: customer.rank || 'Bronze',
        rankScore: customer.rankScore || 0,
        activityStatus: customer.activityStatus || 'Moderately Active',
        activityScore: customer.activityScore || 50,
        aiSummary: customer.aiSummary || 'Welcome! Keep shopping and leaving reviews to earn premium status rewards.',
        rankUpdatedAt: customer.rankUpdatedAt,
        coupons: tierCoupons
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const approveAiEvaluation = async (req, res) => {
  try {
    const { customerId, action, rank, rankScore, activityStatus, aiSummary, customCoupon } = req.body;
    if (!customerId) {
      return res.status(400).json({ success: false, status: 400, message: "Customer ID is required" });
    }

    const customer = await CustomerModel.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, status: 404, message: "Customer not found" });
    }

    if (action === 'reject') {
      customer.aiEvaluationStatus = 'Rejected';
      customer.pendingRank = null;
      customer.pendingRankScore = null;
      customer.pendingActivityStatus = null;
      customer.pendingAiSummary = "";
      customer.pendingRewardCoupon = null;
      await customer.save();

      return res.status(200).json({
        success: true,
        status: 200,
        message: "AI evaluation rejected by Admin",
        data: customer
      });
    }

    // Approve or Approve with Custom Edits
    const finalRank = rank || customer.pendingRank || customer.rank || 'Bronze';
    const finalScore = rankScore !== undefined ? Number(rankScore) : (customer.pendingRankScore || customer.rankScore || 50);
    const finalActivity = activityStatus || customer.pendingActivityStatus || customer.activityStatus || 'Moderately Active';
    const finalSummary = aiSummary || customer.pendingAiSummary || customer.aiSummary || 'Admin approved rank status.';
    const couponToIssue = customCoupon || customer.pendingRewardCoupon;

    customer.rank = finalRank;
    customer.rankScore = finalScore;
    customer.activityStatus = finalActivity;
    customer.activityScore = finalScore;
    customer.aiSummary = finalSummary;
    customer.rankUpdatedAt = new Date();
    customer.aiEvaluationStatus = 'Approved';

    // Clear pending fields
    customer.pendingRank = null;
    customer.pendingRankScore = null;
    customer.pendingActivityStatus = null;
    customer.pendingAiSummary = "";
    customer.pendingRewardCoupon = null;

    let createdCoupon = null;
    if (couponToIssue && couponToIssue.code) {
      let existingCoupon = await CouponModel.findOne({ code: couponToIssue.code.toUpperCase() });
      if (!existingCoupon) {
        existingCoupon = new CouponModel({
          code: couponToIssue.code.toUpperCase(),
          discount: couponToIssue.discount || "20%",
          discountType: couponToIssue.discountType || "percentage",
          minAmoutSpend: Number(couponToIssue.minAmoutSpend) || 0,
          expiryDate: couponToIssue.expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          targetTier: finalRank,
          isAiReward: true,
          targetCustomerId: customer._id,
          status: true
        });
        await existingCoupon.save();
      }
      createdCoupon = existingCoupon;

      if (!customer.assignedCoupons) customer.assignedCoupons = [];
      if (!customer.assignedCoupons.includes(existingCoupon._id)) {
        customer.assignedCoupons.push(existingCoupon._id);
      }
    }

    await customer.save();

    // Trigger real-time Notification for Customer
    if (customer.userId) {
      try {
        const couponMsg = createdCoupon ? ` Unlocked Reward Coupon: ${createdCoupon.code} (${createdCoupon.discount} OFF)!` : '';
        await NotificationModel.create({
          recipientId: customer.userId._id || customer.userId,
          type: 'rank_reward',
          status: 'pending',
          message: `🏆 [Rank & Reward Approved] Admin has approved your AI evaluation! You are now ranked as ${finalRank} Customer (${finalActivity}).${couponMsg}`
        });
      } catch (e) {
        console.error("Error creating approved notification:", e);
      }
    }

    const updatedCustomer = await CustomerModel.findById(customerId).populate("assignedCoupons");

    return res.status(200).json({
      success: true,
      status: 200,
      message: `AI Evaluation approved! ${customer.name} is now ${finalRank} Customer.`,
      data: updatedCustomer
    });
  } catch (err) {
    console.error("Error in approveAiEvaluation:", err);
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

module.exports = {
  Register, all, single, update, DeleteOne, softDelete, toggleBlock, updateRank, getRankAndRewards, approveAiEvaluation
}