const cartModel = require('./CartModel');

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
        if (incomingData.price == undefined || incomingData.price == null) {
            validation.push("price is required");
        }

        if (validation.length > 0) {
            return res.json({
                status: 400,
                success: false,
                message: validation.join(", ")
            });
        }

        const existingData = await cartModel.findOne({
            product_id: incomingData.product_id,
            user_id: incomingData.user_id,
        });

        if (existingData) {
        

            existingData.qty= existingData.qty + 1,

          
            await existingData.save();
        } else {


            const savedData = new cartModel({
                product_id: incomingData.product_id,
                user_id: incomingData.user_id,
                qty: incomingData.qty,
                price: incomingData.price,
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
        const allData = await cartModel.find({ status: true,  user_id: req.body.userId}).populate("product_id").populate("user_id");
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

module.exports = {
    add,
    all,
    single,
    update,
    DeleteOne,
    softDelete,
    increment,
    decrement
}