import React, { useEffect, useState } from 'react';
import { Buffer } from 'buffer';
window.Buffer=Buffer;
declare global {
  interface Window {
    solana: any;
  }
}
import {
  Connection,
  clusterApiUrl,
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import './App.css';

type DisplayEncoding = "utf8" | "hex";

type PhantomEvent = "disconnect" | "connect" | "accountChanged";
type PhantomRequestMethod =
  | "connect"
  | "disconnect"
  | "signTransaction"
  | "signAllTransactions"
  | "signMessage";

interface ConnectOpts {
  onlyIfTrusted: boolean;
}

interface PhantomProvider {
  publicKey: PublicKey | null;
  isConnected: boolean | null;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signMessage: (
    message: Uint8Array | string,
    display?: DisplayEncoding
  ) => Promise<any>;
  connect: (opts?: Partial<ConnectOpts>) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  on: (event: PhantomEvent, handler: (args: any) => void) => void;
  request: (method: PhantomRequestMethod, params: any) => Promise<unknown>;
}

const getProvider = (): PhantomProvider | undefined => {
  if ("solana" in window) {
    const provider = window.solana as any;
    if (provider.isPhantom) return provider as PhantomProvider;
  }
};

function App() {
  const [provider, setProvider] = useState<PhantomProvider | undefined>(
    undefined
  );

  const [walletKey, setWalletKey] = useState<PublicKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newAccountSecretKey, setNewAccountSecretKey] = useState<Uint8Array>(new Uint8Array(0));

  useEffect(() => {
    const provider = getProvider();
    if (provider) setProvider(provider);
  }, []);

  const createWallet = async () => {
    const newPair = Keypair.generate();
    const publicKey = newPair.publicKey.toBase58();
    const privateKey = new Uint8Array(newPair.secretKey);
    setNewAccountSecretKey(privateKey);
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    setMessage("Creating wallet...");
    await airDropSol(newPair.secretKey, newPair.publicKey);
  };

  const connectWallet = async () => {
    const { solana } = window;
    if (solana) {
      try {
        const response = await solana.connect();
        setWalletKey(new PublicKey(response.publicKey));
        setMessage("Wallet connected successfully.");
      } catch (err) {
        setMessage("Error connecting wallet: " + (err as Error).message);
      }
    }
  };

  const airDropSol = async (privateKey: Uint8Array, publicKey: PublicKey) => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
      setMessage("Requesting airdrop...");
      const fromAirDropSignature = await connection.requestAirdrop(
        publicKey,
        4 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(fromAirDropSignature, "confirmed");
      setMessage("Airdrop successful.");
    } catch (err) {
      setMessage("Airdrop error: " + (err as Error).message);
    }
  };

  const transferToWallet = async () => {
    if (!walletKey) {
      console.error("No connected wallet key available");
      setMessage("No connected wallet available.");
      return;
    }
    if (!newAccountSecretKey) {
      console.error("No new account secret key available");
      setMessage("No new account secret key available.");
      return;
    }
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const from = Keypair.fromSecretKey(newAccountSecretKey);
    const to = walletKey;

    setMessage("Transferring SOL...");

    try {
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: from.publicKey,
          toPubkey: to,
          lamports: LAMPORTS_PER_SOL / 100,
        })
      );

      const signature = await sendAndConfirmTransaction(connection, transaction, [from]);
      setMessage("Transfer successful. Signature: " + signature);
    } catch (error) {
      setMessage("Error: " + (error as Error).message);
    }
  }

  const getWalletBalance = async () => {
    try {
      const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

      if (newAccountSecretKey) {
        const myWallet = Keypair.fromSecretKey(newAccountSecretKey);
        const walletBalance = await connection.getBalance(myWallet.publicKey);
        setMessage(`Wallet balance: ${walletBalance / LAMPORTS_PER_SOL} SOL`);
      } else {
        setMessage("No new account secret key available.");
      }
    } catch (err) {
      setMessage("Error getting wallet balance: " + (err as Error).message);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h2>Connect to Phantom Wallet</h2>
        <button onClick={createWallet}>Create a New Solana Account</button>
        <button onClick={transferToWallet}>Transfer SOL to New Account</button>
        <button onClick={connectWallet}>Connect Wallet</button>
        <button onClick={getWalletBalance}>Get Wallet Balance</button>
        {provider && walletKey && <p>Connected account</p>}
        {message && <p>{message}</p>}
      </header>
    </div>
  );
}

export default App;
