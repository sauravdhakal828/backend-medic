const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const prisma = new PrismaClient();

// ── Make sure uploads folder exists ──
if (!fs.existsSync("uploads")) fs.mkdirSync("uploads");

// ── Multer config ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) =>
    cb(null, `licence-${Date.now()}${path.extname(file.originalname)}`),
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPG, PNG or PDF files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

exports.uploadMiddleware = upload.single("licence");

// ── Helper ──
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const formatUser = (user) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  avatar: user.avatar,
  googleId: user.googleId,
  pharmacyName: user.pharmacyName || null,
  licenceUrl: user.licenceUrl || null,
  isProfileComplete: user.isProfileComplete,
});

// ── Email Login ──
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: "User not found" });
    if (!user.password)
      return res.status(400).json({ message: "Please login with Google" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    const token = generateToken(user);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Check Email ──
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    res.json({ exists: !!user, hasPassword: !!user?.password });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Register with Email ──
exports.registerWithEmail = async (req, res) => {
  try {
    const { email, password } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return res.status(400).json({ message: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, password: hashed, isProfileComplete: false },
    });

    const token = generateToken(user);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Complete Profile (name + role + pharmacy details) ──
exports.completeProfile = async (req, res) => {
  try {
    const { name, role, pharmacyName } = req.body;
    const licenceFile = req.file; // undefined if not uploaded — that's fine

    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    if (role === "PHARMACY" && !pharmacyName) {
      return res.status(400).json({ message: "Pharmacy name is required" });
    }

    const updateData = {
      name,
      role,
      isProfileComplete: true,
    };

    if (role === "PHARMACY") {
      updateData.pharmacyName = pharmacyName;
      if (licenceFile) {
        updateData.licenceUrl = `/uploads/${licenceFile.filename}`;
      }
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
    });

    const token = generateToken(user);
    res.json({ token, user: formatUser(user) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Google OAuth Callback ──
exports.googleCallback = async (req, res) => {
  try {
    const user = req.user;
    const token = generateToken(user);

    const redirectUrl = `${process.env.CLIENT_URL}/auth/callback?token=${token}&isProfileComplete=${user.isProfileComplete}`;
    res.redirect(redirectUrl);
  } catch (err) {
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
};

// ── Get Patient by ID (for pharmacy to look up a consumer) ──
exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;

    const patient = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
      },
    });

    if (!patient || patient.role !== "CONSUMER") {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.json({ patient });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};