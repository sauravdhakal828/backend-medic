const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const auth = require("../middleware/auth");
const { PrismaClient } = require("@prisma/client");
const {
  login,
  checkEmail,
  registerWithEmail,
  completeProfile,
  googleCallback,
  uploadMiddleware,  // ← added
} = require("../controllers/authController");

const prisma = new PrismaClient();

// Email auth
router.post("/login", login);
router.post("/check-email", checkEmail);
router.post("/register-email", registerWithEmail);
router.post("/complete-profile", auth, uploadMiddleware, completeProfile); // ← uploadMiddleware added

// Get current user
router.get("/me", auth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        googleId: user.googleId,
        pharmacyName: user.pharmacyName || null,   // ← added
        licenceUrl: user.licenceUrl || null,         // ← added
        isProfileComplete: user.isProfileComplete,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Google OAuth
router.get("/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/login", session: false }),
  googleCallback
);

router.get("/solana-balance", async (req, res) => {
  try {
    const { getBalance } = require("../services/solanaService");
    const balance = await getBalance();
    res.json({ balance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get patient profile by ID (for pharmacy to view)
router.get("/patient/:id", auth, async (req, res) => {
  try {
    const patientId = parseInt(req.params.id);

    const patient = await prisma.user.findUnique({
      where: { id: patientId },
      include: {
        savedPrescriptions: {
          include: {
            prescription: {
              include: {
                pharmacy: { select: { name: true } }
              }
            }
          },
          orderBy: { savedAt: "desc" }
        }
      }
    });

    if (!patient) return res.status(404).json({ message: "Patient not found" });

    res.json({
      patient: {
        id: patient.id,
        name: patient.name,
        email: patient.email,
        avatar: patient.avatar,
        role: patient.role,
        createdAt: patient.createdAt,
        prescriptions: patient.savedPrescriptions
          .map((s) => s.prescription)
          .filter(Boolean),
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;