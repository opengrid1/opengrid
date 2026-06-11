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

// Retry transient RPC/network errors with backoff so a flaky public node
// never silently drops a cycle.
async function withRetry(fn, label, tries = 4) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const wait = 2000 * 2 ** i;
      console.error(`[${new Date().toISOString()}] ${label} failed (try ${i + 1}/${tries}): ${e?.shortMessage ?? e?.message ?? e} — retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

async function claimOnce() {
  const ts = new Date().toISOString();
  const claimable = await withRetry(() => sdk.creatorRevenue(account.address, false), "read claimable");
  if (claimable < MIN_CLAIM) {
    console.log(`[${ts}] claimable ${formatEther(claimable)} ETH < threshold ${formatEther(MIN_CLAIM)} — skipping`);
    return;
  }
  const gas = await withRetry(() => publicClient.getBalance({ address: account.address }), "read gas balance");
  if (gas === 0n) {
    console.error(`[${ts}] wallet has 0 ETH for gas — cannot claim ${formatEther(claimable)} ETH (fees stay safe in escrow)`);
    return;
  }
  const hash = await withRetry(() => sdk.withdrawCreatorRevenue({}), "submit claim");
  const r = await publicClient.waitForTransactionReceipt({ hash });
  if (r.status !== "success") {
    console.error(`[${ts}] claim tx reverted | tx ${hash} @ block ${r.blockNumber}`);
    return;
  }
  console.log(`[${ts}] claimed ${formatEther(claimable)} ETH | tx ${hash} | ${r.status} @ block ${r.blockNumber}`);
}

console.log("Claiming as:", account.address, "| threshold:", formatEther(MIN_CLAIM), "ETH");
await claimOnce();
if (LOOP_MINUTES > 0) {
  console.log(`Looping every ${LOOP_MINUTES} minutes — Ctrl+C to stop`);
  setInterval(() => claimOnce().catch((e) => console.error("claim error:", e?.message ?? e)), LOOP_MINUTES * 60_000);
}
