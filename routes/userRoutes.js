const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user/userController');
const productCtrl = require('../controllers/user/productController');
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
router.get('/userProfile', profileCtrl.getUserProfile);
router.post('/update-profile',  uploads.single('profileImage'), profileCtrl.updateProfile);
router.get('/change-password', profileCtrl.getChangePassword);

// Address Management
router.get('/address', profileCtrl.getUserAddress);
router.get('/addAddress', profileCtrl.getAddAddress);
router.post('/addAddress', profileCtrl.postAddAddress);
router.post('/editAddress', profileCtrl.postEditAddress);
router.post('/deleteAddress', profileCtrl.deleteAddress);

// Shop 
router.get("/shop", userAuth, userCtrl.loadShoppingPage)
router.post("/filter", userAuth,  userCtrl.filterProducts);
router.get('/logout', userAuth, userCtrl.logout)

// Product Management

router.get('/productDetails', userAuth, productCtrl.productDetails);

module.exports = router;