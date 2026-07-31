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
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
      transporter.sendMail({
        from: '"PrimeNest" <manviv1253@gmail.com>',
        to: `${customer.email}, nikhilxe@gmail.com`,
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
      }).catch((err) => {
        console.error("Email send error:", err)
      })
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
      .populate("addressId")
      .sort({ createdAt: -1 });


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

// VENDOR SPECIFIC ORDER METHODS
const vendorOrders = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const products = await productModel.find({ vendorId }).select('_id');
    const productIds = products.map(p => p._id);

    const orders = await orderModel.find({
      "products.productId": { $in: productIds },
      isDeleted: false
    })
      .populate("customerId", "name email Contact Address")
      .populate("products.productId")
      .populate("addressId")
      .sort({ createdAt: -1 });

    // Filter order products to only include products belonging to this vendor
    const vendorSpecificOrders = orders.map(order => {
      const orderObj = order.toObject();
      orderObj.vendorItems = orderObj.products.filter(item => {
        return item.productId && item.productId.vendorId && item.productId.vendorId.toString() === vendorId.toString();
      });
      orderObj.vendorSubtotal = orderObj.vendorItems.reduce((acc, item) => {
        const itemPrice = Number(item.price || item.productId.price || 0);
        return acc + (itemPrice * item.quantity);
      }, 0);
      return orderObj;
    });

    return res.status(200).json({
      success: true,
      status: 200,
      message: "Vendor orders fetched successfully",
      data: vendorSpecificOrders
    });
  } catch (err) {
    console.error("vendorOrders error:", err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: err.message
    });
  }
};

const updateVendorOrderStatus = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { orderId, status } = req.body; // status: 'accepted' | 'packed' | 'shipped' | 'delivered'

    if (!orderId || !status) {
      return res.status(400).json({
        success: false,
        status: 400,
        message: "orderId and status are required"
      });
    }

    const order = await orderModel.findById(orderId).populate("products.productId");
    if (!order) {
      return res.status(404).json({ success: false, status: 404, message: "Order not found" });
    }

    let itemUpdated = false;
    order.products.forEach(item => {
      if (item.productId && item.productId.vendorId && item.productId.vendorId.toString() === vendorId.toString()) {
        item.itemStatus = status;
        itemUpdated = true;
      }
    });

    if (!itemUpdated) {
      return res.status(403).json({ success: false, status: 403, message: "No items found for this vendor in order" });
    }

    order.updatedAt = Date.now();
    await order.save();

    return res.status(200).json({
      success: true,
      status: 200,
      message: `Order status updated to ${status}`,
      data: order
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

const vendorInvoice = async (req, res) => {
  try {
    const vendorId = req.vendor._id;
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, status: 400, message: "orderId is required" });
    }

    const order = await orderModel.findById(orderId)
      .populate("customerId")
      .populate("products.productId")
      .populate("addressId");

    if (!order) {
      return res.status(404).json({ success: false, status: 404, message: "Order not found" });
    }

    const vendor = req.vendor;
    const vendorItems = order.products.filter(item => 
      item.productId && item.productId.vendorId && item.productId.vendorId.toString() === vendorId.toString()
    );

    const subtotal = vendorItems.reduce((acc, item) => acc + (Number(item.price || item.productId.price || 0) * item.quantity), 0);

    return res.status(200).json({
      success: true,
      status: 200,
      data: {
        invoiceNo: `INV-V${vendor._id.toString().slice(-4)}-${order.autoId}`,
        date: order.createdAt,
        vendor: {
          businessName: vendor.businessName,
          gstNumber: vendor.gstNumber,
          panNumber: vendor.panNumber,
          address: vendor.address,
          email: vendor.email,
          phone: vendor.phone,
          logo: vendor.logo
        },
        customer: {
          name: order.customerId?.name || "Customer",
          email: order.customerId?.email || "",
          contact: order.customerId?.Contact || "",
          address: order.addressId
        },
        items: vendorItems.map(item => ({
          name: item.productId.name,
          sku: item.productId.sku || "N/A",
          quantity: item.quantity,
          price: Number(item.price || item.productId.price || 0),
          subtotal: Number(item.price || item.productId.price || 0) * item.quantity
        })),
        subtotal,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: 500, message: err.message });
  }
};

module.exports = {
  addOrder, getOrders, countOrders, allOrders, updateOrderStatus, singleOrder,
  vendorOrders, updateVendorOrderStatus, vendorInvoice
}