const router = require('express').Router()
const productController = require('../apis/product/ProductController')
const categoryController = require('../apis/category/categoryController')
const BrandController = require('../apis/brand/BrandController')
const CustomerController = require('../apis/customer/CustomerController')
const OrderController = require('../apis/order/OrderController')
const enquiryController = require('../apis/enquiry/EnquiryController')
const reviewController = require('../apis/review/ReviewController')
const userController = require('../apis/user/userController')
const CouponController = require('../apis/coupons/CouponsController')
const AddressController = require('../apis/address/AddressController')
const CartController = require('../apis/cart/CartController')
const queryController = require('../apis/query/QueryController')

const aiController = require('../apis/aiControler/aiController')
// const wishlistController = require('../apis/wishList/WishListController')
const multer = require('multer')

router.post('/product/all', productController.all)
router.get('/', (req, res) => {
    res.send("Welcome to Server,Server Activated ! ")
})

// It is for Offline Disk Storage (using Multer)
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, 'server/public')
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now()
//     cb(null,uniqueSuffix  + '-' +  file.originalname)
//   }
// })

// In case of Cloudinary
const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

//Login
router.post('/category/all', categoryController.all)
router.post('/brand/all', BrandController.all)
router.post("/login", userController.login)
router.post("/changePassword", userController.changepassword)
router.post("/forgotPassword", userController.forgotPassword)
router.post("/resetPassword/:token", userController.resetPassword)

//AI integration
router.post("/aiCall", aiController.main)
router.post("/ai/announcement-description", aiController.generateAnnouncementDescription)

router.use(require("../middleware/AdminTokenChecker"))


//Product
router.post('/product/add', upload.array('image'), productController.add)
router.post('/product/single', productController.single)
router.post('/product/update', upload.array('image'), productController.update)
router.post('/product/DeleteOne', productController.DeleteOne)
router.post('/product/softDelete', productController.softDelete)
// router.post('/product/filtercategory', productController.FilterByCategoryId)


//category
// router.use(require("../middleware/AdminTokenChecker"))
router.post('/category/add', upload.single('image'), categoryController.add)
router.post('/category/single', categoryController.single)
router.post('/category/update', upload.single('image'), categoryController.update)
router.post('/category/DeleteOne', categoryController.DeleteOne)
router.post('/category/softDelete', categoryController.softDelete)


//brand
router.post('/brand/add', upload.single('logo'), BrandController.add)
router.post('/brand/single', BrandController.single)
router.post('/brand/update', upload.single('logo'), BrandController.update)
router.post('/brand/DeleteOne', BrandController.DeleteOne)
router.post('/brand/softDelete', BrandController.softDelete)

//Cart

router.post('/cart/single', CartController.single)
router.post('/cart/update', CartController.update)
router.post('/cart/DeleteOne', CartController.DeleteOne)
router.post('/cart/softDelete', CartController.softDelete)
router.post('/cart/increment', CartController.increment)
router.post('/cart/decrement', CartController.decrement)



//enquiry
router.post('/enquiry/add', enquiryController.add)
router.post('/enquiry/all', enquiryController.all)
router.post('/enquiry/single', enquiryController.single)
router.post('/enquiry/update', enquiryController.update)
router.post('/enquiry/DeleteOne', enquiryController.DeleteOne)
router.post('/enquiry/softDelete', enquiryController.softDelete)



//Customer
router.post("/customer/Register", CustomerController.Register)
router.post('/customer/all', CustomerController.all)
router.post('/customer/single', CustomerController.single)
router.post('/customer/update', CustomerController.update)
router.post('/customer/DeleteOne', CustomerController.DeleteOne)
router.post('/customer/softDelete', CustomerController.softDelete)
router.post('/customer/toggleBlock',CustomerController.toggleBlock)
router.post('/customer/update-rank', CustomerController.updateRank)
router.post('/customer/ai-evaluate-rank', aiController.evaluateCustomerRank)
router.post('/customer/ai-evaluate-all', aiController.evaluateAllCustomersRank)
router.post('/customer/approve-ai-evaluation', CustomerController.approveAiEvaluation)
router.post('/vendor/ai-evaluate-activity', aiController.evaluateVendorActivity)

//Coupon
router.post('/coupon/add', CouponController.add)
router.post('/coupon/all', CouponController.all)
router.post('/coupon/single', CouponController.single)
router.post('/coupon/update', CouponController.update)
router.post('/coupon/DeleteOne', CouponController.DeleteOne)
router.post('/coupon/softDelete', CouponController.softDelete)
router.post('/coupon/assign-reward', CouponController.assignRewardCoupon)

//Order
router.post('/order/count', OrderController.countOrders)
router.post('/order/all', OrderController.allOrders)
router.post('/order/single', OrderController.singleOrder)
router.post('/order/update', OrderController.updateOrderStatus)

//Address
router.post('/address/add', AddressController.add);
router.post('/address/all', AddressController.all);

//Query
router.post('/query/all', queryController.getAllQueries);
router.post('/query/reply', upload.single('adminAttachment'), queryController.replyQuery);

// WishList
// router.post('/wishlist/add',wishlistController.createWishlist)
// router.post('/wishlist/all',wishlistController.getAll)
// router.post('/wishlist/single',wishlistController.single)
// router.post('/wishlist/update',wishlistController.update)
// router.post('/wishlist/delete',wishlistController.DeleteOne)

const VendorController = require('../apis/vendor/VendorController')
const announcementController = require('../apis/announcement/AnnouncementController')

// Admin Vendor Management
router.post('/vendor/all', VendorController.getAllVendors)
router.post('/vendor/approve', VendorController.approveVendor)
router.post('/vendor/reject', VendorController.rejectVendor)
router.post('/vendor/toggleBlock', VendorController.toggleBlockVendor)

// Announcement Management
router.post('/announcement/add', announcementController.addAnnouncement)
router.post('/announcement/all', announcementController.getAllAnnouncements)
router.post('/announcement/delete', announcementController.deleteAnnouncement)
router.post('/announcement/user', announcementController.getUserAnnouncements)

module.exports = router; 