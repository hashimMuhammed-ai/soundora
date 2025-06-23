const Category = require('../../models/categoryModel');



const categoryInfo = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 4;
    const skip = (page - 1) * limit;

    const categoryData = await Category.find({})
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)

      const totalCategories = await Category.countDocuments();
      const totalPages = Math.ceil(totalCategories / limit);
      res.render('admin/category',{
        cat: categoryData,
        currentPage: page,
        totalPages,
        totalCategories
      });
  } catch (error) {
      console.error(error);
      res.redirect('/pageError');
  }
}

const addCategory = async (req, res) => {
  try {
    const {name, description, categoryOffer} = req.body;
    const existingCategory = await Category.findOne({name});
    if(existingCategory){
      return res.status(400).json({error: 'Category already exists'});
    }
    const newCategory = new Category({
      name,
      description,
      categoryOffer
    })
    await newCategory.save();
    return res.json({success: true, message: 'Category Added Successfully'});
  } catch (error) {
    return res.status(500).json({error: 'Internal Server Error'});
  }
}


const toggleCategory = async (req, res) => {
   try {
      const { id } = req.params
      const category = await Category.findById(id)
      if (!category) {
         return res.status(404).json({ success: false, message: "Category not found" })
      }
      category.isListed = !category.isListed
      await category.save()
      return res.status(200).json({ success: true, message: "Category updated successfully" })
   } catch (error) {
      console.log('error toggling category', error);
      return res.status(500).json({ message: "Internal server error" })
   }
}


const getEditCategory = async (req, res) => {
   try {
      const id = req.query.id

      const category = await Category.findById({ _id: id });   

      res.render("admin/editCategory", { category })
   } catch (error) {
      res.redirect('/pageError')
   }
}


const editCategory = async (req, res) => {
   try {
       const { categoryName, categoryDescription, categoryOffer } = req.body;
       const categoryId = req.params.id;

       if (!categoryName || categoryName.trim().length < 3) {
           return res.status(400).json({ 
               success: false, 
               message: 'Category name must be at least 3 characters long' 
           });
       }

       if (!categoryDescription || categoryDescription.trim().length < 10) {
           return res.status(400).json({ 
               success: false, 
               message: 'Description must be at least 10 characters long' 
           });
       }

       const offer = parseFloat(categoryOffer);
       if (isNaN(offer) || offer < 0 || offer > 100) {
           return res.status(400).json({ 
               success: false, 
               message: 'Category offer must be a number between 0 and 100' 
           });
       }

       const existingCategory = await Category.findOne({ 
           name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
           _id: { $ne: categoryId } 
       });

       if (existingCategory) {
           return res.status(400).json({ 
               success: false, 
               message: 'A category with this name already exists' 
           });
       }

       const updatedCategory = await Category.findByIdAndUpdate(
           categoryId, 
           {
               name: categoryName.trim(),
               description: categoryDescription.trim(),
               categoryOffer: offer
           }, 
           { new: true, runValidators: true }
       );

       if (!updatedCategory) {
           return res.status(404).json({ 
               success: false, 
               message: 'Category not found' 
           });
       }

       res.status(200).json({ 
           success: true, 
           message: 'Category updated successfully',
           category: updatedCategory 
       });

   } catch (error) {
       console.error('Edit Category Error:', error);
       res.status(500).json({ 
           success: false, 
           message: 'An error occurred while updating the category',
           error: error.message 
       });
   }
};






module.exports = {categoryInfo, addCategory, toggleCategory, getEditCategory, editCategory};