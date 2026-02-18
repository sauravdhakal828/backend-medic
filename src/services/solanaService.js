const { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");

// Fix fetch for Node.js
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
global.fetch = fetch;

const connection = new Connection(
  process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
  "confirmed"
);

const getWallet = () => {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;
  if (!privateKey) throw new Error("SOLANA_PRIVATE_KEY not set in .env");
  const secretKey = Uint8Array.from(JSON.parse(privateKey));
  return Keypair.fromSecretKey(secretKey);
};

const storeHashOnSolana = async (dataHash, prescriptionUid) => {
  try {
    const wallet = getWallet();

    console.log("🔗 Storing on Solana...");
    console.log("Wallet:", wallet.publicKey.toString());

    // Check balance first
    const balance = await connection.getBalance(wallet.publicKey);
    console.log("Wallet balance:", balance / LAMPORTS_PER_SOL, "SOL");

    if (balance === 0) {
      console.error("❌ Wallet has no SOL. Fund it at faucet.solana.com");
      return null;
    }

    const memoData = JSON.stringify({
      app: "PharmaChain",
      uid: prescriptionUid,
      hash: dataHash,
      timestamp: Date.now(),
    });

    const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

    const { blockhash } = await connection.getLatestBlockhash();

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    }).add(
      new TransactionInstruction({
        keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memoData, "utf-8"),
      })
    );

    const signature = await connection.sendTransaction(transaction, [wallet]);

    console.log("⏳ Waiting for confirmation...");
    await connection.confirmTransaction(signature, "confirmed");

    console.log(`✅ Solana tx confirmed: ${signature}`);
    return signature;

  } catch (err) {
    console.error("❌ Solana error:", err.message);
    return null;
  }
};

const verifyOnSolana = async (signature) => {
  try {
    const tx = await connection.getTransaction(signature, { commitment: "confirmed" });
    return !!tx;
  } catch {
    return false;
  }
};

const getBalance = async () => {
  const wallet = getWallet();
  const balance = await connection.getBalance(wallet.publicKey);
  return balance / LAMPORTS_PER_SOL;
};

module.exports = { storeHashOnSolana, verifyOnSolana, getBalance };