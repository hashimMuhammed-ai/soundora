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
            .populate('items.productId', 'productName productImages salePrice')
            .sort({ createdAt: -1 })
            .lean();

        let timeFilter = req.query.timeFilter || 'weekly';
        let startDate = req.query.startDate ? new Date(req.query.startDate) : null; // Use raw Date for consistency
        let endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        // Fallback to weekly if custom-range is selected without dates
        if (timeFilter === 'custom-range' && (!startDate || !endDate)) {
            timeFilter = 'weekly';
            startDate = moment().subtract(6, 'days').toDate();
            endDate = null;
        } else if (timeFilter === 'custom-range' && startDate > endDate) {
            [startDate, endDate] = [endDate, startDate];
        }

        const dashboardData = await getDashboardData(timeFilter, startDate, endDate);

        const topSellingProducts = await Order.aggregate([
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId",
                    totalSold: { $sum: { $ifNull: ["$items.quantity", 0] } }
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
        ]).catch(err => {
            console.error('Top Selling Products aggregation error:', err);
            return [];
        });

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
                    totalSold: { $sum: { $ifNull: ["$items.quantity", 0] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]).catch(err => {
            console.error('Top Selling Categories aggregation error:', err);
            return [];
        });

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
                    totalSold: { $sum: { $ifNull: ["$items.quantity", 0] } }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 5 }
        ]).catch(err => {
            console.error('Top Selling Brands aggregation error:', err);
            return [];
        });

        return res.render('admin/dashboard', { dashboardData, orders, topSellingProducts, topSellingCategories, topSellingBrands });
    } catch (err) {
        console.log('Dashboard load error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const getDashboardDataAPI = async (req, res) => {
    try {
        const { timeFilter } = req.query;
        let startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        let endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        if (!timeFilter) {
            return res.status(400).json({ error: 'timeFilter parameter is required' });
        }

        // Fallback to weekly if custom-range is selected without dates
        if (timeFilter === 'custom-range' && (!startDate || !endDate)) {
            timeFilter = 'weekly';
            startDate = moment().subtract(6, 'days').toDate();
            endDate = null;
        } else if (timeFilter === 'custom-range' && startDate > endDate) {
            [startDate, endDate] = [endDate, startDate];
        }

        const dashboardData = await getDashboardData(timeFilter, startDate, endDate);
        res.json(dashboardData);
    } catch (err) {
        console.log('Dashboard data API error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

async function getDashboardData(timeFilter, startDate, endDate) {
    const currentDate = moment().toDate(); // 09:38 AM IST, August 12, 2025
    const now = moment();

    let customStartDate, customEndDate, labels, format, aggregateBy;

    switch (timeFilter) {
        case 'weekly':
            customStartDate = moment().subtract(6, 'days').startOf('day').toDate();
            labels = Array.from({ length: 7 }, (_, i) =>
                moment().subtract(6 - i, 'days').format('DD-MM-YYYY')
            );
            format = '%Y-%m-%d';
            aggregateBy = { day: '$createdAt' };
            break;
        case 'yearly':
            customStartDate = moment().subtract(5, 'years').startOf('year').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'years').format('YYYY')
            );
            format = '%Y';
            aggregateBy = { year: '$createdAt' };
            break;
        case 'monthly':
            customStartDate = moment().subtract(5, 'months').startOf('month').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'months').format('MMM')
            );
            format = '%Y-%m';
            aggregateBy = { month: '$createdAt' };
            break;
        case 'daily':
            customStartDate = moment().startOf('day').toDate(); // Only today, August 12, 2025
            labels = [moment().format('DD-MM-YYYY')]; // Single day label
            format = '%Y-%m-%d';
            aggregateBy = { day: '$createdAt' };
            break;
        case 'all-time':
            customStartDate = new Date('1970-01-01');
            customEndDate = currentDate;
            labels = ['All Time'];
            format = null; // No grouping needed
            aggregateBy = null;
            break;
        case 'custom-range':
            if (!startDate || !endDate) {
                throw new Error('startDate and endDate are required for custom range');
            }
            customStartDate = moment(startDate).startOf('day').toDate(); // Ensure start of day
            customEndDate = moment(endDate).endOf('day').toDate(); // Ensure end of day
            if (moment(customEndDate).isBefore(customStartDate)) {
                [customStartDate, customEndDate] = [customEndDate, customStartDate];
            }
            const daysDiff = moment(customEndDate).diff(moment(customStartDate), 'days') + 1;
            labels = Array.from({ length: daysDiff }, (_, i) =>
                moment(customStartDate).add(i, 'days').format('DD-MM-YYYY')
            );
            format = '%Y-%m-%d';
            aggregateBy = { day: '$createdAt' };
            break;
        default:
            customStartDate = moment().subtract(5, 'months').startOf('month').toDate();
            labels = Array.from({ length: 6 }, (_, i) =>
                moment().subtract(5 - i, 'months').format('MMM')
            );
            format = '%Y-%m';
            aggregateBy = { month: '$createdAt' };
    }

    const totalRevenue = await Order.aggregate([
        { $match: { status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
    ]).catch(err => {
        console.error('Total Revenue aggregation error:', err);
        return [{ total: 0 }];
    });

    const totalCustomers = await User.countDocuments({ isAdmin: false }).catch(err => {
        console.error('Total Customers count error:', err);
        return 0;
    });

    const totalOrders = await Order.countDocuments({
        status: { $nin: ['pending', 'failed'] }
    }).catch(err => {
        console.error('Total Orders count error:', err);
        return 0;
    });

    const previousPeriodStart = moment(customStartDate).subtract(
        timeFilter === 'weekly' || timeFilter === 'daily' ? 7 :
            timeFilter === 'yearly' ? 6 : 6,
        timeFilter === 'weekly' || timeFilter === 'daily' ? 'days' :
            timeFilter === 'yearly' ? 'years' : 'months'
    ).toDate();

    const currentPeriodMatch = {
        createdAt: { $gte: customStartDate, $lte: customEndDate || currentDate },
        status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded', 'pending'] }
    };
    const previousPeriodMatch = {
        createdAt: { $gte: previousPeriodStart, $lt: customStartDate },
        status: { $nin: ['cancelled', 'failed', 'Return approved', 'refunded'] }
    };

    const currentPeriodRevenue = await Order.aggregate([
        { $match: currentPeriodMatch },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
    ]).catch(err => {
        console.error('Current Period Revenue aggregation error:', err);
        return [{ total: 0 }];
    });

    const previousPeriodRevenue = await Order.aggregate([
        { $match: previousPeriodMatch },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
    ]).catch(err => {
        console.error('Previous Period Revenue aggregation error:', err);
        return [{ total: 0 }];
    });

    const revenueGrowth = calculateGrowthPercentage(
        currentPeriodRevenue[0]?.total || 0,
        previousPeriodRevenue[0]?.total || 0
    );

    const currentPeriodCustomers = await User.countDocuments({
        createdOn: { $gte: customStartDate, $lte: customEndDate || currentDate },
        isAdmin: false
    }).catch(err => {
        console.error('Current Period Customers count error:', err);
        return 0;
    });

    const previousPeriodCustomers = await User.countDocuments({
        createdOn: { $gte: previousPeriodStart, $lt: customStartDate },
        isAdmin: false
    }).catch(err => {
        console.error('Previous Period Customers count error:', err);
        return 0;
    });

    const customerGrowth = calculateGrowthPercentage(
        currentPeriodCustomers,
        previousPeriodCustomers
    );

    const currentPeriodOrders = await Order.countDocuments({
        ...currentPeriodMatch,
        status: { $nin: ['pending'] }
    }).catch(err => {
        console.error('Current Period Orders count error:', err);
        return 0;
    });

    const previousPeriodOrders = await Order.countDocuments({
        ...previousPeriodMatch,
        status: { $nin: ['pending'] }
    }).catch(err => {
        console.error('Previous Period Orders count error:', err);
        return 0;
    });

    const orderGrowth = calculateGrowthPercentage(
        currentPeriodOrders,
        previousPeriodOrders
    );

    let salesByPeriod, customersByPeriod, ordersByPeriod;

    if (timeFilter === 'all-time') {
        salesByPeriod = await Order.aggregate([
            { $match: currentPeriodMatch },
            { $group: { _id: null, total: { $sum: { $ifNull: ['$totalAmount', 0] } } } }
        ]).catch(err => {
            console.error('All-Time Sales aggregation error:', err);
            return [];
        }).then(result => result.length ? [{ _id: 'All Time', total: result[0].total }] : []);
        customersByPeriod = await User.aggregate([
            { $match: currentPeriodMatch },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]).catch(err => {
            console.error('All-Time Customers aggregation error:', err);
            return [];
        }).then(result => result.length ? [{ _id: 'All Time', count: result[0].count }] : []);
        ordersByPeriod = await Order.aggregate([
            { $match: currentPeriodMatch },
            { $group: { _id: null, count: { $sum: 1 } } }
        ]).catch(err => {
            console.error('All-Time Orders aggregation error:', err);
            return [];
        }).then(result => result.length ? [{ _id: 'All Time', count: result[0].count }] : []);
    } else {
        salesByPeriod = await Order.aggregate([
            { $match: currentPeriodMatch },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: '$createdAt', timezone: 'Asia/Kolkata' } },
                    total: { $sum: { $ifNull: ['$totalAmount', 0] } }
                }
            },
            { $sort: { '_id': 1 } }
        ]).catch(err => {
            console.error('Sales By Period aggregation error:', err);
            return [];
        });
        customersByPeriod = await User.aggregate([
            {
                $match: {
                    createdOn: { $gte: customStartDate, $lte: customEndDate || currentDate },
                    isAdmin: false
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: '$createdOn', timezone: 'Asia/Kolkata' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]).catch(err => {
            console.error('Customers By Period aggregation error:', err);
            return [];
        });
        ordersByPeriod = await Order.aggregate([
            { $match: { ...currentPeriodMatch, status: { $nin: ['pending'] } } },
            {
                $group: {
                    _id: { $dateToString: { format: format, date: '$createdAt', timezone: 'Asia/Kolkata' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id': 1 } }
        ]).catch(err => {
            console.error('Orders By Period aggregation error:', err);
            return [];
        });
    }

    const categoryPerformance = await Order.aggregate([
        { $match: currentPeriodMatch },
        { $unwind: '$items' },
        {
            $lookup: {
                from: 'products',
                localField: 'items.productId',
                foreignField: '_id',
                as: 'productDetails'
            }
        },
        { $unwind: { path: '$productDetails', preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: 'categories',
                localField: 'productDetails.category',
                foreignField: '_id',
                as: 'categoryDetails'
            }
        },
        { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
        {
            $group: {
                _id: '$categoryDetails._id',
                categoryName: { $first: { $ifNull: ['$categoryDetails.name', 'Unknown'] } },
                totalSales: { $sum: { $ifNull: [{ $multiply: ['$items.price', '$items.quantity'] }, 0] } }
            }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 }
    ]).catch(err => {
        console.error('Category Performance aggregation error:', err);
        return [];
    });

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
        { $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                orderId: 1,
                customer: { $ifNull: ['$userDetails.name', 'Unknown'] },
                product: { $arrayElemAt: ['$items.productId.productName', 0] },
                date: '$createdAt',
                amount: { $ifNull: ['$totalAmount', 0] },
                status: 1
            }
        }
    ]).catch(err => {
        console.error('Recent Orders aggregation error:', err);
        return [];
    });

    const salesData = mapDataToLabels(salesByPeriod, labels, timeFilter, 'total');
    const customersData = mapDataToLabels(customersByPeriod, labels, timeFilter, 'count');
    const ordersData = mapDataToLabels(ordersByPeriod, labels, timeFilter, 'count');

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
    const growth = ((current - previous) / Math.abs(previous)) * 100;
    return Number(growth.toFixed(1));
}

function mapDataToLabels(data, labels, timeFilter, valueField) {
    const result = new Array(labels.length).fill(0);
    const dataMap = new Map();

    data.forEach(item => {
        let key;
        if (timeFilter === 'all-time') {
            key = 'All Time';
        } else if (timeFilter === 'weekly' || timeFilter === 'daily' || timeFilter === 'custom-range') {
            key = moment(item._id, 'YYYY-MM-DD').format('DD-MM-YYYY'); // Ensure consistent format
        } else if (timeFilter === 'yearly') {
            key = item._id;
        } else {
            key = moment(item._id, 'YYYY-MM').format('MMM');
        }
        dataMap.set(key, item[valueField] || 0);
    });

    labels.forEach((label, index) => {
        result[index] = dataMap.get(label) || 0;
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