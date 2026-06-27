const { uploadImg } = require('../../../utilities/helper');
const categoryModel = require('./categoryModel')
// CREATE OPERATION
const add = async (req, res) => {
    try {
        const incomingData = req.body || {};
        let validation = "";

        if (!incomingData.name) {
            validation += "name is required"
        }
        if (!incomingData.description) {
            validation += ", Description is required"
        }

        if (!req.file) {
            validation += " File is required";
        }



        if (!!validation) {
            return res.json({
                status: 400,
                success: false,
                message: validation
            })
        }
        else {
            const existingData = await categoryModel.findOne({ name: incomingData.name });
            if (!!existingData) {
                return res.json({
                    status: 400,
                    success: false,
                    message: "Data already exists"
                })
            }

            // const savedData = new categoryModel({
            //     name: incomingData.name,
            //     description: incomingData.description,
            //     image: req.file.filename
                
            // })


            // If we need Array
            let categoryObj = new categoryModel();
            categoryObj.name = req.body.name;
            categoryObj.description = req.body.description;
            // req.files.map((f) => {

            //     categoryObj.image.push(f.filename)
            // })
            try {
            let url= await uploadImg(req.file.buffer)
            categoryObj.image = url

          }catch(err){
            console.log(err);
            
               res.send({
                success: false,
                status:403 ,
                message: "Clodnary err",
                err: err,
              });
          }

            // await categoryObj.save();
            await categoryObj.save();
            res.json({
                status: 201,
                success: true,
                message: "Category created Successfully !",
                data: categoryObj
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
        
        const allData = await categoryModel.find();
        const total = await categoryModel.countDocuments({});
        res.json({
            status: 200,
            success: true,
            message: "categorys loaded successfully",
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
        const categoryId = req.body?._id;

        if (!categoryId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const category = await categoryModel.findOne({ _id: categoryId })

        if (!category) {
            res.json({
                status: 404,
                success: false,
                message: "category not found"
            })
        } else {
            res.json({
                status: 200,
                success: true,
                message: "category fetched",
                data: category
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
        const categoryId = req.body?._id;
        const incomingData = req.body;

        if (!categoryId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
                
            })
        }

        const categoryData = await categoryModel.findOne({ _id: categoryId })

        if (!categoryData) {
            res.json({
                status: 404,
                success: false,
                message: "category not found"
            })
        } else {

            if (incomingData.name) {
                categoryData.name = incomingData.name;
            }
            if (incomingData.description) {
                categoryData.description = incomingData.description;
            }
            if (req.file) {
                categoryData.image = req.file.filename;
            }
            categoryData.updatedAt = Date.now()
            let updatedcategory = await categoryData.save()

            res.json({
                status: 200,
                success: true,
                message: "category Updated Successfully",
                data: updatedcategory
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
        categoryModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Not Found",
                        success: false,
                    });
                } else {
                    categoryModel.deleteOne({ _id: req.body._id }).then(() => {
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
        categoryModel
            .findOne({ _id: req.body._id })
            .then((ExistCate) => {
                if (ExistCate == null) {
                    res.send({
                        status: 404,
                        message: "Not Found",
                        success: false,
                    });
                } else {
                    
                    ExistCate.status = !ExistCate.status;
                    ExistCate.save()
                        .then((data) => {
                            res.send({
                                status: 201,
                                message: "Status changed Succesfully",
                                data: data,
                            });
                        })
                        .catch(() => { });
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


module.exports = {
    add, all, single, update, DeleteOne, softDelete
}