const mongoose = require('mongoose');

const {Schema} = mongoose;

const userSchema = new Schema({
  name: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: false
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: false,
    unique: false,
    sparse: true,
    default: null
  },
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  createdOn: {
    type: Date,
    default: Date.now
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  profileImage: { 
    type: String 
  },
  cart: [{
    type: Schema.Types.ObjectId,
    ref: 'Cart'
  }],
  wallet: {
    type: Number,
    default: 0
  },
  wishlist: [{
    type: Schema.Types.ObjectId,
    ref: 'Wishlist'
  }],
  orderHistory: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  referalCode: {
    type: String,
  },
  redeemed: {
    type: Boolean
  },
  redeemedUsers: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  searchHistory: [{
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category'
    },
    brand: {
      type: String
    },
    searchOn: {
      type: Date,
      default: Date.now
    }
  }]
})

const User = mongoose.model('User', userSchema);

module.exports = User;