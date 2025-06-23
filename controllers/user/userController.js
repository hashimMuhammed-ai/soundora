const User = require('../../models/userModel');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');


const pageNotFound = (req, res) => {
  try {
    res.render('user/page-404',);
  }
  catch (error) {
    console.log(error);
  }
}

const getSignup = (req, res) => {
  try {
    const error = req.flash('error');
    return res.render('user/signup', {error: error[0]});
  }
  catch (error) {
    console.log(error);
  }
}

function generateOtp(){
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp){
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PASSWORD
      }
    })
    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      to: email,
      subject: "Verify your account",
      text: `Your OTP is ${otp}`,
      html: `<b>Your OTP: ${otp}</b>`
    })

    return info.accepted.length > 0;
  }
  catch (error) {
    console.error('Error sending email', error);
    return false;
  }
}

const postSignup = async (req, res) => {
  try {
    const {name, email, phone, password} = req.body;
    const userExist = await User.findOne({email})
    if(userExist){
      req.flash('error', 'Email Already Existed');
      return res.redirect('/signup');
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if(!emailSent){
      return res.json('email-error')
    }

    req.session.userOtp = otp;
    req.session.userData = {name, email, password, phone};

    res.render('user/verify-otp');
    console.log("OTP Sent", otp);

    
    

  }
  catch (error) {
    console.error('Signup error', error);
    res.redirect('/pageNotFound');
  }
}

const verifyOtp = async (req, res) => {
  try {
    const {otp} = req.body;
    console.log(otp);
    if(otp === req.session.userOtp){
      const user = req.session.userData;
      const hashPassword = await bcrypt.hash(user.password, 10);
      const userData = await User.create({name: user.name, email: user.email, phone: user.phone, password: hashPassword});
      req.session.user = userData._id;
      res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      redirectUrl: '/login'
});
    }else {
      res.status(400).json({success: false, message: 'invalid OTP, Please try again'})
    }
  } catch (error) {
    console.error('Error verifying OTP', error);
    res.status(500).json({success: false, message: 'An error occured'})
  }
}

const resendOtp = async (req, res) => {
  try {
    const {email} = req.session.userData;
    if(!email){
      return res.status(400).json({success: false, message: 'Email not found in session'})
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if(emailSent){
      console.log('Resend OTP', otp);
      res.status(200).json({success: true, message: 'OTP Resend Successfully'});
    }else {
      res.status(500).json({success: false, message: 'Failed to resend OTP, Please try again'});
    }
  } catch (error) {
    console.error('Error resending OTP', error);
    res.status(500).json({success: false, message: 'Internal Server Error, Please try again'})
  }
}

const getLogin = (req, res) => {
  try {
    if(!req.session.user){
      const error = req.flash('error');
      res.render('user/login',{error: error[0]});
    }else {
      res.redirect('/home')
    }
  }
  catch (error) {
    console.log(error);
    res.redirect('/pageNotFound');
  }
}

const postLogin = async (req, res) => {
  try {
    const {email, password} = req.body;
    const user = await User.findOne({email})
    if(!user || user.isBlocked){
      req.flash('error', 'Invalid Email Or Blocked User');
      return res.redirect('/login');
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if(!isMatch){
      console.log('Invalid Password');
      req.flash('error', 'Invalid Password');
      return res.redirect('/login');
    }
    req.session.user = user._id;
    res.redirect('/home');
  }
  catch (error) {
    console.log('Login Error',error);
    req.flash('error', 'Login failed, Please try again later');
    res.redirect('/login');
  }
}



module.exports = {pageNotFound, getSignup, postSignup, verifyOtp, resendOtp, getLogin, postLogin};