import React, { useEffect, useState } from "react";
import { usePharmacyStore } from "../store/usePharmacyStore";

export default function AnalyticsTab() {
  const { bills, isLoadingBills, fetchBills } = usePharmacyStore();
  const [filterType, setFilterType] = useState("last30"); // 'last7', 'last30', 'month', 'all'

  useEffect(() => {
    // Fetch a large sample of bills to perform accurate client-side analytics
    fetchBills({ limit: 1000 });
  }, [fetchBills]);

  // Helper to parse dates without timezone issues
  const getBillDate = (billDateStr) => {
    return new Date(billDateStr);
  };

  // Filter bills based on date range
  const getFilteredBills = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today

    let startDate = new Date();
    if (filterType === "last7") {
      startDate.setDate(today.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterType === "last30") {
      startDate.setDate(today.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
    } else if (filterType === "month") {
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // All time
      return bills;
    }

    return bills.filter((b) => {
      const bDate = getBillDate(b.billDate);
      return bDate >= startDate && bDate <= today;
    });
  };

  const filteredBills = getFilteredBills();

  // ── Metrics Calculation ────────────────────────────────────────────────────
  let totalSales = 0;
  let totalCost = 0;
  let totalDiscount = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  const paymentCounts = { Cash: 0, Card: 0, UPI: 0 };
  const productSales = {}; // { productName: { quantity: 0, sales: 0, category: '' } }

  filteredBills.forEach((b) => {
    totalSales += b.netTotal;
    totalDiscount += b.discountAmount || 0;
    totalCGST += b.cgst || 0;
    totalSGST += b.sgst || 0;

    if (paymentCounts[b.paymentMode] !== undefined) {
      paymentCounts[b.paymentMode] += b.netTotal;
    }

    // Calculate cost based on PTR (Price to Retailer)
    b.items.forEach((item) => {
      totalCost += (item.ptr || 0) * item.quantity;

      if (!productSales[item.name]) {
        productSales[item.name] = { quantity: 0, sales: 0, category: item.category };
      }
      productSales[item.name].quantity += item.quantity;
      productSales[item.name].sales += item.amount;
    });
  });

  const totalProfit = totalSales - totalCost;
  const invoiceCount = filteredBills.length;
  const avgOrderValue = invoiceCount > 0 ? totalSales / invoiceCount : 0;
  const totalPaymentAmount = paymentCounts.Cash + paymentCounts.Card + paymentCounts.UPI || 1;

  // ── Top Products ───────────────────────────────────────────────────────────
  const topProducts = Object.entries(productSales)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // ── Date-wise Grouping for Trend Chart ──────────────────────────────────────
  const getTrendData = () => {
    const dailyData = {}; // { 'YYYY-MM-DD': sales }
    const today = new Date();

    let daysToGenerate = 30;
    if (filterType === "last7") daysToGenerate = 7;
    else if (filterType === "month") {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      daysToGenerate = Math.ceil((today - startOfMonth) / (1000 * 60 * 60 * 24)) + 1;
    } else if (filterType === "all") {
      daysToGenerate = 12; // Group by month instead
    }

    if (filterType === "all") {
      // Group by Month
      const monthlyData = {};
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      
      // Initialize past 12 months
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substring(2)}`;
        monthlyData[key] = 0;
      }

      bills.forEach((b) => {
        const bDate = getBillDate(b.billDate);
        const key = `${monthNames[bDate.getMonth()]} ${bDate.getFullYear().toString().substring(2)}`;
        if (monthlyData[key] !== undefined) {
          monthlyData[key] += b.netTotal;
        }
      });

      return Object.entries(monthlyData).map(([label, sales]) => ({ label, sales }));
    } else {
      // Initialize daily keys
      for (let i = daysToGenerate - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split("T")[0];
        dailyData[key] = 0;
      }

      filteredBills.forEach((b) => {
        const key = getBillDate(b.billDate).toISOString().split("T")[0];
        if (dailyData[key] !== undefined) {
          dailyData[key] += b.netTotal;
        }
      });

      return Object.entries(dailyData).map(([dateStr, sales]) => {
        const dateObj = new Date(dateStr);
        const label = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { label, sales };
      });
    }
  };

  const trendData = getTrendData();
  const maxTrendVal = Math.max(...trendData.map((t) => t.sales), 100);

  // ── SVG Donut Chart for Payments ──────────────────────────────────────────
  const cashPct = (paymentCounts.Cash / totalPaymentAmount) * 100;
  const cardPct = (paymentCounts.Card / totalPaymentAmount) * 100;
  const upiPct = (paymentCounts.UPI / totalPaymentAmount) * 100;

  // Render SVG Donut Chart Paths
  const radius = 50;
  const circ = 2 * Math.PI * radius;
  const cashStrokeDash = (cashPct / 100) * circ;
  const cardStrokeDash = (cardPct / 100) * circ;
  const upiStrokeDash = (upiPct / 100) * circ;

  const upiOffset = circ;
  const cashOffset = circ - upiStrokeDash;
  const cardOffset = circ - upiStrokeDash - cashStrokeDash;

  // ── SVG Spline Coordinates for Trend Line ─────────────────────────────────
  const chartWidth = 650;
  const chartHeight = 220;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const graphWidth = chartWidth - paddingLeft - paddingRight;
  const graphHeight = chartHeight - paddingTop - paddingBottom;

  const trendPoints = trendData.map((item, i) => {
    const x = paddingLeft + (i * graphWidth) / (trendData.length - 1 || 1);
    const barHeight = (item.sales / maxTrendVal) * graphHeight;
    const y = paddingTop + graphHeight - barHeight;
    return { x, y };
  });

  let splinePath = "";
  let splineAreaPath = "";
  if (trendPoints.length > 0) {
    splinePath = `M ${trendPoints[0].x} ${trendPoints[0].y}`;
    for (let i = 0; i < trendPoints.length - 1; i++) {
      const p0 = trendPoints[i];
      const p1 = trendPoints[i + 1];
      const cp1_x = p0.x + (p1.x - p0.x) / 2;
      const cp1_y = p0.y;
      const cp2_x = p0.x + (p1.x - p0.x) / 2;
      const cp2_y = p1.y;
      splinePath += ` C ${cp1_x} ${cp1_y}, ${cp2_x} ${cp2_y}, ${p1.x} ${p1.y}`;
    }
    splineAreaPath =
      splinePath +
      ` L ${trendPoints[trendPoints.length - 1].x} ${paddingTop + graphHeight} L ${trendPoints[0].x} ${paddingTop + graphHeight} Z`;
  }

  return (
    <section id="tab-analytics" className="tab-pane active">
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Sales Analytics &amp; Reports</h2>
          <p className="subtitle">Visual insights into pharmacy revenue, profit, and customer payments.</p>
        </div>

        <div className="chart-metric-selector" style={{ display: "flex", gap: "8px" }}>
          <button
            className={`metric-btn ${filterType === "last7" ? "active" : ""}`}
            onClick={() => setFilterType("last7")}
          >
            7 Days
          </button>
          <button
            className={`metric-btn ${filterType === "last30" ? "active" : ""}`}
            onClick={() => setFilterType("last30")}
          >
            30 Days
          </button>
          <button
            className={`metric-btn ${filterType === "month" ? "active" : ""}`}
            onClick={() => setFilterType("month")}
          >
            This Month
          </button>
          <button
            className={`metric-btn ${filterType === "all" ? "active" : ""}`}
            onClick={() => setFilterType("all")}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Analytics Stats Summary Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="stat-card">
          <div className="stat-icon bg-primary">
            <i className="fa-solid fa-coins"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Total Revenue</span>
            <h3>₹{totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="stat-card border-success">
          <div className="stat-icon bg-success">
            <i className="fa-solid fa-wallet"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Net Profit</span>
            <h3 style={{ color: "#10b981" }}>₹{totalProfit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>

        <div className="stat-card border-warning">
          <div className="stat-icon bg-warning text-dark">
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Invoices Count</span>
            <h3>{invoiceCount}</h3>
          </div>
        </div>

        <div className="stat-card border-orange">
          <div className="stat-icon bg-orange">
            <i className="fa-solid fa-calculator"></i>
          </div>
          <div className="stat-info">
            <span className="stat-label">Average Invoice Value</span>
            <h3>₹{avgOrderValue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      </div>

      <div className="dashboard-analytics-section" style={{ gridTemplateColumns: "1.6fr 1fr", gap: "20px", marginTop: "24px" }}>
        {/* Sales Trend Spline Chart */}
        <div className="analytics-card card-panel">
          <div className="analytics-card-header">
            <div className="panel-title-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="fa-solid fa-chart-line panel-icon" style={{ color: "var(--primary)" }}></i>
              <h3 style={{ margin: 0 }}>Sales &amp; Revenue Chart</h3>
            </div>
          </div>

          <div className="chart-container" style={{ position: "relative", height: chartHeight, marginTop: "16px" }}>
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="analytics-svg-chart">
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                </linearGradient>
                <filter id="shadowGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="var(--primary)" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Area */}
              {splineAreaPath && <path d={splineAreaPath} fill="url(#areaGradient)" style={{ pointerEvents: "none" }} />}

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                const y = paddingTop + graphHeight * (1 - pct);
                const val = Math.round(maxTrendVal * pct);
                return (
                  <g key={idx}>
                    <line
                      x1={paddingLeft}
                      y1={y}
                      x2={chartWidth - paddingRight}
                      y2={y}
                      stroke="var(--border-color)"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize="9">
                      ₹{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                    </text>
                  </g>
                );
              })}

              {/* Spline Path */}
              {splinePath && (
                <path
                  d={splinePath}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="3"
                  filter="url(#shadowGlow)"
                  style={{ pointerEvents: "none" }}
                />
              )}

              {/* Data points */}
              {trendPoints.map((pt, idx) => {
                const val = trendData[idx].sales;
                // Only render dots for reasonably spaced labels
                const shouldRenderDot = trendData.length <= 15 || idx % 2 === 0 || idx === trendData.length - 1;
                if (!shouldRenderDot) return null;

                return (
                  <g key={idx} className="chart-bar-group">
                    <circle cx={pt.x} cy={pt.y} r="4" fill="var(--bg-card)" stroke="var(--primary)" strokeWidth="2.5" />
                    <text x={pt.x} y={chartHeight - 8} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontWeight="500">
                      {idx % (trendData.length > 10 ? 3 : 1) === 0 ? trendData[idx].label : ""}
                    </text>

                    {/* SVG Tooltip */}
                    <g className="chart-tooltip">
                      <rect
                        x={pt.x - 50}
                        y={pt.y - 35}
                        width={100}
                        height={25}
                        rx="4"
                        fill="var(--bg-card-hover)"
                        stroke="var(--primary)"
                        strokeWidth="1"
                        style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))" }}
                      />
                      <text x={pt.x} y={pt.y - 18} textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontWeight="bold">
                        ₹{Math.round(val).toLocaleString("en-IN")}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Payment Mode Distribution Donut Chart */}
        <div className="analytics-card card-panel">
          <div className="analytics-card-header">
            <div className="panel-title-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="fa-solid fa-chart-pie panel-icon" style={{ color: "#10b981" }}></i>
              <h3 style={{ margin: 0 }}>Payment Methods</h3>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "24px", marginTop: "24px" }}>
            <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: "rotate(-90deg)" }}>
              {/* UPI Segment (Purple) */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="#8b5cf6"
                strokeWidth="18"
                strokeDasharray={`${upiStrokeDash} ${circ}`}
                strokeDashoffset={circ - upiOffset}
              />
              {/* Cash Segment (Primary) */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="var(--primary)"
                strokeWidth="18"
                strokeDasharray={`${cashStrokeDash} ${circ}`}
                strokeDashoffset={circ - cashOffset}
              />
              {/* Card Segment (Emerald) */}
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="#10b981"
                strokeWidth="18"
                strokeDasharray={`${cardStrokeDash} ${circ}`}
                strokeDashoffset={circ - cardOffset}
              />
              {/* Center space hole to make it a donut */}
              <circle cx="70" cy="70" r="38" fill="var(--bg-card)" />
            </svg>

            {/* Legends & Amounts */}
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "var(--primary)" }}></span>
                  <span>Cash Payments</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: "600" }}>
                  ₹{paymentCounts.Cash.toLocaleString("en-IN")} ({Math.round(cashPct || 0)}%)
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6" }}></span>
                  <span>UPI Payments</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: "600" }}>
                  ₹{paymentCounts.UPI.toLocaleString("en-IN")} ({Math.round(upiPct || 0)}%)
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
                  <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></span>
                  <span>Card Payments</span>
                </div>
                <div style={{ fontSize: "12px", fontWeight: "600" }}>
                  ₹{paymentCounts.Card.toLocaleString("en-IN")} ({Math.round(cardPct || 0)}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-split" style={{ marginTop: "24px", gap: "20px" }}>
        {/* Left: Top Products Table */}
        <div className="split-left card-panel" style={{ flex: "1.4" }}>
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div className="panel-title-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="fa-solid fa-ranking-star panel-icon" style={{ color: "var(--orange)" }}></i>
              <h3>Top Selling Products</h3>
            </div>
          </div>

          <div className="panel-content">
            <table className="bill-history-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-color)", color: "var(--text-muted)" }}>
                  <th style={{ padding: "10px 8px" }}>Rank</th>
                  <th style={{ padding: "10px 8px" }}>Medicine Name</th>
                  <th style={{ padding: "10px 8px" }}>Category</th>
                  <th style={{ padding: "10px 8px" }}>Qty Sold</th>
                  <th style={{ padding: "10px 8px" }}>Total Sales</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                      No transactions recorded in this period.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)", verticalAlign: "middle" }}>
                      <td style={{ padding: "12px 8px", fontWeight: "bold" }}>#{idx + 1}</td>
                      <td style={{ padding: "12px 8px", fontWeight: "500" }}>{p.name}</td>
                      <td style={{ padding: "12px 8px" }}>{p.category}</td>
                      <td style={{ padding: "12px 8px" }}>{p.quantity} Units</td>
                      <td style={{ padding: "12px 8px", fontWeight: "600", color: "var(--primary)" }}>
                        ₹{p.sales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Tax Breakdown Summary Card */}
        <div className="split-right card-panel" style={{ flex: "1" }}>
          <div className="panel-header" style={{ marginBottom: "16px" }}>
            <div className="panel-title-group" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <i className="fa-solid fa-receipt panel-icon" style={{ color: "var(--primary)" }}></i>
              <h3>GST Tax &amp; Discount Sheet</h3>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--bg-card-hover)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>CGST Collected</div>
              <h4 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", marginTop: "4px" }}>
                ₹{totalCGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h4>
            </div>

            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--bg-card-hover)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>SGST Collected</div>
              <h4 style={{ fontSize: "18px", fontWeight: "600", color: "var(--text-primary)", marginTop: "4px" }}>
                ₹{totalSGST.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h4>
            </div>

            <div style={{ padding: "14px", borderRadius: "8px", background: "var(--bg-card-hover)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Total Discounts Applied</div>
              <h4 style={{ fontSize: "18px", fontWeight: "600", color: "var(--danger)", marginTop: "4px" }}>
                ₹{totalDiscount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </h4>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
