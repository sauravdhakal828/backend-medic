const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("./config/passport");

dotenv.config();

const authRoutes = require("./routes/authRoutes");
const prescriptionRoutes = require("./routes/prescriptionRoutes");

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoutes);
app.use("/api/prescriptions", prescriptionRoutes);

app.get("/", (req, res) => res.json({ message: "PharmaChain API running" }));

app.get("/debug", (req, res) => {
  res.json({
    hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
    hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
    clientUrl: process.env.CLIENT_URL,
    nodeEnv: process.env.NODE_ENV,
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log("Google Client ID loaded:", !!process.env.GOOGLE_CLIENT_ID);
  console.log("Google Secret loaded:", !!process.env.GOOGLE_CLIENT_SECRET);
  console.log("Callback URL:", process.env.GOOGLE_CALLBACK_URL);
}).on("error", (err) => {
  console.error("Server failed to start:", err);
});