const getDiscountPrice = (product) => {
  if (!product) {
    console.error('getDiscountPrice: Received null/undefined product');
    return null;
  }

  const productOffer = product.productOffer || 0;
  const categoryOffer = product.category?.categoryOffer || 0;
  const maxOffer = Math.max(productOffer, categoryOffer);
  const discountedPrice = Math.round(product.salePrice - product.salePrice * (maxOffer / 100));

  return {
    ...product.toObject(),
    finalPrice: discountedPrice,
    appliedOffer: maxOffer,
    regularPrice: product.regularPrice,
    isAvailable: product.isListed && product.category?.isListed,
  };
};


const getDiscountPriceCart = (product) => {
  // if (!product) return null;
    
  //   if (!product.category || !product.category.isListed) {
  //       product.isAvailable = false;
  //       return product;
  //   }
  if (!product) {
    console.error("getDiscountPriceCart: Received null/undefined product");
    return null; 
  }
  let productOffer = product.productOffer || 0;
  let categoryOffer = product.category?.categoryOffer || 0;

  let maxOffer = Math.max(productOffer, categoryOffer);
  let discountedPrice = product.salePrice - (product.salePrice * maxOffer) / 100;



product.finalPrice = Math.round(discountedPrice);
product.appliedOffer = maxOffer;
product.regularPrice = product.regularPrice;

  return product;
}

module.exports = {getDiscountPrice, getDiscountPriceCart};

