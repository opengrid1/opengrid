import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, formatEther, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync, existsSync } from "fs";

// Claims LORE creator fees for the wallet holding creator NFT #110893.
// Key: WALLET_PK env var, or falls back to the session key file if present.
// Run once: node claim-mythos-fees.js
// Loop:     LOOP_MINUTES=10 node claim-mythos-fees.js
// Skip claims below MIN_CLAIM_ETH (default 0.001) to avoid wasting gas on dust.

const KEY_FILE = "/home/user/mythos-wallet.txt";
let pk = process.env.WALLET_PK;
if (!pk && existsSync(KEY_FILE)) {
  pk = readFileSync(KEY_FILE, "utf8").match(/Private key:\s*(0x[0-9a-fA-F]{64})/)?.[1];
}
if (!pk) {
  console.error("No key: set WALLET_PK env var");
  process.exit(1);
}

const MIN_CLAIM = parseEther(process.env.MIN_CLAIM_ETH ?? "0.001");
const LOOP_MINUTES = Number(process.env.LOOP_MINUTES ?? 0);

const account = privateKeyToAccount(pk);
const transport = http(process.env.BASE_RPC_URL);
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });
const sdk = createFlaunch({ publicClient, walletClient });

async function claimOnce() {
  const ts = new Date().toISOString();
  const claimable = await sdk.creatorRevenue(account.address, false);
  if (claimable < MIN_CLAIM) {
    console.log(`[${ts}] claimable ${formatEther(claimable)} ETH < threshold ${formatEther(MIN_CLAIM)} — skipping`);
    return;
  }
  const hash = await sdk.withdrawCreatorRevenue({});
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`[${ts}] claimed ${formatEther(claimable)} ETH | tx ${hash} | ${r.status} @ block ${r.blockNumber}`);
}

console.log("Claiming as:", account.address, "| threshold:", formatEther(MIN_CLAIM), "ETH");
await claimOnce();
if (LOOP_MINUTES > 0) {
  console.log(`Looping every ${LOOP_MINUTES} minutes — Ctrl+C to stop`);
  setInterval(() => claimOnce().catch((e) => console.error("claim error:", e?.message ?? e)), LOOP_MINUTES * 60_000);
}
