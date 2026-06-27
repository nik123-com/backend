const reviewModel = require('../review/ReviewModel')
const ProductModel = require('../product/ProductModel')

const updateProductRating = async (productId) => {
    try {
        if (!productId) return;
        const reviews = await reviewModel.find({ productId: productId, status: true });
        let avgRating = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + (r.rating || 0), 0);
            avgRating = sum / reviews.length;
        }
        await ProductModel.findByIdAndUpdate(productId, { rating: avgRating });
        console.log(`Updated product ${productId} average rating to ${avgRating}`);
    } catch (err) {
        console.error(`Error updating product rating for product ${productId}:`, err);
    }
}

// CREATE Operation
const add = async (req, res) => {
    try {
        const incomingData = req.body;
        let validation = "";
        if (!incomingData.rating) {
            validation += "Rating is required. "
        }
        if (!incomingData.comment) {
            validation += "Comment is required. "
        }
        if (!incomingData.productId) {
            validation += "ProductId is required. "
        }
        if (!!validation) {
            return res.json({
                status: 400,
                success: false,
                message: validation
            })
        }
        else {
            console.log(incomingData);
            const productId = incomingData.productId;
                        
            const savedData = new reviewModel({
                userId : req.decoded.userId,
                productId: productId,
                rating: incomingData.rating,
                comment: incomingData.comment,
            })

            await savedData.save();
            await updateProductRating(productId);

            res.json({
                status: 201,
                success: true,
                message: "Data created",
                data: savedData
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

        const productId = req.body.productId;

        const allData = await reviewModel
            .find({
                productId: productId,
                status: true
            })
            .populate("userId");

        const total = allData.length;

        res.json({
            status: 200,
            success: true,
            message: "review loaded successfully",
            total: total,
            data: allData
        });

    } catch (err) {
        res.json({
            status: 500,
            success: false,
            message: "Internal Server Error: " + err
        });
    }
};

const single = async (req, res) => {
    try {
        const reviewId = req.body?._id;

        if (!reviewId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const review = await reviewModel.findOne({ _id: reviewId })

        if (!review) {
            res.json({
                status: 404,
                success: false,
                message: "review not found"
            })
        } else {
            res.json({
                status: 200,
                success: true,
                message: "review fetched",
                data: review
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
        const reviewId = req.body?._id;
        const incomingData = req.body;

        if (!reviewId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const reviewData = await reviewModel.findOne({ _id: reviewId })

        if (!reviewData) {
            res.json({
                status: 404,
                success: false,
                message: "review not found"
            })
        } else {

            if (incomingData.rating) {
                reviewData.rating = incomingData.rating;
            }
            if (incomingData.comment) {
                reviewData.comment = incomingData.comment;
            }
            reviewData.updatedAt = Date.now()
            let updatedreview = await reviewData.save()
            await updateProductRating(reviewData.productId);

            res.json({
                status: 200,
                succes: true,
                message: "review Updated Successfully",
                data: updatedreview
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
    reviewModel
      .findOne({ _id: req.body._id })
      .then((ExistCate) => {
        if (ExistCate == null) {
          res.send({
            status: 404,
            message: "Not Found",
            success: false,
          });
        } else {
          reviewModel.deleteOne({ _id: req.body._id }).then(async () => {
            await updateProductRating(ExistCate.productId);
            res.send({
              status: 200,
              message: "delete",
              success: true,
            });
          }).catch((err)=>{
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
    reviewModel
      .findOne({ _id: req.body._id })
      .then((ExistCate) => {
        if (ExistCate == null) {
          res.send({
            status: 404,
            message: "Not Found",
            success: false,
          });
        } else {
          console.log(ExistCate);
          ExistCate.status = !ExistCate.status;

          ExistCate.save()
            .then(async (data) => {
              await updateProductRating(data.productId);
              res.send({
                status: 201,
                message: "Cateogry Created",
                data: data,
              });
            })
            .catch(() => {});
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
    add, all, single, update,DeleteOne,softDelete
}