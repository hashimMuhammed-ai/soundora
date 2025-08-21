const Wallet = require("../../models/walletModel")
const Order = require("../../models/orderModel")
const HTTP_STATUS = require('../../constants/httpStatus');

const addMoney = async (req, res) => {
    try {
        const { amount } = req.body
        const userId = req.session.user

        if(!userId){
            return res.status(HTTP_STATUS.UNAUTHORIZED).json({success:false,message:"Unauthorised"})
        }

        let wallet = await Wallet.findOne({ userId: userId })

        if(!wallet){
            wallet = new Wallet({
                userId: userId,
                balance:0,
                transactions:[]
            })
        }

        wallet.balance += Number(amount)
        wallet.transactions.push({
            type: 'credit',
            amount:Number(amount),
            description:"Wallet Recharge"
        })
        await wallet.save()
        return res.status(200).json({success:true,message:"Money added successfully"})

    } catch (error) {
        console.log("error in add money", error)
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success:false,message: 'Internal Server Error' });
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
    returnOrder
}
