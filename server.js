const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");

require("./db");

const app = express();
app.use(express.json());
app.use(cors());

const ADMIN_EMAIL = "admin@skyroxgym.com";
const ADMIN_PASSWORD = "admin123";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["client", "admin"], default: "client" },
    phone: { type: String, default: "" },
    plan: { type: String, default: "" },
    subscriptionStart: { type: Date, default: null },
    subscriptionEnd: { type: Date, default: null },
    admissionDate: { type: Date, default: null },
    isAdmitted: { type: Boolean, default: false }
}, {
    timestamps: true
});

const User = mongoose.model("User", userSchema);

function serializeUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        plan: user.plan,
        isAdmitted: user.isAdmitted,
        subscriptionStart: user.subscriptionStart,
        subscriptionEnd: user.subscriptionEnd,
        admissionDate: user.admissionDate,
        createdAt: user.createdAt
    };
}

async function ensureAdminUser() {
    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) return;

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await User.create({
        name: "Skyro-X Admin",
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin"
    });

    console.log(`Admin ready: ${ADMIN_EMAIL}`);
}

function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getAdminFromHeader(req) {
    const adminEmail = req.headers["x-admin-email"];
    if (!adminEmail) return null;

    const adminUser = await User.findOne({ email: String(adminEmail).trim().toLowerCase() });
    return adminUser && adminUser.role === "admin" ? adminUser : null;
}

/* 🔥 ROOT ROUTE (FIX FOR CANNOT GET /) */
app.get("/", (req, res) => {
    res.send("SkyroX Gym Backend is Running 🚀");
});

/* REGISTER */
app.post("/register", async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            return res.status(400).json({ message: "User already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: phone.trim()
        });

        res.json({ message: "User registered", user: serializeUser(user) });

    } catch (err) {
        res.status(500).json({ message: "Registration error" });
    }
});

/* LOGIN */
app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email?.trim().toLowerCase() });

        if (!user) return res.status(400).json({ message: "User not found" });

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(400).json({ message: "Wrong password" });

        res.json({ message: "Login success", user: serializeUser(user) });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

/* GET USER */
app.get("/user/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email.trim().toLowerCase() });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ user: serializeUser(user) });

    } catch (err) {
        res.status(500).json({ message: "Error fetching user" });
    }
});

/* START SERVER (FIXED PORT) */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

/* ENSURE ADMIN */
mongoose.connection.once("open", async () => {
    try {
        await ensureAdminUser();
    } catch (err) {
        console.error(err);
    }
});