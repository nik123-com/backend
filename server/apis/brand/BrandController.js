const BrandModel = require('./BrandModel');
const { uploadImg } = require('../../../utilities/helper');
// CREATE OPERATION
const add = async (req, res) => {
    try {
        const incomingData = req.body || {};
        let validation = "";
        if (!req.file) {
            validation += " File is required"
        }
        if (!incomingData.name) {
            validation += "name is required"
        }
        if (!!validation) {
            return res.json({
                status: 400,
                success: false,
                message: validation
            })
        }
        else {
            const existingData = await BrandModel.findOne({ name: incomingData.name });
            if (existingData) { 
                return res.json({
                    status: 400,
                    success: false,
                    message: "Data already exists"
                })
            }
            let BrandObj = new BrandModel();
            BrandObj.name = req.body.name;
            try {
                const url = await uploadImg(req.file.buffer);
                BrandObj.logo = url;

            } catch (err) {
                console.log(err);

            }
            await BrandObj.save();
            res.json({
                status: 201,
                success: true,
                message: "Brand created Successfully !",
                data: BrandObj
            })
        }
    }
    catch (err) {
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
        const allData = await BrandModel.find({ status: true });

        const total = await BrandModel.countDocuments({});

        res.json({
            status: 200,
            success: true,
            message: "Brands loaded successfully",
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
        const brandId = req.body?._id;

        if (!brandId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const brand = await BrandModel.findOne({ _id: brandId })

        if (!brand) {
            res.json({
                status: 404,
                success: false,
                message: "brand not found"
            })
        } else {
            res.json({
                status: 200,
                success: true,
                message: "brand fetched",
                data: brand
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

// UPDATE

const update = async (req, res) => {
    try {
        const brandId = req.body?._id;
        const incomingData = req.body;

        if (!brandId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const brandData = await BrandModel.findOne({ _id: brandId })

        if (!brandData) {
            res.json({
                status: 404,
                success: false,
                message: "brand not found"
            })
        } else {

            if (incomingData.name) {
                brandData.name = incomingData.name;
            }
            if (req.file) {
                brandData.logo = req.file.filename
            }
            brandData.updatedAt = Date.now()
            let updatedbrand = await brandData.save()

            res.json({
                status: 200,
                succes: true,
                message: "Brand Updated Successfully",
                data: updatedbrand
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
        BrandModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Brand Not Found",
                        success: false,
                    });
                } else {
                    BrandModel.deleteOne({ _id: req.body._id }).then(() => {
                        res.send({
                            status: 200,
                            message: "Brand deleted Successfully",
                            success: true,
                        });
                    }).catch((err) => {
                        res.send({
                            status: 200,
                            message: "ID not Found",
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
        BrandModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Brand Not Found",
                        success: false,
                    });
                } else {
                    ExistCate.status = false;

                    ExistCate.save()
                        .then(() => {
                            res.send({
                                status: 201,
                                message: "Status Updated Successfully",
                                success: true,
                            });
                        })
                        .catch((err) => {
                            res.send({
                                status: 500,
                                message: "Id Not Found",
                                success: false,
                            });
                        });
                }
            })
            .catch((err) => {
                res.send({
                    status: 404,
                    message: "Internal Server Error",
                    success: false,
                });
            });
    }
};

module.exports = {
    add, all, single, update, DeleteOne, softDelete
}