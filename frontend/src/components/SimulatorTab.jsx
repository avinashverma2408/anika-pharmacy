import React from 'react';
import { 
    usePharmacyStore, 
    getLocalDateString, 
    addDays, 
    formatDateDisplay 
} from '../store/usePharmacyStore';

export default function SimulatorTab() {
    const { 
        simulatedDate, 
        setSimulatedDate 
    } = usePharmacyStore();

    // Time Travel Shortcuts
    const handleResetToday = () => {
        const todayStr = getLocalDateString(new Date());
        setSimulatedDate(todayStr);
    };

    const handleForward7 = () => {
        const newDate = addDays(simulatedDate, 7);
        setSimulatedDate(newDate);
    };

    const handleForward20 = () => {
        const newDate = addDays(simulatedDate, 20);
        setSimulatedDate(newDate);
    };


    return (
        <section id="tab-simulator" className="tab-pane active">
            <div className="page-header">
                <h2>Notification Expiry Simulator</h2>
                <p className="subtitle">Simulate time and add mock medicines to test the alert mechanisms instantly.</p>
            </div>

            <div className="simulator-grid">
                {/* Card 1: Time Travel */}
                <div className="card-panel">
                    <div className="panel-header">
                        <div className="panel-title-group">
                            <i className="fa-solid fa-clock-rotate-left panel-icon text-primary"></i>
                            <h3>Simulated System Date</h3>
                        </div>
                    </div>
                    <div className="panel-content">
                        <p className="sim-description">Change the system date below to fast-forward into the future and see how the expiry warnings trigger on schedule.</p>
                        
                        <div className="form-group sim-date-group">
                            <label htmlFor="simulated-date-input">Set Current System Date</label>
                            <input 
                                type="date" 
                                id="simulated-date-input" 
                                value={simulatedDate}
                                onChange={(e) => setSimulatedDate(e.target.value)}
                            />
                        </div>

                        <div className="sim-quick-dates">
                            <button className="btn btn-outline btn-small" onClick={handleResetToday}>Reset to Today</button>
                            <button className="btn btn-outline btn-small" onClick={handleForward7}>Forward +7 Days</button>
                            <button className="btn btn-outline btn-small" onClick={handleForward20}>Forward +20 Days</button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Simulation Info Panel */}
            <div className="card-panel mt-4">
                <h3>How Expiry Notification Triggers Work</h3>
                <div className="rules-explanation-grid">
                    <div className="rule-box">
                        <span className="badge badge-warning">20 Days Before Expiry</span>
                        <p>Alerts the pharmacist that stock has 20 days of shelf life remaining. Useful to plan clearance sales, reorders, or returns to vendors.</p>
                    </div>
                    <div className="rule-box">
                        <span className="badge badge-danger">7 Days (1 Week) Before</span>
                        <p>Highly critical alert. Indicates the medicine is expiring next week. Usually placed on high warning or pulled to front shelves.</p>
                    </div>
                    <div className="rule-box font-red">
                        <span className="badge badge-critical">On the Expiry Day</span>
                        <p>Critical notice. The medicine must be immediately discarded or removed from sales inventory to prevent any accidental sale.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}
