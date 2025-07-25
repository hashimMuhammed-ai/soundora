const Cart = require('../../models/cartModel');
const User = require('../../models/userModel');
const Address = require('../../models/addressModel');
const Product = require('../../models/productModel');
const Order = require('../../models/orderModel');
const Coupon = require('../../models/couponModel');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

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

        const user = await User.findById(req.session.user);
        const date = new Date();
        const coupon = await Coupon.find({
            couponMinAmount: {$lte: cart.cartTotal},
            isActive: true,
            limit: {$gt: 0},
            couponValidity: {$gte: date}
        }).sort({couponDiscount: -1})

        
        res.render("user/checkout", {
            cart,
            user,
            userAddress,
            coupon,
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
        const { shippingAddress, paymentMethod, couponCode, discountAmount } = req.body;

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
        const cleanedDiscount = parseFloat(discountAmount);

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
            status: paymentMethod === 'cod' ? 'processing' : 'pending',
            couponApplied: couponCode || null,
            discount: cleanedDiscount
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


const generateInvoice = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!orderId) {
            return res.status(400).send('Invalid Order ID');
        }

        const order = await Order.findById(orderId)
            .populate({
                path: 'items.productId',
                select: 'productName salePrice'
            })
            .populate('userId', 'name email phone')

        if (!order) {
            return res.status(404).send('Order not found');
        }


        const customerName = order.userId ?
            (order.userId.name || 'Customer') :
            'Customer';


        if (!order) {
            return res.status(404).send('Order not found');
        }

        const invoiceDir = path.join(__dirname, '../../publics/invoices');
        if (!fs.existsSync(invoiceDir)) {
            fs.mkdirSync(invoiceDir, { recursive: true });
        }

        const invoicePath = path.join(invoiceDir, `invoice-${order.orderId}.pdf`);
        const writeStream = fs.createWriteStream(invoicePath);

        const doc = new PDFDocument({
            size: 'A4',
            margins: {
                top: 50,
                bottom: 50,
                left: 50,
                right: 50
            }
        });
        doc.pipe(writeStream);

        doc.font('Helvetica-Bold')
            .fontSize(25)
            .text('Soundora', { align: 'center' })
            .fontSize(16)
            .text('Tax Invoice', { align: 'center' })
            .moveDown(1.5);

        doc.font('Helvetica')
            .fontSize(10)
            .text(`Invoice Number: ${order.orderId}`, { align: 'left' })
            .text(`Date of Issue: ${order.createdAt.toLocaleDateString()}`, { align: 'left' })
            .moveDown(1);

        doc.font('Helvetica-Bold')
            .text('Billing Details:', { underline: false })
            .moveDown(0.5)
            .font('Helvetica')
            .text(`Customer Name: ${customerName}`, { align: 'left' })
            .moveDown(1);
        doc.font('Helvetica-Bold')
            .text('Payment Details:', { underline: false })
            .moveDown(1)
            .font('Helvetica')
            .text(`Payment Method: ${order.paymentMethod}`, { align: 'left' })
            .moveDown(0.5)
            .font('Helvetica')
            .text(`Payment Status: ${order.status}`, { align: 'left' })
            .moveDown(1);

        doc.font('Helvetica-Bold')
            .fontSize(12)
            .text('Order Summary', { underline: false });

        const startX = 50;
        const columnWidths = { product: 250, quantity: 80, price: 80, total: 80 };
        let y = doc.y + 10;

        doc.font('Helvetica-Bold')
            .text('Product', startX, y, { width: columnWidths.product })
            .text('Quantity', startX + columnWidths.product, y, { width: columnWidths.quantity, align: 'right' })
            .text('Price', startX + columnWidths.product + columnWidths.quantity, y, { width: columnWidths.price, align: 'right' })
            .text('Total', startX + columnWidths.product + columnWidths.quantity + columnWidths.price, y, { width: columnWidths.total, align: 'right' })
            .moveDown(0.5)
            .moveTo(startX, doc.y)
            .lineTo(550, doc.y)
            .stroke();

        let runningTotal = 0;
        order.items.forEach((item) => {
            y = doc.y + 5;
            const itemTotal = item.price * item.quantity;
            runningTotal += itemTotal;

            doc.font('Helvetica')
                .text(item.productId.productName, startX, y, { width: columnWidths.product })
                .text(`${item.quantity}`, startX + columnWidths.product, y, { width: columnWidths.quantity, align: 'right' })
                .text(`RS.${item.price.toFixed(2)}`, startX + columnWidths.product + columnWidths.quantity, y, { width: columnWidths.price, align: 'right' })
                .text(`RS.${itemTotal.toFixed(2)}`, startX + columnWidths.product + columnWidths.quantity + columnWidths.price, y, { width: columnWidths.total, align: 'right' })
                .moveDown(0.5);
        });

    
        doc.moveDown(1)
            .moveTo(startX, doc.y)
            .lineTo(550, doc.y)
            .stroke()
            .moveDown(0.5);

        const summaryStartY = doc.y; 
        const lineHeight = 15; 

        const labelX = 350;
        const valueX = 460;
        const valueWidth = 80;


        doc.font('Helvetica-Bold').text('Subtotal', labelX, summaryStartY, { width: 100, align: 'right' });
doc.font('Helvetica').text(`RS.${runningTotal.toFixed(2)}`, valueX, summaryStartY, { width: valueWidth, align: 'right' });

doc.font('Helvetica-Bold').text('Discount', labelX, summaryStartY + lineHeight, { width: 100, align: 'right' });
doc.font('Helvetica').text('RS.0.00', valueX, summaryStartY + lineHeight, { width: valueWidth, align: 'right' });

doc.font('Helvetica-Bold').text('Delivery Charge', labelX, summaryStartY + lineHeight * 2, { width: 100, align: 'right' });
doc.font('Helvetica').text('RS.40.00', valueX, summaryStartY + lineHeight * 2, { width: valueWidth, align: 'right' });

doc.font('Helvetica-Bold').text('Grand Total', labelX, summaryStartY + lineHeight * 3, { width: 100, align: 'right' });
doc.font('Helvetica-Bold').text(`RS.${(runningTotal + 40).toFixed(2)}`, valueX, summaryStartY + lineHeight * 3, { width: valueWidth, align: 'right' });


        

        doc.moveDown(3)
            .font('Helvetica')
            .text('Thanks for choosing Soudora', 50, null, { width: 550, align: 'center' })
            .text('Return & Exchange Policy: www.soundora.com/return-policy', 50, null, { width: 550, align: 'center' })
            .moveDown(1)
            .font('Helvetica-Bold')
            .text('Contact Us: 9895861278', 50, null, { width: 550, align: 'center' })
            .text('Email: contact@soundora.com', 50, null, { width: 550, align: 'center' })
            .moveDown(1)
            .font('Helvetica')
            .text('Visit Us: www.soundora.com', 50, null, { width: 550, align: 'center' })

        doc.end();

        writeStream.on('finish', () => {
            res.download(invoicePath, `invoice-${orderId}.pdf`, (err) => {
                if (err) {
                    console.error('Download error:', err);
                    res.status(500).send('Error downloading invoice');
                }
            });
        });

    } catch (error) {
        console.error('Invoice Generation Error:', error);
        res.status(500).send('Error generating invoice');
    }
};


