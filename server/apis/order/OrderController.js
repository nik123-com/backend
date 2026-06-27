const orderModel = require("./OrderModel")
const nodemailer = require("nodemailer");
const customerModel = require("../customer/CustomerModel")
const cartModel = require("../cart/CartModel")
const productModel = require("../product/ProductModel")

const addOrder = async (req, res) => {
  try {
    if (!req.body.userId) {
      return res.send({ status: 400, success: false, message: "User Id is required" })
    }
    if (!req.body.shipingAddress) {
      return res.send({ status: 400, success: false, message: "Delivery address is required" })
    }

    let customer = await customerModel.findOne({ userId: req.body.userId })
    if (!customer) {
      return res.send({ status: 404, success: false, message: "Customer profile not found" })
    }

    let cartItems = await cartModel.find({ user_id: req.body.userId })
    if (cartItems.length == 0) {
      return res.send({ status: 404, success: false, message: "Your cart is empty" })
    }

    let totalOrders = await orderModel.countDocuments()
    let products = cartItems.map(item => ({
      productId: item.product_id,
      quantity: item.qty
    }))

    let grandTotal = 0
    for (let item of cartItems) {
      let product = await productModel.findOne({ _id: item.product_id })
      if (!product) continue
      grandTotal += Number(product.price) * item.qty
    }
    let shippingCharge = 70
    grandTotal += shippingCharge

    let newOrder = new orderModel()
    newOrder.autoId = totalOrders + 1
    newOrder.customerId = customer._id
    newOrder.products = products
    newOrder.addressId = req.body.shipingAddress
    newOrder.couponApplied = req.body.couponApplied || ""
    newOrder.couponId = req.body.couponId || null
    newOrder.discount = req.body.discount || 0
    newOrder.grandTotal = req.body.totalAmount || grandTotal
    newOrder.paymentMethod = req.body.paymentMethod || "COD"
    newOrder.paymentStatus = req.body.paymentStatus || "Pending"
    newOrder.orderStatus = "Placed"

    const savedOrder = await newOrder.save()

    await cartModel.deleteMany({ user_id: req.body.userId })

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        service: "Gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
      try {
        await transporter.sendMail({
          from: '"PrimeNest" <manviv1253@gmail.com>',
          to: customer.email,
          subject: `Order #${savedOrder.autoId} Confirmed`,
          html: `
            <div style="font-family: Arial;">
              <h2>Order Confirmed</h2>
              <p>Hi <b>${customer.name || "Customer"}</b>,</p>
              <p>Your order has been placed successfully.</p>
              <p><b>Order ID:</b> ${savedOrder.autoId}</p>
              <p><b>Total Amount:</b> Rs.${grandTotal}</p>
              <p>We'll notify you once it's shipped.</p>
              <br/><p>Thanks,<br/>PrimeNest</p>
            </div>`
        })
      } catch (err) {
        console.error("Email send error:", err)
      }
    }

    return res.send({ status: 201, success: true, message: "Order Placed Successfully", data: savedOrder })

  } catch (err) {
    console.log(err)
    return res.send({ status: 500, success: false, message: "Internal server error" })
  }
}

const getOrders = async (req, res) => {
  try {
    let customerId = req.body.customerId
    if (!customerId && req.body.userId) {
      let customer = await customerModel.findOne({ userId: req.body.userId })
      if (customer) customerId = customer._id
    }
    if (!customerId) {
      return res.send({ success: false, status: 400, message: "Customer id is required" })
    }

    let order = await orderModel.find({ customerId, isDeleted: false })
      .populate("products.productId")
      .populate("addressId")
      .sort({ createdAt: -1 });
    let total = await orderModel.countDocuments({ isDeleted: false })
    res.send({
      success: true,
      status: 200,
      message: "All orders loaded",
      total: total,
      data: order
    })
  }
  catch (err) {
    console.log(err);
    res.send({ success: false, status: 500, message: err.message })
  }
};
const countOrders = async (req, res) => {
  try {

    const count = await orderModel.countDocuments({
      isDeleted: false
    });

    return res.send({
      success: true,
      status: 200,
      message: "Order count fetched successfully",
      count: count
    });

  } catch (err) {
    console.log(err);

    return res.send({
      success: false,
      status: 500,
      message: err.message
    });
  }
};
const allOrders = async (req, res) => {
  try {


    let orders = await orderModel
      .find({ isDeleted: false })
      .populate("customerId", "name email")
      .populate("couponId", "code discount")
      .populate("addressId");


    let total = await orderModel.countDocuments({ isDeleted: false });

    return res.send({
      success: true,
      status: 200,
      message: "All orders loaded",
      total: total,
      data: orders
    });

  } catch (err) {
    console.log(err);
    
    return res.send({
      success: false,
      status: 500,
      message: err.message
    });
  }
};
const updateOrderStatus = async (req, res) => {
  try {
    if (!req.body._id) {
      return res.send({
        success: false,
        status: 400,
        message: "_id is required"
      });
    }

    if (!req.body.orderStatus) {
      return res.send({
        success: false,
        status: 400,
        message: "orderStatus is required"
      });
    }

    let order = await orderModel.findOne({ _id: req.body._id });

    if (!order) {
      return res.send({
        success: false,
        status: 404,
        message: "Order not found"
      });
    }

    order.orderStatus = req.body.orderStatus;
    if (req.body.paymentStatus) {
      order.paymentStatus = req.body.paymentStatus;
    }
    order.updatedAt = Date.now();

    await order.save();

    return res.send({
      success: true,
      status: 200,
      message: "Order status updated successfully",
      data: order
    });

  } catch (err) {
    console.log(err);
    return res.send({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const singleOrder = async (req, res) => {
  try {
    if (!req.body._id) {
      return res.send({
        success: false,
        status: 400,
        message: "_id is required"
      });
    }

    let order = await orderModel.findOne({ _id: req.body._id })
      .populate("customerId", "name email phone")
      .populate("products.productId")
      .populate("addressId")
      .populate("couponId");

    if (!order) {
      return res.send({
        success: false,
        status: 404,
        message: "Order not found"
      });
    }

    return res.send({
      success: true,
      status: 200,
      message: "Order details loaded",
      data: order
    });

  } catch (err) {
    console.log(err);
    return res.send({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

module.exports = {
  addOrder, getOrders, countOrders, allOrders, updateOrderStatus, singleOrder
}