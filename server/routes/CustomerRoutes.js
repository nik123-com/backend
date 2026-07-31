const categoryController = require("../apis/category/categoryController")
const productsController = require("../apis/product/ProductController")
const CustomerController = require("../apis/customer/CustomerController")
const userController = require("../apis/user/userController")
const wishlistController = require('../apis/wishList/WishListController')
const CartController = require('../apis/cart/CartController')
const AddressController = require('../apis/address/AddressController')
const CouponController = require('../apis/coupons/CouponsController')
const BrandController = require('../apis/brand/BrandController')
const reviewController = require('../apis/review/ReviewController')
const OrderController = require('../apis/order/OrderController')
const productController = require('../apis/product/ProductController')
const queryController = require('../apis/query/QueryController')
const notificationController = require('../apis/notification/NotificationController')
const multer = require('multer')
const upload = multer({ storage: multer.memoryStorage() })
const router = require("express").Router()

router.post("/product/all", productsController.all)
router.post("/category/all", categoryController.all)
router.post('/brand/all', BrandController.all)
router.post("/product/single", productsController.single)
router.post('/product/filtercategory', productController.FilterByCategoryId)
router.post('/product/filterbrand', productController.FilterByBrandId)
//Login
router.post("/Register", CustomerController.Register)
router.post("/login", userController.login)
router.post('/review/all', reviewController.all)
router.post('/category/single', categoryController.single)
router.post('/review/single', reviewController.single)


router.use(require("../middleware/customerTokenChecker"))

// Notification Routes
router.post('/notification/all', notificationController.getNotifications)
router.post('/notification/respond', notificationController.respondInvite)
router.post('/notification/markRead', notificationController.markAsRead)
router.post('/notification/stock-notify', notificationController.requestStockNotification)
router.post('/notification/stock-subscriptions', notificationController.getUserStockNotifications)
router.post('/notification/delete', notificationController.deleteNotification)

router.post("/product/add", productsController.add)
router.post('/wishlist/add', wishlistController.createWishlist)
router.post('/wishlist/all', wishlistController.getAll)
router.post('/wishlist/addItems', wishlistController.addItem)
router.post('/wishlist/deleteone', wishlistController.deleteWishList)
router.post('/wishlist/access', wishlistController.toggleWishlistAccess)
router.post('/wishlist/invite', wishlistController.addFriend)
router.post('/wishlist/view', wishlistController.getSingle)
router.post('/wishlist/sendMessage', wishlistController.sendMessage)

router.post('/cart/all', CartController.all)
router.post('/cart/add', CartController.add)
router.post('/cart/DeleteOne', CartController.DeleteOne)
router.post('/cart/increment', CartController.increment)
router.post('/cart/decrement', CartController.decrement)
//Address
router.post('/address/add', AddressController.add);
router.post('/address/all', AddressController.all);
router.post('/coupon/all', CouponController.all)


//Brand
router.post('/review/add', reviewController.add)
router.post('/review/update', reviewController.update)
router.post('/review/DeleteOne', reviewController.DeleteOne)
router.post('/review/softDelete', reviewController.softDelete)

//Order
router.post('/order/add', OrderController.addOrder)
router.post('/order/all', OrderController.getOrders)
router.post('/order/single', OrderController.singleOrder)
router.post('/order/update', OrderController.updateOrderStatus)

//Query
router.post('/query/add', upload.single('evidenceFile'), queryController.addQuery)
router.post('/query/all', queryController.getCustomerQueries)
router.post('/query/feedback', queryController.submitFeedback)

module.exports = router;