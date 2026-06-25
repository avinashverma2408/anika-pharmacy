require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { startExpiryChecker } = require("./utils/expiryChecker");

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:4173",
  "https://stirring-queijadas-445b92.netlify.app",
];
// In production, also allow any netlify.app subdomain
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        /\.netlify\.app$/.test(origin) ||
        process.env.NODE_ENV !== "production"
      ) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev)
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/medicines", require("./routes/medicine.routes"));
app.use("/api/notifications", require("./routes/notification.routes"));
// Dashboard stats reuse notification controller under a separate prefix
app.use("/api/dashboard", require("./routes/notification.routes"));
app.use("/api/bills", require("./routes/bill.routes"));

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Anika Pharmacy API is running",
    timestamp: new Date().toISOString(),
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// 404 handler
app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.path} not found.` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ── MongoDB Connection & Seeding ─────────────────────────────────────────────
let mongoServer;

async function autoSeedIfNeeded() {
  try {
    const User = require("./models/User");
    const Medicine = require("./models/Medicine");

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("🌱 No users found. Seeding initial admin user...");
      // Seed default admin accounts (email + password will be hashed by pre‑save hook)
      const DEFAULT_PASSWORD = "admin@123";

      const admins = [
        {
          email: "admin@anika.yopmail.com",
          passwordHash: DEFAULT_PASSWORD,
          role: "admin",
        },
        {
          email: "avinashverma2408@gmail.com",
          passwordHash: DEFAULT_PASSWORD,
          role: "admin",
        },
      ];

      // Create each admin if not already present (User.countDocuments was 0, so none exist)
      const createdAdmins = await User.create(admins);
      createdAdmins.forEach((u) =>
        console.log(
          `👤 Admin created: ${u.email} (password: ${DEFAULT_PASSWORD})`,
        ),
      );
    } else {
      console.log(
        "✅ Database already contains user data. Skipping user seeding.",
      );
    }

    const medCount = await Medicine.countDocuments();
    if (medCount === 0) {
      console.log("🌱 No medicines found. Seeding sample medicines...");
      const today = new Date();
      const addDays = (d) => {
        const dt = new Date(today);
        dt.setDate(dt.getDate() + d);
        return dt;
      };
      const MEDICINES = [
        {
          name: "Paracetamol 500mg (Crocin)",
          category: "Tablet",
          batch: "PR-102",
          price: 15,
          quantity: 120,
          expiryDate: addDays(20),
          status: "Active",
          stockistName: "Cipla Ltd",
          ptr: 10.5,
          hsn: "30045033",
          pack: "1*15",
          gstRate: 5,
          composition: "Paracetamol",
        },
        {
          name: "Amoxicillin 250mg Capsules",
          category: "Tablet",
          batch: "AM-204",
          price: 120,
          quantity: 80,
          expiryDate: addDays(7),
          status: "Active",
          stockistName: "Alkem Laboratories",
          ptr: 90.0,
          hsn: "300490",
          pack: "1*10",
          gstRate: 5,
          composition: "Amoxicillin",
        },
        {
          name: "Cough Syrup Pediatric (Benadryl)",
          category: "Syrup",
          batch: "CS-880",
          price: 65,
          quantity: 0,
          expiryDate: addDays(45),
          status: "Out of Stock",
          stockistName: "Abbott India",
          ptr: 48.0,
          hsn: "30049094",
          pack: "1*15",
          gstRate: 5,
          composition: "Diphenhydramine",
        },
        {
          name: "Influenza Vaccine (Flu Shield)",
          category: "Vaccine",
          batch: "FV-901",
          price: 850,
          quantity: 15,
          expiryDate: addDays(0),
          status: "Active",
          stockistName: "Serum Institute",
          ptr: 680.0,
          hsn: "3004",
          pack: "1*30",
          gstRate: 5,
          composition: "Influenza Vaccine",
        },
        {
          name: "Vitamin C Chewable (Limcee)",
          category: "Tablet",
          batch: "VC-304",
          price: 40,
          quantity: 300,
          expiryDate: addDays(120),
          status: "Active",
          stockistName: "Abbott India",
          ptr: 28.0,
          hsn: "30045033",
          pack: "1*15",
          gstRate: 5,
          composition: "Vitamin C",
        },
        {
          name: "Metformin 500mg",
          category: "Tablet",
          batch: "MF-501",
          price: 35,
          quantity: 200,
          expiryDate: addDays(90),
          status: "Active",
          stockistName: "Sun Pharma",
          ptr: 24.5,
          hsn: "30045033",
          pack: "1*10",
          gstRate: 5,
          composition: "Metformin",
        },
        {
          name: "Azithromycin 250mg",
          category: "Tablet",
          batch: "AZ-301",
          price: 180,
          quantity: 50,
          expiryDate: addDays(3),
          status: "Active",
          stockistName: "Cipla Ltd",
          ptr: 135.0,
          hsn: "30049011",
          pack: "1*10",
          gstRate: 5,
          composition: "Azithromycin",
        },
        {
          name: "Betadine Antiseptic Solution",
          category: "Other",
          batch: "BD-601",
          price: 95,
          quantity: 30,
          expiryDate: addDays(180),
          status: "Active",
          stockistName: "Win-Medicare",
          ptr: 72.0,
          hsn: "30049099",
          pack: "1*50GM",
          gstRate: 5,
          composition: "Povidone-Iodine",
        },
        {
          name: "Insulin Regular (Humulin)",
          category: "Injection",
          batch: "IN-101",
          price: 450,
          quantity: 20,
          expiryDate: addDays(-5),
          status: "Active",
          stockistName: "Lilly India",
          ptr: 360.0,
          hsn: "3004",
          pack: "1*10",
          gstRate: 5,
          composition: "Insulin",
        },
        {
          name: "Calamine Lotion",
          category: "Ointment",
          batch: "CL-401",
          price: 55,
          quantity: 45,
          expiryDate: addDays(300),
          status: "Active",
          stockistName: "Piramal Pharma",
          ptr: 41.25,
          hsn: "3004",
          pack: "1*10",
          gstRate: 5,
          composition: "Calamine",
        },
        {
          name: "Dolo 650mg Tablets",
          category: "Tablet",
          batch: "DO-650",
          price: 30,
          quantity: 150,
          expiryDate: addDays(60),
          status: "Active",
          stockistName: "Micro Labs",
          ptr: 20.0,
          hsn: "30045033",
          pack: "1*15",
          gstRate: 5,
          composition: "Paracetamol",
        },
        {
          name: "Calpol 500mg",
          category: "Tablet",
          batch: "CA-500",
          price: 16,
          quantity: 200,
          expiryDate: addDays(40),
          status: "Active",
          stockistName: "GSK India",
          ptr: 11.2,
          hsn: "30045033",
          pack: "1*15",
          gstRate: 5,
          composition: "Paracetamol",
        },
        {
          name: "Celin 500mg (Vitamin C)",
          category: "Tablet",
          batch: "CE-500",
          price: 38,
          quantity: 180,
          expiryDate: addDays(150),
          status: "Active",
          stockistName: "GSK India",
          ptr: 25.5,
          hsn: "30045033",
          pack: "1*25",
          gstRate: 5,
          composition: "Vitamin C",
        },
        {
          name: "Azee 500mg",
          category: "Tablet",
          batch: "AZ-500",
          price: 220,
          quantity: 60,
          expiryDate: addDays(30),
          status: "Active",
          stockistName: "Cipla Ltd",
          ptr: 165.0,
          hsn: "30049011",
          pack: "1*5",
          gstRate: 5,
          composition: "Azithromycin",
        },
        {
          name: "Glycomet 500mg",
          category: "Tablet",
          batch: "GL-500",
          price: 28,
          quantity: 250,
          expiryDate: addDays(110),
          status: "Active",
          stockistName: "USV Biotech",
          ptr: 19.6,
          hsn: "30045033",
          pack: "1*10",
          gstRate: 5,
          composition: "Metformin",
        },
      ];
      await Medicine.insertMany(MEDICINES);
      console.log(`💊 ${MEDICINES.length} medicines auto-seeded successfully.`);
    } else {
      console.log(
        "✅ Database already contains medicine data. Skipping medicine seeding.",
      );
    }
  } catch (err) {
    console.error("❌ Database seeding failed:", err.message);
  }
}

async function startServer() {
  try {
    let mongoUri = process.env.MONGO_URI;

    if (
      !mongoUri ||
      mongoUri.includes("your_mongodb_atlas_connection_string_here") ||
      mongoUri.trim() === ""
    ) {
      console.log(
        "ℹ️ No valid MONGO_URI found in environment. Starting in-memory MongoDB server...",
      );
      const { MongoMemoryServer } = require("mongodb-memory-server");
      mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log(`📡 In-Memory MongoDB Server started at: ${mongoUri}`);
    }

    await mongoose.connect(mongoUri);
    console.log("✅ MongoDB connected successfully");

    // Auto-seed database if running in-memory or database is empty
    await autoSeedIfNeeded();

    // Start daily expiry cron job
    startExpiryChecker();

    // Start Express app listening
    const server = app.listen(PORT, () => {
      console.log(
        `🚀 Anika Pharmacy Backend running on http://localhost:${PORT}`,
      );
      console.log(`📋 API Docs: http://localhost:${PORT}/api/health`);
    });

    // Graceful shutdown helper
    const gracefulShutdown = async () => {
      console.log("\nShutting down backend server...");
      server.close(async () => {
        console.log("HTTP server closed.");
        if (mongoose.connection) {
          await mongoose.connection.close();
          console.log("🔌 MongoDB connection closed.");
        }
        if (mongoServer) {
          await mongoServer.stop();
          console.log("🛑 In-Memory MongoDB Server stopped.");
        }
        process.exit(0);
      });
    };

    process.on("SIGINT", gracefulShutdown);
    process.on("SIGTERM", gracefulShutdown);
  } catch (err) {
    console.error("❌ Server startup failed:", err.message);
    if (mongoServer) await mongoServer.stop();
    process.exit(1);
  }
}

startServer();
