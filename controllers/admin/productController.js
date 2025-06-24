const Product = require('../../models/productModel');
const Category = require('../../models/categoryModel');
const Brand = require('../../models/brandModel');
const User = require('../../models/userModel');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');


const getProductAddPage = async (req, res) => {
  try {
    const category = await Category.find({isListed: true});
    const brand = await Brand.find({isBlocked: false});
    res.render('admin/product-add', {cat: category, brand});
  } catch (error) {
      res.redirect('/pageError')
  }
}


const addProducts = async (req, res) => {
   try {
      const products = req.body;
      
      const productExists = await Product.findOne({
         productName: products.productName  
      });

      if (!productExists) {
         const images = [];
         
         if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
               const originalImagePath = req.files[i].path;
               const resizedImagePath = path.join("public", "uploads", "product-images", `resized-${req.files[i].filename}`);

               try {
                  await sharp(originalImagePath)
                     .resize({ width: 440, height: 440 })
                     .toFile(resizedImagePath);
                  images.push(req.files[i].filename);
               } catch (imgError) {
                  console.error("Error processing image:", imgError);
               }
            }
         }

         const categoryId = await Category.findOne({ name: products.category });
         if (!categoryId) {
            const category = await Category.find({ isListed: true });
            const brand = await Brand.find({ isBlocked: false });
            return res.render('admin/product-add', { 
               cat: category, 
               brand: brand, 
               message: "Category not found"
            });
         }
         
         const brandId = await Brand.findOne({ brandName: products.brand });
         if (!brandId) {
            const category = await Category.find({ isListed: true });
            const brand = await Brand.find({ isBlocked: false });
            return res.render('admin/product-add', { 
               cat: category, 
               brand: brand, 
               message: "Brand not found"
            });
         }

         if (!products.productName || !products.description || !products.regularPrice) {
            const category = await Category.find({ isListed: true });
            const brand = await Brand.find({ isBlocked: false });
            return res.render('admin/product-add', { 
               cat: category, 
               brand: brand, 
               message: "All required fields must be filled"
            });
         }

         if (images.length < 3) {
            const category = await Category.find({ isListed: true });
            const brand = await Brand.find({ isBlocked: false });
            return res.render('admin/product-add', { 
               cat: category, 
               brand: brand, 
               message: "At least 3 product images are required"
            });
         }

         const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: categoryId._id,
            regularPrice: products.regularPrice,
            salePrice: products.salePrice || products.regularPrice, 
            discountPrice: products.discountPrice,
            productImages: images,
            isListed: products.isListed !== undefined ? products.isListed : true, 
            quantity: products.quantity || 0, 
            brand: brandId._id,
            status: "Available",
         });

         await newProduct.save();
         return res.redirect('/admin/addProducts');
      } else {
         const category = await Category.find({ isListed: true });
         const brand = await Brand.find({ isBlocked: false });
         return res.render('admin/product-add', { 
            cat: category,
            brand: brand, 
            message: "Product already exists"
         });
      }
   } catch (error) {
      console.log("Error adding product", error);
      
      const category = await Category.find({ isListed: true }).catch(e => []);
      const brand = await Brand.find({ isBlocked: false }).catch(e => []);
      
      return res.render('admin/product-add', { 
         cat: category,
         brand: brand, 
         message: "Error adding product: " + error.message
      });
   }
};


const getAllProducts = async (req, res) => {
   try {

      const search = req.query.search || "";
      const page = Math.max(1, parseInt(req.query.page)) || 1;
      const limit = 5


      const productData = await Product.find({
         $or: [
            { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
         ]
      })
         .limit(limit)
         .skip((page - 1) * limit)
         .populate('category') // Ensure this matches the schema's `ref` field
         .exec();


      const count = await Product.find({
         $or: [
            { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
         ]
      }).countDocuments();


      const category = await Category.find({ isListed: true });
      const brand = await Brand.find({ isBlocked: false });


      res.render('admin/products', {
         data: productData,
         currentPage: page,
         totalPages: Math.ceil(count / limit),
         cat: category,
         searchTerm: search,
         brand: brand
      });

   } catch (error) {
      console.error("Error in getAllProducts:", error);
      res.redirect('/pageError');
   }
};


module.exports = {getProductAddPage, addProducts, getAllProducts};