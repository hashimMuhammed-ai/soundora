const User = require('../../models/userModel');
const mongoose = require('mongoose');
const Order = require('../../models/orderModel');
const bcrypt = require('bcrypt');
const moment = require('moment');



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

    const isMatch = await bcrypt.compare(password, admin.password);
    if(!isMatch){
      req.flash('error','Invalid Password');
      return res.redirect('/admin/login');
    }
    req.session.admin = true;
    // req.session.adminId = admin._id;
    return res.redirect('/admin/dashboard');
  }
  catch (error) {
    ('Login Error',error);
    res.render('admin/login',{error: 'Something went wrong, Please try again later'})
  }
}

const getDashboard = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login');
        }
        const orders = await Order.find({ status: { $nin: ["failed"] } })
            .populate('userId', 'name email phone')
            .populate('items.productId', 'productName productImages salePrice ')
            .sort({ createdAt: -1 })

        const timeFilter = req.query.timeFilter || 'weekly';

        const dashboardData = await getDashboardData(timeFilter);

        const topSellingProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $project: {
                    productName: "$productDetails.productName",
                    productImages: "$productDetails.productImages",
                    totalSold: 1
                }
            }
        ]);

        const topSellingCategories = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "categories",
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },
            { $unwind: "$categoryDetails" },
            {
                $group: {
                    _id: "$categoryDetails._id",
                    name: { $first: "$categoryDetails.name" },
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);

        const topSellingBrands = await Order.aggregate([
            { $unwind: "$items" },
            {
                $lookup: {
                    from: "products",
                    localField: "items.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $lookup: {
                    from: "brands",
                    localField: "productDetails.brand",
                    foreignField: "_id",
                    as: "brandDetails"
                }
            },
            { $unwind: "$brandDetails" },
            {
                $group: {
                    _id: "$brandDetails._id",
                    brandName: { $first: "$brandDetails.brandName" },
                    brandImage: { $first: "$brandDetails.brandImage" },
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]);


        return res.render('admin/dashboard', { dashboardData, orders, topSellingProducts, topSellingCategories, topSellingBrands });
    } catch (err) {
        console.log('Dashboard load error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};


const getDashboardDataAPI = async (req, res) => {
    try {
        const { timeFilter } = req.query;
        if (!timeFilter) {
            return res.status(400).json({ error: 'timeFilter parameter is required' });
        }

        const dashboardData = await getDashboardData(timeFilter);
        res.json(dashboardData);
    } catch (err) {
        console.log('Dashboard data API error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function getDashboardData(timeFilter) {

    const currentDate = new Date();
    const now = moment();

    let startDate, labels, format, aggregateBy;

    switch (timeFilter) {
        case 'weekly':
            startDate = moment().subtract(6, 'days').startOf('day').toDate();
            labels = Array.from({ length: 7 }, (_, i) =>
                moment().subtract(6 - i, 'days').format('ddd')
            );
            format = '%Y-%m-%d';
            aggregateBy = { day: '$createdAt' };
            break;
        case 'yearly':
            startDate = moment().subtract(5, 'years').startOf('year').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'years').format('YYYY')
            );
            format = '%Y';
            aggregateBy = { year: '$createdAt' };
            break;
        case 'monthly':
        default:
            startDate = moment().subtract(5, 'months').startOf('month').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'months').format('MMM')
            );
            format = '%Y-%m';
            aggregateBy = { month: '$createdAt' };
    }


    const totalRevenue = await Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);


    const totalCustomers = await User.countDocuments({ isAdmin: false });

    const totalOrders = await Order.countDocuments({
        status: { $nin: ['pending', 'failed'] }
    });

    const previousPeriodStart = moment(startDate).subtract(
        timeFilter === 'weekly' ? 7 :
            timeFilter === 'yearly' ? 6 : 6,
        timeFilter === 'weekly' ? 'days' :
            timeFilter === 'yearly' ? 'years' : 'months'
    ).toDate();

    const currentPeriodRevenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const previousPeriodRevenue = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: previousPeriodStart, $lt: startDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]);

    const revenueGrowth = calculateGrowthPercentage(
        currentPeriodRevenue[0]?.total || 0,
        previousPeriodRevenue[0]?.total || 0
    );

    const currentPeriodCustomers = await User.countDocuments({
        createdOn: { $gte: startDate, $lte: currentDate },
        isAdmin: false
    });

    const previousPeriodCustomers = await User.countDocuments({
        createdOn: { $gte: previousPeriodStart, $lt: startDate },
        isAdmin: false
    });

    const customerGrowth = calculateGrowthPercentage(
        currentPeriodCustomers,
        previousPeriodCustomers
    );

    // Get orders growth percentage
    const currentPeriodOrders = await Order.countDocuments({
        createdAt: { $gte: startDate, $lte: currentDate },
        status: { $nin: ['cancelled', 'failed', 'pending'] }
    });

    const previousPeriodOrders = await Order.countDocuments({
        createdAt: { $gte: previousPeriodStart, $lt: startDate },
        status: { $nin: ['cancelled', 'failed', 'pending'] }
    });

    const orderGrowth = calculateGrowthPercentage(
        currentPeriodOrders,
        previousPeriodOrders
    );

    // Get sales data over time
    const salesByPeriod = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] }
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdAt' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                total: { $sum: '$totalAmount' }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

  
    const customersByPeriod = await User.aggregate([
        {
            $match: {
                createdOn: { $gte: startDate, $lte: currentDate },
                isAdmin: false
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdOn' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdOn' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    // Get orders over time
    const ordersByPeriod = await Order.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: currentDate },
                status: { $nin: ['cancelled', 'failed', 'pending'] }
            }
        },
        {
            $group: {
                _id: timeFilter === 'weekly'
                    ? { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
                    : timeFilter === 'yearly'
                        ? { $dateToString: { format: '%Y', date: '$createdAt' } }
                        : { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { '_id': 1 } }
    ]);

    // Get category performance
    const categoryPerformance = await Order.aggregate([
        {
            $match: {
                status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] }
            }
        },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.productId',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: '$productDetails' },
        {
            $lookup: {
                from: 'categories',
                localField: 'productDetails.category',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        { $unwind: '$categoryDetails' },
        {
            $group: {
                _id: '$categoryDetails._id',
                categoryName: { $first: '$categoryDetails.name' },
                totalSales: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
            }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 }
    ]);

    // Get recent orders
    const recentOrders = await Order.aggregate([
        { $sort: { createdAt: -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                as: 'userDetails'
            }
        },
        { $unwind: '$userDetails' },
        {
            $project: {
                orderId: 1,
                customer: '$userDetails.name',
                product: { $arrayElemAt: ['$items.productId.productName', 0] },
                date: '$createdAt',
                amount: '$totalAmount',
                status: 1
            }
        }
    ]);

    // Map data to chart format with labels
    const salesData = mapDataToLabels(salesByPeriod, labels, timeFilter, 'total');
    const customersData = mapDataToLabels(customersByPeriod, labels, timeFilter, 'count');
    const ordersData = mapDataToLabels(ordersByPeriod, labels, timeFilter, 'count');

    // Prepare category data
    const categoryLabels = categoryPerformance.map(cat => cat.categoryName);
    const categoryData = categoryPerformance.map(cat => cat.totalSales);
  
    return {
        summary: {
            totalRevenue: totalRevenue[0]?.total || 0,
            totalCustomers,
            totalOrders,
            revenueGrowth,
            customerGrowth,
            orderGrowth
        },
        sales: {
            labels,
            data: salesData
        },
        customers: {
            labels,
            data: customersData
        },
        orders: {
            labels,
            data: ordersData
        },
        categories: {
            labels: categoryLabels,
            data: categoryData
        },
        recentOrders
    };
}


function calculateGrowthPercentage(current, previous) {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Number(((current - previous) / previous * 100).toFixed(1));
}


function mapDataToLabels(data, labels, timeFilter, valueField) {
    const result = [];
    const dataMap = new Map();

    data.forEach(item => {
        let key;
        if (timeFilter === 'weekly') {
            key = moment(item._id).format('ddd');
        } else if (timeFilter === 'yearly') {
            key = item._id;
        } else {
            key = moment(item._id, 'YYYY-MM').format('MMM');
        }
        dataMap.set(key, item[valueField]);
    });

    labels.forEach(label => {
        result.push(dataMap.get(label) || 0);
    });

    return result;
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








module.exports = {pageError, getLogin, postLogin, getDashboard, getDashboardDataAPI, logout};