const enquiryModel = require('../enquiry/EnquiryModel')
// CREATE Operation
const add = async (req, res) => {
    try {
        const incomingData = req.body;
        let validation = "";
        if (!incomingData.subject) {
            validation += "Subject is required"
        }
        if (!incomingData.message) {
            validation += "Message is required"
        }
        if (!!validation) {
            return res.json({
                status: 400,
                success: false,
                message: validation
            })
        }
        else {
            const savedData = new enquiryModel({
                subject: incomingData.subject,
                message: incomingData.message,
               
            })

            await savedData.save();
            res.json({
                status: 201,
                success: true,
                message: "Enquiry created",
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
        const total = await enquiryModel.countDocuments({status:true});
        const allData = await enquiryModel.find({status:true});
        res.json({
            status: 200,
            success: true,
            message: "enquiry loaded successfully",
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
        const enquiryId = req.body?._id;

        if (!enquiryId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }
        const enquiry = await enquiryModel.findOne({ _id: enquiryId })

        if (!enquiry) {
            res.json({
                status: 404,
                success: false,
                message: "enquiry not found"
            })
        } else {
            res.json({
                status: 200,
                success: true,
                message: "enquiry fetched",
                data: enquiry
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
        const enquiryId = req.body?._id;
        const incomingData = req.body;

        if (!enquiryId) {
            res.json({
                status: 400,
                success: false,
                message: "_id is required"
            })
        }

        const enquiryData = await enquiryModel.findOne({ _id: enquiryId })

        if (!enquiryData) {
            res.json({
                status: 404,
                success: false,
                message: "enquiry not found"
            })
        } else {
            if (incomingData.shipingAddress) {
                enquiryData.subject = incomingData.subject;
            }
            if (incomingData.totalAmount) {
                enquiryData.message = incomingData.message;
            }
            
            enquiryData.updatedAt = Date.now()
            let updatedenquiry = await enquiryData.save()

            res.json({
                status: 200,
                succes: true,
                message: "enquiry Updated Successfully",
                data: updatedenquiry
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
    enquiryModel
      .findOne({ _id: req.body._id })
      .then((ExistCate) => {
        if (ExistCate == null) {
          res.send({
            status: 404,
            message: "Not Found",
            success: false,
          });
        } else {
          enquiryModel.deleteOne({ _id: req.body._id }).then(() => {
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
    enquiryModel
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
            .then((data) => {
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