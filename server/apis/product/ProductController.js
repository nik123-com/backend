const { uploadImg } = require('../../../utilities/helper');
const ProductModel = require('./ProductModel')
// CREATE OPERATION
const add = async (req, res) => {
    try {
        const incomingData = req.body || {};
        let validation = ""

        if (!incomingData.name) {
            validation += "name is required"
        }
        if (!incomingData.description) {
            validation += ", Description is required"
        }
        if (!incomingData.price) {
            validation += " Price is required"
        }
        if (!incomingData.category_id) {
            validation += " Category Id is required"
        }
        if (!incomingData.brand_id) {
            validation += " Brand Id is required"
        }

        if (!req.files || req.files.length === 0) {
            validation += "File is Required"
        }

        if (!!validation) {
            return res.json({
                status: 400,
                success: false,
                message: validation
            })
        }
        else {
            const nameRegex = new RegExp("^" + incomingData.name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i");
            const query = {
                name: nameRegex,
                category_id: incomingData.category_id
            };
            if (incomingData.brand_id) {
                query.brand_id = incomingData.brand_id;
            } else {
                query.$or = [{ brand_id: null }, { brand_id: { $exists: false } }];
            }

            const existingData = await ProductModel.findOne(query);
            if (!!existingData) {
                const qtyToAdd = Number(incomingData.stock) > 0 ? Number(incomingData.stock) : 1;
                existingData.stock = (Number(existingData.stock) || 0) + qtyToAdd;
                if (req.files && req.files.length > 0) {
                    try {
                        const urls = await Promise.all(
                            req.files.map(async (f) => await uploadImg(f.buffer))
                        );
                        existingData.image = [...(existingData.image || []), ...urls];
                    } catch (err) {
                        console.log(err);
                    }
                }
                await existingData.save();
                return res.json({
                    status: 200,
                    success: true,
                    message: `Product already exists. Automatically incremented quantity by ${qtyToAdd} (Total stock: ${existingData.stock}).`,
                    data: existingData,
                    isExisting: true
                });
            }

            // // If we need Array
            let ProductObj = new ProductModel();
            ProductObj.name = req.body.name;
            ProductObj.description = req.body.description;
            ProductObj.price = req.body.price;
            ProductObj.category_id = req.body.category_id;
            ProductObj.brand_id = req.body.brand_id;
            req.files.map((f) => {
                ProductObj.image.push(f.filename)
            })

            try {
                const urls = await Promise.all(
                    req.files.map(async (f) => {
                        return await uploadImg(f.buffer);
                    })
                );

                ProductObj.image = urls;

            } catch (err) {
                console.log(err);
                return res.send({
                    success: false,
                    status: 403,
                    message: "Cloudinary error",
                    err: err,
                });
            }

            await ProductObj.save();
            res.json({
                status: 201,
                success: true,
                message: "Product created Successfully !",
                data: ProductObj
            })
        }
    } catch (err) {
        res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err.message
        })
    }
}
// READ OPERATION
// To GET ALL DOCUMENTS
const all = async (req, res) => {

    try {
        const allData = await ProductModel.find(req.body).populate("category_id").populate("brand_id");
        const total = await ProductModel.countDocuments({});
        res.json({
            status: 201,
            success: true,
            message: "Products loaded successfully",
            total: total,
            data: allData
        })
    } catch (err) {
        res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err,
        })
    }
}
const single = async (req, res) => {
    try {
        const ProductId = req.body?._id;

        if (!ProductId) {
            return res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const Product = await ProductModel.findOne({_id: ProductId }).populate("category_id").populate("brand_id")

        if (!Product) {
            return res.json({
                status: 404,
                success: false,
                message: "Product not found"
            })
        } else {
            res.json({
                status: 200,
                success: true,
                message: "Product fetched",
                data: Product
            })
        }
    } catch (err) {
        res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err,
        })
    }
}

