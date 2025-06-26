const User = require('../../models/userModel');
const Category = require('../../models/categoryModel');
const Product = require('../../models/productModel');
const Brand = require('../../models/brandModel');
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
      

      if (user) {
         const userData = await User.findById(user);
         return res.render('user/home', { user: userData, products: productData ,brands:brands});
      } else {
         return res.render('user/home', { products: processedProducts,brands:brands})
      }
      
   } catch (error) {
      console.log('error loading home page');
      res.status(500).send('Internal server error');
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
      const user = req.session.user;
      const categories = await Category.find({ isListed: true })   
      const brands = await Brand.find({isBlocked: false})

      const userData = await User.findOne({ _id: user });
      const page = parseInt(req.query.page) || 1;
      const limit = 6
      const skip = (page - 1) * limit;
      
      const query = {
         isListed: true,
         quantity: { $gt: 0 }
      }

      const products = await Product.find(query) 
      .populate('category')
      .sort({ createdAt: 1 }).skip(skip).limit(limit)

      const totalProducts = await Product.countDocuments({
         isListed: true,
         quantity: { $gt: 0 }
      })

      const totalPages = Math.ceil(totalProducts / limit);
      const categoriesWithIds = categories.map(category => ({
         _id: category._id.toString(),
         name: category.name,
         description: category.description,
      }));
      const brandsWithIds = brands.map(brand => ({
         _id: brand._id.toString(),
         brandName: brand.brandName,
         brandImage: brand.brandImage
      }));

      res.render('user/shop', {
         user: userData,
         products: products,
         categories: categoriesWithIds,
         brands: brandsWithIds,
         category: categories, 
         brand: brands,
         totalProducts: totalProducts,
         currentPage: page,
         totalPages: totalPages,
      })

   } catch (error) {
      console.log("load Shop Page error", error);
      res.status(500).render('error', { message: "Failed to load shop page" });
   }
}


const filterProducts = async (req, res) => {
   try {
       const { categories, priceRange, searchQuery, sortBy, page = 1 } = req.body;
       const limit = 6; 
       const skip = (page - 1) * limit;

       let filter = { 
           isListed: true,
           quantity: { $gt: 0 } 
       };

       const listedCategories = await Category.find({ isListed: true }).lean()
       const listedBrands = await Brand.find({ isBlocked: false }).lean()

       if (categories && categories.length > 0) {
           const filteredCategories = listedCategories.filter((cat) => 
               categories.includes(cat._id.toString())
           );
           filter.category = { $in: filteredCategories.map(cat => cat._id), $ne: null };
       }

       if (req.body.brands && req.body.brands.length > 0) {
           const filteredBrands = listedBrands.filter((brand) => 
               req.body.brands.includes(brand._id.toString())
           );
           filter.brand = { $in: filteredBrands.map(brand => brand._id), $ne: null };
       }

       if (priceRange) {
           const [min, max] = priceRange.split('-').map(Number);
           filter.salePrice = max ? { $gte: min, $lte: max } : { $gte: min };
       }

       if (searchQuery) {
           filter.productName = { $regex: searchQuery, $options: 'i' };
       }

       let query = Product.find(filter).populate('category').skip(skip).limit(limit);

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

       const products = await query.exec();
       const totalProducts = await Product.countDocuments(filter);

       res.json({
           success: true,
           products: products,
           totalProducts: totalProducts,
           totalPages: Math.ceil(totalProducts / limit),
           currentPage: page
       });

   } catch (error) {
       console.log("error filtering products", error);
       res.status(500).json({ success: false, message: "Internal server error" });
   }
};



module.exports = {pageNotFound, loadHompage, getSignup, postSignup, verifyOtp, resendOtp, getLogin, postLogin, loadShoppingPage, filterProducts};