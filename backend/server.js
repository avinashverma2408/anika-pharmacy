require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { startExpiryChecker } = require('./utils/expiryChecker');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
    origin: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
        next();
    });
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth.routes'));
app.use('/api/medicines',     require('./routes/medicine.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
// Dashboard stats reuse notification controller under a separate prefix
app.use('/api/dashboard',     require('./routes/notification.routes'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Anika Pharmacy API is running',
        timestamp: new Date().toISOString(),
        db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ── MongoDB Connection & Seeding ─────────────────────────────────────────────
let mongoServer;

async function autoSeedIfNeeded() {
    try {
        const User = require('./models/User');

        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log('🌱 No users found. Seeding initial admin user...');
            const ADMIN = {
                email: 'admin@anika.com',
                passwordHash: 'admin123',  // will be bcrypt-hashed by pre-save hook
                role: 'admin'
            };

            const admin = await User.create(ADMIN);
            console.log(`👤 Admin created: ${admin.email} (password: admin123)`);
        } else {
            console.log('✅ Database already contains user data. Skipping seeding.');
        }
    } catch (err) {
        console.error('❌ Database seeding failed:', err.message);
    }
}

async function startServer() {
    try {
        let mongoUri = process.env.MONGO_URI;

        if (!mongoUri || mongoUri.includes('your_mongodb_atlas_connection_string_here') || mongoUri.trim() === '') {
            console.log('ℹ️ No valid MONGO_URI found in environment. Starting in-memory MongoDB server...');
            const { MongoMemoryServer } = require('mongodb-memory-server');
            mongoServer = await MongoMemoryServer.create();
            mongoUri = mongoServer.getUri();
            console.log(`📡 In-Memory MongoDB Server started at: ${mongoUri}`);
        }

        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB connected successfully');

        // Auto-seed database if running in-memory or database is empty
        await autoSeedIfNeeded();

        // Start daily expiry cron job
        startExpiryChecker();

        // Start Express app listening
        const server = app.listen(PORT, () => {
            console.log(`🚀 Anika Pharmacy Backend running on http://localhost:${PORT}`);
            console.log(`📋 API Docs: http://localhost:${PORT}/api/health`);
        });

        // Graceful shutdown helper
        const gracefulShutdown = async () => {
            console.log('\nShutting down backend server...');
            server.close(async () => {
                console.log('HTTP server closed.');
                if (mongoose.connection) {
                    await mongoose.connection.close();
                    console.log('🔌 MongoDB connection closed.');
                }
                if (mongoServer) {
                    await mongoServer.stop();
                    console.log('🛑 In-Memory MongoDB Server stopped.');
                }
                process.exit(0);
            });
        };

        process.on('SIGINT', gracefulShutdown);
        process.on('SIGTERM', gracefulShutdown);

    } catch (err) {
        console.error('❌ Server startup failed:', err.message);
        if (mongoServer) await mongoServer.stop();
        process.exit(1);
    }
}

startServer();