// UPDATE;
const update = async (req, res) => {
    try {
        const ProductId = req.body?._id;
        const incomingData = req.body;

        if (!ProductId) {
            return res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const ProductData = await ProductModel.findOne({_id: ProductId })

        if (!ProductData) {
            return res.json({
                status: 404,
                success: false,
                message: "Product not found"
            })
        } else {

            const wasOff = ProductData.status === false;
            if (incomingData.name) {
                ProductData.name = incomingData.name;
            }
            if (incomingData.description) {
                ProductData.description = incomingData.description;
            }
            if (incomingData.price !== undefined && incomingData.price !== null && incomingData.price !== "") {
                ProductData.price = incomingData.price;
            }
            if (incomingData.category_id) {
                ProductData.category_id = incomingData.category_id;
            }
            if (incomingData.brand_id) {
                ProductData.brand_id = incomingData.brand_id;
            }
            if (incomingData.status !== undefined) {
                ProductData.status = incomingData.status === "true" || incomingData.status === true;
            }
            if (req.files && req.files.length > 0) {
                try {
                    const urls = await Promise.all(
                        req.files.map(async (f) => {
                            return await uploadImg(f.buffer);
                        })
                    );
                    ProductData.image = urls;
                } catch (imgErr) {
                    console.log(imgErr);
                }
            } else if (req.file) {
                try {
                    const url = await uploadImg(req.file.buffer);
                    ProductData.image = [url];
                } catch (imgErr) {
                    console.log(imgErr);
                }
            }
            ProductData.updatedAt = Date.now();
            const isNowOn = ProductData.status === true;

            let updatedProduct = await ProductData.save();

            if (wasOff && isNowOn) {
                try {
                    const StockNotification = require('../notification/StockNotificationModel');
                    const Notification = require('../notification/NotificationModel');

                    const pendingSubscribers = await StockNotification.find({
                        productId: ProductData._id,
                        status: 'pending'
                    });

                    for (let sub of pendingSubscribers) {
                        await Notification.create({
                            recipientId: sub.userId,
                            productId: ProductData._id,
                            type: 'stock_available',
                            message: `Good news! Stock for "${ProductData.name}" is now available.`,
                            status: 'pending'
                        });
                        sub.status = 'notified';
                        await sub.save();
                    }
                } catch (notifErr) {
                    console.error("Error triggering stock notifications:", notifErr);
                }
            }

            res.json({
                status: 200,
                success: true,
                message: "Product Updated Successfully",
                data: updatedProduct
            })
        }
    } catch (err) {
        res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err,
        })
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
        ProductModel
            .findOne({_id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Not Found",
                        success: false,
                    });
                } else {
                    ProductModel.deleteOne({ _id: req.body._id }).then(() => {
                        res.send({
                            status: 200,
                            message: "Category deleted Successfully",
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
const softDelete = async (req, res) => {
    try {
        if (!req.body._id) {
            return res.send({
                status: 404,
                message: "_id is required",
                success: false,
            });
        }
        const ExistCate = await ProductModel.findOne({ _id: req.body._id });
        if (ExistCate == null) {
            return res.send({
                status: 404,
                message: "Not Found",
                success: false,
            });
        }

        const wasOff = ExistCate.status === false;
        ExistCate.status = !ExistCate.status;
        const isNowOn = ExistCate.status === true;

        const data = await ExistCate.save();

        if (wasOff && isNowOn) {
            try {
                const StockNotification = require('../notification/StockNotificationModel');
                const Notification = require('../notification/NotificationModel');

                const pendingSubscribers = await StockNotification.find({
                    productId: ExistCate._id,
                    status: 'pending'
                });

                for (let sub of pendingSubscribers) {
                    await Notification.create({
                        recipientId: sub.userId,
                        productId: ExistCate._id,
                        type: 'stock_available',
                        message: `Good news! Stock for "${ExistCate.name}" is now available.`,
                        status: 'pending'
                    });
                    sub.status = 'notified';
                    await sub.save();
                }
            } catch (notifErr) {
                console.error("Error triggering stock notifications:", notifErr);
            }
        }

        return res.send({
            status: 201,
            message: "Status Updated Successfully",
            success: true,
            data: data,
        });
    } catch (err) {
        return res.send({
            status: 500,
            message: "Internal Server Error: " + err.message,
            success: false,
        });
    }
};

//Filter By Category Id

const FilterByCategoryId = async (req, res) => {
    try {
        const category_id = req.body?.category_id;
        if (!category_id) {
            return res.json({
                status: 400,
                success: false,
                message: "Category id is required"
            });
        }
        const product = await ProductModel.find({category_id: category_id }).populate("category_id");
        if (!product) {
            return res.json({
                status: 404,
                success: false,
                message: "Product not found"
            });
        }
        return res.json({
            status: 200,
            success: true,
            message: "Product fetched",
            data: product
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};


//Filter By Brand Id
const FilterByBrandId = async (req, res) => {
    try {
        const brand_id = req.body?.brand_id;
        if (!brand_id) {
            return res.json({
                status: 400,
                success: false,
                message: "Brand id is required"
            });
        }
        const product = await ProductModel.find({ brand_id: brand_id }).populate("category_id").populate("brand_id");
        if (!product) {
            return res.json({
                status: 404,
                success: false,
                message: "Product not found"
            });
        }
        return res.json({
            status: 200,
            success: true,
            message: "Product fetched",
            data: product
        });
    } catch (err) {
        return res.json({
            status: 500,
            success: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};


// VENDOR SPECIFIC PRODUCT METHODS
const vendorAdd = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const {
            name, description, price, category_id, brand_id,
            stock, sku, warehouse, variants, isDraft,
            seoTitle, seoKeywords, seoDescription, existingImages
        } = req.body;

        if (!name || !price || !category_id) {
            return res.status(400).json({
                success: false,
                status: 400,
                message: "Name, Price, and Category are required."
            });
        }

        // Check if product with same Name, Brand, Category already exists for this vendor
        const nameRegex = new RegExp("^" + name.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + "$", "i");
        const query = {
            vendorId,
            name: nameRegex,
            category_id: category_id
        };

        if (brand_id) {
            query.brand_id = brand_id;
        } else {
            query.$or = [{ brand_id: null }, { brand_id: { $exists: false } }];
        }

        const existingProduct = await ProductModel.findOne(query);

        if (existingProduct) {
            // Automatically increment quantity
            const qtyToAdd = Number(stock) > 0 ? Number(stock) : 1;
            existingProduct.stock = (Number(existingProduct.stock) || 0) + qtyToAdd;

            // Handle optional new images upload if provided
            if (req.files && req.files.length > 0) {
                const uploadedUrls = await Promise.all(
                    req.files.map(async (f) => await uploadImg(f.buffer))
                );
                existingProduct.image = [...(existingProduct.image || []), ...uploadedUrls];
            }

            await existingProduct.save();

            return res.status(200).json({
                success: true,
                status: 200,
                message: `Product already exists. Automatically incremented quantity by ${qtyToAdd} (Total stock: ${existingProduct.stock}).`,
                data: existingProduct,
                isExisting: true
            });
        }

        let imageArr = [];
        if (existingImages) {
            if (Array.isArray(existingImages)) imageArr = existingImages;
            else try { imageArr = JSON.parse(existingImages); } catch (e) { imageArr = [existingImages]; }
        }

        if (req.files && req.files.length > 0) {
            const uploadedUrls = await Promise.all(
                req.files.map(async (f) => await uploadImg(f.buffer))
            );
            imageArr = [...imageArr, ...uploadedUrls];
        }

        let parsedVariants = [];
        if (variants) {
            if (Array.isArray(variants)) parsedVariants = variants;
            else try { parsedVariants = JSON.parse(variants); } catch (e) { parsedVariants = []; }
        }

        const newProduct = new ProductModel({
            name,
            description: description || "",
            price,
            category_id,
            brand_id: brand_id || null,
            vendorId,
            image: imageArr,
            stock: Number(stock) || 0,
            sku: sku || "",
            warehouse: warehouse || "Main Warehouse",
            variants: parsedVariants,
            isDraft: isDraft === true || isDraft === "true",
            seoTitle: seoTitle || "",
            seoKeywords: seoKeywords || "",
            seoDescription: seoDescription || "",
            status: true
        });

        await newProduct.save();

        return res.status(201).json({
            success: true,
            status: 201,
            message: isDraft ? "Product saved as Draft" : "Published successfully",
            data: newProduct
        });
    } catch (err) {
        console.error("vendorAdd error:", err);
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
};

const vendorAll = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const products = await ProductModel.find({ vendorId })
            .populate("category_id")
            .populate("brand_id")
            .sort({ create_at: -1 });

        return res.status(200).json({
            success: true,
            status: 200,
            data: products
        });
    } catch (err) {
        return res.status(500).json({
            success: false,
            status: 500,
            message: err.message
        });
    }
};

const vendorUpdate = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { _id, ...updates } = req.body;

        if (!_id) {
            return res.status(400).json({ success: false, status: 400, message: "Product _id is required" });
        }

        const product = await ProductModel.findOne({ _id, vendorId });
        if (!product) {
            return res.status(404).json({ success: false, status: 404, message: "Product not found or access denied" });
        }

        if (updates.isDraft !== undefined) {
            updates.isDraft = updates.isDraft === true || updates.isDraft === "true";
        }

        if (updates.variants && typeof updates.variants === 'string') {
            try { updates.variants = JSON.parse(updates.variants); } catch (e) {}
        }

        let imageArr = product.image;
        if (updates.existingImages) {
            if (Array.isArray(updates.existingImages)) imageArr = updates.existingImages;
            else try { imageArr = JSON.parse(updates.existingImages); } catch (e) { imageArr = [updates.existingImages]; }
        }

        if (req.files && req.files.length > 0) {
            const uploadedUrls = await Promise.all(
                req.files.map(async (f) => await uploadImg(f.buffer))
            );
            imageArr = [...imageArr, ...uploadedUrls];
        }
        updates.image = imageArr;

        const updated = await ProductModel.findByIdAndUpdate(_id, { $set: updates }, { new: true });

        const isDraftVal = updates.isDraft === true || updates.isDraft === "true";
        return res.status(200).json({
            success: true,
            status: 200,
            message: isDraftVal ? "Product saved as Draft" : "Published successfully",
            data: updated
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

const vendorDelete = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { _id } = req.body;

        if (!_id) {
            return res.status(400).json({ success: false, status: 400, message: "_id is required" });
        }

        const product = await ProductModel.findOneAndDelete({ _id, vendorId });
        if (!product) {
            return res.status(404).json({ success: false, status: 404, message: "Product not found or access denied" });
        }

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Product deleted successfully"
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

const vendorUpdateStock = async (req, res) => {
    try {
        const vendorId = req.vendor._id;
        const { _id, stock, sku, warehouse } = req.body;

        if (!_id) {
            return res.status(400).json({ success: false, status: 400, message: "_id is required" });
        }

        const product = await ProductModel.findOne({ _id, vendorId });
        if (!product) {
            return res.status(404).json({ success: false, status: 404, message: "Product not found or access denied" });
        }

        if (stock !== undefined) product.stock = Number(stock);
        if (sku) product.sku = sku;
        if (warehouse) product.warehouse = warehouse;

        await product.save();

        return res.status(200).json({
            success: true,
            status: 200,
            message: "Inventory updated successfully",
            data: product
        });
    } catch (err) {
        return res.status(500).json({ success: false, status: 500, message: err.message });
    }
};

module.exports = {
    add, all, single, update, DeleteOne, softDelete, FilterByCategoryId, FilterByBrandId,
    vendorAdd, vendorAll, vendorUpdate, vendorDelete, vendorUpdateStock
}