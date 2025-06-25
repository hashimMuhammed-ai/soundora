const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin/adminController');
const customerCtrl = require('../controllers/admin/customerController');
const categoryCtrl = require('../controllers/admin/categoryController');
const brandCtrl = require('../controllers/admin/brandController');
const productCtrl = require('../controllers/admin/productController');
const {userAuth, adminAuth} = require('../middlewares/auth');
const multer = require('multer');
const storage = require('../helpers/multer');
const Product = require('../models/productModel');
const uploads = multer({storage: storage});

router.get('/pageError', adminCtrl.pageError);
router.get('/login',adminCtrl.getLogin);
router.post('/login', adminCtrl.postLogin);
router.get('/dashboard', adminAuth, adminAuth, adminCtrl.getDashboard);
router.get('/logout', adminCtrl.logout);
router.get('/customers', adminAuth, customerCtrl.customerInfo);
router.post('/toggleBlock', adminAuth, customerCtrl.toggleBlock);
// Category Management
router.get('/category', adminAuth, categoryCtrl.categoryInfo);
router.post('/addCategory', adminAuth, categoryCtrl.addCategory);
router.patch('/toggleCategory/:id', adminAuth, categoryCtrl.toggleCategory)
router.get('/editCategory', adminAuth, categoryCtrl.getEditCategory);
router.post('/editCategory/:id', adminAuth, categoryCtrl.editCategory)
// Brand Management
router.get('/brands', brandCtrl.getBrandPage);
router.post('/addBrand', uploads.single('image'), brandCtrl.addBrand)
router.get('/blockBrand', adminAuth, brandCtrl.blockBrand)
router.get('/unblockBrand', adminAuth, brandCtrl.unblockBrand)
router.get('/deleteBrand', adminAuth, brandCtrl.deleteBrand)
// Product Management
router.get("/addProducts", productCtrl.getProductAddPage)
router.post("/addProducts", uploads.array('images',3), productCtrl.addProducts)
router.get('/products',productCtrl.getAllProducts);
router.post('/addProductOffer', productCtrl.addProductOffer)
router.post('/deleteProductOffer', productCtrl.deleteProductOffer);
router.patch('/toggle-list/:id', productCtrl.toggleProductList);
router.get('/editProduct',  productCtrl.getEditProduct);
router.post("/editProduct/:id", uploads.array('images', 3), productCtrl.editProduct);
router.post('/deleteImage', productCtrl.deleteSingleImage)


module.exports = router;