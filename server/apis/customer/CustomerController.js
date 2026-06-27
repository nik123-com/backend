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
              host: "smtp.gmail.com",
              port: 587,
              secure: false, 
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },

            });
            try {
              const info = await transporter.sendMail({
                from: '"Our Team" nikhilxe@gmail.com', // sender address
                to: {email}, // list of recipients
                subject: "Regarding Testing", // subject line
                text: "Someone Registered with your Email Id", // plain text body
                html: "<b>Someone Registered with your Email Id</b>", // HTML body
              });

              console.log("Message sent: %s", info.messageId);
              // Preview URL is only available when using an Ethereal test account
              console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
            } catch (err) {
              console.error("Error while sending mail:", err);
            }

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

module.exports = {
  Register, all, single, update, DeleteOne, softDelete, toggleBlock
}