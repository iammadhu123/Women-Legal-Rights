// ================================
// Women Legal Chatbot - Server.js (with CSV + Gemini AI)
// ================================

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const fs = require("fs");
const csv = require("csv-parser");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const stringSimilarity = require("string-similarity");
require("dotenv").config();

const app = express();

// ✅ Allow CORS for frontend (for both PC and phone)
app.use(cors({
  origin: true, // allow all origins including null (file:// protocol)
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ✅ Serve static files from public directory
app.use(express.static('public'));

// ✅ Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// ✅ MongoDB Connection (use MONGO_URI from .env if provided)
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/women_legal_db";
mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  })
  .then(() => console.log("✅ MongoDB connected to", mongoUri))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// ✅ User Schema
const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  resetToken: String,
  resetTokenExpiry: Date
});
const User = mongoose.model("User", UserSchema);

// ✅ Gmail Transporter
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
  console.log("📝 Signup request:", req.body);
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields are required!" });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: "Email already exists!" });

    const hashedPass = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPass });
    await user.save();

    console.log("✅ User registered:", email);
    res.json({ message: "User registered successfully!" });
  } catch (err) {
    console.error("🔥 Signup error:", err.message);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// ============================
// 🔹 Login
// ============================
app.post("/login", async (req, res) => {
  console.log("📩 Login request:", req.body);
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required!" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    if (!user.password) {
      // defensive guard for malformed records
      console.warn("⚠️ User has no password hash", email);
      return res.status(500).json({ error: "Account not properly configured. Contact administrator." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid password!" });
    }

    console.log("✅ Login successful:", email);
    res.json({ message: "Login successful", name: user.name });
  } catch (err) {
    console.error("🔥 Login error:", err);
    res.status(500).json({ error: err.message || "Server error during login" });
  }
});

// ============================
// 🔹 Forgot Password
// ============================
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: "Email not found" });

    const token = crypto.randomBytes(32).toString("hex");
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `${
      process.env.FRONTEND_URL || "http://localhost:5000"
    }/reset.html?token=${token}&email=${encodeURIComponent(email)}`;

    // Check if SMTP is configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log("⚠️ SMTP not configured. Reset link:", resetLink);
      console.log("📧 For development: Copy this link to reset password:", resetLink);
      return res.json({
        message: "Password reset link generated! Check server console for the reset link (SMTP not configured for development)."
      });
    }

    await transporter.sendMail({
      from: `"Women Legal Bot" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Password Reset — Women Legal Rights",
      html: `<p>Click below to reset password (valid 1 hour):</p>
             <a href="${resetLink}">${resetLink}</a>`
    });

    console.log("✉️ Reset email sent:", email);
    res.json({ message: "Password reset link sent successfully!" });
  } catch (err) {
    console.error("🔥 Forgot-password error:", err.message);
    res.status(500).json({ error: "Server error in forgot-password" });
  }
});

// ============================
// 🔹 Validate Token
// ============================
app.get("/validate-reset", async (req, res) => {
  const { token, email } = req.query;
  try {
    const user = await User.findOne({ email, resetToken: token });
    if (!user || user.resetTokenExpiry < Date.now())
      return res.status(400).json({ valid: false, error: "Invalid or expired token" });
    res.json({ valid: true });
  } catch (err) {
    console.error("validate-reset error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================
// 🔹 Reset Password
// ============================
app.post("/reset-password", async (req, res) => {
  const { email, token, newPassword } = req.body;
  try {
    const user = await User.findOne({ email, resetToken: token });
    if (!user || user.resetTokenExpiry < Date.now())
      return res.status(400).json({ error: "Invalid or expired token" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log("✅ Password reset successful for:", email);
    res.json({ message: "Password reset successful. Please login." });
  } catch (err) {
    console.error("🔥 Reset-password error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ============================
// 🔹 CSV Knowledge Base
// ============================
let legalData = [];
const loadCSVData = () => {
  legalData = []; // Reset data

  // Load legal_faq.csv
  fs.createReadStream("legal_faq.csv")
    .pipe(csv())
    .on("data", (row) => {
      // Normalize row to consistent format
      const normalized = {
        keyword: row.question_keyword || row.keywords || row.keyword || "",
        question: row.question || row.question_en || row.question_keyword || row.keywords || row.keyword || "",
        answer: row.answer || row.answer_en || "",
        law_reference: row.law_reference || ""
      };
      legalData.push(normalized);
    })
    .on("end", () => {
      console.log("✅ CSV data loaded:", legalData.length, "rows from legal_faq.csv");
      genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null;
    });
};

loadCSVData(); // Load data on startup

// ============================
// 🔹 Gemini AI Chat + CSV Fallback
// ============================
let genAI = process.env.GOOGLE_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY) : null; // Fixed env var

app.post("/chat", upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'file', maxCount: 1 }]), async (req, res) => {
  let message = req.body.message;
  let audio = req.files && req.files.audio ? req.files.audio[0] : null;
  let file = req.files && req.files.file ? req.files.file[0] : null;

  console.log("💬 Chat request:", { message, audio: !!audio, file: !!file });

  try {
    if (!message && !audio && !file) {
      return res.status(400).json({ reply: "Please provide a message, audio, or file." });
    }

    // Handle audio or file input (for now, just acknowledge)
    if (audio) {
      message = "User sent an audio message.";
    } else if (file) {
      message = `User uploaded a file: ${file.originalname}`;
    }

    if (!message || message.trim() === "") {
      return res.status(400).json({ reply: "Please enter a message." });
    }

    // Step 1: Try smart matching from CSV using string similarity on questions
    const allQuestions = legalData.map((q) => q.question.toLowerCase());
    const bestMatch = stringSimilarity.findBestMatch(message.toLowerCase(), allQuestions);
    const best = bestMatch.bestMatch;

    if (best.rating > 0.3) { // Lower threshold for better matching
      const found = legalData[bestMatch.bestMatchIndex];
      console.log("📄 Matched CSV:", found.question);

      let reply = `${found.answer}`;
      if (found.law_reference) reply += `\n📘 Related Law: ${found.law_reference}`;
      return res.json({ reply });
    }

    // Step 2: If no CSV match, fallback to Gemini AI
    if (!genAI) {
      return res.json({ reply: "AI service is currently unavailable. Please try again later." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a friendly and knowledgeable assistant for women's legal rights in India. Keep answers short, empathetic, and factually accurate.\nUser: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const reply =
      response.text().trim() ||
      "Sorry, I couldn’t understand that. Could you rephrase?";

    console.log("🤖 Gemini Reply:", reply);
    res.json({ reply });
  } catch (err) {
    console.error("🔥 Chat error:", err.message);
    res.status(500).json({ reply: "Server error while generating reply." });
  }
});

// ✅ Start Server
app.listen(5000, "0.0.0.0", () => {
  console.log("🚀 Server running on http://localhost:5000");
  console.log("🔧 Make sure MongoDB is running (e.g. 'mongod' or use Atlas) and open the UI via http://localhost:5000 not file://");
});
