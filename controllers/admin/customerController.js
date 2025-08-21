const User = require('../../models/userModel');
// const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const HTTP_STATUS = require('../../constants/httpStatus');




const customerInfo = async (req, res)=> {
  try {
    const search = req.query.search || '';
    const page = req.query.page || 1;
    const limit = 4;

    const searchQuery = {
    isAdmin: false,
    $or: [
      {name: {$regex: search, $options: 'i'}},
      {email: {$regex: search, $options: 'i'}},
      {phone: {$regex: search, $options: 'i'}}
    ]
    }
    const totalUsers = await User.countDocuments(searchQuery);
    const users = await User.find(searchQuery)
      .sort({createdOn: -1})
      .skip((page - 1) * limit)
      .limit(limit);
    res.render('admin/customers', {search, data: users, currentPage: page, totalPages: Math.ceil(totalUsers/limit)})
  }
  catch (error) {
    console.log(error);
  }
}

const toggleBlock = async (req, res) => {
  try { 
    console.log('Received Toggle Request:', req.body);
    const { id, isBlocked } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({ success: false, message: "User not found" });
    }

    user.isBlocked = isBlocked;
    await user.save();

    return res.json({ success: true, message: "Updated Successfully" });
  } catch (error) {
    console.error(error);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ success: false, message: "Something went wrong" });
  }
}

module.exports = {customerInfo, toggleBlock};
