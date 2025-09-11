const Wallet = require("../../models/walletModel")
const Order = require("../../models/orderModel")
const HTTP_STATUS = require('../../constants/httpStatus');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const addMoney = async (req, res) => {
    try {
        const { amount } = req.body
        const userId = req.session.user

        if(!userId){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({success:false,message:"Unauthorised"})
        }

        if (!amount || amount <= 0) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({success:false,message:"Invalid amount"})
        }

        // Create Razorpay order
        const options = {
            amount: Number(amount) * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: `w_${userId.toString().slice(-8)}_${Date.now().toString().slice(-8)}`,
            notes: {
                userId: userId,
                purpose: 'wallet_recharge'
            }
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return res.status(200).json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.log("error in add money", error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success:false,message: 'Internal Server Error' });
    }
}

const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({success: false, message: "Unauthorised"});
        }

        // Verify payment signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({
                success: false,
                message: "Payment verification failed"
            });
        }

        // Payment verified, add money to wallet
        let wallet = await Wallet.findOne({ userId: userId });

        if (!wallet) {
            wallet = new Wallet({
                userId: userId,
                balance: 0,
                transactions: []
            });
        }

        const amountInRupees = Number(amount) / 100; // Convert from paise to rupees
        wallet.balance += amountInRupees;
        wallet.transactions.push({
            type: 'credit',
            amount: amountInRupees,
            description: "Wallet Recharge via Razorpay",
            status: 'completed'
        });

        await wallet.save();

        return res.status(200).json({
            success: true,
            message: "Money added successfully",
            balance: wallet.balance
        });

    } catch (error) {
        console.log("error in verify payment", error);
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ 
            success: false, 
            message: 'Internal Server Error' 
        });
    }
}

const returnOrder = async (req,res) =>{
    try {
        const orderId =req.params.orderId
        const {reason} = req.body
        const userId = req.session.user

        if (!userId) {
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({ success: false, message: 'Unauthorized' });
        }
        if (!reason) {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Return reason is required' });
        }

        const order = await Order.findById(orderId);
        if (!order || order.status !== "delivered") {
            return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: 'invalid Order' });
        }

        if (order.status !== "delivered") {
            return res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, message: 'Only delivered orders can be returned' });
        }


        order.status = 'Return requested';
        order.returnReason = reason;
        await order.save();

        return res.status(HTTP_STATUS.OK).json({ success: true, message: 'Product return request sended update status later....' })
    } catch (error) {
        console.log("error in return order", error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success:false,message: 'Internal Server Error' });
    }
}

module.exports ={
    addMoney,
    verifyPayment,
    returnOrder
}