const returnOrder = async (req,res) =>{
    try {
        const orderId =req.params.orderId
        const {reason} = req.body
        const userId = req.session.user

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        if (!reason) {
            return res.status(400).json({ success: false, message: 'Return reason is required' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'invalid Order' });
        }

        if (order.status !== "delivered") {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }


        order.status = 'Return requested';
        order.returnReason = reason;
        await order.save();

        return res.status(200).json({ success: true, message: 'Product return request sended update status later....' })
    } catch (error) {
        console.log("error in return order", error)
        return res.status(500).json({ success:false,message: 'Internal Server Error' });
    }
}


const validateCheckoutItems = async (req, res) => {
    try {
        const { orderedItems } = req.body;
        
        const unavailableItems = [];
        console.log(orderedItems);
        
        for (const item of orderedItems) {
            const product = await Product.findById(item.productId).populate('category');
            
            if (!product || !product.isListed) {
                unavailableItems.push({
                    id: item.productId,
                    name: item.productId.productName || "Unknown product",
                    reason: "Product is no longer available"
                });
                continue;
            }
            
            if (!product.category || !product.category.isListed) {
                unavailableItems.push({
                    id: item.productId,
                    name: product.productName,
                    reason: "Product category is no longer available"
                });
                continue;
            }
            
            if (product.quantity < item.quantity) {
                unavailableItems.push({
                    id: item.productId,
                    name: product.productName,
                    reason: "Insufficient stock available"
                });
            }
        }
        
        if (unavailableItems.length > 0) {
            return res.status(400).json({
                success: false,
                error: "Some products have become unavailable",
                unavailableItems: unavailableItems
            });
        }
        
        return res.json({
            success: true,
            message: "All products are available"
        });
    } catch (error) {
        console.error("Error validating checkout items:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to validate items. Please try again."
        });
    }
}


const applyCoupon = async (req, res) => {
    try {

        const { couponCode } = req.body;
        const userId = req.session.user;

        const cart = await Cart.findOne({userId});
        if(!cart || cart.items.length === 0){
            return res.status(400).json({success: false, message: 'Cart is empty'})
        }
        const subtotal = cart.cartTotal;

        const coupon = await Coupon.findOne({ couponCode, isActive: true });
        if (!coupon) {
            return res.status(400).json({ success: false, message: 'Invalid or expired coupon' });
        }
        const currentDate = new Date();
        if (coupon.couponValidity < currentDate) {
            return res.status(400).json({ success: false, message: 'Coupon has expired' });
        }
        if (coupon.limit <= 0) {
            return res.status(400).json({ success: false, message: 'Coupon has reached its limit' });
        }

        let discount = 0;
        if (coupon.couponType === "percentage") {
            discount = (subtotal * coupon.couponDiscount) / 100;
        } else {
            discount = coupon.couponDiscount;
        }

        if (coupon.couponMaxAmount && discount > coupon.couponMaxAmount) {
            discount = coupon.couponMaxAmount;
        }

        let newTotal = subtotal - discount;

        coupon.limit -= 1;

        coupon.usageCount += 1;

        await coupon.save();

        return res.status(200).json({ success: true, message: 'Coupon applied successfully', discount, newTotal });

    } catch (error) {
        console.log("error applying coupon", error)
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const removeCoupon = async (req, res) => {
    try {
        const { couponCode, subtotal } = req.body;
        const coupon = await Coupon.findOne({ couponCode: couponCode });

        if (!coupon) {
            return res.json({ success: false, message: 'Invalid coupon' });
        }

        coupon.limit += 1;
        coupon.usageCount -= 1;
        await coupon.save();

        const cartTotal = subtotal;

        res.json({
            success: true,
            cartTotal,
            message: 'Coupon removed successfully'
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        res.status(500).json({
            success: false,
            message: 'Server error while removing coupon'
        });
    }
}


module.exports = { 
    loadCheckout,
    editCheckoutAddress,
    addCheckoutAddress,
    placeOrder,
    viewOrder,
    cancelOrder,
    generateInvoice,
    returnOrder,
    validateCheckoutItems,
    applyCoupon,
    removeCoupon
};