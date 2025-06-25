const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user/userController');
const passport = require('passport');
const profileCtrl = require('../controllers/user/profileController');



router.get('/pageNotFound', userCtrl.pageNotFound);
router.get('/signup', userCtrl.getSignup);
router.post('/signup', userCtrl.postSignup);
router.post('/verify-otp', userCtrl.verifyOtp);
router.post('/resend-otp', userCtrl.resendOtp);
router.get('/auth/google', passport.authenticate('google',{scope: ['profile', 'email']}));
router.get('/auth/google/callback', passport.authenticate('google', {failureRedirect: '/signup'}),(req,res)=>{
  res.redirect('/home');
})
router.get('/login', userCtrl.getLogin);
router.post('/login', userCtrl.postLogin);

// Profile Management
router.get("/forgot-password", profileCtrl.getForgotPassPage);
router.post("/forgot-email-valid", profileCtrl.forgotEmailValid)
router.post("/verify-passForgot-otp", profileCtrl.verifyForgotPassOtp);
router.get("/reset-password", profileCtrl.getResetPassPage);
router.post("/resend-forgot-otp", profileCtrl.resendtOTP)
router.post("/reset-password", profileCtrl.postNewPassword)

module.exports = router;