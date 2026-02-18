const { Keypair } = require("@solana/web3.js");

const keypair = Keypair.generate();
console.log("Public Key:", keypair.publicKey.toString());
console.log("Private Key (JSON array):", JSON.stringify(Array.from(keypair.secretKey)));