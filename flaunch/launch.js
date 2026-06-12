import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { readFileSync } from "fs";

const RECEIVER = "0x8B353FebE45911D12bEA9Efe0b549909b417eD8b";
const DESCRIPTION =
  "Every legend starts somewhere. LORE is a story written onchain — branded, named, and illustrated by an AI, launched on Base. No roadmap, no promises. Just the first page.";

const pk = process.env.WALLET_PK;
if (!pk) {
  console.error("WALLET_PK env var is required");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const transport = http(process.env.BASE_RPC_URL); // defaults to public Base RPC
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });

console.log("Wallet:", account.address);
const balance = await publicClient.getBalance({ address: account.address });
console.log("Balance:", formatEther(balance), "ETH");
if (balance === 0n) {
  console.error("Wallet has no ETH for gas — aborting");
  process.exit(1);
}

const flaunch = createFlaunch({ publicClient, walletClient });

const params = {
  name: "Lore",
  symbol: "LORE",
  fairLaunchPercent: 0, // deprecated param, must be 0
  fairLaunchDuration: 0,
  initialMarketCapUSD: 10_000,
  creator: RECEIVER, // receives the Flaunch creator NFT + fee revenue
  creatorFeeAllocationPercent: 80,
};

let hash;
try {
  const base64Image = `data:image/png;base64,${readFileSync(
    new URL("./logo.png", import.meta.url)
  ).toString("base64")}`;
  console.log("Flaunching with logo (image + metadata upload via Flaunch API)...");
  hash = await flaunch.flaunchIPFS({
    ...params,
    metadata: { base64Image, description: DESCRIPTION },
  });
} catch (err) {
  console.error("flaunchIPFS failed:", err?.message ?? err);
  console.log("Retrying without image (empty tokenUri)...");
  hash = await flaunch.flaunch({ ...params, tokenUri: "" });
}

console.log("Tx hash:", hash);
console.log("Waiting for receipt...");
const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(
  `Status: ${receipt.status} | Block: ${receipt.blockNumber} | Gas used: ${receipt.gasUsed}`
);
if (receipt.status !== "success") {
  console.error("Transaction reverted");
  process.exit(1);
}

const pool = await flaunch.getPoolCreatedFromTx(hash);
if (pool) {
  console.log("Token contract:", pool.memecoin);
  console.log("Flaunch NFT tokenId:", pool.tokenId.toString());
  console.log("Flaunch page:", `https://flaunch.gg/base/coin/${pool.memecoin}`);
  console.log("BaseScan:", `https://basescan.org/token/${pool.memecoin}`);
} else {
  console.log(
    "Could not parse PoolCreated event — inspect the tx:",
    `https://basescan.org/tx/${hash}`
  );
}
