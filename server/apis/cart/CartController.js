const cartModel = require('./CartModel');
const productModel = require('../product/ProductModel');
const NegotiationModel = require('../bargain/NegotiationModel');

// CREATE OPERATION
const add = async (req, res) => {
    try {
        const incomingData = req.body || {};
        let validation = [];

        if (!incomingData.product_id) {
            validation.push("ProductId is required");
        }
        if (!incomingData.user_id) {
            validation.push("UserId is required");
        }
        if (incomingData.qty === undefined || incomingData.qty === null) {
            validation.push("qty is required");
        }

        if (validation.length > 0) {
            return res.json({
                status: 400,
                success: false,
                message: validation.join(", ")
            });
        }

        const product = await productModel.findById(incomingData.product_id);
        if (!product) {
            return res.json({
                status: 404,
                success: false,
                message: "Product not found"
            });
        }

        // Check if customer has an active unpurchased single-use negotiated deal
        const activeDeal = await NegotiationModel.findOne({
            userId: incomingData.user_id,
            productId: incomingData.product_id,
            status: "deal_accepted",
            isPurchased: false,
            expiresAt: { $gt: new Date() }
        }).sort({ createdAt: -1 });

        let effectivePrice = (incomingData.price !== undefined && incomingData.price !== null)
            ? Number(incomingData.price)
            : Number(product.price);

        if (activeDeal && activeDeal.finalAgreedPrice) {
            effectivePrice = Number(activeDeal.finalAgreedPrice);
        }

        const existingData = await cartModel.findOne({
            product_id: incomingData.product_id,
            user_id: incomingData.user_id,
        });

        const currentQty = existingData ? existingData.qty : 0;
        const addQty = Number(incomingData.qty) || 1;

        // When a negotiated deal is applied, the user negotiated for addQty units
        const targetQty = activeDeal ? addQty : (currentQty + addQty);

        if (product.stock < targetQty) {
            return res.json({
                status: 400,
                success: false,
                message: product.stock <= 0 ? "Product is out of stock" : `Only ${product.stock} units available in stock.`
            });
        }

        if (existingData) {
            existingData.qty = targetQty;
            existingData.price = effectivePrice;
            await existingData.save();
        } else {
            const savedData = new cartModel({
                product_id: incomingData.product_id,
                user_id: incomingData.user_id,
                qty: targetQty,
                price: effectivePrice,
            });

            await savedData.save();
        }

        return res.json({
            status: 201,
            success: true,
            message: "Product Added to Cart"
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message
        });
    }
};

// READ ALL OPERATION
const all = async (req, res) => {
    try {
        const userId = req.body?.userId;
        const allData = await cartModel.find({ status: true,  user_id: userId}).populate("product_id").populate("user_id");

        if (userId && allData && allData.length > 0) {
            for (let item of allData) {
                if (item.product_id) {
                    const prodId = item.product_id._id || item.product_id;
                    const activeDeal = await NegotiationModel.findOne({
                        userId: userId,
                        productId: prodId,
                        status: "deal_accepted",
                        isPurchased: false,
                        expiresAt: { $gt: new Date() }
                    }).sort({ createdAt: -1 });

                    if (activeDeal && activeDeal.finalAgreedPrice) {
                        const dealPrice = Number(activeDeal.finalAgreedPrice);
                        if (item.price !== dealPrice) {
                            item.price = dealPrice;
                            await cartModel.updateOne({ _id: item._id }, { $set: { price: dealPrice } });
                        }
                    } else if (item.product_id.price && item.price !== Number(item.product_id.price)) {
                        const origPrice = Number(item.product_id.price);
                        item.price = origPrice;
                        await cartModel.updateOne({ _id: item._id }, { $set: { price: origPrice } });
                    }
                }
            }
        }

        const total = await cartModel.countDocuments({});

        return res.json({
            status: 200,
            success: true,
            message: "Carts loaded successfully",
            total: total,
            data: allData
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message,
        });
    }
};

const single = async (req, res) => {
    try {
        const cartId = req.body?._id;

        if (!cartId) {
            return res.json({
                status: 400,
                success: false,
                message: "_id is required"
            });
        }

        const cart = await cartModel.findOne({ _id: cartId });

        if (!cart) {
            return res.json({
                status: 404,
                success: false,
                message: "Cart not found"
            });
        }

        return res.json({
            status: 200,
            success: true,
            message: "Cart fetched",
            data: cart
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message,
        });
    }
};

