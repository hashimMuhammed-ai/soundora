const User = require('../../models/userModel');
const Category = require('../../models/categoryModel');
const Product = require('../../models/productModel');
const Brand = require('../../models/brandModel');
const Wallet = require('../../models/walletModel');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const HTTP_STATUS = require('../../constants/httpStatus');


const pageNotFound = (req, res) => {
  try {
    res.render('user/page-404',);
  }
  catch (error) {
    console.log(error);
  }
}


const loadHompage = async (req, res) => {
   try {
      const user = req.session.user;
      const categories = await Category.find({ isListed: true })
      const brands = await Brand.find({isBlocked:false})  
      
      let productData = await Product.find({
         isListed: true,
         category: { $in: categories.map(category => category._id) }, 
         brand: { $in: brands.map(brand => brand._id) },
         quantity: { $gt: 0 }
      })
      .populate("category")
      .populate("brand")
      .sort({ createdOn: -1 }).limit(8)
      
     
      const userId = user || req.user?._id;
       if (userId) {
         const userData = await User.findById(userId);
         return res.render('user/home', { user: userData, products: productData ,brands:brands});
      } else {
         return res.render('user/home', { products: productData,brands:brands})
      }
      
   } catch (error) {
      console.log('error loading home page');
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).send('Internal server error');
   }
}


const getSignup = (req, res) => {
  try {
    const error = req.flash('error');
    const referralCode = req.query.ref || null;
    return res.render('user/signup', {error: error[0], referralCode});
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
    const {name, email, phone, password, referralCode} = req.body;

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
    req.session.userData = {name, email, password, phone, referralCode};

    res.render('user/verify-otp');
    console.log("OTP Sent", otp);

  }
  catch (error) {
    console.error('Signup error', error);
    res.redirect('/pageNotFound');
  }
}

const generateReferralCode = (name) => {
  return name.toLowerCase().slice(0, 3) + Math.random().toString(36).substring(2, 7);
};

const verifyOtp = async (req, res) => {
  try {
    const {otp} = req.body;
    
    if(otp !== req.session.userOtp){
      return res.status(HTTP_STATUS.BAD_REQUEST).json({success: false, message: 'Invalid OTP, Please try again'})
    }

    const user = req.session.userData;
    const hashPassword = await bcrypt.hash(user.password, 10);
    const newReferralCode = generateReferralCode(user.name);  

    const newUserData = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: hashPassword,
      referralCode: newReferralCode
    }

    let referrer = null;
    if(user.referralCode){
      referrer = await User.findOne({referralCode: user.referralCode});

      if(referrer){
        newUserData.referredBy = user.referralCode;
        referrer.wallet += 150;

        const walletDoc = await Wallet.findOne({userId: referrer._id})
        if(walletDoc){
          walletDoc.balance += 150;
          walletDoc.transactions.push({
            type: 'credit',
            amount: 150,
            description: `Referral bonus from ${user.name}`,
            status: 'completed'
          })
          await walletDoc.save();
        }else{
          await Wallet.create({
            userId: referrer._id,
            balance: 150,
            transactions: [{
              type: 'credit',
              amount: 150,
              description: `Referral bonus from ${user.name}`,
              status: 'completed'
            }]
          })
        }
      }
    }
    
    const userData = await User.create(newUserData);

    if (referrer) {
      referrer.redeemedUsers.push(userData._id);
      await referrer.save();
    }

    req.session.user = userData._id;
    req.session.userName = userData.name

    res.status(200).json({success: true, message: 'OTP verified successfully', redirectUrl: '/login'})

  } catch (error) {
    console.error('Error verifying OTP', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'An error occured'})
  }
}

