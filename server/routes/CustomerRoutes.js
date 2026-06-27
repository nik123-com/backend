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
const router = require("express").Router()


router.post("/product/all", productsController.all)
router.post("/category/all", categoryController.all)
router.post('/brand/all', BrandController.all)
router.post("/product/single", productsController.single)

//Login
router.post("/Register", CustomerController.Register)
router.post("/login", userController.login)
router.use(require("../middleware/customerTokenChecker"))
router.post('/category/single', categoryController.single)
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
router.post('/product/filtercategory', productController.FilterByCategoryId)

//Brand
router.post('/product/filterbrand', productController.FilterByBrandId)

router.post('/review/add', reviewController.add)
router.post('/review/all', reviewController.all)
router.post('/review/single', reviewController.single)
router.post('/review/update', reviewController.update)
router.post('/review/DeleteOne', reviewController.DeleteOne)
router.post('/review/softDelete', reviewController.softDelete)

//Order
router.post('/order/add', OrderController.addOrder)
router.post('/order/all', OrderController.getOrders)
router.post('/order/single', OrderController.singleOrder)
router.post('/order/update', OrderController.updateOrderStatus)

module.exports = router;