import { useState, useEffect } from 'react';
import { usePharmacyStore, getLocalDateString, calculateDaysDifference, formatDateDisplay } from '../store/usePharmacyStore';

export default function CalendarTab() {
    const {
        medicines,
        fetchMedicines,
        simulatedDate,
        setEditModalOpen
    } = usePharmacyStore();

    // Parse the simulatedDate to set our default calendar focus
    const simDate = new Date(simulatedDate);
    const [currentYear, setCurrentYear] = useState(simDate.getFullYear());
    const [currentMonth, setCurrentMonth] = useState(simDate.getMonth()); // 0-indexed
    const [selectedMed, setSelectedMed] = useState(null); // for quick view popup

    useEffect(() => {
        // Fetch all medicines so we have the full catalogue for the calendar
        fetchMedicines({ limit: 100, status: 'all' });
    }, [fetchMedicines]);

    // Handle Month Navigation
    const handlePrevMonth = () => {
        if (currentMonth === 0) {
            setCurrentMonth(11);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 11) {
            setCurrentMonth(0);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const handleResetToToday = () => {
        setCurrentYear(simDate.getFullYear());
        setCurrentMonth(simDate.getMonth());
    };

    // Calendar Calculations
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
    
    // Generate dates for current month
    const cells = [];
    
    // Padding from previous month
    const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
        cells.push({
            day: prevMonthDays - i,
            isCurrentMonth: false,
            monthOffset: -1
        });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
        cells.push({
            day: i,
            isCurrentMonth: true,
            monthOffset: 0
        });
    }

    // Padding for next month to complete the grid (multiples of 7)
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
        cells.push({
            day: i,
            isCurrentMonth: false,
            monthOffset: 1
        });
    }

    // Helper to check if cell day is today (relative to simulatedDate)
    const isToday = (day, isCurr) => {
        if (!isCurr) return false;
        return simDate.getDate() === day &&
               simDate.getMonth() === currentMonth &&
               simDate.getFullYear() === currentYear;
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <section id="tab-calendar" className="tab-pane active">
            <div className="page-header flex-header">
                <div>
                    <h2>Expiry Calendar</h2>
                    <p className="subtitle">Track expiring batches of medicines directly on a calendar grid.</p>
                </div>
            </div>

            <div className="calendar-container">
                {/* Header Toolbar */}
                <div className="calendar-header-toolbar">
                    <div className="calendar-nav-buttons">
                        <button className="btn btn-secondary btn-small" onClick={handlePrevMonth} title="Previous Month">
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        <span className="calendar-title-display">
                            {monthNames[currentMonth]} {currentYear}
                        </span>
                        <button className="btn btn-secondary btn-small" onClick={handleNextMonth} title="Next Month">
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <button className="reset-system-date-btn" onClick={handleResetToToday} style={{ marginLeft: 0 }}>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                        Back to System Date
                    </button>
                </div>

                {/* Expiry Color Legend */}
                <div className="calendar-legend-bar">
                    <div className="legend-item">
                        <div className="legend-color-dot expired"></div>
                        <span>Expired</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color-dot expiring-soon"></div>
                        <span>Expiring Soon (≤20 Days)</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color-dot safe"></div>
                        <span>Safe (No urgent expiry)</span>
                    </div>
                </div>

                {/* Grid */}
                <div className="calendar-grid-container">
                    <div className="calendar-weekdays-header">
                        {weekdays.map(day => (
                            <div key={day}>{day}</div>
                        ))}
                    </div>

                    <div className="calendar-days-grid">
                        {cells.map((cell, idx) => {
                            // Calculate full date for this cell
                            let cellYear = currentYear;
                            let cellMonth = currentMonth + cell.monthOffset;
                            if (cellMonth < 0) {
                                cellMonth = 11;
                                cellYear -= 1;
                            } else if (cellMonth > 11) {
                                cellMonth = 0;
                                cellYear += 1;
                            }

                            const cellDateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;

                            // Filter medicines expiring on this specific date
                            const expMeds = medicines.filter(m => {
                                if (m.status === 'Inactive') return false;
                                return getLocalDateString(m.expiryDate) === cellDateStr;
                            });

                            // Calculate cell urgency class
                            let cellUrgency = '';
                            if (expMeds.length > 0) {
                                const daysList = expMeds.map(m => calculateDaysDifference(simulatedDate, m.expiryDate));
                                if (daysList.some(d => d < 0)) {
                                    cellUrgency = 'cell-expired';
                                } else if (daysList.some(d => d <= 20)) {
                                    cellUrgency = 'cell-expiring-soon';
                                } else {
                                    cellUrgency = 'cell-safe';
                                }
                            }

                            return (
                                <div 
                                    key={idx} 
                                    className={`calendar-day-cell ${!cell.isCurrentMonth ? 'outside-month' : ''} ${isToday(cell.day, cell.isCurrentMonth) ? 'is-today' : ''} ${cellUrgency}`}
                                >
                                    <span className="calendar-day-number">{cell.day}</span>
                                    
                                    <div className="calendar-expiries-list">
                                        {expMeds.map(med => {
                                            const days = calculateDaysDifference(simulatedDate, med.expiryDate);
                                            
                                            let urgencyClass = 'safe';
                                            let icon = 'fa-shield-halved';
                                            if (days < 0) {
                                                urgencyClass = 'expired';
                                                icon = 'fa-triangle-exclamation';
                                            } else if (days <= 20) {
                                                urgencyClass = 'expiring-soon';
                                                icon = 'fa-hourglass-half';
                                            }

                                            return (
                                                <div 
                                                    key={med.id} 
                                                    className={`calendar-expiry-item ${urgencyClass}`}
                                                    title={`${med.name} (${med.batch})`}
                                                    onClick={() => setSelectedMed(med)}
                                                >
                                                    <i className={`fa-solid ${icon}`} style={{ marginRight: '4px' }}></i>
                                                    {med.name}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Quick View Modal */}
            {selectedMed && (
                <div className="calendar-quick-view-modal" onClick={() => setSelectedMed(null)}>
                    <div className={`quick-view-card border-${calculateDaysDifference(simulatedDate, selectedMed.expiryDate) < 0 ? 'expired' : calculateDaysDifference(simulatedDate, selectedMed.expiryDate) <= 20 ? 'expiring-soon' : 'safe'}`} onClick={(e) => e.stopPropagation()}>
                        <div className="quick-view-header">
                            <div>
                                <h3>{selectedMed.name}</h3>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {selectedMed._id || selectedMed.id}</span>
                            </div>
                            <button className="quick-view-close-btn" onClick={() => setSelectedMed(null)}>&times;</button>
                        </div>
                        
                        <div className="quick-view-body">
                            <div className="quick-view-row">
                                <span>Batch Number</span>
                                <span><code>{selectedMed.batch}</code></span>
                            </div>
                            <div className="quick-view-row">
                                <span>Category</span>
                                <span>{selectedMed.category}</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Expiry Date</span>
                                <span>{formatDateDisplay(selectedMed.expiryDate)}</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Days Left</span>
                                <span style={{ 
                                    color: calculateDaysDifference(simulatedDate, selectedMed.expiryDate) < 0 
                                        ? 'var(--danger)' 
                                        : calculateDaysDifference(simulatedDate, selectedMed.expiryDate) <= 20 
                                            ? 'var(--warning)' 
                                            : 'var(--success)'
                                }}>
                                    {calculateDaysDifference(simulatedDate, selectedMed.expiryDate) < 0 
                                        ? `Expired (${Math.abs(calculateDaysDifference(simulatedDate, selectedMed.expiryDate))}d ago)` 
                                        : `${calculateDaysDifference(simulatedDate, selectedMed.expiryDate)} Days`
                                    }
                                </span>
                            </div>
                            <div className="quick-view-row">
                                <span>Quantity Left</span>
                                <span>{selectedMed.quantity} units</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Retail Price (MRP)</span>
                                <span>₹{selectedMed.price.toFixed(2)}</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Purchase Rate (PTR)</span>
                                <span>₹{(selectedMed.ptr || 0).toFixed(2)}</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Stockist / Distributor</span>
                                <span>{selectedMed.stockistName || 'None'}</span>
                            </div>
                            <div className="quick-view-row">
                                <span>Product Status</span>
                                <span>{selectedMed.status}</span>
                            </div>
                        </div>

                        <div className="quick-view-footer">
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => {
                                    setEditModalOpen(true, selectedMed);
                                    setSelectedMed(null);
                                }}
                            >
                                <i className="fa-solid fa-pen-to-square"></i> Edit Product
                            </button>
                            <button 
                                className="btn btn-primary" 
                                onClick={() => {
                                    setSelectedMed(null);
                                }}
                            >
                                Close View
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
