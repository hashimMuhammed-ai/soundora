const Cart = require('../../models/cartModel');
const User = require('../../models/userModel');
const Address = require('../../models/addressModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');

const loadCheckout = async (req, res) => {
    try {
        const userId = req.session.user;

        let cart = await Cart.findOne({ userId }).populate({
            path: "items.productId",
            populate: { path: "category" }
        });

        const availableItems = cart.items.filter(item =>
            item.productId.isListed &&
            item.productId.category &&
            item.productId.category.isListed
        );

        if (availableItems.length !== cart.items.length) {
            req.flash("error", "Some products or their categories are unavailable and have been removed from your checkout.");
        }
        cart.items = availableItems;

        cart.cartTotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        await cart.save();

        const addressDoc = await Address.findOne({ userId: userId });
        let userAddress = addressDoc ? addressDoc.address : [];

        
        res.render("user/checkout", {
            cart,
            userAddress,
            messages: req.flash()
        });

    } catch (error) {
        console.log("Error in checkout:", error);
        res.redirect("/pageNotFound");
    }
};

const editCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            address_id,
            name,
            addressType,
            city,
            state,
            landMark,
            pincode,
            phone,
            altPhone
        } = req.body;

        if (!address_id) {
            console.log("Invalid Address ID:", address_id);
            return res.status(400).json({ error: "Invalid address ID" });
        }

        const address = await Address.findOne({ userId});
        if (!address) {
            return res.status(404).json({ error: "Address not found" });
        }

        const addressIndex = address.address.findIndex(addr => addr._id.toString() === address_id);
        if (addressIndex === -1) {
            return res.status(404).json({ error: "Address not found in array" });
        }

        address.address[addressIndex] = {
            ...address.address[addressIndex],
            name,
            addressType,
            city,
            state,
            landMark,
            pincode,
            phone,
            altPhone
        };

        await address.save();
        res.redirect('/checkout');
    } catch (error) {
        console.log("error in editCheckoutAddress", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

const addCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            name,
            addressType,
            city,
            state,
            landMark,
            pincode,
            phone,
            altPhone
        } = req.body;

        let addressDoc = await Address.findOne({ userId });

        if (addressDoc) {
            addressDoc.address.push({
                name,
                addressType,
                city,
                state,
                landMark,
                pincode,
                phone,
                altPhone
            });
            await addressDoc.save();
        } else {
            addressDoc = new Address({
                userId,
                address: [{
                    name,
                    addressType,
                    city,
                    state,
                    landMark,
                    pincode,
                    phone,
                    altPhone
                }]
            });
            await addressDoc.save();
        }

        res.redirect('/checkout');
    } catch (error) {
        console.log("error in addCheckoutAddress", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const { shippingAddress, paymentMethod } = req.body;

        // Get user cart with populated products
        const cart = await Cart.findOne({ userId })
            .populate('items.productId')
            .populate({
                path: 'userId',
                select: 'name email'
            })
            .exec();

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Your cart is empty" 
            });
        }

        // Get full address details
        const addressDoc = await Address.findOne({ 
            userId, 
            "address._id": shippingAddress 
        });
        
        if (!addressDoc) {
            return res.status(400).json({ 
                success: false, 
                error: "Address not found" 
            });
        }

        const selectedAddress = addressDoc.address.find(
            addr => addr._id.toString() === shippingAddress
        );

        // Validate products and stock
        const unavailableItems = [];
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || !product.isListed || product.quantity < item.quantity) {
                unavailableItems.push({
                    name: item.productId.productName,
                    reason: !product ? "Product not found" : 
                           !product.isListed ? "Product not available" : 
                           "Insufficient stock"
                });
            }
        }

        if (unavailableItems.length > 0) {
            return res.status(400).json({ 
                success: false, 
                unavailableItems,
                error: "Some items are unavailable"
            });
        }

        // Calculate totals
        const subtotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
        const shippingCharge = subtotal > 0 ? 40 : 0;
        const totalAmount = subtotal + shippingCharge;

        // Prepare order items
        const orderItems = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
        }));

        // Create new order
        const order = new Order({
            userId,
            items: orderItems,
            shippingAddress: selectedAddress, 
            paymentMethod,
            totalAmount,
            status: paymentMethod === 'cod' ? 'processing' : 'pending'
        });

        await order.save();

        // Update product stock
        const bulkOps = cart.items.map(item => ({
            updateOne: {
                filter: { _id: item.productId._id },
                update: { $inc: { quantity: -item.quantity } }
            }
        }));
        
        await Product.bulkWrite(bulkOps);

        // Clear cart
        await Cart.updateOne(
            { userId },
            { $set: { items: [], totalPrice: 0 } }
        );

        res.json({ 
            success: true, 
            orderId: order._id 
        });

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ 
            success: false, 
            error: "Internal server error",
            details: error.message 
        });
    }
};


const viewOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.params.orderId;

        const order = await Order.findById(orderId)
            .populate({
                path: 'items.productId',
                select: 'productName productImages price'
            })

        if (!order) {
            console.log("Order not found in database");
            return res.redirect('/userProfile');
        }

        if (!order.userId || order.userId.toString() !== userId.toString()) {
            console.log("Order does not belong to current user");
            return res.redirect('/userProfile');
        }

        const user = await User.findById(userId).select('name email phone');

        const deliveryAddress = order.shippingAddress || null;

        const orderData = {
            ...order.toObject(),
            address: deliveryAddress,
            totalAmount: order.totalAmount,
            orderStatus: order.status,
            couponApplied: order.couponApplied,
            createdAt: order.createdAt,
            payment_method: order.paymentMethod
        };

        return res.render("user/order", { order: orderData, user });

    } catch (error) {
        console.error('View order error:', error);
        return res.redirect('/profile');
    }
};


const cancelOrder = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const orderReason = req.body.reason;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        if (!orderReason) {
            return res.status(400).json({ success: false, message: 'Reason is required' });
        }

        const order = await Order.findById(orderId);
        if (!order || order.userId.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
        }

        const cancellableStatuses = ['pending', 'processing', 'shipped'];
        if (!cancellableStatuses.includes(order.status)) {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        for (let item of order.items) {
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { quantity: item.quantity }
            }, { new: true });
        }

        order.status = 'cancelled';
        order.cancellationReason = orderReason;
        await order.save();

        return res.status(200).json({ success: true, message: 'Order cancelled successfully' });

    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};





module.exports = { 
    loadCheckout,
    editCheckoutAddress,
    addCheckoutAddress,
    placeOrder,
    viewOrder,
    cancelOrder
};