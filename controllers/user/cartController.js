const User = require("../../models/userModel");
const Product = require("../../models/productModel");
const Cart = require('../../models/cartModel');
const Wishlist = require('../../models/wishlistModel');

const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;

        let cart = await Cart.findOne({ userId }).populate({
            path: "items.productId", 
            populate: { path: "category" }
        });

        if (!cart) {
            return res.render("user/cart", { 
                user: req.session.userData,
                cart: {
                    items: [],
                    cartTotal: 0,
                }
            });
        }

        const processedData = cart.items
            .map(item => {
                if (!item.productId) return null;
                
                const productAvailable = item.productId.isListed && item.productId.quantity > 0;
                const categoryAvailable = item.productId.category && item.productId.category.isListed;
                
                item.productId.isAvailable = productAvailable && categoryAvailable;
                
                return { ...item._doc, productId: item.productId };
            })
            .filter(item => item);

        cart.items = processedData;
        cart.cartTotal = cart.items.reduce((total, item) => 
            (item.productId.isAvailable ? item.totalPrice : 0) + total, 0);

        res.render("user/cart", {
            user: req.session.userData, 
            cart
        });

    } catch (error) {
        console.error("Error loading cart:", error);
        res.status(500).send("Failed to load cart");
    }
};

const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        if (!productId) {
            return res.status(400).json({ 
                success: false,
                message: "Product ID is required" 
            });
        }
        
        const product = await Product.findById(productId).populate("category");
        
        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: "Product not found" 
            });
        }

        // Check if product or category is unlisted or out of stock
        if (!product.isListed || (product.category && !product.category.isListed) || product.quantity === 0) {
            return res.status(400).json({ 
                success: false,
                message: "Product cannot be added (unlisted, category unlisted, or out of stock)" 
            });
        }

        const itemQuantity = parseInt(quantity) || 1;
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({
                userId,
                items: [],
                cartTotal: 0
            });
        }

        const existingItemIndex = cart.items.findIndex(item => 
            item.productId.toString() === productId.toString()
        );

        if (existingItemIndex > -1) {
            let newQuantity = cart.items[existingItemIndex].quantity + itemQuantity;

            if (newQuantity > 5) {
                return res.status(400).json({ 
                    success: false,
                    message: "You can only order up to 5 items" 
                });
            }
            if (newQuantity > product.quantity) {
                return res.status(400).json({ 
                    success: false,
                    message: "You can not order more than available stock" 
                });
            }
            if (newQuantity < 1) {
                return res.status(400).json({ 
                    success: false,
                    message: "Quantity cannot be less than 1" 
                });
            }

            cart.items[existingItemIndex].quantity = newQuantity;
            cart.items[existingItemIndex].totalPrice = newQuantity * product.salePrice;
        } else {
            cart.items.push({
                productId,
                quantity: itemQuantity,
                price: product.salePrice,
                totalPrice: product.salePrice * itemQuantity
            });
        }

        // Remove from wishlist if present
        await Wishlist.updateOne(
            { userId },
            { $pull: { items: { productId } } }
        );

        cart.cartTotal = cart.items.reduce((total, item) => 
            total + (Number(item.totalPrice) || 0), 0
        );

        await cart.save();

        res.status(200).json({
            success: true,
            message: "Cart updated successfully",
            cartTotal: cart.cartTotal,
            itemsCount: cart.items.length
        });

    } catch (error) {
        console.error("Error in add to cart:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add product to cart \n LOGIN FIRST"
        });
    }
};

const removeCartItem = async (req, res) => {
    try {
        const userId = req.session.user;  
        const productId = req.params.productId;

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ success: false, message: "Cart not found" });
        }

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not found in cart" });
        }

        cart.items.splice(itemIndex, 1);

        cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        await cart.save();

        return res.status(200).json({ success: true, message: "Item removed from cart" });

    } catch (error) {
        console.error("Error removing item:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadCart,
    addToCart,
    removeCartItem
};