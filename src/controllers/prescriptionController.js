const { PrismaClient } = require("@prisma/client");
const CryptoJS = require("crypto-js");
const { generateQR } = require("../services/qrService");
const { storeHashOnSolana } = require("../services/solanaService");

const prisma = new PrismaClient();

const hashData = (data) => {
  return CryptoJS.SHA256(JSON.stringify(data)).toString();
};

exports.create = async (req, res) => {
  try {
    if (req.user.role !== "PHARMACY") {
      return res.status(403).json({ message: "Only pharmacy accounts can create prescriptions" });
    }

    const { medicineName, dosage, frequency, times, instructions, patientName } = req.body;

    // Save to DB first
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

    // Generate hash
    const dataHash = hashData({
      medicineName,
      dosage,
      frequency,
      times,
      patientName,
      uid: prescription.uid,
    });

    // Generate QR
    const qrCode = await generateQR(prescription.uid);

    // Store hash on Solana (runs in background, won't block response)
    storeHashOnSolana(dataHash, prescription.uid).then(async (signature) => {
      if (signature) {
        await prisma.prescription.update({
          where: { id: prescription.id },
          data: { solanaTxSignature: signature },
        });
        console.log(`Prescription ${prescription.uid} stored on Solana`);
      }
    });

    // Update with QR and hash immediately
    const updated = await prisma.prescription.update({
      where: { id: prescription.id },
      data: { qrCode, solanaDataHash: dataHash },
    });

    res.json({ prescription: updated });
  } catch (err) {
  console.error("Full error:", err);
  res.status(500).json({ message: err.message, stack: err.stack });
}
};

exports.getAll = async (req, res) => {
  try {
    const prescriptions = await prisma.prescription.findMany({
      where: { pharmacyId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ prescriptions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getByUid = async (req, res) => {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { uid: req.params.uid },
      include: { pharmacy: { select: { name: true, email: true } } },
    });

    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    res.json({ prescription });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.update = async (req, res) => {
  try {
    if (req.user.role !== "PHARMACY") {
      return res.status(403).json({ message: "Only pharmacy accounts can update prescriptions" });
    }

    const { medicineName, dosage, frequency, times, instructions } = req.body;

    const existing = await prisma.prescription.findUnique({
      where: { uid: req.params.uid },
    });

    if (!existing || existing.pharmacyId !== req.user.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // New hash for updated data
    const dataHash = hashData({
      medicineName,
      dosage,
      frequency,
      times,
      uid: req.params.uid,
    });

    // Store updated hash on Solana
    storeHashOnSolana(dataHash, req.params.uid).then(async (signature) => {
      if (signature) {
        await prisma.prescription.update({
          where: { uid: req.params.uid },
          data: { solanaTxSignature: signature },
        });
      }
    });

    const updated = await prisma.prescription.update({
      where: { uid: req.params.uid },
      data: {
        medicineName,
        dosage,
        frequency: parseInt(frequency),
        times,
        instructions,
        solanaDataHash: dataHash,
      },
    });

    res.json({ prescription: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Save a prescription to consumer's account
exports.savePrescription = async (req, res) => {
  try {
    const { prescriptionUid } = req.body;

    // Check prescription exists
    const prescription = await prisma.prescription.findUnique({
      where: { uid: prescriptionUid },
    });
    if (!prescription) return res.status(404).json({ message: "Prescription not found" });

    // Save it (ignore if already saved)
    await prisma.savedPrescription.upsert({
      where: {
        consumerId_prescriptionUid: {
          consumerId: req.user.id,
          prescriptionUid,
        },
      },
      update: {},
      create: {
        consumerId: req.user.id,
        prescriptionUid,
      },
    });

    res.json({ message: "Prescription saved" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all saved prescriptions for consumer
exports.getSavedPrescriptions = async (req, res) => {
  try {
    const saved = await prisma.savedPrescription.findMany({
      where: { consumerId: req.user.id },
      orderBy: { savedAt: "desc" },
    });

    // Get full prescription details for each
    const prescriptions = await Promise.all(
      saved.map(async (s) => {
        const prescription = await prisma.prescription.findUnique({
          where: { uid: s.prescriptionUid },
          include: { pharmacy: { select: { name: true } } },
        });
        return prescription;
      })
    );

    res.json({ prescriptions: prescriptions.filter(Boolean) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};