const Cart = require('../models/cartModel'); 

const User = require('../models/userModel');

const setUserLocals = async (req, res, next) => {
  try {
    res.locals.user = req.session.user || null;

    if (req.session.user) {
      // Check if user is blocked; do not destroy entire session to preserve admin login
      const userDoc = await User.findById(req.session.user).select('isBlocked name');
      if (!userDoc || userDoc.isBlocked) {
        // Remove only user context and locals
        delete req.session.user;
        res.locals.user = null;
        res.locals.userName = null;
        res.locals.cartItemCount = 0;
      } else {
        res.locals.userName = userDoc?.name || req.session.userName || null;
        const cart = await Cart.findOne({ userId: req.session.user });
        res.locals.cartItemCount = cart?.items?.length || 0;
      }
    }

    next();
  } catch (err) {
    console.error('Error in setUserLocals middleware:', err);
    next(err); 
  }
};

module.exports = setUserLocals;
