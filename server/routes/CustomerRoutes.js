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
const announcementController = require('../apis/announcement/AnnouncementController')
const recommendationController = require('../apis/recommendation/RecommendationController')
const aiController = require('../apis/aiControler/aiController')
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

// Query Routes (Accessible to logged-in Customers & Vendors)
router.post('/query/add', upload.single('evidenceFile'), queryController.addQuery)
router.post('/query/all', queryController.getCustomerQueries)
router.post('/query/feedback', queryController.submitFeedback)

// Announcement Route
router.post('/announcement/all', announcementController.getUserAnnouncements)

// Explainable Recommendations & Behavior Tracking (Customer/Guest Accessible)
router.post('/recommendations', recommendationController.getRecommendations)
router.post('/recommendations/explain', recommendationController.getExplanation)
router.post('/recommendations/product-detail', recommendationController.getProductDetailRecommendations)
router.post('/behavior/event', recommendationController.trackEvent)
router.post('/sana/contextual-query', aiController.contextualShoppingQuery)
router.post('/cart/smart-optimization', CartController.smartOptimization)

// AI Price-Supply Bargaining System
const bargainingController = require('../apis/bargain/BargainingController')
router.post('/bargain/start', bargainingController.start)
router.post('/bargain/offer', bargainingController.submitOffer)
router.post('/bargain/accept', bargainingController.accept)
router.post('/bargain/check-deal', bargainingController.checkActiveDeal)
router.post('/bargain/session-status', bargainingController.sessionStatus)

router.use(require("../middleware/customerTokenChecker"))

// Customer Profile & Credentials
router.post('/profile', CustomerController.getProfile)
router.post('/profile/update', upload.single('evidence'), CustomerController.updateProfile)

// Reward Routes
router.post('/checkReward', CustomerController.checkRankReward)
router.post('/dismissReward', CustomerController.dismissRewardPopup)

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
// Protected user preference profile
router.post('/behavior/profile', recommendationController.getUserProfile)
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

module.exports = router;