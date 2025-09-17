const User = require('../models/userModel');

const adminAuth = (req, res, next) => {
  if(req.session.admin){
    next();
  }
  else {
    res.redirect('/admin/login');
  }
}

const adminLoginAuth = (req, res, next) => {
  if(!req.session.admin){
    next()
  }else {
    res.redirect('/admin/dashboard')
  }
}

const userAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user).select('isBlocked');

    if (!user || user.isBlocked) {
      // Destroy session so the block takes effect immediately
      return req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return res.redirect('/login');
      });
    }

    return next();
  } catch (err) {
    console.error('userAuth error:', err);
    return res.redirect('/login');
  }
}


const userLoginAuth = async (req, res, next) => {
  try {
    if (!req.session.user) {
      return next();
    }

    // If a session exists, verify it's not a blocked account
    const user = await User.findById(req.session.user).select('isBlocked');

    if (!user || user.isBlocked) {
      // Clear any stale session for blocked/non-existent users so they can see login page
      return req.session.destroy(() => {
        res.clearCookie('connect.sid');
        return next();
      });
    }

    // Active logged-in users should not access login/signup pages
    return res.redirect('/');
  } catch (err) {
    console.error('userLoginAuth error:', err);
    return next();
  }
}

module.exports = {adminAuth, userAuth, adminLoginAuth, userLoginAuth};