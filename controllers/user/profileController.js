const User = require('../../models/userModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config()
const session = require('express-session');
const Address = require('../../models/addressModel');
const multer = require('multer');
const storage = require('../../helpers/multer');



function generateOtp() {
    const digits = '0123456789'
    let otp = ''
    for (let i = 0; i < 6; i++) {
        otp += digits[Math.floor(Math.random() * 10)]
    }
    return otp
}

const getForgotPassPage = async (req, res) => {
    try {
        res.render('user/forgot-password')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const sendVerificationEmail = async (email, otp) => {
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
        });
        const mailOptions = {
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'Your Otp for password reset',
            text: `Your OTP is ${otp}. `,
            html: `<b>Your OTP is ${otp}</b>`
        };
        const info = await transporter.sendMail(mailOptions);
        return true

    } catch (error) {
        console.log("error", error)
        return false
    }
}

const forgotEmailValid = async (req, res) => {
    try {

        const { email } = req.body

        const findUser = await User.findOne({ email: email })
        if (findUser) {
            const otp = generateOtp()
            const emailSent = await sendVerificationEmail(email, otp);
            if (emailSent) {
                req.session.userOtp = otp
                req.session.userData = { email }
                
                res.render("user/forgotPass-otp")
                console.log('otp sent', otp);
            } else {
                res.render("forgot-password", { message: "Failed to send OTP. Please try again." })
            }
        } else {
            res.render("forgot-password", { message: "User with this email not found" })
        }

    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const verifyForgotPassOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp 
        if (enteredOtp === req.session.userOtp) {
            if (!req.session.userData) {
                return res.json({
                    success: false,
                    message: "Session expired. Please try again."
                })
            }
            
            res.json({
                success: true,
                message: "OTP verified successfully",
                redirectUrl: "/reset-password"
            })
        } else {
            res.json({
                success: false,
                message: "Invalid OTP. Please try again."
            })
        }
    } catch (error) {
        console.error("Error in verifyForgotPassOtp:", error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}


const getResetPassPage = (req, res) => {
    try {
        res.render("user/reset-password")
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}

const resendtOTP = async (req, res) => {
    try {
        const otp = generateOtp()
        req.session.userOtp = otp
        const email = req.session.userData?.email

        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resent otp sent", otp)
            res.status(200).json({ success: true, message: "OTP resent successfully" })
        }
    } catch (error) {
        console.log("Error resending otp", error)
        res.status(500).json({ success: false, message: "Internal server error" })
    }
}

const postNewPassword = async (req, res) => {
    try {
        const { newPass1, newPass2 } = req.body
        const email = req.session.userData?.email 
        
        if (!email) {
            return res.render("user/reset-password", { message: "Session expired. Please try again." })
        }

        if (newPass1 === newPass2) {
            const hashedPassword = await bcrypt.hash(newPass1, 10);
            const user = await User.findOneAndUpdate(
                { email: email }, 
                { password: hashedPassword },
                { new: true } 
            )
            
            if (!user) {
                return res.render("user/reset-password", { message: "User not found" })
            }

            req.session.userData = null
            req.session.userOtp = null
            return res.render("user/login", {success: true, message: "Password updated successfully. Please login." })
        } else {
            return res.render("user/reset-password", { message: "Passwords do not match" })
        }
    } catch (error) {
        console.error("Error in postNewPassword:", error)
        res.render("reset-password", { message: "An error occurred. Please try again." })
    }
}


const getUserProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const user = await User.findById(userId);
        res.render('user/profile', {user, orders: [], totalPages: 1, wallet: {transactions: []}})
    } catch (error) {
        console.log(error)
    }
}


const getUserAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const userAddress = await Address.findOne({userId});
        if(userAddress){
            res.render('user/address', {userAddress})
        }
        
    } catch (error) {
        console.log(error);
    }
}

const getAddAddress = async (req, res) => {
    try {
        res.render('user/add-address');
    } catch (error) {
        console.log(error);
    }
}

const postAddAddress = async (req, res) => {
    try {
        const {addressType, name, city, landMark, state, pincode, phone, altPhone} = req.body;
        const userId = req.session.user;
        const userAddress = await Address.findOne({userId});
        if(userAddress){
            userAddress.address.push({
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            });
            await userAddress.save();
        } else {
            await Address.create({userId,address: [{
                addressType,
                name,
                city,
                landMark,
                state,
                pincode,
                phone,
                altPhone
            }]})
        }
        res.json({success: true, message: 'Address Added Successfully'})

    } catch (error) {
        console.error('Error in Adding Address',error);
        res.status(500).json({success: false, message: 'Something Went Wrong!'});
    }
}


const postEditAddress = async (req,res) => {
    try {
        const addressId = req.query.id;
        const {
            addressType,
            name,
            city,
            state,
            landMark,
            pincode,
            phone,
            altPhone
        } = req.body;
        const userId = req.session.user;
        const userAddress = await Address.findOne({userId});
        if(!userAddress){
            return res.status(404).json({success: false, message: 'Address record not found'})
        }
        const addressItem = userAddress.address.id(addressId);
        if(!addressItem){
            return res.status(404).json({success: false, message: 'Address Not Found'})
        }
        addressItem.addressType = addressType;
        addressItem.name = name;
        addressItem.city = city;
        addressItem.state = state;
        addressItem.landMark = landMark;
        addressItem.pincode = pincode;
        addressItem.phone = phone;
        addressItem.altPhone = altPhone;
        await userAddress.save();
        res.json({success: true, message: 'Address Updated Successfully'});
    } catch (error) {
        console.error('Error Updating Error', error);
        res.status(500).json({success: false, message: 'Server Error'})
    }
}


const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user;
        const userAddress = await Address.findOne({userId});
        if(!userAddress){
            return res.status(404).json({success: false, message: 'Address record not found'})
        }
        const addressItem = userAddress.address.id(addressId);
        if(!addressItem){
            return res.status(404).json({success: false, message: 'Address not found'});
        }
        userAddress.address.pull({_id: addressId});
        await userAddress.save();
        res.json({success: true, message: 'Address Deleted Successfully'})
    } catch (error) {
        console.error('Error Deleting Address', error);
        res.status(500).json({success: false, message: 'Server Error'})
    }
}


const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only JPEG, PNG, and WebP files are allowed'));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
}).single('profileImage');

// Update Profile Route
const updateProfile = async (req, res) => {
  try {
    console.log('lllllllllllllllllllllllllllllllllllllllll')
    console.log('helloooooooooooooooooooooooo');


      const { name, phone } = req.body;
      const userId = req.session.user; // Assuming user ID is stored in session

      // Validate inputs
      if (!name || !phone) {
        return res.json({ success: false, message: 'Name and phone are required' });
      }
      if (!/^\d{10}$/.test(phone)) {
        return res.json({ success: false, message: 'Invalid phone number' });
      }

      // Prepare update data
      const updateData = { name, phone };
      if (req.file) {
        updateData.profileImage = req.file.filename;
      }

      // Update user in database
      console.log('hhhhhhhoiiiiiii',updateData);
      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!user) {
        return res.json({ success: false, message: 'User not found' });
      }

      res.json({ success: true, message: 'Profile updated successfully', user });
    ;
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.json({ success: false, message: 'Server error' });
  }
};

const getChangePassword = async (req, res) => {
    try {
        res.render('user/change-password')
    } catch (error) {
        console.log(error);
    }
}


module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendtOTP,
    postNewPassword,
    getUserProfile,
    getUserAddress,
    getAddAddress,
    postAddAddress,
    postEditAddress,
    deleteAddress,
    updateProfile,
    getChangePassword
}