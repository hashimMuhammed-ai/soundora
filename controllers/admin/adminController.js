const User = require('../../models/userModel');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');



const pageError = async (req, res) => {
  res.render('admin-error');
}

const getLogin = (req, res) => {
  try {
    if(req.session.admin){
      return res.redirect('/admin/dashboard');
    }
    res.render('admin/login');
  }
  catch (error) {
    console.log(error)
  }
}

const postLogin = async (req, res) => {
  try {
    const {email, password} = req.body;

    const admin = await User.findOne({email, isAdmin: true})
    if(!admin){
      req.flash('error', 'Invalid Admin Credentials');
      return res.redirect('/admin/login')
    }

    const isMatch = bcrypt.compare(password, admin.password);
    if(!isMatch){
      req.flash('error','Invalid Password');
      return res.redirect('/admin/login');
    }
    req.session.admin = true;
    // req.session.adminId = admin._id;
    return res.redirect('/admin/dashboard');
  }
  catch (error) {
    console.log('Login Error',error);
    res.render('admin/login',{error: 'Something went wrong, Please try again later'})
  }
}

const getDashboard = (req, res) => {
  try {
    if(req.session.admin){

       res.render('admin/dashboard', {dashboardData:0,totalRevenue:200, totalCustomers: 12, topSellingProducts: [], topSellingCategories: [], topSellingBrands: []});
    }
   
  }
  catch (error) {
    console.log(error);
  }
}


const logout = async (req, res) => {
  try {
    req.session.destroy(err => {
      if(err){
        console.log('Error destroying session', err);
        return res.redirect('/pageError');
      }
      res.redirect('/admin/login');
    })
  } catch (error) {
      console.log('Unexpected error during logout', error);
      res.redirect('/pageError');
  }
}








module.exports = {pageError, getLogin, postLogin, getDashboard, logout};