const resendOtp = async (req, res) => {
  try {
    const {email} = req.session.userData;
    if(!email){
      return res.status(HTTP_STATUS.BAD_REQUEST).json({success: false, message: 'Email not found in session'})
    }
    const otp = generateOtp();
    req.session.userOtp = otp;
    const emailSent = await sendVerificationEmail(email, otp);
    if(emailSent){
      console.log('Resend OTP', otp);
      res.status(HTTP_STATUS.OK).json({success: true, message: 'OTP Resend Successfully'});
    }else {
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Failed to resend OTP, Please try again'});
    }
  } catch (error) {
    console.error('Error resending OTP', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({success: false, message: 'Internal Server Error, Please try again'})
  }
}

const getLogin = (req, res) => {
  try {
    if(!req.session.user){
      const error = req.flash('error')[0] || res.locals.error || '';
      res.render('user/login',{error: error[0]});
    }else {
      res.redirect('/')
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
    req.session.userName = user.name;
    res.redirect('/');
  }
  catch (error) {
    console.log('Login Error',error);
    req.flash('error', 'Login failed, Please try again later');
    res.redirect('/login');
  }
}


const loadShoppingPage = async (req, res) => {
    try {
        const categories = await Category.find({ isListed: true });
        const brands = await Brand.find({ isBlocked: false });

        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        // Build query to include only valid categories and brands
        const query = {
            isListed: true,
            quantity: { $gt: 0 },
            category: { $in: await Category.find({ isListed: true }).distinct('_id'), $ne: null },
            brand: { $in: await Brand.find({ isBlocked: false }).distinct('_id'), $ne: null }
        };

        // Count total products with the same query
        const totalProducts = await Product.countDocuments(query);

        // Fetch products with populate and pagination
        const products = await Product.find(query)
            .populate({ path: 'category', match: { isListed: true } })
            .populate({ path: 'brand', match: { isBlocked: false } })
            .skip(skip)
            .limit(limit)
            .lean(); // Use lean() for performance

        // Filter out products where category or brand is null after populate
        const filteredProducts = products.filter(p => p.category && p.brand);

        const totalPages = Math.ceil(totalProducts / limit);

        res.render('user/shop', {
            products: filteredProducts,
            category: categories,
            brand: brands,
            totalProducts,
            currentPage: page,
            totalPages,
            limit
        });

    } catch (error) {
        console.log("load Shop Page error", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).render('error', { message: "Failed to load shop page" });
    }
};



const filterProducts = async (req, res) => {
    try {
        const { categories, brands, priceRange, searchQuery, sortBy, page = 1 } = req.body;
        const limit = 6;
        const skip = (page - 1) * limit;

        let filter = {
            isListed: true,
            quantity: { $gt: 0 }
        };

        const listedCategoryIds = await Category.find({ isListed: true }).distinct('_id');
        const listedBrandIds = await Brand.find({ isBlocked: false }).distinct('_id');

        if (categories && categories.length > 0) {
            const filteredCategories = categories.filter((catId) =>
                listedCategoryIds.map(id => id.toString()).includes(catId)
            );
            filter.category = { $in: filteredCategories, $ne: null };
        } else {
            filter.category = { $in: listedCategoryIds, $ne: null };
        }

        if (brands && brands.length > 0) {
            const filteredBrands = brands.filter((brandId) =>
                listedBrandIds.map(id => id.toString()).includes(brandId)
            );
            filter.brand = { $in: filteredBrands, $ne: null };
        } else {
            filter.brand = { $in: listedBrandIds, $ne: null };
        }

        if (priceRange) {
            const [min, max] = priceRange.split('-').map(Number);
            filter.salePrice = max ? { $gte: min, $lte: max } : { $gte: min };
        }

        if (searchQuery) {
            filter.productName = { $regex: searchQuery, $options: 'i' };
        }

        // Count products with exact same filter
        const totalProducts = await Product.countDocuments(filter);

        let query = Product.find(filter)
            .populate({ path: 'category', match: { isListed: true } })
            .populate({ path: 'brand', match: { isBlocked: false } })
            .skip(skip)
            .limit(limit);

        if (sortBy) {
            switch (sortBy) {
                case 'price-low-high':
                    query = query.sort({ salePrice: 1 });
                    break;
                case 'price-high-low':
                    query = query.sort({ salePrice: -1 });
                    break;
                case 'new-arrivals':
                    query = query.sort({ createdAt: -1 });
                    break;
                case 'a-z':
                    query = query.sort({ productName: 1 });
                    break;
                case 'z-a':
                    query = query.sort({ productName: -1 });
                    break;
            }
        }

        const rawProducts = await query.exec();
        // Filter out products where category or brand is null after populate
        const products = rawProducts.filter(p => p.category && p.brand);

        res.json({
            success: true,
            products: products,
            totalProducts: totalProducts,
            totalPages: Math.ceil(totalProducts / limit),
            currentPage: parseInt(page),
            limit
        });

    } catch (error) {
        console.log("error filtering products", error);
        res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
};


const logout = async (req, res) => {
   try {
      req.session.destroy((err) => {
         if (err) {
            console.log('session destruction error', err);
            return res.redirect('/')
         }
         return res.redirect('/login')
      })
   } catch (error) {
      console.log("logout error", error);
      res.redirect('/pageNotFound')
   }
}



module.exports = {pageNotFound, loadHompage, getSignup, postSignup, verifyOtp, resendOtp, getLogin, postLogin, loadShoppingPage, filterProducts, logout};