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
    hasCompletedRegistration: { type: Boolean, default: false },
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
        hasCompletedRegistration: user.hasCompletedRegistration,
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
        if (!existingAdmin.hasCompletedRegistration) {
            existingAdmin.hasCompletedRegistration = true;
            await existingAdmin.save();
        }
        return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await User.create({
        name: "Skyro-X Admin",
        email: ADMIN_EMAIL,
        password: hashedPassword,
        role: "admin",
        hasCompletedRegistration: true
    });

    console.log(`Admin ready: ${ADMIN_EMAIL}`);
}

function normalizeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
}

function addMonths(baseDate, months) {
    const result = new Date(baseDate);
    result.setMonth(result.getMonth() + months);
    return result;
}

function createTemporaryPassword() {
    return `skyrox-${Math.random().toString(36).slice(2, 10)}`;
}

async function getAdminFromHeader(req) {
    const adminEmail = req.headers["x-admin-email"];
    if (!adminEmail) return null;

    const adminUser = await User.findOne({ email: normalizeEmail(adminEmail) });
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
        const normalizedPhone = phone.trim();
        const existingMatches = await User.find({
            role: "client",
            $or: [
                { email: normalizedEmail },
                { phone: normalizedPhone }
            ]
        });

        const emailMatch = existingMatches.find((user) => user.email === normalizedEmail);
        const phoneMatch = existingMatches.find((user) => user.phone === normalizedPhone);

        if (emailMatch && phoneMatch && String(emailMatch._id) !== String(phoneMatch._id)) {
            return res.status(400).json({ message: "Email and phone are linked to different records. Please contact admin." });
        }

        const existingUser = emailMatch || phoneMatch;

        if (existingUser && existingUser.hasCompletedRegistration) {
            return res.status(400).json({ message: "User already exists." });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        if (existingUser) {
            existingUser.name = name.trim();
            existingUser.email = normalizedEmail;
            existingUser.phone = normalizedPhone;
            existingUser.password = hashedPassword;
            existingUser.role = "client";
            existingUser.hasCompletedRegistration = true;

            await existingUser.save();

            return res.json({
                message: "Existing gym record connected successfully.",
                user: serializeUser(existingUser)
            });
        }

        const user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            phone: normalizedPhone,
            hasCompletedRegistration: true
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

        if (!user.hasCompletedRegistration) {
            user.hasCompletedRegistration = true;
            await user.save();
        }

        res.json({ message: "Login success", user: serializeUser(user) });

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
});

/* GET USER */
app.get("/user/:email", async (req, res) => {
    try {
        const user = await User.findOne({ email: normalizeEmail(req.params.email) });

        if (!user) return res.status(404).json({ message: "User not found" });

        res.json({ user: serializeUser(user) });

    } catch (err) {
        res.status(500).json({ message: "Error fetching user" });
    }
});

app.post("/admission", async (req, res) => {
    try {
        const { email, phone, plan, subscriptionStart, subscriptionEnd, admissionDate } = req.body;

        if (!email || !phone || !plan || !subscriptionStart || !subscriptionEnd) {
            return res.status(400).json({ message: "All admission fields are required." });
        }

        const user = await User.findOne({ email: normalizeEmail(email) });

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

        res.json({ message: "Admission saved successfully.", user: serializeUser(user) });
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

        const members = await User.find({ role: "client" }).sort({ createdAt: -1, admissionDate: -1 });

        res.json({
            members: members.map((member) => ({
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

        const { name, email, phone, password, plan, subscriptionStart, subscriptionEnd, admissionDate } = req.body;

        if (!name || !email || !phone || !plan || !subscriptionStart || !subscriptionEnd || !admissionDate) {
            return res.status(400).json({ message: "All member fields are required." });
        }

        const normalizedEmail = normalizeEmail(email);
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

            if (password && String(password).trim()) {
                existingUser.password = await bcrypt.hash(String(password).trim(), 10);
            }

            await existingUser.save();
            return res.json({ message: "Existing member updated successfully.", user: serializeUser(existingUser) });
        }

        const generatedPassword = password && String(password).trim()
            ? String(password).trim()
            : createTemporaryPassword();

        const hashedPassword = await bcrypt.hash(generatedPassword, 10);

        const member = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            password: hashedPassword,
            role: "client",
            hasCompletedRegistration: false,
            phone: phone.trim(),
            plan: plan.trim(),
            subscriptionStart: startDate,
            subscriptionEnd: endDate,
            admissionDate: joinedDate,
            isAdmitted: true
        });

        res.json({ message: "Member added successfully.", user: serializeUser(member) });
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

        const member = await User.findOne({ email: normalizeEmail(req.params.email), role: "client" });

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

app.patch("/admin/members/:email/extend", async (req, res) => {
    try {
        const adminUser = await getAdminFromHeader(req);

        if (!adminUser) {
            return res.status(401).json({ message: "Admin access required." });
        }

        const months = Number(req.body?.months);

        if (![1, 3, 6, 12].includes(months)) {
            return res.status(400).json({ message: "Invalid extension plan." });
        }

        const member = await User.findOne({ email: normalizeEmail(req.params.email), role: "client" });

        if (!member) {
            return res.status(404).json({ message: "Member not found." });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const startBase = member.subscriptionEnd && member.subscriptionEnd >= today
            ? new Date(member.subscriptionEnd)
            : today;

        member.subscriptionStart = member.subscriptionStart || today;
        member.subscriptionEnd = addMonths(startBase, months);
        member.plan = `${months} ${months === 1 ? "Month" : "Months"}`;
        member.isAdmitted = true;

        if (!member.admissionDate) {
            member.admissionDate = today;
        }

        await member.save();

        res.json({ message: `Subscription extended by ${months} month${months === 1 ? "" : "s"}.`, user: serializeUser(member) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not extend subscription." });
    }
});

app.patch("/admin/profile", async (req, res) => {
    try {
        const adminUser = await getAdminFromHeader(req);

        if (!adminUser) {
            return res.status(401).json({ message: "Admin access required." });
        }

        const { name, email, currentPassword, newPassword } = req.body;

        if (!currentPassword) {
            return res.status(400).json({ message: "Current password is required." });
        }

        const currentMatches = await bcrypt.compare(currentPassword, adminUser.password);

        if (!currentMatches) {
            return res.status(400).json({ message: "Current password is incorrect." });
        }

        if (name) {
            adminUser.name = String(name).trim();
        }

        if (email) {
            const normalizedEmail = normalizeEmail(email);
            const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: adminUser._id } });

            if (existingUser) {
                return res.status(400).json({ message: "Email is already in use." });
            }

            adminUser.email = normalizedEmail;
        }

        if (newPassword && String(newPassword).trim()) {
            adminUser.password = await bcrypt.hash(String(newPassword).trim(), 10);
        }

        await adminUser.save();

        res.json({ message: "Admin profile updated successfully.", user: serializeUser(adminUser) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Could not update admin profile." });
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
