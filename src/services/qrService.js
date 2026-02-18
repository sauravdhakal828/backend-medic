const QRCode = require("qrcode");

exports.generateQR = async (prescriptionUid) => {
  const url = `http://localhost:3000/prescription/${prescriptionUid}`;
  const qr = await QRCode.toDataURL(url);
  return qr;
};