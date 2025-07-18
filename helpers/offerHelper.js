const getDiscountPrice = (product) => {
  if (!product) {
    console.error('getDiscountPrice: Received null/undefined product');
    return null;
  }

  const productOffer = product.productOffer || 0;
  const categoryOffer = product.category?.categoryOffer || 0;
  const maxOffer = Math.max(productOffer, categoryOffer);
  const discountedPrice = Math.round(product.salePrice * (1 - maxOffer / 100));

  return {
    ...product.toObject(),
    finalPrice: discountedPrice,
    appliedOffer: maxOffer,
    regularPrice: product.regularPrice,
    isAvailable: product.isListed && product.category?.isListed,
  };
};

module.exports = {getDiscountPrice}