// UPDATE OPERATION
const update = async (req, res) => {
    try {
        const cartId = req.body?._id;
        const incomingData = req.body || {};

        if (!cartId) {
            return res.json({
                status: 400,
                success: false,
                message: "_id is required"
            });
        }

        const cartData = await cartModel.findOne({ _id: cartId });

        if (!cartData) {
            return res.json({
                status: 404,
                success: false,
                message: "Cart not found"
            });
        }

        if (incomingData.product_id) {
            cartData.product_id = incomingData.product_id
        }
        if (incomingData.user_id) {
            cartData.user_id = incomingData.user_id;
        }
        if (incomingData.qty !== undefined && incomingData.qty !== null) {
            cartData.qty = incomingData.qty;
        }
        if (incomingData.price !== undefined && incomingData.price !== null) {
            cartData.price = incomingData.price;
        }

        cartData.updatedAt = Date.now();

        const updatedCart = await cartData.save();
        return res.json({
            status: 200,
            success: true,
            message: "Cart updated successfully",
            data: updatedCart
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message,
        });
    }
}


//DeleteOne
const DeleteOne = (req, res) => {
    let ErrMsg = [];

    if (!req.body._id) {
        ErrMsg.push("_id is required");
    }

    if (ErrMsg.length > 0) {
        res.send({
            status: 404,
            message: ErrMsg,
            success: false,
        });
    } else {
        cartModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Not Found",
                        success: false,
                    });
                } else {
                    cartModel.deleteOne({ _id: req.body._id }).then(() => {
                        res.send({
                            status: 200,
                            message: "deleted Successfully",
                            success: true,
                        });
                    }).catch((err) => {
                        res.send({
                            status: 500,
                            message: "Internal Server Error",
                            success: false,
                        });
                    })
                }
            })
            .catch((err) => {
                res.send({
                    status: 500,
                    message: "Internal Server Error",
                    success: false,
                });
            });
    }
};

//Soft Delete
const softDelete = (req, res) => {
    let ErrMsg = [];

    if (!req.body._id) {
        ErrMsg.push("_id is required");
    }

    if (ErrMsg.length > 0) {
        res.send({
            status: 404,
            message: ErrMsg,
            success: false,
        });
    } else {
        cartModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Not Found",
                        success: false,
                    });
                } else {
                    ExistCate.status = false;

                    ExistCate.save()
                        .then(() => {
                            res.send({
                                status: 200,
                                message: "deleted Successfully",
                                success: true,
                            });
                        })
                        .catch((err) => {
                            res.send({
                                status: 500,
                                message: "Internal Server Error",
                                success: false,
                            });
                        });
                }
            })
            .catch((err) => {
                res.send({
                    status: 500,
                    message: "Internal Server Error",
                    success: false,
                });
            });
    }
};
//Increase
const increment = async (req, res) => {
    try {
        const { cart_id } = req.body;

        if (!cart_id) {
            return res.json({
                status: 400,
                success: false,
                message: "Cart id is required"
            });
        }

        const existingData = await cartModel.findById(cart_id);

        if (!existingData) {
            return res.json({
                status: 404,
                success: false,
                message: "Cart not found"
            });
        }

        const product = await productModel.findById(existingData.product_id);
        if (product && product.stock < existingData.qty + 1) {
            return res.json({
                status: 400,
                success: false,
                message: `Cannot increment. Only ${product.stock} units available in stock.`
            });
        }

        existingData.qty = existingData.qty + 1;
        await existingData.save();

        return res.json({
            status: 200,
            success: true,
            message: "Quantity incremented Successfully",
            data: existingData
        });

    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message,
        });
    }
};
const decrement = async (req, res) => {
  try {
    const { cart_id } = req.body;
    const existingData = await cartModel.findById(cart_id);
    if (!existingData) {
      return res.json({
        status: 404,
        success: false,
        message: "Cart not found",
      });
    }
    existingData.qty = existingData.qty - 1;

    if (existingData.qty === 0) {
      await cartModel.findByIdAndDelete(cart_id);
      return res.json({
        status: 200,
        success: true,
        message: "Row deleted because qty became 0",
      });
    }

    // otherwise save updated qty
    await existingData.save();

    return res.json({
      status: 200,
      success: true,
      message: "Quantity decremented",
      data: existingData,
    });

  } catch (err) {
    return res.json({
      status: 500,
      success: false,
      message: err.message,
    });
  }
};

const SmartCartService = require('./SmartCartService');

const smartOptimization = async (req, res) => {
  try {
    const userId = req.body?.userId || (req.decoded ? req.decoded.userId : null);
    const currentCouponCode = req.body?.couponCode || null;

    const result = await SmartCartService.optimizeCart({
      userId,
      currentCouponCode
    });

    return res.status(200).json({
      status: 200,
      success: true,
      data: result
    });
  } catch (err) {
    console.error("smartOptimization error:", err);
    return res.status(500).json({
      status: 500,
      success: false,
      message: err.message
    });
  }
};

module.exports = {
    add,
    all,
    single,
    update,
    DeleteOne,
    softDelete,
    increment,
    decrement,
    smartOptimization
}