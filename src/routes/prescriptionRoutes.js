const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const { verifyOnSolana } = require("../services/solanaService");
const {
  create,
  getAll,
  getByUid,
  update,
  savePrescription,
  getSavedPrescriptions,
} = require("../controllers/prescriptionController");

router.post("/", auth, create);
router.get("/", auth, getAll);
router.get("/saved", auth, getSavedPrescriptions);
router.post("/save", auth, savePrescription);
router.get("/:uid", getByUid);
router.put("/:uid", auth, update);

router.get("/:uid/verify", async (req, res) => {
  try {
    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const prescription = await prisma.prescription.findUnique({
      where: { uid: req.params.uid },
    });
    if (!prescription) return res.status(404).json({ verified: false });
    if (!prescription.solanaTxSignature) return res.json({ verified: false, reason: "Not yet stored on chain" });

    const verified = await verifyOnSolana(prescription.solanaTxSignature);
    res.json({
      verified,
      signature: prescription.solanaTxSignature,
      explorerUrl: `https://explorer.solana.com/tx/${prescription.solanaTxSignature}?cluster=devnet`,
    });
  } catch (err) {
    res.status(500).json({ verified: false, error: err.message });
  }
});

// Pharmacy creates prescription for a specific patient (from QR scan)
router.post("/for-patient/:patientId", auth, async (req, res) => {
  try {
    if (req.user.role !== "PHARMACY") {
      return res.status(403).json({ message: "Only pharmacy accounts can create prescriptions" });
    }

    const { PrismaClient } = require("@prisma/client");
    const prisma = new PrismaClient();
    const CryptoJS = require("crypto-js");
    const { generateQR } = require("../services/qrService");
    const { storeHashOnSolana } = require("../services/solanaService");

    const patientId = parseInt(req.params.patientId);
    const { medicineName, dosage, frequency, times, instructions, patientName } = req.body;

    // Create prescription
    const prescription = await prisma.prescription.create({
      data: {
        medicineName,
        dosage,
        frequency: parseInt(frequency),
        times,
        instructions,
        patientName,
        pharmacyId: req.user.id,
      },
    });

    const dataHash = CryptoJS.SHA256(JSON.stringify({
      medicineName, dosage, frequency, times, patientName, uid: prescription.uid
    })).toString();

    const qrCode = await generateQR(prescription.uid);

    // Auto save to patient's account
    await prisma.savedPrescription.upsert({
      where: {
        consumerId_prescriptionUid: {
          consumerId: patientId,
          prescriptionUid: prescription.uid,
        }
      },
      update: {},
      create: {
        consumerId: patientId,
        prescriptionUid: prescription.uid,
      }
    });

    // Store on Solana in background
    storeHashOnSolana(dataHash, prescription.uid).then(async (signature) => {
      if (signature) {
        await prisma.prescription.update({
          where: { uid: prescription.uid },
          data: { solanaTxSignature: signature },
        });
      }
    });

    const updated = await prisma.prescription.update({
      where: { uid: prescription.uid },
      data: { qrCode, solanaDataHash: dataHash },
    });

    res.json({ prescription: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;