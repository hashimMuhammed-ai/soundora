const {body} = require('express-validator');

const validateCoupon = [
  body('couponCode').notEmpty().withMessage('Coupon code is required'),
  body('couponType').notEmpty().withMessage('Coupon type is required'),
  body('discount').notEmpty().withMessage('Discount is required'),
  body('minPurchase').notEmpty().withMessage('Minimum purchase is required'),
  body('maxDiscount').notEmpty().withMessage('Maximum discount is required'),
  body('expiryDate').notEmpty().withMessage('Expiry date is required'),
  body('usageLimit').notEmpty().withMessage('Usage limit is required')
];

module.exports = validateCoupon;