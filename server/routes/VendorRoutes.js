const router = require('express').Router();
const multer = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const VendorController = require('../apis/vendor/VendorController');
const productController = require('../apis/product/ProductController');
const OrderController = require('../apis/order/OrderController');
const CouponController = require('../apis/coupons/CouponsController');
const reviewController = require('../apis/review/ReviewController');
const queryController = require('../apis/query/QueryController');
const aiController = require('../apis/aiControler/aiController');

const vendorTokenChecker = require('../middleware/vendorTokenChecker');

// Public Vendor Registration
router.post('/register', VendorController.registerVendor);

// Protected Vendor Panel Endpoints
router.use(vendorTokenChecker);

// Profile & Settings
router.post('/profile', VendorController.getVendorProfile);
router.post('/update-profile', VendorController.updateVendorProfile);

// Reward & Rank Notifier
router.post('/checkReward', VendorController.checkRankReward);
router.post('/dismissRewardPopup', VendorController.dismissRewardPopup);

// Dashboard
router.post('/dashboard', VendorController.getDashboardStats);

// Wallet
router.post('/wallet', VendorController.getWalletDetails);
router.post('/request-payout', VendorController.requestPayout);

// Products
router.post('/product/add', upload.array('image'), productController.vendorAdd);
router.post('/product/all', productController.vendorAll);
router.post('/product/update', upload.array('image'), productController.vendorUpdate);
router.post('/product/delete', productController.vendorDelete);
router.post('/product/update-stock', productController.vendorUpdateStock);

// Predictive Stock-Out Intelligence
router.post('/inventory/intelligence', VendorController.getStockIntelligence);
router.post('/products/stock-forecast', VendorController.getProductStockForecast);

// AI Price-Supply Bargaining History for Vendors
const bargainingController = require('../apis/bargain/BargainingController');
router.post('/bargain/history', bargainingController.getVendorNegotiations);
router.post('/bargain/authorize', bargainingController.vendorAuthorize);
router.post('/bargain/decline', bargainingController.vendorDecline);
router.post('/bargain/delete', bargainingController.deleteNegotiation);

// Orders
router.post('/order/all', OrderController.vendorOrders);
router.post('/order/update-status', OrderController.updateVendorOrderStatus);
router.post('/order/invoice', OrderController.vendorInvoice);

// Coupons
router.post('/coupon/add', CouponController.vendorAdd);
router.post('/coupon/all', CouponController.vendorAll);
router.post('/coupon/delete', CouponController.vendorDelete);

// Reviews
router.post('/review/all', reviewController.vendorReviews);
router.post('/review/reply', reviewController.vendorReplyReview);

// Support Queries
router.post('/query/add', upload.single('evidenceFile'), queryController.addQuery);
router.post('/query/all', queryController.getCustomerQueries);
router.post('/query/feedback', queryController.submitFeedback);

// AI Assistant
router.post('/ai/description', aiController.generateProductDescription);
router.post('/ai/store-description', aiController.generateStoreDescription);
router.post('/ai/seo', aiController.generateSeoData);
router.post('/ai/caption', aiController.generateMarketingCaption);
router.post('/ai/price-suggest', aiController.suggestPrice);
router.post('/ai/review-reply', aiController.generateReviewReply);

// Announcements for Vendors
const announcementController = require('../apis/announcement/AnnouncementController');
router.post('/announcement/all', announcementController.getUserAnnouncements);

module.exports = router;
