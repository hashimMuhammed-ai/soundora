const Cart = require('../models/cartModel'); 

const setUserLocals = async (req, res, next) => {
  try {
    res.locals.user = req.session.user || null;

    if (req.session.user) {
      res.locals.userName = req.session.userName || null;
      const cart = await Cart.findOne({ userId: req.session.user });
      res.locals.cartItemCount = cart?.items?.length || 0;
    }

    next();
  } catch (err) {
    console.error('Error in setUserLocals middleware:', err);
    next(err); 
  }
};

module.exports = setUserLocals;
