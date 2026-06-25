import React, { useEffect, useState } from 'react';
import { usePharmacyStore, calculateDaysDifference, formatDateDisplay, getExpiryStatus } from '../store/usePharmacyStore';

export default function DashboardTab() {
    const {
        medicines,
        dashboardStats,
        isLoadingStats,
        setAddModalOpen,
        setActiveTab,
        setInventorySubTab,
        setInventoryCategoryFilter,
        simulatedDate,
        billStats,
        fetchBillStats
    } = usePharmacyStore();

    useEffect(() => {
        fetchBillStats();
    }, [fetchBillStats]);

    // ── Seasonal Forecaster Logic ─────────────────────────────────────────────
    const getForecastData = () => {
        if (!simulatedDate) return null;
        const dateObj = new Date(simulatedDate);
        const month = dateObj.getMonth(); // 0-11
        
        let currentSeason = '';
        let upcomingSeason = '';
        let recommendedCategories = [];
        let primaryCategory = '';
        let expectedIncrease = '';
        let seasonalMonths = '';
        let targetQty = 150;
        let seasonIcon = 'fa-sun';
        let seasonColor = '#06b6d4';
        
        if (month >= 5 && month <= 8) { // June - Sept
            currentSeason = 'Monsoon';
            upcomingSeason = 'Winter';
            recommendedCategories = ['Syrup', 'Injection'];
            primaryCategory = 'Syrup';
            expectedIncrease = '45%';
            seasonalMonths = 'Oct - Jan';
            targetQty = 180;
            seasonIcon = 'fa-snowflake';
            seasonColor = '#8b5cf6'; // purple
        } else if (month >= 9 || month === 0) { // Oct - Jan
            currentSeason = 'Winter';
            upcomingSeason = 'Summer/Spring';
            recommendedCategories = ['Ointment', 'Other'];
            primaryCategory = 'Ointment';
            expectedIncrease = '30%';
            seasonalMonths = 'Feb - May';
            targetQty = 120;
            seasonIcon = 'fa-leaf';
            seasonColor = '#f59e0b'; // amber
        } else { // Feb - May
            currentSeason = 'Summer/Spring';
            upcomingSeason = 'Monsoon';
            recommendedCategories = ['Vaccine', 'Tablet'];
            primaryCategory = 'Vaccine';
            expectedIncrease = '50%';
            seasonalMonths = 'Jun - Sep';
            targetQty = 100;
            seasonIcon = 'fa-cloud-showers-heavy';
            seasonColor = '#06b6d4'; // cyan
        }
        
        const primaryMeds = medicines.filter(m => m.status !== 'Inactive' && m.category === primaryCategory);
        const primaryStock = primaryMeds.reduce((sum, m) => sum + m.quantity, 0);
        const restockNeeded = Math.max(0, targetQty - primaryStock);
        
        return {
            currentSeason,
            upcomingSeason,
            recommendedCategories,
            primaryCategory,
            expectedIncrease,
            seasonalMonths,
            targetQty,
            seasonIcon,
            seasonColor,
            primaryStock,
            restockNeeded
        };
    };

    const getForecastChartData = (upcomingSeason) => {
        if (upcomingSeason === 'Winter') {
            return {
                labels: ['Aug', 'Sep', 'Oct (Soon)', 'Nov (Peak)'],
                lastYear: [85, 90, 110, 140],
                expected: [90, 95, 130, 210]
            };
        } else if (upcomingSeason === 'Summer/Spring') {
            return {
                labels: ['Dec', 'Jan', 'Feb (Soon)', 'Mar (Peak)'],
                lastYear: [60, 55, 75, 95],
                expected: [65, 58, 90, 140]
            };
        } else {
            return {
                labels: ['Apr', 'May', 'Jun (Soon)', 'Jul (Peak)'],
                lastYear: [70, 75, 120, 150],
                expected: [72, 80, 150, 230]
            };
        }
    };

    const forecast = getForecastData();
    const forecastChart = forecast ? getForecastChartData(forecast.upcomingSeason) : null;

    let lastYearPath = '';
    let expectedPath = '';
    let expectedAreaPath = '';
    const points = [];

    if (forecast && forecastChart) {
        const cWidth = 330;
        const cHeight = 110;
        const pLeft = 30;
        const pRight = 10;
        const pTop = 15;
        const pBot = 20;
        const gWidth = cWidth - pLeft - pRight;
        const gHeight = cHeight - pTop - pBot;
        const maxVal = 250;

        for (let i = 0; i < 4; i++) {
            const x = pLeft + i * (gWidth / 3);
            const yLY = pTop + gHeight - (forecastChart.lastYear[i] / maxVal) * gHeight;
            const yEx = pTop + gHeight - (forecastChart.expected[i] / maxVal) * gHeight;
            points.push({ x, yLY, yEx, valLY: forecastChart.lastYear[i], valEx: forecastChart.expected[i], label: forecastChart.labels[i] });
        }

        lastYearPath = `M ${points[0].x} ${points[0].yLY} L ${points[1].x} ${points[1].yLY} L ${points[2].x} ${points[2].yLY} L ${points[3].x} ${points[3].yLY}`;
        expectedPath = `M ${points[0].x} ${points[0].yEx} L ${points[1].x} ${points[1].yEx} L ${points[2].x} ${points[2].yEx} L ${points[3].x} ${points[3].yEx}`;
        expectedAreaPath = `M ${points[0].x} ${pTop + gHeight} L ${points[0].x} ${points[0].yEx} L ${points[1].x} ${points[1].yEx} L ${points[2].x} ${points[2].yEx} L ${points[3].x} ${points[3].yEx} L ${points[3].x} ${pTop + gHeight} Z`;
    }

    const handleForecastAction = () => {
        if (!forecast) return;
        setInventorySubTab('all');
        setInventoryCategoryFilter(forecast.primaryCategory);
        setActiveTab('inventory');
    };

    // Use API stats if available, else derive from local medicines
    const stats = dashboardStats?.stats;
    const totalCount       = stats?.totalMedicines  ?? medicines.filter(m => m.status !== 'Inactive').length;
    const activeSafeCount  = stats?.activeMedicines  ?? medicines.filter(m => m.status === 'Active' && calculateDaysDifference(simulatedDate, m.expiryDate) > 20 && m.quantity > 0).length;
    const expiringSoonCount= stats?.expiring20Days  ?? medicines.filter(m => m.status === 'Active' && m.quantity > 0 && calculateDaysDifference(simulatedDate, m.expiryDate) >= 0 && calculateDaysDifference(simulatedDate, m.expiryDate) <= 20).length;
    const expiredCount = stats?.expiredCount ?? 
        medicines.filter(m => m.status !== 'Inactive' && calculateDaysDifference(simulatedDate, m.expiryDate) < 0).length;
    const outOfStockCount = stats?.outOfStock ?? 
        medicines.filter(m => m.status !== 'Inactive' && (m.status === 'Out of Stock' || m.quantity === 0) && calculateDaysDifference(simulatedDate, m.expiryDate) >= 0).length;
    const inactiveCount = stats?.inactiveCount ?? medicines.filter(m => m.status === 'Inactive').length;

    // Expiring soon list from API or local compute
    const expiringSoonItems = dashboardStats?.expiringSoon
        ? dashboardStats.expiringSoon.map(m => ({ medicine: m, daysLeft: m.daysUntilExpiry ?? 0 }))
        : medicines
            .filter(m => {
                const d = calculateDaysDifference(simulatedDate, m.expiryDate);
                return m.status === 'Active' && m.quantity > 0 && d >= 0 && d <= 20;
            })
            .map(m => ({ medicine: m, daysLeft: calculateDaysDifference(simulatedDate, m.expiryDate) }))
            .sort((a, b) => a.daysLeft - b.daysLeft);

    const handleStatCardClick = (subTab) => {
        setInventorySubTab(subTab);
        setActiveTab('inventory');
    };

    const StatValue = ({ val }) => isLoadingStats
        ? <span style={{ display:'inline-block', width:32, height:20, background:'var(--bg-input)', borderRadius:4, animation:'pulse 1.5s infinite' }}></span>
        : <h3 className="stat-value">{val}</h3>;

    // Calculate category distribution
    const categoryCounts = medicines.reduce((acc, curr) => {
        if (curr.status !== 'Inactive') {
            const cat = curr.category || 'Other';
            acc[cat] = (acc[cat] || 0) + 1;
        }
        return acc;
    }, {});
    const totalActiveMeds = Object.values(categoryCounts).reduce((a, b) => a + b, 0) || 1;

    const categoriesList = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Vaccine', 'Ointment', 'Other'].map(cat => ({
        name: cat,
        count: categoryCounts[cat] || 0,
        percentage: Math.round(((categoryCounts[cat] || 0) / totalActiveMeds) * 100)
    }));

    // Monthly Breakdown Data dynamically generated based on simulatedDate
    const rawBreakdown = billStats?.monthlyBreakdown || [];
    const getDynamicMonthlyBreakdown = () => {
        const breakdown = [];
        const monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        
        const baseDate = simulatedDate ? new Date(simulatedDate) : new Date();
        
        // Generate last 6 months sliding window ending with simulatedDate
        for (let i = 5; i >= 0; i--) {
            const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
            const year = d.getFullYear();
            const monthNum = d.getMonth() + 1; // 1-indexed (1-12)
            const label = `${monthNames[d.getMonth()]} ${year}`;
            
            const matchedDbMonth = rawBreakdown.find(entry => 
                entry.year === year && entry.month === monthNum
            );
            
            breakdown.push({
                label,
                revenue: matchedDbMonth ? matchedDbMonth.revenue : 0,
                profit: matchedDbMonth ? matchedDbMonth.profit : 0,
                count: matchedDbMonth ? matchedDbMonth.count : 0
            });
        }
        return breakdown;
    };

    const [chartMetric, setChartMetric] = useState('revenue'); // 'revenue' or 'profit'

    const monthlyBreakdown = getDynamicMonthlyBreakdown();
    const currentMonthData = monthlyBreakdown[monthlyBreakdown.length - 1];
    const previousMonthData = monthlyBreakdown[monthlyBreakdown.length - 2];
    const currentMonthVal = currentMonthData ? (chartMetric === 'revenue' ? currentMonthData.revenue : currentMonthData.profit) : 0;
    const prevMonthVal = previousMonthData ? (chartMetric === 'revenue' ? previousMonthData.revenue : previousMonthData.profit) : 0;
    const percentageChange = prevMonthVal > 0 ? ((currentMonthVal - prevMonthVal) / prevMonthVal) * 100 : 0;

    const maxVal = Math.max(...monthlyBreakdown.map(d => chartMetric === 'revenue' ? d.revenue : d.profit), 1);
    
    // SVG Bar Chart Dimensions
    const chartWidth = 500;
    const chartHeight = 280;
    const paddingLeft = 50;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const graphWidth = chartWidth - paddingLeft - paddingRight;
    const graphHeight = chartHeight - paddingTop - paddingBottom;
    const barWidth = 24;
    const numBars = monthlyBreakdown.length;
    const barGap = numBars > 1 ? (graphWidth - (barWidth * numBars)) / (numBars - 1) : 0;

    const lifetimeRevenue = billStats?.lifetimeRevenue || 0;
    const lifetimeBills = billStats?.lifetimeBills || 0;
    const currentMonthRevenue = billStats?.currentMonthRevenue || 0;
    
    const lifetimeProfit = billStats?.lifetimeProfit || 0;
    const currentMonthProfit = billStats?.currentMonthProfit || 0;
    const topSelling = billStats?.topSelling || [];
    const topProfitable = billStats?.topProfitable || [];
    const avgProfitMargin = lifetimeRevenue > 0 ? (lifetimeProfit / lifetimeRevenue) * 100 : 0;

    // Calculate line coordinates overlay on the bar chart
    const trendLinePoints = monthlyBreakdown.map((item, i) => {
        const x = paddingLeft + i * (barWidth + barGap) + barWidth / 2;
        const val = chartMetric === 'revenue' ? item.revenue : item.profit;
        const barHeight = (val / maxVal) * graphHeight;
        const y = paddingTop + graphHeight - barHeight;
        return { x, y };
    });

    let splinePath = '';
    let splineAreaPath = '';
    if (trendLinePoints.length > 0) {
        splinePath = `M ${trendLinePoints[0].x} ${trendLinePoints[0].y}`;
        for (let i = 0; i < trendLinePoints.length - 1; i++) {
            const p0 = trendLinePoints[i];
            const p1 = trendLinePoints[i+1];
            const cp1_x = p0.x + (p1.x - p0.x) / 2;
            const cp1_y = p0.y;
            const cp2_x = p0.x + (p1.x - p0.x) / 2;
            const cp2_y = p1.y;
            splinePath += ` C ${cp1_x} ${cp1_y}, ${cp2_x} ${cp2_y}, ${p1.x} ${p1.y}`;
        }
        
        splineAreaPath = splinePath + ` L ${trendLinePoints[trendLinePoints.length - 1].x} ${paddingTop + graphHeight} L ${trendLinePoints[0].x} ${paddingTop + graphHeight} Z`;
    }

    return (
        <section id="tab-dashboard" className="tab-pane active">
            <div className="page-header">
                <h2>Store Dashboard</h2>
                <p className="subtitle">Quick overview of pharmacy products and upcoming medicine expiries.</p>
            </div>

            {/* Stats Grid */}
            <div className="stats-grid">
                <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('all')}>
                    <div className="stat-icon bg-primary"><i className="fa-solid fa-pills"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Total Medicines</span>
                        <StatValue val={totalCount} />
                    </div>
                </div>

                <div className="stat-card border-success" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('active')}>
                    <div className="stat-icon bg-success"><i className="fa-solid fa-circle-check"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Active &amp; Safe</span>
                        <StatValue val={activeSafeCount} />
                    </div>
                </div>

                <div className="stat-card border-warning" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('expiring')}>
                    <div className="stat-icon bg-warning text-dark"><i className="fa-solid fa-triangle-exclamation"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Expiring Soon (20d)</span>
                        <StatValue val={expiringSoonCount} />
                    </div>
                </div>

                <div className="stat-card border-danger" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('expired')}>
                    <div className="stat-icon bg-danger"><i className="fa-solid fa-circle-xmark"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Expired Medicines</span>
                        <StatValue val={expiredCount} />
                    </div>
                </div>

                <div className="stat-card border-orange" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('outofstock')}>
                    <div className="stat-icon bg-orange"><i className="fa-solid fa-boxes-stacked"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Out of Stock</span>
                        <StatValue val={outOfStockCount} />
                    </div>
                </div>

                <div className="stat-card border-inactive" style={{ cursor: 'pointer' }} onClick={() => handleStatCardClick('inactive')}>
                    <div className="stat-icon bg-inactive"><i className="fa-solid fa-box-archive"></i></div>
                    <div className="stat-info">
                        <span className="stat-label">Inactive Stock</span>
                        <StatValue val={inactiveCount} />
                    </div>
                </div>
            </div>
            <div className="dashboard-analytics-section">
                {/* Left Panel: Revenue Chart */}
                <div className="analytics-card card-panel">
                    <div className="analytics-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                        <div className="panel-title-group">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-chart-column panel-icon" style={{ color: chartMetric === 'revenue' ? 'var(--primary)' : '#10b981' }}></i>
                                <h3 style={{ margin: 0 }}>{chartMetric === 'revenue' ? 'Monthly Sales & Revenue Trend' : 'Monthly Net Profit Trend'}</h3>
                            </div>
                            <div className="trend-summary-highlights">
                                <span className="trend-highlight-label">This Month:</span>
                                <span className="trend-highlight-value" style={{ color: chartMetric === 'revenue' ? 'var(--primary)' : '#10b981', fontWeight: '700' }}>
                                    ₹{currentMonthVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                                {prevMonthVal > 0 && (
                                    <span className={`trend-highlight-badge ${percentageChange >= 0 ? 'up' : 'down'}`}>
                                        <i className={percentageChange >= 0 ? "fa-solid fa-arrow-trend-up" : "fa-solid fa-arrow-trend-down"}></i>
                                        {percentageChange >= 0 ? '+' : ''}{percentageChange.toFixed(1)}% MoM
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="chart-metric-selector">
                            <button 
                                className={`metric-btn ${chartMetric === 'revenue' ? 'active' : ''}`}
                                onClick={() => setChartMetric('revenue')}
                            >
                                Revenue
                            </button>
                            <button 
                                className={`metric-btn ${chartMetric === 'profit' ? 'active profit' : ''}`}
                                onClick={() => setChartMetric('profit')}
                            >
                                Profit
                            </button>
                        </div>
                    </div>
                    
                    <div className="chart-container" style={{ position: 'relative', height: chartHeight }}>
                        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="analytics-svg-chart">
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartMetric === 'revenue' ? "var(--primary)" : "#10b981"} stopOpacity="0.85" />
                                    <stop offset="100%" stopColor={chartMetric === 'revenue' ? "var(--primary-hover)" : "#059669"} stopOpacity="0.95" />
                                </linearGradient>
                                <linearGradient id="trendLineGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={chartMetric === 'revenue' ? "#d946ef" : "#10b981"} />
                                    <stop offset="100%" stopColor={chartMetric === 'revenue' ? "#06b6d4" : "#34d399"} />
                                </linearGradient>
                                <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartMetric === 'revenue' ? "#d946ef" : "#10b981"} stopOpacity="0.22" />
                                    <stop offset="100%" stopColor={chartMetric === 'revenue' ? "#d946ef" : "#10b981"} stopOpacity="0.0" />
                                </linearGradient>
                                <filter id="barShadow" x="-20%" y="-10%" width="140%" height="120%">
                                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor={chartMetric === 'revenue' ? "var(--primary)" : "#10b981"} floodOpacity="0.25" />
                                </filter>
                                <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor={chartMetric === 'revenue' ? "#ec4899" : "#10b981"} floodOpacity="0.4" />
                                </filter>
                            </defs>

                            {/* Glowing Spline Area under Trend */}
                            {splineAreaPath && (
                                <path 
                                    d={splineAreaPath} 
                                    fill="url(#chartAreaGrad)" 
                                    style={{ pointerEvents: 'none' }}
                                />
                            )}
                            
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                                const y = paddingTop + graphHeight * (1 - pct);
                                const val = Math.round(maxVal * pct);
                                return (
                                    <g key={idx} className="chart-grid-line-group">
                                        <line 
                                            x1={paddingLeft} 
                                            y1={y} 
                                            x2={chartWidth - paddingRight} 
                                            y2={y} 
                                            stroke="var(--border-color)" 
                                            strokeDasharray="4 4" 
                                            strokeWidth="1"
                                        />
                                        <text 
                                            x={paddingLeft - 8} 
                                            y={y + 4} 
                                            textAnchor="end" 
                                            fill="var(--text-muted)" 
                                            fontSize="10"
                                        >
                                            ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                                        </text>
                                    </g>
                                );
                            })}
                            
                            {/* Chart Bars */}
                            {monthlyBreakdown.map((item, i) => {
                                const x = paddingLeft + i * (barWidth + barGap);
                                const val = chartMetric === 'revenue' ? item.revenue : item.profit;
                                const barHeight = (val / maxVal) * graphHeight;
                                const y = paddingTop + graphHeight - barHeight;
                                
                                return (
                                    <g key={i} className="chart-bar-group">
                                        {/* Bar Track Background */}
                                        <rect 
                                            x={x} 
                                            y={paddingTop} 
                                            width={barWidth} 
                                            height={graphHeight} 
                                            rx="4" 
                                            fill="var(--bg-input)" 
                                            opacity="0.1" 
                                        />
                                        
                                        {/* Actual Value Bar */}
                                        <rect 
                                            x={x} 
                                            y={y} 
                                            width={barWidth} 
                                            height={barHeight} 
                                            rx="4" 
                                            fill="url(#barGradient)" 
                                            className="chart-bar"
                                            filter="url(#barShadow)"
                                            opacity="0.85"
                                        />
                                        
                                        {/* Glowing Top Cap */}
                                        {barHeight > 6 && (
                                            <rect 
                                                x={x} 
                                                y={y} 
                                                width={barWidth} 
                                                height="4" 
                                                rx="2" 
                                                fill={chartMetric === 'revenue' ? "#38bdf8" : "#34d399"} 
                                                opacity="0.85"
                                            />
                                        )}
                                        
                                        <text 
                                            x={x + barWidth / 2} 
                                            y={chartHeight - 8} 
                                            textAnchor="middle" 
                                            fill="var(--text-secondary)" 
                                            fontSize="10"
                                            fontWeight="600"
                                        >
                                            {item.label}
                                        </text>
                                        
                                        {/* Pure SVG Tooltip on Hover */}
                                        <g className="chart-tooltip">
                                            <rect 
                                                x={x + barWidth / 2 - 60} 
                                                y={y - 45} 
                                                width={120} 
                                                height={38} 
                                                rx="6" 
                                                fill="var(--bg-card-hover)" 
                                                stroke={chartMetric === 'revenue' ? "var(--primary)" : "#10b981"} 
                                                strokeWidth="1"
                                                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                                            />
                                            <text 
                                                x={x + barWidth / 2} 
                                                y={y - 32} 
                                                textAnchor="middle" 
                                                fill="var(--text-primary)" 
                                                fontSize="10" 
                                                fontWeight="bold"
                                            >
                                                ₹{val.toLocaleString('en-IN')}
                                            </text>
                                            <text 
                                                x={x + barWidth / 2} 
                                                y={y - 20} 
                                                textAnchor="middle" 
                                                fill="var(--text-muted)" 
                                                fontSize="9"
                                            >
                                                {item.count} Invoices
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}

                            {/* Glowing Spline Trend Line */}
                            {splinePath && (
                                <path 
                                    d={splinePath} 
                                    fill="none" 
                                    stroke="url(#trendLineGrad)" 
                                    strokeWidth="3.5" 
                                    filter="url(#lineGlow)"
                                    style={{ pointerEvents: 'none' }}
                                    className="analytics-trend-line"
                                />
                            )}
                        </svg>
                        
                        {/* Premium Chart Legend */}
                        <div className="chart-legend-container" style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                            <div className="chart-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', width: '12px', height: '12px', borderRadius: '3px', background: chartMetric === 'revenue' ? 'var(--primary)' : '#10b981' }}></span>
                                <span>{chartMetric === 'revenue' ? 'Monthly Revenue (Bars)' : 'Monthly Net Profit (Bars)'}</span>
                            </div>
                            <div className="chart-legend-item" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ display: 'inline-block', width: '20px', height: '3px', borderRadius: '1.5px', background: chartMetric === 'revenue' ? '#d946ef' : '#10b981' }}></span>
                                <span>Smoothed Trend Line</span>
                            </div>
                        </div>
                    </div>
                </div>
 
                {/* Right Panel: Category & Stock Metrics */}
                <div className="analytics-card card-panel">
                    <div className="analytics-card-header">
                        <div className="panel-title-group">
                            <i className="fa-solid fa-chart-pie panel-icon" style={{ color: 'var(--success)' }}></i>
                            <h3>Category &amp; Revenue Metrics</h3>
                        </div>
                    </div>
                    
                    <div className="category-distribution-list">
                        {categoriesList.map(cat => {
                            let gradient = 'linear-gradient(90deg, var(--primary) 0%, var(--primary-hover) 100%)';
                            let glowColor = 'var(--primary)';
                            if (cat.name === 'Tablet') { gradient = 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)'; glowColor = '#3b82f6'; }
                            else if (cat.name === 'Capsule') { gradient = 'linear-gradient(90deg, #d946ef 0%, #f472b6 100%)'; glowColor = '#d946ef'; }
                            else if (cat.name === 'Syrup') { gradient = 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'; glowColor = '#10b981'; }
                            else if (cat.name === 'Injection') { gradient = 'linear-gradient(90deg, #ec4899 0%, #f472b6 100%)'; glowColor = '#ec4899'; }
                            else if (cat.name === 'Vaccine') { gradient = 'linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)'; glowColor = '#8b5cf6'; }
                            else if (cat.name === 'Ointment') { gradient = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'; glowColor = '#f59e0b'; }
                            else if (cat.name === 'Other') { gradient = 'linear-gradient(90deg, #64748b 0%, #94a3b8 100%)'; glowColor = '#64748b'; }
 
                            return (
                                <div key={cat.name} className="category-progress-item">
                                    <div className="category-progress-meta">
                                        <span className="category-name" style={{ fontWeight: '600' }}>{cat.name}s</span>
                                        <span className="category-count">{cat.count} meds ({cat.percentage}%)</span>
                                    </div>
                                    <div className="progress-bar-bg">
                                        <div 
                                            className="progress-bar-fill" 
                                            style={{ 
                                                width: `${cat.percentage}%`, 
                                                background: gradient,
                                                boxShadow: `0 0 6px ${glowColor}33`
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div className="analytics-financial-summary" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                        <div className="financial-card card-month">
                            <div className="fin-card-header">
                                <span className="fin-label">Current Month Sales</span>
                                <div className="fin-icon-wrap bg-primary-glow"><i className="fa-solid fa-calendar-days text-primary-color"></i></div>
                            </div>
                            <h4 className="fin-value">₹{currentMonthRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                        </div>
                        <div className="financial-card card-lifetime">
                            <div className="fin-card-header">
                                <span className="fin-label">Lifetime Revenue</span>
                                <div className="fin-icon-wrap bg-success-glow"><i className="fa-solid fa-sack-dollar text-success-color"></i></div>
                            </div>
                            <h4 className="fin-value">₹{lifetimeRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                        </div>
                        <div className="financial-card card-invoices">
                            <div className="fin-card-header">
                                <span className="fin-label">Invoices Saved</span>
                                <div className="fin-icon-wrap bg-warning-glow"><i className="fa-solid fa-file-invoice text-warning-color"></i></div>
                            </div>
                            <h4 className="fin-value">{lifetimeBills}</h4>
                        </div>
                        
                        <div className="financial-card card-month-profit">
                            <div className="fin-card-header">
                                <span className="fin-label">Current Month Profit</span>
                                <div className="fin-icon-wrap bg-profit-glow"><i className="fa-solid fa-money-bill-trend-up"></i></div>
                            </div>
                            <h4 className="fin-value" style={{ color: '#10b981' }}>₹{currentMonthProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                        </div>
                        <div className="financial-card card-lifetime-profit">
                            <div className="fin-card-header">
                                <span className="fin-label">Lifetime Profit</span>
                                <div className="fin-icon-wrap bg-month-profit-glow"><i className="fa-solid fa-vault"></i></div>
                            </div>
                            <h4 className="fin-value" style={{ color: '#8b5cf6' }}>₹{lifetimeProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</h4>
                        </div>
                        <div className="financial-card card-margin">
                            <div className="fin-card-header">
                                <span className="fin-label">Avg Profit Margin</span>
                                <div className="fin-icon-wrap bg-margin-glow"><i className="fa-solid fa-percent"></i></div>
                            </div>
                            <h4 className="fin-value" style={{ color: '#f59e0b' }}>{avgProfitMargin.toFixed(2)}%</h4>
                        </div>
                    </div>
                </div>
            </div>

            {/* Dashboard Split Layout */}
            <div className="dashboard-split">
                {/* Left: Urgent Expiries */}
                <div className="split-left card-panel">
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <i className="fa-solid fa-hourglass-half panel-icon warning-text"></i>
                            <h3>Urgent Expiry Timeline</h3>
                        </div>
                        <span className={`badge ${expiringSoonCount > 0 ? 'badge-warning' : 'badge-safe'}`}>
                            {expiringSoonCount > 0 ? `${expiringSoonCount} Upcoming` : 'All Safe'}
                        </span>
                    </div>
                    <div className="panel-content">
                        <div className="timeline-list" id="urgent-expiry-list">
                            {expiringSoonItems.length === 0 ? (
                                <div className="empty-state">
                                    <i className="fa-solid fa-circle-check text-success" style={{ fontSize: '28px', color: 'var(--success)' }}></i>
                                    <p>No upcoming expiries detected. All products are safe!</p>
                                </div>
                            ) : (
                                expiringSoonItems.map(item => {
                                    const med = item.medicine;
                                    const days = item.daysLeft;
                                    
                                    const { urgencyClass, daysLabel } = getExpiryStatus(days);

                                    return (
                                        <div key={med.id} className={`timeline-item ${urgencyClass}`}>
                                            <i className="fa-solid fa-hourglass-half timeline-icon"></i>
                                            <div className="timeline-content">
                                                <div className="timeline-title">{med.name}</div>
                                                <div className="timeline-desc">Batch No: {med.batch} | Qty: {med.quantity} | Category: {med.category}</div>
                                                <div className="timeline-meta">
                                                    <span>Expiry: {formatDateDisplay(med.expiryDate)}</span>
                                                    <span className={`badge badge-${urgencyClass}`}>{daysLabel}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right: Fast Actions & Summary */}
                <div className="split-right">
                    {/* Seasonal Demand Forecaster Widget */}
                    {forecast && (
                        <div className="card-panel forecaster-card" style={{ borderLeft: `4px solid ${forecast.seasonColor}` }}>
                            <div className="forecaster-header">
                                <div className="forecaster-title-group" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <i className={`fa-solid ${forecast.seasonIcon} forecaster-icon`} style={{ color: forecast.seasonColor, fontSize: '22px' }}></i>
                                    <div>
                                        <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Seasonal Demand Forecaster</h3>
                                        <span className="forecast-season-badge" style={{ backgroundColor: `${forecast.seasonColor}22`, color: forecast.seasonColor, fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: '600', display: 'inline-block', marginTop: '2px' }}>
                                            Upcoming: {forecast.upcomingSeason} ({forecast.seasonalMonths})
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="forecaster-body" style={{ marginTop: '16px' }}>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    Current season is <strong>{forecast.currentSeason}</strong>. Based on sales analytics, demand for <strong>{forecast.primaryCategory}s</strong> will spike by <span style={{ color: forecast.seasonColor, fontWeight: '700' }}>{forecast.expectedIncrease}</span> during <strong>{forecast.upcomingSeason}</strong>.
                                </p>
                                
                                <div className="forecast-alert-box" style={{ background: 'var(--bg-card-hover)', padding: '12px', borderRadius: '8px', marginTop: '12px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                                        <span>Current Stock:</span>
                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{forecast.primaryStock} units</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                        <span>Target Stock:</span>
                                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{forecast.targetQty} units</span>
                                    </div>
                                    {forecast.restockNeeded > 0 ? (
                                        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', color: 'var(--warning)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <i className="fa-solid fa-circle-exclamation"></i>
                                            <span><strong>Restock Suggestion:</strong> Add {forecast.restockNeeded} units of {forecast.primaryCategory}s.</span>
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', color: 'var(--success)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <i className="fa-solid fa-circle-check"></i>
                                            <span><strong>Stock Adequate:</strong> No immediate restock needed.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Predictive Forecast Chart */}
                                <div className="forecast-chart-container" style={{ marginTop: '16px', background: 'var(--bg-card-hover)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-secondary)' }}>PREDICTIVE SALES TREND</span>
                                        <div style={{ display: 'flex', gap: '8px', fontSize: '9px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-muted)' }}>
                                                <span style={{ display: 'inline-block', width: '8px', height: '0px', borderTop: '1.5px dashed var(--text-muted)' }}></span> Last Year
                                            </span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: forecast.seasonColor, fontWeight: '600' }}>
                                                <span style={{ display: 'inline-block', width: '8px', height: '2px', backgroundColor: forecast.seasonColor }}></span> Expected
                                            </span>
                                        </div>
                                    </div>
                                    
                                    <svg viewBox="0 0 330 110" className="forecast-svg-chart" style={{ width: '100%', height: 'auto', display: 'block' }}>
                                        <defs>
                                            <linearGradient id={`forecastAreaGrad-${forecast.upcomingSeason}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={forecast.seasonColor} stopOpacity="0.3" />
                                                <stop offset="100%" stopColor={forecast.seasonColor} stopOpacity="0.0" />
                                            </linearGradient>
                                        </defs>
                                        
                                        {/* Grid Lines */}
                                        {[0, 0.5, 1].map((pct, idx) => {
                                            const y = 15 + 75 * (1 - pct);
                                            const val = Math.round(250 * pct);
                                            return (
                                                <g key={idx}>
                                                    <line x1="30" y1={y} x2="320" y2={y} stroke="var(--border-color)" strokeDasharray="3 3" strokeWidth="0.75" />
                                                    <text x="25" y={y + 3} textAnchor="end" fill="var(--text-muted)" fontSize="8">{val}</text>
                                                </g>
                                            );
                                        })}
                                        
                                        {/* X Axis Labels */}
                                        {points.map((pt, idx) => (
                                            <text key={idx} x={pt.x} y="105" textAnchor="middle" fill="var(--text-secondary)" fontSize="8" fontWeight="500">
                                                {pt.label}
                                            </text>
                                        ))}
                                        
                                        {/* Area under Expected Sales */}
                                        <path d={expectedAreaPath} fill={`url(#forecastAreaGrad-${forecast.upcomingSeason})`} />
                                        
                                        {/* Paths */}
                                        <path d={lastYearPath} fill="none" stroke="var(--text-muted)" strokeWidth="1.25" strokeDasharray="3 3" />
                                        <path d={expectedPath} fill="none" stroke={forecast.seasonColor} strokeWidth="2.25" className="forecast-expected-path" />
                                        
                                        {/* Node Dots for Expected Sales */}
                                        {points.map((pt, idx) => (
                                            <g key={idx}>
                                                <circle cx={pt.x} cy={pt.yEx} r="3" fill="var(--bg-card)" stroke={forecast.seasonColor} strokeWidth="1.5" />
                                                {idx === 3 && (
                                                    <circle cx={pt.x} cy={pt.yEx} r="6" fill={forecast.seasonColor} opacity="0.3" className="pulse-dot" />
                                                )}
                                                <title>{`Month: ${pt.label}\nExpected: ${pt.valEx} sales\nLast Year: ${pt.valLY} sales`}</title>
                                            </g>
                                        ))}
                                    </svg>
                                </div>

                                <button className="btn btn-outline w-full btn-icon" onClick={handleForecastAction} style={{ marginTop: '16px', borderColor: forecast.seasonColor, color: forecast.seasonColor, background: 'transparent' }}>
                                    <i className="fa-solid fa-magnifying-glass-chart"></i> View {forecast.primaryCategory} Stock
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="card-panel quick-actions-panel">
                        <h3>Quick Actions</h3>
                        <div className="actions-buttons-grid">
                            <button className="btn btn-primary btn-icon" onClick={() => setAddModalOpen(true)}>
                                <i className="fa-solid fa-plus"></i> Add New Product
                            </button>
                            <button className="btn btn-secondary btn-icon" onClick={() => setActiveTab('simulator')}>
                                <i className="fa-solid fa-vial-circle-check"></i> Test Notification
                            </button>
                            <button className="btn btn-outline btn-icon" onClick={() => setActiveTab('notifications-log')}>
                                <i className="fa-solid fa-bell"></i> View Alert Logs
                            </button>
                        </div>
                    </div>

                    {/* System Status Notification Banner */}
                    <div className="info-card">
                        <i className="fa-solid fa-circle-info info-icon"></i>
                        <div className="info-text">
                            <h4>Notifications Policy</h4>
                            <p>This application will alert you in real-time. Make sure to allow browser notification permissions for system tray desktop popups!</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Product Performance Analytics Panel */}
            <div className="card-panel mt-4" style={{ marginTop: '24px' }}>
                <div className="panel-header">
                    <div className="panel-title-group">
                        <i className="fa-solid fa-ranking-star panel-icon text-primary" style={{ color: 'var(--primary)' }}></i>
                        <h3>Product Performance Analytics</h3>
                    </div>
                </div>
                
                <div className="performance-grid">
                    {/* Top Selling Medicines */}
                    <div className="perf-sub-panel">
                        <h4><i className="fa-solid fa-fire text-orange" style={{ color: 'var(--orange)' }}></i> Top Selling Products (By Volume)</h4>
                        <div className="perf-list">
                            {topSelling.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
                                    <i className="fa-solid fa-chart-bar text-muted" style={{ fontSize: '24px', opacity: 0.5, marginBottom: '8px' }}></i>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No sales recorded yet.</p>
                                </div>
                            ) : (
                                topSelling.map((med, idx) => (
                                    <div key={idx} className="perf-item">
                                        <div className="perf-rank">#{idx + 1}</div>
                                        <div className="perf-details">
                                            <div className="perf-name">{med._id}</div>
                                            <div className="perf-category">{med.category}</div>
                                        </div>
                                        <div className="perf-stats">
                                            <div className="perf-value">{med.quantity} Units</div>
                                            <div className="perf-subtext">Sales: ₹{med.sales.toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Most Profitable Medicines */}
                    <div className="perf-sub-panel">
                        <h4><i className="fa-solid fa-gem text-success" style={{ color: '#10b981' }}></i> Most Profitable Products (Net Profit Contribution)</h4>
                        <div className="perf-list">
                            {topProfitable.length === 0 ? (
                                <div className="empty-state" style={{ padding: '20px', textAlign: 'center' }}>
                                    <i className="fa-solid fa-sack-dollar text-muted" style={{ fontSize: '24px', opacity: 0.5, marginBottom: '8px' }}></i>
                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No sales recorded yet.</p>
                                </div>
                            ) : (
                                topProfitable.map((med, idx) => (
                                    <div key={idx} className="perf-item profit-hover">
                                        <div className="perf-rank" style={{ color: '#10b981' }}>#{idx + 1}</div>
                                        <div className="perf-details">
                                            <div className="perf-name">{med._id}</div>
                                            <div className="perf-category">{med.category}</div>
                                        </div>
                                        <div className="perf-stats">
                                            <div className="perf-value" style={{ color: '#10b981' }}>+₹{Math.round(med.profit).toLocaleString('en-IN')}</div>
                                            <div className="perf-subtext">Sales: ₹{med.sales.toLocaleString('en-IN')}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
