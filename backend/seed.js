/**
 * Seed script — creates the initial admin user + sample medicines in MongoDB
 * Run: node backend/seed.js
 *
 * NOTE: Set MONGO_URI in backend/.env before running!
 */
require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const Medicine = require('./models/Medicine');

const today = new Date();
const addDays = (d) => { const dt = new Date(today); dt.setDate(dt.getDate() + d); return dt; };

const ADMIN = {
    email: 'admin@anika.com',
    passwordHash: 'admin123',  // will be bcrypt-hashed by pre-save hook
    role: 'admin'
};

const MEDICINES = [
    { name: 'Paracetamol 500mg (Crocin)',    category: 'Tablet',  batch: 'PR-102', price: 15,   quantity: 120, expiryDate: addDays(20),  status: 'Active' },
    { name: 'Amoxicillin 250mg Capsules',    category: 'Tablet',  batch: 'AM-204', price: 120,  quantity: 80,  expiryDate: addDays(7),   status: 'Active' },
    { name: 'Cough Syrup Pediatric (Benadryl)', category: 'Syrup', batch: 'CS-880', price: 65,  quantity: 0,   expiryDate: addDays(45),  status: 'Out of Stock' },
    { name: 'Influenza Vaccine (Flu Shield)', category: 'Vaccine', batch: 'FV-901', price: 850, quantity: 15,  expiryDate: addDays(0),   status: 'Active' },
    { name: 'Vitamin C Chewable (Limcee)',   category: 'Tablet',  batch: 'VC-304', price: 40,   quantity: 300, expiryDate: addDays(120), status: 'Active' },
    { name: 'Metformin 500mg',               category: 'Tablet',  batch: 'MF-501', price: 35,   quantity: 200, expiryDate: addDays(90),  status: 'Active' },
    { name: 'Azithromycin 250mg',            category: 'Tablet',  batch: 'AZ-301', price: 180,  quantity: 50,  expiryDate: addDays(3),   status: 'Active' },
    { name: 'Betadine Antiseptic Solution',  category: 'Other',   batch: 'BD-601', price: 95,   quantity: 30,  expiryDate: addDays(180), status: 'Active' },
    { name: 'Insulin Regular (Humulin)',     category: 'Injection',batch: 'IN-101', price: 450, quantity: 20,  expiryDate: addDays(-5),  status: 'Active' },
    { name: 'Calamine Lotion',               category: 'Ointment', batch: 'CL-401', price: 55,  quantity: 45,  expiryDate: addDays(300), status: 'Active' }
];

async function seed() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB connected');

    // Clear existing data
    await User.deleteMany({});
    await Medicine.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const admin = await User.create(ADMIN);
    console.log(`👤 Admin created: ${admin.email} (password: admin123)`);

    // Create medicines
    const meds = await Medicine.insertMany(MEDICINES);
    console.log(`💊 ${meds.length} medicines seeded`);

    console.log('\n✅ Seed complete! You can now start the backend server.');
    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
});
