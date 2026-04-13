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

    if (existingAdmin) {
        return;
    }

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
    if (!value) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

async function getAdminFromHeader(req) {
    const adminEmail = req.headers["x-admin-email"];

    if (!adminEmail) {
        return null;
    }

    const adminUser = await User.findOne({ email: String(adminEmail).trim().toLowerCase() });
    return adminUser && adminUser.role === "admin" ? adminUser : null;
}

app.post("/register", async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        if (!name || !email || !password || !phone) {
            return res.status(400).json({ message: "Name, email, mobile number and password are required." });
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
            role: "client",
            phone: phone.trim()
        });

        res.json({
            message: "User registered successfully.",
            user: serializeUser(user)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Registration error." });
    }
});

app.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email: email?.trim().toLowerCase() });

        if (!user) {
            return res.status(400).json({ message: "User not found." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Wrong password." });
        }

        res.json({
            message: "Login success.",
            user: serializeUser(user)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error." });
    }
});

app.get("/user/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: req.params.email.trim().toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        res.json({ user: serializeUser(user) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not fetch user." });
    }
});

app.post("/admission", async (req, res) => {
    try {
        const { email, phone, plan, subscriptionStart, subscriptionEnd, admissionDate } = req.body;

        if (!email || !phone || !plan || !subscriptionStart || !subscriptionEnd) {
            return res.status(400).json({ message: "All admission fields are required." });
        }

        const user = await User.findOne({ email: email.trim().toLowerCase() });

        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }

        const startDate = normalizeDate(subscriptionStart);
        const endDate = normalizeDate(subscriptionEnd);
        const joinedDate = normalizeDate(admissionDate) || new Date();

        if (!startDate || !endDate) {
            return res.status(400).json({ message: "Invalid subscription dates." });
        }

        user.phone = phone.trim();
        user.plan = plan.trim();
        user.subscriptionStart = startDate;
        user.subscriptionEnd = endDate;
        user.admissionDate = joinedDate;
        user.isAdmitted = true;

        await user.save();

        res.json({
            message: "Admission saved successfully.",
            user: serializeUser(user)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Admission failed." });
    }
});

app.get("/members", async (req, res) => {
    try {
        const adminUser = await getAdminFromHeader(req);

        if (!adminUser) {
            return res.status(401).json({ message: "Admin access required." });
        }

        const members = await User.find({ role: "client" })
            .sort({ createdAt: -1, admissionDate: -1 });

        res.json({
            members: members.map(member => ({
                name: member.name,
                email: member.email,
                phone: member.phone,
                plan: member.plan,
                isAdmitted: member.isAdmitted,
                subscriptionStart: member.subscriptionStart,
                subscriptionEnd: member.subscriptionEnd,
                admissionDate: member.admissionDate,
                accountCreatedAt: member.createdAt
            }))
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not fetch members." });
    }
});

app.post("/admin/members", async (req, res) => {
    try {
        const adminUser = await getAdminFromHeader(req);

        if (!adminUser) {
            return res.status(401).json({ message: "Admin access required." });
        }

        const {
            name,
            email,
            phone,
            plan,
            subscriptionStart,
            subscriptionEnd,
            admissionDate
        } = req.body;

        if (!name || !email || !phone || !plan || !subscriptionStart || !subscriptionEnd || !admissionDate) {
            return res.status(400).json({ message: "All member fields are required." });
        }

        const normalizedEmail = email.trim().toLowerCase();
        const startDate = normalizeDate(subscriptionStart);
        const endDate = normalizeDate(subscriptionEnd);
        const joinedDate = normalizeDate(admissionDate);

        if (!startDate || !endDate || !joinedDate) {
            return res.status(400).json({ message: "Invalid member dates." });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });

        if (existingUser) {
            existingUser.name = name.trim();
            existingUser.phone = phone.trim();
            existingUser.plan = plan.trim();
            existingUser.subscriptionStart = startDate;
            existingUser.subscriptionEnd = endDate;
            existingUser.admissionDate = joinedDate;
            existingUser.isAdmitted = true;
            existingUser.role = "client";

            await existingUser.save();

            return res.json({
                message: "Existing member updated successfully.",
                user: serializeUser(existingUser)
            });
        }

        const tempPassword = await bcrypt.hash(`member-${Date.now()}`, 10);

        const member = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: tempPassword,
            role: "client",
            phone: phone.trim(),
            plan: plan.trim(),
            subscriptionStart: startDate,
            subscriptionEnd: endDate,
            admissionDate: joinedDate,
            isAdmitted: true
        });

        res.json({
            message: "Member added successfully.",
            user: serializeUser(member)
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not add member." });
    }
});

app.delete("/admin/members/:email", async (req, res) => {
    try {
        const adminUser = await getAdminFromHeader(req);

        if (!adminUser) {
            return res.status(401).json({ message: "Admin access required." });
        }

        const memberEmail = req.params.email?.trim().toLowerCase();
        const member = await User.findOne({ email: memberEmail, role: "client" });

        if (!member) {
            return res.status(404).json({ message: "Member not found." });
        }

        await User.deleteOne({ _id: member._id });

        res.json({ message: "Member removed successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not remove member." });
    }
});

mongoose.connection.once("open", async () => {
    try {
        await ensureAdminUser();
    } catch (err) {
        console.error("Failed to seed admin user", err);
    }
});

app.listen(5000, () => console.log("Server running on port 5000"));
