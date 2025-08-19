const Wishlist = require("../../models/wishlistModel");
const Cart = require("../../models/cartModel");
const { getDiscountPrice, getDiscountPriceCart } = require("../../helpers/offerHelper");



const loadWishlist = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 5;
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: "items.productId",
                populate: { path: "category" }
            });

        if (!wishlist || wishlist.items.length === 0) {
            return res.render("user/wishlist", {
                wishlist: [],
                currentPage: 1,
                totalPages: 0
            });
        }

        const processedItems = wishlist.items.map(item => ({
            ...item.toObject(),
            productId: getDiscountPriceCart(item.productId)
        }));

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedItems = processedItems.slice(startIndex, endIndex);
                                                                      
        const totalItems = processedItems.length;
        const totalPages = Math.ceil(totalItems / limit);

        res.render("user/wishlist", {
            user: req.session.userData,
            wishlist: { ...wishlist.toObject(), items: paginatedItems },
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems
        });
    } catch (error) {
        console.error("Error in load wishlist:", error);
        res.status(500).redirect("/userProfile");
    }
};
const addToWishlist = async (req,res)=>{
    try {
        const userId = req.session.user
        const {productId} = req.body
        
        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        let wishlist = await Wishlist.findOne({userId})

        if (!wishlist) {
            wishlist = new Wishlist({ userId: userId, items: [] });
        }

        const cart = await Cart.findOne({ userId, "items.productId": productId });

        if (cart) {
            return res.status(400).json({ success: false, message: "Item is already in the cart" });
        }

        const existingItemIndex = wishlist.items.findIndex(item => item.productId.toString() === productId);
         if (existingItemIndex !== -1) {
            return res.status(200).json({ success: false, message: "Item already in wishlist" });
        }

        wishlist.items.push({productId})

        await wishlist.save()

        res.status(200).json({success:true, message:"Added to wishlist"})
    } catch (error) {
        console.log("error in add to wishlist", error)
        res.status(500).json({success:false, message:"Internal server error"})
    }
}

const removeWishlistItem = async (req,res)=>{
    try {
        const userId = req.session.user
        const productId = req.params.productId
        const wishlist = await Wishlist.findOneAndUpdate(
            {userId},
            {$pull:{items:{productId}}},
            {new:true}
        )

        if(!wishlist){
            return res.status(404).json({success:false, message:"Wishlist not found"})
        }
        res.status(200).json({success:true, message:"Removed from wishlist"})

    } catch (error) {
        console.log("error in remove wishlist item", error)
        res.status(500).json({success:false, message:"Internal server error"})
    }
}

module.exports={
    loadWishlist,
    addToWishlist,
    removeWishlistItem
}