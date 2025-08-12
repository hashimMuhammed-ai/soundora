const mongoose = require('mongoose');
const uuid = require('crypto').randomUUID;

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
});

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orderId: {
    type: String,
    unique: true
  },
  items: [orderItemSchema],
  shippingAddress: {
    addressType: {
          type: String,
          required: true
      },
      name: {
          type: String,
          required: true
      },
      city: {
          type: String,
          required: true
      },
      landMark: {
          type: String,
          required: true
      },
      state: {
          type: String,
          required: true
      },
      pincode: {
          type: Number,
          required: true
      },
      phone: {
          type: Number,
          required: true
      },
      altPhone: { 
          type: Number,
          required: false
      }
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'razorpay', 'wallet'],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ["success", "failed", "pending"],
    default: "pending"
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'Return requested', 'Return rejected', 'Return approved', 'failed'],
    default: 'pending'
  },
  cancellationReason: {
    type: String
  },
  adminReturnStatus: {
    type: String
  },
  couponApplied: {
    type: String
  },
  discount: {
    type: String
  },
  orderDate: {
    type: Date,
    default: Date.now
  }
},{ timestamps: true });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderId) {
    this.orderId = `ORD-${Date.now()}-${uuid().slice(0,8).toUpperCase()}`;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);