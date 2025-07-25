const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin/adminController');
const customerCtrl = require('../controllers/admin/customerController');
const categoryCtrl = require('../controllers/admin/categoryController');
const brandCtrl = require('../controllers/admin/brandController');
const productCtrl = require('../controllers/admin/productController');
const orderCtrl = require('../controllers/admin/orderController');
const couponCtrl = require('../controllers/admin/couponController');
const {adminLoginAuth, adminAuth} = require('../middlewares/auth');
const multer = require('multer');
const storage = require('../helpers/multer');
const Product = require('../models/productModel');
const uploads = multer({storage: storage});

router.get('/pageError', adminAuth, adminCtrl.pageError);
router.get('/login', adminLoginAuth, adminCtrl.getLogin);
router.post('/login', adminLoginAuth, adminCtrl.postLogin);
router.get('/dashboard', adminAuth, adminCtrl.getDashboard);
router.get('/logout', adminAuth, adminCtrl.logout);
router.get('/customers', adminAuth, customerCtrl.customerInfo);
router.post('/toggleBlock', adminAuth, customerCtrl.toggleBlock);


// Category Management
router.get('/category', adminAuth, categoryCtrl.categoryInfo);
router.post('/addCategory', adminAuth, categoryCtrl.addCategory);
router.patch('/toggleCategory/:id', adminAuth, categoryCtrl.toggleCategory)
router.get('/editCategory', adminAuth, categoryCtrl.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryCtrl.editCategory)


// Brand Management
router.get('/brands', adminAuth, brandCtrl.getBrandPage);
router.post('/addBrand', adminAuth, uploads.single('image'), brandCtrl.addBrand)
router.get('/blockBrand', adminAuth, brandCtrl.blockBrand)
router.get('/unblockBrand', adminAuth, brandCtrl.unblockBrand)
router.get('/deleteBrand', adminAuth, brandCtrl.deleteBrand)


// Product Management
router.get("/addProducts", adminAuth, productCtrl.getProductAddPage)
router.post("/addProducts", adminAuth, uploads.array('images',3), productCtrl.addProducts)
router.get('/products', adminAuth,productCtrl.getAllProducts);
router.post('/addProductOffer', adminAuth, productCtrl.addProductOffer)
router.post('/deleteProductOffer', adminAuth, productCtrl.deleteProductOffer);
router.patch('/toggle-list/:id', adminAuth, productCtrl.toggleProductList);
router.get('/editProduct', adminAuth, productCtrl.getEditProduct);
router.post("/editProduct/:id", adminAuth, uploads.array('images', 3), productCtrl.editProduct);
router.post('/deleteImage', adminAuth, productCtrl.deleteSingleImage)


//Order Management

router.get('/orders', adminAuth, orderCtrl.getOrdersPage)
router.post('/updateOrder', adminAuth, orderCtrl.updateOrder)
router.post('/cancelOrder', adminAuth, orderCtrl.cancelOrder)
router.post('/approveReturn', adminAuth, orderCtrl.approveReturn)
router.post('/rejectReturn/:orderId', adminAuth, orderCtrl.rejectReturn)


//Coupon Management

router.get('/coupons', adminAuth, couponCtrl.getCouponPage)
router.post('/addCoupon', adminAuth, couponCtrl.addCoupon)
router.patch('/toggle-coupon/:id', adminAuth, couponCtrl.toggleCoupon)

module.exports = router;