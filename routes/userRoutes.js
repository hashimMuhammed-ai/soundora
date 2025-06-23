const express = require('express');
const router = express.Router();
const userCtrl = require('../controllers/user/userController');
const passport = require('passport');



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


module.exports = router;