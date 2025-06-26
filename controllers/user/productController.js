const Product = require("../../models/productModel");
const User = require("../../models/userModel");
const Category = require("../../models/categoryModel");
// const Brand = require("../../models/brandModel");
// const { getDiscountPrice } = require("../../helpers/offerHelper");


const productDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId);
        const productId = req.query.id;

        const product = await Product.findById(productId)
            .populate("category","name description categoryOffer isListed ", { isListed: true }) 
            .populate("brand", "brandName"); 


        if (!product) {
            return res.redirect("/pageNotFound"); 
        }

        const relatedProducts = await Product.find({
            category: product.category._id, 
            _id: { $ne: productId }
        }).limit(4);
        


        res.render("user/product-details", {
            product: product,
            user: userData,
            quantity: product.quantity,
            category: product.category, 
            brand: product.brand, 
            relatedProducts: relatedProducts
        });

    } catch (error) {
        console.log("error in product details", error);
        res.redirect("/pageNotFound");
    }
};

module.exports = {
    productDetails
};