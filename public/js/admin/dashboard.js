let isInitialLoad = true;
let salesChart, customersChart, ordersChart, categoryChart;

document.addEventListener('DOMContentLoaded', function() {
    // Initialize charts and set initial filter visibility
    const filterSelect = document.getElementById('salesChartFilter');
    const dateRangePicker = document.getElementById('customRangePicker');
    dateRangePicker.style.display = filterSelect.value === 'custom-range' ? 'flex' : 'none';

    // Initialize charts with initial data
    initializeCharts();

    // Add event listener to filter dropdown
    filterSelect.addEventListener('change', function() {
        const timeFilter = this.value;
        dateRangePicker.style.display = timeFilter === 'custom-range' ? 'flex' : 'none';
        if (timeFilter !== 'custom-range') {
            updateDashboard(timeFilter);
        }
    });

    // Add event listener to apply button for custom range
    const applyButton = document.getElementById('applyFilter');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (applyButton && startDateInput && endDateInput) {
        applyButton.addEventListener('click', function() {
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;

            // Validate dates
            if (!startDate || !endDate) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Warning',
                    text: 'Please select both start date and end date for custom range.',
                    showConfirmButton: false,
                    timer: 1500
                });
                return;
            }

            // Check if end date is not before start date
            if (new Date(endDate) < new Date(startDate)) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Invalid Date Range',
                    text: 'End date cannot be earlier than start date.',
                    showConfirmButton: false,
                    timer: 1500
                });
                return;
            }

            updateDashboard('custom-range', startDate, endDate);
        });
    }
});

function updateDashboard(timeFilter, startDate = null, endDate = null) {
    // Skip update on initial load (handled by change event)
    if (isInitialLoad) {
        isInitialLoad = false;
        return;
    }

    console.log("Updating with timeFilter:", timeFilter, "startDate:", startDate, "endDate:", endDate);

    // Update URL parameters
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('timeFilter', timeFilter);
    if (startDate && endDate) {
        currentUrl.searchParams.set('startDate', startDate);
        currentUrl.searchParams.set('endDate', endDate);
    } else {
        currentUrl.searchParams.delete('startDate');
        currentUrl.searchParams.delete('endDate');
    }
    window.history.replaceState({}, '', currentUrl);

    // Show loading state
    const containers = document.querySelectorAll('.chart-container');
    containers.forEach(container => container.classList.add('loading'));

    // Fetch data via AJAX
    let fetchUrl = '/admin/dashboard-data?timeFilter=' + encodeURIComponent(timeFilter);
    if (startDate && endDate) {
        fetchUrl += '&startDate=' + encodeURIComponent(startDate) + '&endDate=' + encodeURIComponent(endDate);
    }

    fetch(fetchUrl)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            console.log("Fetched data:", data); // Debug the response
            updateCharts(data);
            containers.forEach(container => container.classList.remove('loading'));
        })
        .catch(error => {
            console.error('Error fetching dashboard data:', error);
            containers.forEach(container => container.classList.remove('loading'));
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Error updating dashboard. Please try again.',
                showConfirmButton: false,
                timer: 1500
            });
        });
}

function initializeCharts() {
    const dashboardData = window.dashboardData || {
        sales: { labels: [], data: [] },
        customers: { labels: [], data: [] },
        orders: { labels: [], data: [] },
        categories: { labels: [], data: [] },
        summary: {
            totalRevenue: 0,
            totalCustomers: 0,
            totalOrders: 0,
            revenueGrowth: 0,
            customerGrowth: 0,
            orderGrowth: 0
        }
    };

    // Initialize Sales Chart
    const salesCtx = document.getElementById('salesChart').getContext('2d');
    salesChart = new Chart(salesCtx, {
        type: 'line',
        data: {
            labels: dashboardData.sales.labels,
            datasets: [{
                label: 'Sales Revenue (₹)',
                data: dashboardData.sales.data,
                borderColor: 'green',
                backgroundColor: 'rgba(144, 238, 144, 0.5)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: value => '₹' + value.toLocaleString() }
                }
            },
            plugins: {
                tooltip: { callbacks: { label: context => 'Revenue: ₹' + context.parsed.y.toLocaleString() } }
            }
        }
    });

    // Initialize Customers Chart
    const customersCtx = document.getElementById('customersChart').getContext('2d');
    customersChart = new Chart(customersCtx, {
        type: 'bar',
        data: {
            labels: dashboardData.customers.labels,
            datasets: [{
                label: 'New Customers',
                data: dashboardData.customers.data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Initialize Orders Chart
    const ordersCtx = document.getElementById('ordersChart').getContext('2d');
    ordersChart = new Chart(ordersCtx, {
        type: 'bar',
        data: {
            labels: dashboardData.orders.labels,
            datasets: [{
                label: 'Orders',
                data: dashboardData.orders.data,
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgb(255, 99, 132)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });

    // Initialize Category Performance Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'pie',
        data: {
            labels: dashboardData.categories.labels,
            datasets: [{
                label: 'Category Sales (₹)',
                data: dashboardData.categories.data,
                backgroundColor: [
                    'rgba(33, 150, 243, 0.7)',
                    'rgba(255, 193, 7, 0.7)',
                    'rgba(76, 175, 80, 0.7)',
                    'rgba(244, 67, 54, 0.7)',
                    'rgba(156, 39, 176, 0.7)'
                ],
                borderColor: [
                    'rgb(33, 150, 243)',
                    'rgb(255, 193, 7)',
                    'rgb(76, 175, 80)',
                    'rgb(244, 67, 54)',
                    'rgb(156, 39, 176)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${context.label}: ₹${value.toLocaleString()} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });

    // Update summary cards with initial data
    updateSummaryCards(dashboardData.summary);
}

function updateCharts(data) {
    updateSalesChart(data.sales);
    updateCustomersChart(data.customers);
    updateOrdersChart(data.orders);
    updateCategoryChart(data.categories);
    updateSummaryCards(data.summary);
}

function updateSalesChart(salesData) {
    if (salesChart) {
        salesChart.data.labels = salesData.labels || [];
        salesChart.data.datasets[0].data = salesData.data || [];
        salesChart.update();
    }
}

function updateCustomersChart(customersData) {
    if (customersChart) {
        customersChart.data.labels = customersData.labels || [];
        customersChart.data.datasets[0].data = customersData.data || [];
        customersChart.update();
    }
}

function updateOrdersChart(ordersData) {
    if (ordersChart) {
        ordersChart.data.labels = ordersData.labels || [];
        ordersChart.data.datasets[0].data = ordersData.data || [];
        ordersChart.update();
    }
}

function updateCategoryChart(categoryData) {
    if (categoryChart) {
        categoryChart.data.labels = categoryData.labels || [];
        categoryChart.data.datasets[0].data = categoryData.data || [];
        categoryChart.update();
    }
}

function updateSummaryCards(summaryData) {
    document.querySelector('.summary-card:nth-child(1) .summary-info h3').textContent =
        '₹' + Math.round(summaryData.totalRevenue || 0).toLocaleString();
    const customerElement = document.querySelector('.summary-card:nth-child(2) .summary-info h3');
    if (customerElement) customerElement.textContent = (summaryData.totalCustomers || 0).toLocaleString();
    const orderElement = document.querySelector('.summary-card:nth-child(3) .summary-info h3');
    if (orderElement) orderElement.textContent = (summaryData.totalOrders || 0).toLocaleString();
}