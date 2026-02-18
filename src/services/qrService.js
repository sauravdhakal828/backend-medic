const QRCode = require("qrcode");

exports.generateQR = async (prescriptionUid) => {
  const url = `https://frontend-medic-production.up.railway.app/prescription/${prescriptionUid}`;
  const qr = await QRCode.toDataURL(url);
  return qr;
};