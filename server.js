// ================================
// Women Legal Chatbot - Production Server
// ================================

require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const csv = require("csv-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const stringSimilarity = require("string-similarity");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

// ============================
// 🔐 Security Middlewares
// ============================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40,
  message: { reply: "Too many requests. Please slow down." }
});
app.use("/chat", limiter);

// ============================
// 🔹 Basic Middlewares
// ============================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

// ============================
// 🔹 MongoDB
// ============================
const mongoUri =
  process.env.MONGO_URI ||
  "mongodb://127.0.0.1:27017/women_legal_db";

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ Mongo Error:", err));

// ============================
// 🔹 User Schema
// ============================
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    resetToken: String,
    resetTokenExpiry: Date
  })
);

// ============================
// 🔹 Email Transporter
// ============================
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// ============================
// 🔹 Signup
// ============================
app.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ error: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashed }).save();

    res.json({ message: "User registered successfully" });
  } catch (err) {
    res.status(500).json({ error: "Signup error" });
  }
});

// ============================
// 🔹 Login
// ============================
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ error: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid password" });

    res.json({ message: "Login successful", name: user.name });
  } catch {
    res.status(500).json({ error: "Login error" });
  }
});

// ============================
// 🔹 Forgot Password
// ============================
app.post("/forgot-password", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user)
      return res.status(400).json({ error: "Email not found" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `http://localhost:5000/reset.html?token=${token}&email=${user.email}`;

    if (!process.env.SMTP_USER) {
      console.log("Reset Link:", resetLink);
      return res.json({
        message: "Reset link generated. Check server console."
      });
    }

    await transporter.sendMail({
      from: `"Women Legal Bot" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: "Password Reset",
      html: `<a href="${resetLink}">${resetLink}</a>`
    });

    res.json({ message: "Reset link sent" });
  } catch {
    res.status(500).json({ error: "Reset error" });
  }
});

// ============================
// 🔹 CSV Knowledge Base
// ============================
let legalData = [];

fs.createReadStream("legal_faq.csv")
  .pipe(csv())
  .on("data", (row) => {
    legalData.push({
      question: (row.question || "").toLowerCase(),
      answer: row.answer || "",
      law_reference: row.law_reference || ""
    });
  })
  .on("end", () =>
    console.log("✅ CSV Loaded:", legalData.length)
  );

// ============================
// 🔹 Gemini Setup
// ============================
const genAI = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null;

const userMemory = new Map();

// ============================
// 🔹 CHAT SYSTEM
// ============================
app.post("/chat", upload.none(), async (req, res) => {
  try {
    let message = req.body.message;
    const userId = req.ip;

    if (!message || message.trim().length < 2)
      return res.json({
        reply: "Please enter a valid question."
      });

    message = message.trim();

    // 🔹 Block nonsense inputs
    if (/^[a-z]{1,3}$/i.test(message))
      return res.json({
        reply:
          "Please ask a meaningful legal question."
      });

    // =========================
    // 🔹 SMART CSV MATCH
    // =========================
    if (legalData.length > 0) {
      const questions = legalData.map((q) => q.question);

      const match = stringSimilarity.findBestMatch(
        message.toLowerCase(),
        questions
      );

      if (match.bestMatch.rating > 0.65) {
        const found = legalData[match.bestMatchIndex];

        let reply = found.answer;
        if (found.law_reference)
          reply += `\n\n📘 Related Law: ${found.law_reference}`;

        return res.json({ reply });
      }
    }

    // =========================
    // 🔹 GEMINI AI FALLBACK
    // =========================
    if (!genAI)
      return res.json({
        reply: "AI service unavailable."
      });

    if (!userMemory.has(userId))
      userMemory.set(userId, []);

    const history = userMemory.get(userId);

    history.push({
      role: "user",
      parts: [{ text: message }]
    });

    if (history.length > 8)
      history.splice(0, history.length - 8);

    const model =
      genAI.getGenerativeModel({
        model: "gemini-1.5-flash"
      });

    const result =
      await model.generateContent({
        contents: history,
        systemInstruction: {
          parts: [
            {
              text: `You are an expert in Indian women's legal rights.
Provide accurate, law-based answers.
Be supportive and clear.`
            }
          ]
        }
      });

    const reply =
      result.response.text().trim() ||
      "Please rephrase your question.";

    history.push({
      role: "model",
      parts: [{ text: reply }]
    });

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      reply: "Server error while generating reply."
    });
  }
});

// ============================
// 🚀 START SERVER
// ============================
app.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Server running on http://localhost:5000");
});