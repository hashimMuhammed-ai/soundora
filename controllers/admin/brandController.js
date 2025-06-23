const Brand = require('../../models/brandModel')
const Product = require('../../models/productModel');



const getBrandPage = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 5;
        const skip = (page - 1) * limit
        const brandData = await Brand.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit)
        const totalBrands = await Brand.countDocuments()
        const totalPages = Math.ceil(totalBrands / limit)

        res.render('admin/brands', {
            data: brandData,
            currentPage: page,
            totalPages: totalPages,
            totalBrands: totalBrands
        })
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}
const addBrand = async (req, res) => {
    try {
        const brand = req.body.name.trim();

        const findBrand = await Brand.findOne({ brandName: { $regex: `^${brand}$`, $options: "i" } });
        if (findBrand) {
            return res.status(400).json({ success: false, message: "Brand already exists" });
        }
        if (!req.file ) {
            return res.status(400).json({ success: false, message: "Please upload a brand image" });
        }

        const image = req.file.filename;

        const newBrand = new Brand({ brandName: brand, brandImage: image });
        await newBrand.save();

        res.json({
            success: true,
            message: "Brand added successfully",
            brand: {
                _id: newBrand._id,
                brandName: newBrand.brandName,
                brandImage: newBrand.brandImage,
                isBlocked: false
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
};


const blockBrand = async (req, res) => {
    try {
        const id = req.query.id
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: true } })
        return res.status(200).json({ success: true, message: "Brand blocked successfully" });
    } catch (error) {
        console.log("error in block brand", error)
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
}

const unblockBrand = async (req, res) => {
    try {
        const id = req.query.id
        await Brand.updateOne({ _id: id }, { $set: { isBlocked: false } })
        return res.status(200).json({ success: true, message: "Brand unblocked successfully" });
    } catch (error) {
        console.log("error in unblock brand", error)
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
}

const deleteBrand = async (req, res) => {
    try {
        const { id } = req.query
        if (!id) {
            return res.status(404).json({ success: false, message: "Brand not found" });
        }
        await Brand.deleteOne({ _id: id })
        return res.status(200).json({ success: true, message: "Brand deleted successfully" });
    } catch (error) {
        console.log("error in delete brand", error)
        return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
    }
}

module.exports = {
    getBrandPage,
    addBrand,
    blockBrand,
    unblockBrand,
    deleteBrand
}