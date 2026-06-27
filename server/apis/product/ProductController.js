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
            const existingData = await ProductModel.findOne({ name: incomingData.name });
            if (!!existingData) {
                return res.json({
                    status: 400,
                    success: false,
                    message: "Product already exists"
                })
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
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const Product = await ProductModel.findOne({_id: ProductId }).populate("category_id")

        if (!Product) {
            res.json({
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
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const ProductData = await ProductModel.findOne({_id: ProductId })

        if (!ProductData) {
            res.json({
                status: 404,
                success: false,
                message: "Product not found"
            })
        } else {

            if (incomingData.name) {
                ProductData.name = incomingData.name;
            }
            if (incomingData.description) {
                ProductData.description = incomingData.description;
            }
            if (req.file) {
                ProductData.image = req.file.filename;
            }
            if (req.categoryId) {
                ProductData.category_id = req.category_id;
            }
            if (req.brand_id) {
                ProductData.brand_id = req.brand_id;
            }
            ProductData.updatedAt = Date.now()
            let updatedProduct = await ProductData.save()

            res.json({
                status: 200,
                succes: true,
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
const softDelete = (req, res) => {
    if (!req.body._id) {
        res.send({
            status: 404,
            message: "_id is required",
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
                    // console.log(ExistCate);
                    ExistCate.status = !ExistCate.status;

                    ExistCate.save()
                        .then((data) => {
                            res.send({
                                status: 201,
                                message: "Status Updated Successfully",
                                data: data,
                            });
                        })
                        .catch((err) => { 
                         res.send({
                            status: 400,
                            success: false,
                            message:err
                         })
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


module.exports = {
    add, all, single, update, DeleteOne, softDelete, FilterByCategoryId, FilterByBrandId
}