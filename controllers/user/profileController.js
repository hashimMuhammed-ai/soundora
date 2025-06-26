const User = require('../../models/userModel');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const env = require('dotenv').config()
const session = require('express-session')



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




module.exports = {
    getForgotPassPage,
    forgotEmailValid,
    verifyForgotPassOtp,
    getResetPassPage,
    resendtOTP,
    postNewPassword
}