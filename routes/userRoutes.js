const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user/userController');
const productCtrl = require('../controllers/user/productController');
const cartCtrl = require('../controllers/user/cartController')
const checkoutCtrl = require('../controllers/user/checkoutController');
const razorpayCtrl = require('../controllers/user/razorpayController');
const passport = require('passport');
const profileCtrl = require('../controllers/user/profileController');
const {userLoginAuth, userAuth} = require('../middlewares/auth');
const multer = require('multer');
const storage = require('../helpers/multer');
const uploads = multer({storage: storage});



router.get('/pageNotFound', userCtrl.pageNotFound);
router.get('/', userAuth, userCtrl.loadHompage);
router.get('/signup', userLoginAuth, userCtrl.getSignup);
router.post('/signup', userLoginAuth, userCtrl.postSignup);
router.post('/verify-otp', userLoginAuth,  userCtrl.verifyOtp);
router.post('/resend-otp', userLoginAuth, userCtrl.resendOtp);
router.get('/auth/google', passport.authenticate('google',{scope: ['profile', 'email']}));
router.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/signup'}),(req,res)=>{
  req.session.user = req.user._id;
  res.redirect('/');
})
router.get('/login', userLoginAuth, userCtrl.getLogin);
router.post('/login', userLoginAuth, userCtrl.postLogin);

// Profile Management
router.get("/forgot-password", userLoginAuth,  profileCtrl.getForgotPassPage);
router.post("/forgot-email-valid", userLoginAuth, profileCtrl.forgotEmailValid)
router.post("/verify-passForgot-otp", userLoginAuth, profileCtrl.verifyForgotPassOtp);
router.get("/reset-password", userLoginAuth, profileCtrl.getResetPassPage);
router.post("/resend-forgot-otp", userLoginAuth, profileCtrl.resendtOTP)
router.post("/reset-password", userLoginAuth, profileCtrl.postNewPassword);
router.get('/userProfile', userAuth, profileCtrl.getUserProfile);
router.post('/update-profile',  uploads.single('profileImage'), profileCtrl.updateProfile);
router.get('/change-password', profileCtrl.getChangePassword);
router.post('/verify-current-password', profileCtrl.verifyCurrentPassword);
router.post('/update-password', profileCtrl.updatePassword);

// Address Management
router.get('/address', userAuth, profileCtrl.getUserAddress);
router.get('/addAddress', userAuth, profileCtrl.getAddAddress);
router.post('/addAddress', userAuth, profileCtrl.postAddAddress);
router.post('/editAddress', userAuth, profileCtrl.postEditAddress);
router.post('/deleteAddress', userAuth, profileCtrl.deleteAddress);

// Shop 
router.get("/shop", userAuth, userCtrl.loadShoppingPage)
router.post("/filter", userAuth,  userCtrl.filterProducts);
router.get('/logout', userAuth, userCtrl.logout)

// Product Management

router.get('/productDetails', userAuth, productCtrl.productDetails);

// Cart Management
router.get('/cart', userAuth, cartCtrl.loadCart);
router.post('/addToCart', userAuth, cartCtrl.addToCart);
router.delete('/cart/remove/:productId', userAuth, cartCtrl.removeCartItem);

//Checkout Management
router.get("/checkout", userAuth, checkoutCtrl.loadCheckout);
router.post("/checkout", userAuth, checkoutCtrl.placeOrder);
router.post("/editCheckoutAddress", userAuth, checkoutCtrl.editCheckoutAddress)
router.post("/addCheckoutAddress", userAuth, checkoutCtrl.addCheckoutAddress)
router.get("/viewOrder/:orderId", userAuth, checkoutCtrl.viewOrder)
router.patch("/cancelOrder/:orderId", userAuth, checkoutCtrl.cancelOrder)
router.post('/returnOrder/:orderId', userAuth, checkoutCtrl.returnOrder);
router.get('/invoice/:id', userAuth, checkoutCtrl.generateInvoice);
router.post("/validateCheckoutItems",userAuth, checkoutCtrl.validateCheckoutItems)


router.post("/applyCoupon", userAuth, checkoutCtrl.applyCoupon)
router.post('/removeCoupon', userAuth, checkoutCtrl.removeCoupon);

//razorpay
router.post("/createOrder", userAuth, razorpayCtrl.createOrder)
router.post("/verifyPayment", userAuth, razorpayCtrl.verifyPayment);
router.post("/retryPayment/:orderId", userAuth, razorpayCtrl.retryPayment);
router.get("/paymentFailed/:orderId", userAuth, razorpayCtrl.paymentFailed);
router.post("/verifyRetryPayment", userAuth, razorpayCtrl.verifyRetryPayment);






module.exports = router;