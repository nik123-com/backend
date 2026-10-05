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

    const AddressModel = require("../address/AddressModel");
    let addressRecord = await AddressModel.findById(req.body.shipingAddress);
    if (!addressRecord) {
      return res.send({ status: 400, success: false, message: "Selected delivery address was not found" });
    }

    if (req.body.pin && (!addressRecord.pin || addressRecord.pin === "N/A" || addressRecord.pin.trim() === "")) {
      addressRecord.pin = req.body.pin.trim();
      await addressRecord.save();
    }

    if (!addressRecord.pin || addressRecord.pin === "N/A" || addressRecord.pin.trim() === "") {
      return res.send({
        status: 400,
        success: false,
        message: "Delivery PIN code is required. Please provide your 6-digit delivery PIN code."
      });
    }

    if (!addressRecord.houseno || addressRecord.houseno.trim() === "") {
      return res.send({
        status: 400,
        success: false,
        message: "Delivery address (House/Street) is required to place your order."
      });
    }

    let customer = await customerModel.findOne({ userId: req.body.userId })
    if (!customer) {
      return res.send({ status: 404, success: false, message: "Customer profile not found" })
    }

    let cartItems = await cartModel.find({ user_id: req.body.userId })
    if (cartItems.length == 0) {
      return res.send({ status: 404, success: false, message: "Your cart is empty" })
    }

    // Check product stock before placing order
    for (let item of cartItems) {
      let product = await productModel.findOne({ _id: item.product_id })
      if (!product) {
        return res.send({ status: 404, success: false, message: "One or more products in your cart no longer exist" })
      }
      if (product.stock < item.qty) {
        return res.send({
          status: 400,
          success: false,
          message: `Insufficient stock for product: "${product.name}". Available stock: ${product.stock}`
        })
      }
    }

    const NegotiationModel = require("../bargain/NegotiationModel");
    let totalOrders = await orderModel.countDocuments()
    let products = []
    let grandTotal = 0
    const purchasedNegotiationIds = []

    for (let item of cartItems) {
      let product = await productModel.findOne({ _id: item.product_id })
      if (!product) continue

      // Check if customer has an active single-use negotiated deal on this product
      const activeDeal = await NegotiationModel.findOne({
        userId: req.body.userId,
        productId: product._id,
        status: "deal_accepted",
        isPurchased: false,
        expiresAt: { $gt: new Date() }
      }).sort({ createdAt: -1 });

      const effectivePrice = activeDeal?.finalAgreedPrice
        ? Number(activeDeal.finalAgreedPrice)
        : (Number(item.price) || Number(product.price) || 0);

      if (activeDeal) {
        purchasedNegotiationIds.push(activeDeal._id);
      }

      grandTotal += effectivePrice * item.qty
      products.push({
        productId: product._id,
        quantity: item.qty,
        vendorId: product.vendorId || null,
        price: effectivePrice,
        itemStatus: 'pending'
      })
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
    const isOnline = (newOrder.paymentMethod || "").toUpperCase() === "ONLINE"
    newOrder.paymentStatus = req.body.paymentStatus || (isOnline ? "Paid" : "COD")
    newOrder.orderStatus = "Placed"
    const orderPlacedTime = new Date()
    newOrder.createdAt = orderPlacedTime
    newOrder.updatedAt = orderPlacedTime
    newOrder.statusTimeline = [
      {
        status: "Placed",
        title: "Order placed & payment verified",
        timestamp: orderPlacedTime,
        message: "Order placed & payment verified successfully"
      }
    ]

    const savedOrder = await newOrder.save()

    // Consume single-use negotiated deals so customer will never see it again after purchase
    if (purchasedNegotiationIds.length > 0) {
      await NegotiationModel.updateMany(
        { _id: { $in: purchasedNegotiationIds } },
        {
          $set: {
            isPurchased: true,
            purchasedAt: new Date(),
            orderId: savedOrder._id
          }
        }
      );
    }

    // Subtract stock for ordered products
    for (let item of cartItems) {
      await productModel.findByIdAndUpdate(item.product_id, {
        $inc: { stock: -item.qty }
      })
    }

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
      .sort({ createdAt: -1 })
      .lean();
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
      .populate({
        path: "products.productId",
        populate: { path: "vendorId", select: "businessName ownerName email phone" }
      })
      .populate("couponId", "code discount")
      .populate("addressId")
      .sort({ createdAt: -1 })
      .lean();

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

    const newStatusLower = (req.body.orderStatus || "").toLowerCase();
    const oldStatusLower = (order.orderStatus || "").toLowerCase();

    // Restore stock if cancelled
    if (newStatusLower === "cancelled" && oldStatusLower !== "cancelled") {
      for (let item of order.products) {
        if (item.productId) {
          await productModel.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity }
          });
        }
      }
    } else if (oldStatusLower === "cancelled" && newStatusLower !== "cancelled") {
      for (let item of order.products) {
        if (item.productId) {
          await productModel.findByIdAndUpdate(item.productId, {
            $inc: { stock: -item.quantity }
          });
        }
      }
    }

    order.orderStatus = req.body.orderStatus;
    if (req.body.paymentStatus) {
      order.paymentStatus = req.body.paymentStatus;
    } else if ((req.body.orderStatus || "").toLowerCase() === "delivered") {
      order.paymentStatus = "Paid";
    }
    const updateTime = new Date();
    order.updatedAt = updateTime;

    if (!order.statusTimeline) {
      order.statusTimeline = [];
    }
    const statusTitles = {
      placed: "Order placed & payment verified",
      accepted: "Order accepted by seller & inventory allocated",
      packed: "Package packed and sealed at fulfillment warehouse",
      shipped: "Out for delivery with courier driver",
      delivered: "Package delivered to customer",
      cancelled: "Order cancelled"
    };
    const sLower = (req.body.orderStatus || "").toLowerCase();
    order.statusTimeline.push({
      status: req.body.orderStatus,
      title: statusTitles[sLower] || `Order ${req.body.orderStatus}`,
      timestamp: updateTime,
      message: `Status updated to ${req.body.orderStatus}`
    });

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
      .populate({
        path: "products.productId",
        populate: { path: "vendorId", select: "businessName ownerName email phone" }
      })
      .populate("addressId")
      .populate("couponId")
      .lean();

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
      .sort({ createdAt: -1 })
      .lean();

    // Filter order products to only include products belonging to this vendor
    const vendorSpecificOrders = orders.map(order => {
      const orderObj = order;
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
    for (let item of order.products) {
      if (item.productId && item.productId.vendorId && item.productId.vendorId.toString() === vendorId.toString()) {
        const newStatusLower = (status || "").toLowerCase();
        const oldStatusLower = (item.itemStatus || "").toLowerCase();
        if (newStatusLower === "cancelled" && oldStatusLower !== "cancelled") {
          const prodId = item.productId._id || item.productId;
          await productModel.findByIdAndUpdate(prodId, { $inc: { stock: item.quantity } });
        } else if (oldStatusLower === "cancelled" && newStatusLower !== "cancelled") {
          const prodId = item.productId._id || item.productId;
          await productModel.findByIdAndUpdate(prodId, { $inc: { stock: -item.quantity } });
        }
        item.itemStatus = status;
        itemUpdated = true;
      }
    }

    if (!itemUpdated) {
      return res.status(403).json({ success: false, status: 403, message: "No items found for this vendor in order" });
    }

    order.orderStatus = status;
    if ((status || "").toLowerCase() === "delivered") {
      order.paymentStatus = "Paid";
    }
    const updateTime = new Date();
    order.updatedAt = updateTime;

    if (!order.statusTimeline) {
      order.statusTimeline = [];
    }
    const statusTitles = {
      placed: "Order placed & payment verified",
      accepted: "Order accepted by seller & inventory allocated",
      packed: "Package packed and sealed at fulfillment warehouse",
      shipped: "Out for delivery with courier driver",
      delivered: "Package delivered to customer",
      cancelled: "Order cancelled"
    };
    const sLower = (status || "").toLowerCase();
    order.statusTimeline.push({
      status: status,
      title: statusTitles[sLower] || `Order ${status}`,
      timestamp: updateTime,
      message: `Status updated to ${status}`
    });

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