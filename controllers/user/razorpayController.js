const Razorpay = require("razorpay");
require("dotenv").config();
const crypto = require("crypto");
const Order = require("../../models/orderModel");
const Cart = require("../../models/cartModel");
const Product = require("../../models/productModel");
const Address = require("../../models/addressModel");
const User = require("../../models/userModel");

const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createOrder = async (req, res) => {
    try {

        const cart = await Cart.findOne({userId: req.session.user}).populate('items.productId');

        if(!cart){
            return res.status(404).json({ success: false, error: "cart not found" }); 
        }

        const inActiveCartItems = cart.items.filter((itm)=>
            itm.productId.isBlocked || !itm.productId.isListed); 

        if(inActiveCartItems.length > 0){
           return res.status(404).json({ success: false, error: "cart contains inactive items" }); 
        }

        const { amount, currency } = req.body;
        
        const options = {
            amount: amount * 100, // Convert to paisa
            currency,
            receipt: `order_rcptid_${Date.now()}`,
            payment_capture: 1,
        };

        const order = await razorpayInstance.orders.create(options);
        res.status(200).json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ success: false, error: "Failed to create order" });
    }
};

const verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            shippingAddress,
            totalAmount,
            couponCode,
            discountAmount
        } = req.body;

        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }
        const userAddress = await Address.findOne({
            userId:req.session.user,
            "address._id":shippingAddress
        },{
            address: {$elemMatch: {_id: shippingAddress}}
        })

       if (!userAddress || !userAddress.address || userAddress.address.length === 0) {
           return res.status(400).json({ success: false, message: 'Selected address not found' });
       }
       const selectedAddress = userAddress.address[0];

       console.log("selectedAddress", selectedAddress)

        const userCart = await Cart.findOne({
            userId: req.session.user
        })
         .populate('items.productId')
         
        const orderItems = userCart.items.map((item)=>({
            productId: item.productId._id,
            productName: item.productId.productName,
            quantity: item.quantity,
            price: item.price,
            totalPrice: item.totalPrice
        }))

        const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
            const newOrder = new Order({
                userId: req.session.user,
                address_id: shippingAddress,
                shippingAddress:{
                    addressType: selectedAddress.addressType,
                    name: selectedAddress.name,
                    city: selectedAddress.city,
                    landMark: selectedAddress.landMark,
                    state: selectedAddress.state,
                    pincode: selectedAddress.pincode,
                    phone: selectedAddress.phone,
                    altPhone: selectedAddress.altPhone
                },
                paymentMethod: "razorpay",
                items: orderItems,
                totalAmount: totalAmount,
                status: "processing",
                paymentStatus: "success",
                couponApplied: couponCode ? true : false,
                discount: discountAmount || 0,
                razorpay_order_id,
                razorpay_payment_id
            });

            const savedOrder = await newOrder.save();

            userCart.items = [];
            userCart.cartTotal = 0;
            await userCart.save();

            for(const item of orderItems){
                await Product.updateOne(
                    { _id: item.productId },
                    { $inc: { quantity: -item.quantity } }
                )
            }

            res.json({
                success: true,
                orderId: savedOrder._id
            });

        } else {
            const failedOrder = new Order({
                userId: req.session.user,
                address_id: shippingAddress,
                shippingAddress:{
                    addressType: selectedAddress.addressType,
                    name: selectedAddress.name,
                    city: selectedAddress.city,
                    landMark: selectedAddress.landMark,
                    state: selectedAddress.state,
                    pincode: selectedAddress.pincode,
                    phone: selectedAddress.phone,
                    altPhone: selectedAddress.altPhone
                },
                paymentMethod: "razorpay",
                items: orderItems,
                totalAmount: totalAmount,
                status: "failed",
                paymentStatus: "failed",
                couponApplied: couponCode ? true : false,
                discount: discountAmount || 0,
                razorpay_order_id
            });
            await failedOrder.save();

            res.status(400).json({ success: false, message: "Payment verification failed", orderId: failedOrder._id });

        }
    } catch (error) {
        console.error("Payment Verification Error:", error);
        res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
}

const paymentFailed = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        
        let order = await Order.findById(orderId).catch(() => null);

        if (!order || order.userId.toString() !== req.session.user) {
            return res.redirect('/orders');
        }
        
        const user = await User.findById(req.session.user)

        res.render("user/failure",{order,user})
    } catch (error) {
        console.error("Error rendering failure page:", error);
        res.redirect('/orders');
    }
}
const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.params;

        const failedOrder = await Order.findById(orderId);
        if (!failedOrder || failedOrder.userId.toString() !== req.session.user) {
            return res.status(404).json({ success: false, message: "Order not found or not authorized" });
        }

        if (failedOrder.status !== "failed") {
            return res.status(400).json({ success: false, message: "This order cannot be retried" });
        }

        const options = {
            amount: failedOrder.totalAmount * 100,
            currency: "INR",
            receipt: `retry_order_${orderId}`,
            payment_capture: 1
        };

        const order = await razorpayInstance.orders.create(options);

        res.json({
            success: true,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error("Retry Payment Error:", error);
        res.status(500).json({ success: false, message: "Failed to retry payment" });
    }
};

const verifyRetryPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = req.body;

        if (!req.session.user) {
            return res.status(401).json({ success: false, message: "Not authenticated" });
        }

        const failedOrder = await Order.findById(orderId);
        if (!failedOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const generatedSignature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature === razorpay_signature) {
            failedOrder.status = "processing";
            failedOrder.paymentStatus = "success";
            failedOrder.razorpay_order_id = razorpay_order_id;
            failedOrder.razorpay_payment_id = razorpay_payment_id;
            await failedOrder.save();


            let cart = await Cart.findOne({ userId: req.session.user });

            if (!cart) {
                cart = new Cart({
                    userId: req.session.user,
                    items: [],
                    cartTotal: 0
                });

            } else {
                cart.items = [];
                cart.cartTotal = 0;
            }

            await cart.save();

            if (failedOrder.items && failedOrder.items.length > 0) {
                for (const item of failedOrder.items) {
                    await Product.updateOne(
                        { _id: item.productId },
                        { $inc: { quantity: -item.quantity } }
                    );
                }
            }

            res.json({
                success: true,
                orderId: failedOrder._id
            });
        } else {
            console.log("Retry Payment failed: Signature Mismatch");
            res.status(400).json({ success: false, message: "Payment verification failed" });
        }
    } catch (error) {
        console.error("Retry Payment Verification Error:", error);
        res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
}





module.exports = {
    verifyPayment,
    createOrder,
    paymentFailed,
    retryPayment,
    verifyRetryPayment
};
