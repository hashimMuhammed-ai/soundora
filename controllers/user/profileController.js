const User = require('../../models/userModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config()
const session = require('express-session');
const Address = require('../../models/addressModel');
const Order = require('../../models/orderModel');
const multer = require('multer');
const storage = require('../../helpers/multer');
const Wallet = require('../../models/walletModel');
const HTTP_STATUS = require('../../constants/httpStatus');



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
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" })
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

        if (!email) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: "Email not found in session" })
        }

        const emailSent = await sendVerificationEmail(email, otp);
        if (emailSent) {
            console.log("Resent otp sent", otp)
            res.status(HTTP_STATUS.OK).json({ success: true, message: "OTP resent successfully" })
        }
    } catch (error) {
        console.log("Error resending otp", error)
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" })
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
            return res.render("user/login", { success: true, message: "Password updated successfully. Please login." })
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

        const walletData = await Wallet.findOne({ userId: userId });

        const orderPage = parseInt(req.query.orderPage) || 1;
        const walletPage = parseInt(req.query.walletPage) || 1;

        const orderLimit = 4;
        const orderSkip = (orderPage - 1) * orderLimit;

        const totalOrders = await Order.countDocuments({ userId });
        const orders = await Order.find({ userId })
            .populate("items.productId")
            .sort({ createdAt: -1 })
            .skip(orderSkip)
            .limit(orderLimit);

        const orderTotalPages = Math.ceil(totalOrders / orderLimit);

        const totalTransactions = walletData ? walletData.transactions.length : 0;
        const walletLimit = 10;
        const walletSkip = (walletPage - 1) * walletLimit;

        const paginatedTransactions = walletData ? walletData.transactions
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(walletSkip, walletSkip + walletLimit) : [];

        const walletTotalPages = Math.ceil(totalTransactions / walletLimit);

        const baseUrl = process.env.BASE_URL || 'http://localhost:3004';

        res.render('user/profile', { 
            user, 
            orders, 
            orderTotalPages, 
            orderCurrentPage: orderPage, 
            wallet: { 
                balance: walletData ? walletData.balance : 0, 
                transactions: paginatedTransactions 
            }, 
            walletTotalPages, 
            walletCurrentPage: walletPage, 
            baseUrl 
        })
    } catch (error) {
        console.log(error)
    }
}


const getUserAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        let userAddress = await Address.findOne({ userId });

        if (!userAddress) {
        userAddress = { address: [] }; // default if no addresses
        }

        res.render('user/address', { userAddress })

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
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;
        const userId = req.session.user;
        const userAddress = await Address.findOne({ userId });
        if (userAddress) {
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
            await Address.create({
                userId, address: [{
                    addressType,
                    name,
                    city,
                    landMark,
                    state,
                    pincode,
                    phone,
                    altPhone
                }]
            })
        }
        res.json({ success: true, message: 'Address Added Successfully' })

    } catch (error) {
        console.error('Error in Adding Address', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Something Went Wrong!' });
    }
}


const postEditAddress = async (req, res) => {
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
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address record not found' })
        }
        const addressItem = userAddress.address.id(addressId);
        if (!addressItem) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address Not Found' })
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
        res.json({ success: true, message: 'Address Updated Successfully' });
    } catch (error) {
        console.error('Error Updating Error', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server Error' })
    }
}


const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.body;
        const userId = req.session.user;
        const userAddress = await Address.findOne({ userId });
        if (!userAddress) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address record not found' })
        }
        const addressItem = userAddress.address.id(addressId);
        if (!addressItem) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'Address not found' });
        }
        userAddress.address.pull({ _id: addressId });
        await userAddress.save();
        res.json({ success: true, message: 'Address Deleted Successfully' })
    } catch (error) {
        console.error('Error Deleting Address', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server Error' })
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
        const { name, phone } = req.body;
        const userId = req.session.user; 

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


const verifyCurrentPassword = async (req, res) => {
    try {
        const { currentPassword } = req.body;
        const userId = req.session.user;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'User not found' });
        }
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Current Password is incorrect' })
        }
        res.json({ success: true });

    } catch (error) {
        console.error('Error verifying password', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'internal server error' });
    }
}


const updatePassword = async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.session.user;
        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized: No user session found' });
        }
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const updatedPassword = await User.findByIdAndUpdate(userId, { $set: { password: hashedPassword } }, { new: true });
        if (!updatedPassword) {
            return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Failed to update password' });
        }
        res.json({ success: true })
    } catch (error) {
        console.error('Password Updating Error', error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Server Error' });
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
    getChangePassword,
    verifyCurrentPassword,
    updatePassword
}