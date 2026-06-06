import React, { useState, useEffect } from 'react';
import { usePharmacyStore, formatDateDisplay, showSimpleToast } from '../store/usePharmacyStore';

export default function BillingTab() {
    const {
        medicines,
        checkoutBill,
        isSavingMedicine
    } = usePharmacyStore();

    // Patient & Doctor Information
    const [patientName, setPatientName] = useState('');
    const [patientAddress, setPatientAddress] = useState('');
    const [doctorName, setDoctorName] = useState('');
    const [doctorReg, setDoctorReg] = useState('');
    const [discountPercent, setDiscountPercent] = useState(5);

    // Bill Items state
    const [billItems, setBillItems] = useState([]);
    
    // Auto-generated Bill Info
    const [invoiceNo, setInvoiceNo] = useState('');
    const [billDate, setBillDate] = useState('');
    const [billTime, setBillTime] = useState('');

    // Active Item Search/Add state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [selectedMed, setSelectedMed] = useState(null);
    const [billQty, setBillQty] = useState(1);
    const [billRate, setBillRate] = useState('');

    // Generate random invoice number on mount
    useEffect(() => {
        const randNo = 'AP/' + String(Math.floor(100000 + Math.random() * 900000));
        setInvoiceNo(randNo);

        const now = new Date();
        setBillDate(now.toISOString().slice(0, 10)); // YYYY-MM-DD
        setBillTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
    }, []);

    // Filter active & in-stock medicines on search query
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const query = searchQuery.toLowerCase();
        const filtered = medicines.filter(m => 
            m.status === 'Active' && 
            m.quantity > 0 &&
            (m.name.toLowerCase().includes(query) || m.batch.toLowerCase().includes(query))
        );
        setSearchResults(filtered);
    }, [searchQuery, medicines]);

    // Handle medicine selection
    const handleSelectMedicine = (med) => {
        setSelectedMed(med);
        setBillRate(med.price);
        setBillQty(1);
        setSearchQuery('');
        setSearchResults([]);
    };

    // Add selected item to the bill list
    const handleAddItem = (e) => {
        e.preventDefault();
        if (!selectedMed) return;

        if (billQty <= 0) {
            showSimpleToast('Invalid Quantity', 'Quantity must be at least 1.', 'danger');
            return;
        }

        if (billQty > selectedMed.quantity) {
            showSimpleToast(
                'Stock Insufficient', 
                `Only ${selectedMed.quantity} units of "${selectedMed.name}" are available in stock.`, 
                'danger'
            );
            return;
        }

        // Check if item already added
        const existsIndex = billItems.findIndex(item => item.medicine._id === selectedMed._id || item.medicine.id === selectedMed.id);
        if (existsIndex > -1) {
            showSimpleToast('Already Added', 'This medicine is already added to the bill. Edit or delete the existing row.', 'warning');
            return;
        }

        const itemAmount = billQty * parseFloat(billRate);

        setBillItems([
            ...billItems,
            {
                medicine: selectedMed,
                quantityBilled: parseInt(billQty),
                rateBilled: parseFloat(billRate),
                amount: itemAmount
            }
        ]);

        // Reset search states
        setSelectedMed(null);
        setBillRate('');
        setBillQty(1);
        setSearchQuery('');
    };

    // Remove item from bill
    const handleRemoveItem = (index) => {
        const updated = [...billItems];
        updated.splice(index, 1);
        setBillItems(updated);
    };

    // Calculations
    const subTotal = billItems.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = subTotal * (discountPercent / 100);
    const netTotal = subTotal - discountAmount;

    // Calculate tax summaries (inclusive GST)
    let totalTaxableValue = 0;
    let totalCGST = 0;
    let totalSGST = 0;

    billItems.forEach(item => {
        const itemDiscount = item.amount * (discountPercent / 100);
        const itemNet = item.amount - itemDiscount;
        const rate = item.medicine.gstRate || 5; // default 5%
        
        const taxable = itemNet / (1 + rate / 100);
        const cgst = taxable * (rate / 200);
        const sgst = taxable * (rate / 200);

        totalTaxableValue += taxable;
        totalCGST += cgst;
        totalSGST += sgst;
    });

    // Helper to reset bill form state after print/download
    const resetBillForm = () => {
        setBillItems([]);
        const randNo = 'AP/' + String(Math.floor(100000 + Math.random() * 900000));
        setInvoiceNo(randNo);
        const now = new Date();
        setBillDate(now.toISOString().slice(0, 10));
        setBillTime(now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }));
        
        // Clear patient and doctor states
        setPatientName('');
        setPatientAddress('');
        setDoctorName('');
        setDoctorReg('');
    };

    // Helper to generate PDF using html2canvas and jspdf directly
    const generatePDFDownload = () => {
        const element = document.querySelector('.invoice-print-wrapper');
        if (!element) return;

        // Temporarily activate the screen layout overrides on the element for pdf capture
        element.classList.add('pdf-generation-in-progress');

        // Allow 150ms for browser layout and font rendering
        setTimeout(() => {
            Promise.all([
                import('html2canvas'),
                import('jspdf')
            ]).then(([html2canvasModule, jsPDFModule]) => {
                const html2canvas = html2canvasModule.default || html2canvasModule;
                const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;

                html2canvas(element, {
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff'
                }).then((canvas) => {
                    const imgData = canvas.toDataURL('image/jpeg', 0.95);
                    const pdf = new jsPDF('p', 'mm', 'a4');
                    const imgWidth = 210; // A4 width in mm
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;
                    
                    pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
                    pdf.save(`Invoice-${invoiceNo}.pdf`);

                    // Cleanup and reset
                    element.classList.remove('pdf-generation-in-progress');
                    resetBillForm();
                    showSimpleToast('Success', 'Invoice downloaded successfully!', 'success');
                }).catch((err) => {
                    console.error('Canvas capture failed:', err);
                    element.classList.remove('pdf-generation-in-progress');
                    showSimpleToast('PDF Error', 'Failed to capture invoice canvas.', 'danger');
                });
            }).catch((err) => {
                console.error('Failed to load libraries:', err);
                element.classList.remove('pdf-generation-in-progress');
                showSimpleToast('Library Error', 'Failed to load PDF libraries.', 'danger');
            });
        }, 150);
    };

    // Handle checkout and print/download
    const handleGenerateInvoice = async (mode = 'print') => {
        if (billItems.length === 0) {
            showSimpleToast('Empty Bill', 'Please add at least one medicine to the bill.', 'danger');
            return;
        }

        // Call checkout action to deduct stock
        const success = await checkoutBill(billItems);
        if (success) {
            if (mode === 'print') {
                // Trigger browser print
                setTimeout(() => {
                    window.print();
                    resetBillForm();
                }, 300);
            } else if (mode === 'download') {
                // Trigger download
                generatePDFDownload();
            }
        }
    };

    return (
        <section id="tab-billing" className="tab-pane active">
            {/* Screen View */}
            <div className="no-print">
                <div className="page-header">
                    <h2>GST Billing &amp; Invoicing</h2>
                    <p className="subtitle">Search medicines, add patient/doctor details, compile invoice, and print receipts.</p>
                </div>

                <div className="details-grid">
                    {/* Left Panel: Invoice metadata */}
                    <div className="details-card card-panel">
                        <h3 className="analytics-section-title"><i className="fa-solid fa-file-invoice"></i> Invoice Details</h3>
                        <div className="modal-form" style={{ padding: 0 }}>
                            <div className="form-grid" style={{ marginBottom: '16px' }}>
                                <div className="form-group">
                                    <label>Invoice Number</label>
                                    <input type="text" value={invoiceNo} disabled style={{ opacity: 0.7 }} />
                                </div>
                                <div className="form-group">
                                    <label>Bill Issue Date &amp; Time</label>
                                    <input type="text" value={`${billDate} ${billTime}`} disabled style={{ opacity: 0.7 }} />
                                </div>
                                <div className="form-group">
                                    <label>Patient Name</label>
                                    <input 
                                        type="text" 
                                        value={patientName} 
                                        onChange={(e) => setPatientName(e.target.value)} 
                                        placeholder="Enter Patient Name"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Patient Address</label>
                                    <input 
                                        type="text" 
                                        value={patientAddress} 
                                        onChange={(e) => setPatientAddress(e.target.value)} 
                                        placeholder="Enter Address"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Dr Name</label>
                                    <input 
                                        type="text" 
                                        value={doctorName} 
                                        onChange={(e) => setDoctorName(e.target.value)} 
                                        placeholder="Enter Prescribing Doctor"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Dr Reg No.</label>
                                    <input 
                                        type="text" 
                                        value={doctorReg} 
                                        onChange={(e) => setDoctorReg(e.target.value)} 
                                        placeholder="Dr. Reg Number"
                                    />
                                </div>
                            </div>
                        </div>

                        <hr className="details-divider" />

                        {/* Search & Add Items form */}
                        <h3 className="analytics-section-title" style={{ marginTop: '20px' }}><i className="fa-solid fa-cart-plus"></i> Search &amp; Add Medicines</h3>
                        <div className="form-group" style={{ position: 'relative', marginBottom: '16px' }}>
                            <label>Search Medicine (Name / Batch)</label>
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Type to search medicine..."
                            />
                            {/* Autocomplete Dropdown */}
                            {searchResults.length > 0 && (
                                <ul className="billing-search-results">
                                    {searchResults.map(med => (
                                        <li key={med._id || med.id} onClick={() => handleSelectMedicine(med)}>
                                            <div style={{ fontWeight: '600' }}>{med.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                Batch: {med.batch} | Exp: {formatDateDisplay(med.expiryDate)} | Price: ₹{med.price.toFixed(2)} | Avail: {med.quantity}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {selectedMed && (
                            <form onSubmit={handleAddItem} className="modal-form" style={{ padding: 0 }}>
                                <div className="billing-selected-item-info">
                                    <strong>Selected:</strong> {selectedMed.name} <span className="category-label">{selectedMed.category}</span>
                                    <div className="timeline-desc-text" style={{ marginTop: '4px' }}>
                                        Batch: {selectedMed.batch} | Expiry: {formatDateDisplay(selectedMed.expiryDate)} | Available Stock: {selectedMed.quantity} units
                                    </div>
                                </div>

                                <div className="form-grid" style={{ marginTop: '12px' }}>
                                    <div className="form-group">
                                        <label>Billing Qty (Units)</label>
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max={selectedMed.quantity}
                                            required
                                            value={billQty}
                                            onChange={(e) => setBillQty(parseInt(e.target.value))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Unit Rate / MRP (₹)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            required
                                            value={billRate}
                                            onChange={(e) => setBillRate(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button type="submit" className="btn btn-primary w-full" style={{ marginTop: '12px' }}>
                                    <i className="fa-solid fa-plus"></i> Add Item to Bill
                                </button>
                            </form>
                        )}
                    </div>

                    {/* Right Panel: Bill Summary & Actions */}
                    <div className="details-analytics">
                        <div className="details-card card-panel">
                            <h3 className="analytics-section-title"><i className="fa-solid fa-receipt"></i> Current Invoice Items</h3>
                            <div className="table-container" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Batch</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Amount</th>
                                            <th className="text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {billItems.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No items added yet.</td>
                                            </tr>
                                        ) : (
                                            billItems.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td><strong>{item.medicine.name}</strong></td>
                                                    <td><code>{item.medicine.batch}</code></td>
                                                    <td>{item.quantityBilled}</td>
                                                    <td>₹{item.rateBilled.toFixed(2)}</td>
                                                    <td>₹{item.amount.toFixed(2)}</td>
                                                    <td className="text-right">
                                                        <button 
                                                            type="button" 
                                                            className="btn-icon-only delete" 
                                                            title="Remove Item"
                                                            onClick={() => handleRemoveItem(idx)}
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Bill calculations summary card */}
                        <div className="details-card card-panel">
                            <h3 className="analytics-section-title"><i className="fa-solid fa-chart-simple"></i> Bill Calculation</h3>
                            
                            <div className="valuation-stats-list">
                                <div className="val-stat-item">
                                    <span className="val-stat-label">Subtotal</span>
                                    <span className="val-stat-value">₹{subTotal.toFixed(2)}</span>
                                </div>
                                <div className="val-stat-item" style={{ alignItems: 'center' }}>
                                    <span className="val-stat-label">Discount (%)</span>
                                    <input 
                                        type="number" 
                                        min="0" 
                                        max="100" 
                                        value={discountPercent} 
                                        onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                                        style={{ 
                                            width: '80px', 
                                            padding: '4px 8px', 
                                            background: 'var(--bg-input)', 
                                            color: 'var(--text-primary)', 
                                            border: '1px solid var(--border-color)', 
                                            borderRadius: '6px',
                                            textAlign: 'right'
                                        }} 
                                    />
                                </div>
                                <div className="val-stat-item">
                                    <span className="val-stat-label">Discount Amount</span>
                                    <span className="val-stat-value">₹{discountAmount.toFixed(2)}</span>
                                </div>
                                <div className="val-stat-item">
                                    <span className="val-stat-label">Calculated Taxable Value</span>
                                    <span className="val-stat-value">₹{totalTaxableValue.toFixed(2)}</span>
                                </div>
                                <div className="val-stat-item">
                                    <span className="val-stat-label">CGST (Tax breakdown)</span>
                                    <span className="val-stat-value">₹{totalCGST.toFixed(2)}</span>
                                </div>
                                <div className="val-stat-item">
                                    <span className="val-stat-label">SGST (Tax breakdown)</span>
                                    <span className="val-stat-value">₹{totalSGST.toFixed(2)}</span>
                                </div>
                                <div className="val-stat-item total-profit-item">
                                    <span className="val-stat-label">Grand Total (Net)</span>
                                    <span className="val-stat-value text-primary-color font-large">₹{netTotal.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="billing-actions-group" style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                <button 
                                    type="button" 
                                    className="btn btn-primary" 
                                    style={{ padding: '12px', flex: 1 }}
                                    disabled={billItems.length === 0 || isSavingMedicine}
                                    onClick={() => handleGenerateInvoice('print')}
                                >
                                    {isSavingMedicine ? (
                                        <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                                    ) : (
                                        <><i className="fa-solid fa-print"></i> Print Bill</>
                                    )}
                                </button>
                                
                                <button 
                                    type="button" 
                                    className="btn btn-secondary" 
                                    style={{ padding: '12px', flex: 1 }}
                                    disabled={billItems.length === 0 || isSavingMedicine}
                                    onClick={() => handleGenerateInvoice('download')}
                                >
                                    {isSavingMedicine ? (
                                        <><i className="fa-solid fa-spinner fa-spin"></i> Saving...</>
                                    ) : (
                                        <><i className="fa-solid fa-file-pdf"></i> Download PDF</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Layout: Styled like Bionica Pharmacy Receipt, hidden on screen */}
            <div className="print-only invoice-print-wrapper">
                <div className="print-header">
                    <div className="print-header-left">
                        <h1 className="print-brand">ANIKA PHARMACY</h1>
                        <p className="print-brand-address">Pandeybaba bazar, Kadipur Road</p>
                        <p className="print-brand-address">Sultanpur, UP - 228145</p>
                        <p className="print-brand-contact">Phone : 9795358689, 6386470668</p>
                        <p className="print-brand-contact">E-Mail : vikaskr.verma27@gmail.com</p>
                        <p className="print-brand-gstin">GSTIN : [GSTIN Number]</p>
                        <p className="print-brand-dl">D.L.No. : [D.L. Number]</p>
                    </div>
                    <div className="print-header-right">
                        <div className="print-invoice-title">GST INVOICE</div>
                        <div className="print-invoice-copy">Original for Buyer</div>
                    </div>
                </div>

                <div className="print-meta-grid">
                    <div className="meta-col">
                        <div><strong>Patient Name :</strong> {patientName.toUpperCase()}</div>
                        <div><strong>Patient Address :</strong> {patientAddress}</div>
                    </div>
                    <div className="meta-col">
                        <div><strong>Dr Name :</strong> {doctorName.toUpperCase()}</div>
                        <div><strong>Dr Reg No. :</strong> {doctorReg}</div>
                    </div>
                    <div className="meta-col text-right">
                        <div><strong>Invoice No. :</strong> {invoiceNo}</div>
                        <div><strong>Date :</strong> {billDate.split('-').reverse().join('-')}</div>
                        <div><strong>BILL ISSUE TIME :</strong> {billTime}</div>
                    </div>
                </div>

                <table className="print-table">
                    <thead>
                        <tr>
                            <th style={{ width: '4%' }}>SN</th>
                            <th style={{ width: '38%' }}>PRODUCT NAME</th>
                            <th style={{ width: '8%' }}>PACK</th>
                            <th style={{ width: '10%' }}>HSN</th>
                            <th style={{ width: '10%' }}>BATCH</th>
                            <th style={{ width: '8%' }}>EXP</th>
                            <th style={{ width: '6%' }}>QTY</th>
                            <th style={{ width: '8%' }}>MRP</th>
                            <th style={{ width: '8%' }}>RATE</th>
                            <th style={{ width: '6%' }}>SGST</th>
                            <th style={{ width: '6%' }}>CGST</th>
                            <th style={{ width: '10%' }}>AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody>
                        {billItems.map((item, idx) => {
                            const rate = item.medicine.gstRate || 5;
                            const itemDiscount = item.amount * (discountPercent / 100);
                            const itemNet = item.amount - itemDiscount;
                            const taxable = itemNet / (1 + rate / 100);
                            const gstBreakdownPercent = rate / 2;

                            return (
                                <tr key={idx}>
                                    <td style={{ textAlign: 'center' }}>{idx + 1}</td>
                                    <td><strong>{item.medicine.name.toUpperCase()}</strong></td>
                                    <td style={{ textAlign: 'center' }}>{item.medicine.pack || '1*10'}</td>
                                    <td style={{ textAlign: 'center' }}>{item.medicine.hsn || 'N/A'}</td>
                                    <td style={{ textAlign: 'center' }}>{item.medicine.batch}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {item.medicine.expiryDate ? new Date(item.medicine.expiryDate).toLocaleDateString('en-US', {
                                            month: '2-digit', year: '2-digit'
                                        }).replace('/', '/') : ''}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>{item.quantityBilled}</td>
                                    <td style={{ textAlign: 'right' }}>{item.rateBilled.toFixed(2)}</td>
                                    <td style={{ textAlign: 'right' }}>{item.rateBilled.toFixed(2)}</td>
                                    <td style={{ textAlign: 'center' }}>{gstBreakdownPercent.toFixed(2)}%</td>
                                    <td style={{ textAlign: 'center' }}>{gstBreakdownPercent.toFixed(2)}%</td>
                                    <td style={{ textAlign: 'right' }}>{item.amount.toFixed(2)}</td>
                                </tr>
                            );
                        })}
                        {/* Empty padding rows to match receipt size */}
                        {Array.from({ length: Math.max(0, 10 - billItems.length) }).map((_, i) => (
                            <tr key={i} className="empty-row">
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                                <td>&nbsp;</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div className="print-footer-grid">
                    <div className="print-footer-left">
                        <div className="tax-summary-clause">
                            GST {totalTaxableValue.toFixed(2)} * {(discountPercent).toFixed(0)}% = {discountAmount.toFixed(2)} Discount
                        </div>
                        <div className="tax-summary-clause" style={{ marginTop: '4px', textTransform: 'uppercase' }}>
                            GST INCLUSIVE BREAKDOWN: Taxable Value: ₹{totalTaxableValue.toFixed(2)} | SGST: ₹{totalSGST.toFixed(2)} | CGST: ₹{totalCGST.toFixed(2)}
                        </div>
                        <div className="print-tc">
                            <h4>Terms &amp; Conditions</h4>
                            <p>Goods once sold will not be taken back or exchanged.</p>
                            <p className="print-salutation">** GET WELL SOON **</p>
                        </div>
                    </div>

                    <div className="print-footer-right">
                        <div className="summary-row">
                            <span>SUB TOTAL</span>
                            <span>{subTotal.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>Discount {discountPercent}%</span>
                            <span>{discountAmount.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>SGST</span>
                            <span>{totalSGST.toFixed(2)}</span>
                        </div>
                        <div className="summary-row">
                            <span>CGST</span>
                            <span>{totalCGST.toFixed(2)}</span>
                        </div>
                        <div className="summary-row grand-total">
                            <span>GRAND TOTAL</span>
                            <span>₹{netTotal.toFixed(2)}</span>
                        </div>
                        <div className="signature-box">
                            <div className="signature-line">Authorized Signatory</div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
