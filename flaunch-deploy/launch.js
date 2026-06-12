const fs = require("fs");
const { createPublicClient, createWalletClient, http } = require("viem");
const { privateKeyToAccount } = require("viem/accounts");
const { base } = require("viem/chains");
const { createFlaunch } = require("@flaunch/sdk");

const RECEIVER = "0x8B353FebE45911D12bEA9Efe0b549909b417eD8b";

async function main() {
  const pk = process.env.WALLET_PK;
  if (!pk) throw new Error("WALLET_PK env var not set");
  const account = privateKeyToAccount(pk);
  console.log("Deployer:", account.address);

  const publicClient = createPublicClient({ chain: base, transport: http() });
  const walletClient = createWalletClient({ account, chain: base, transport: http() });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log("Balance:", Number(balance) / 1e18, "ETH");

  const flaunch = createFlaunch({ publicClient, walletClient });

  const baseParams = {
    name: "Lore",
    symbol: "LORE",
    fairLaunchPercent: 0, // deprecated, must be 0
    fairLaunchDuration: 0,
    initialMarketCapUSD: 10000,
    creator: RECEIVER,
    creatorFeeAllocationPercent: 80,
  };
  const description =
    "Every legend starts somewhere. LORE is a story written onchain — " +
    "branded, named, and illustrated by an AI, launched on Base. " +
    "No roadmap, no promises. Just the first page.";

  let hash;
  try {
    const base64Image =
      "data:image/png;base64," + fs.readFileSync("logo.png").toString("base64");
    hash = await flaunch.flaunchIPFS({
      ...baseParams,
      metadata: { base64Image, description },
    });
  } catch (err) {
    console.error("Launch with image failed:", err.message);
    console.log("Retrying without image...");
    hash = await flaunch.flaunchIPFS({
      ...baseParams,
      metadata: { base64Image: "", description },
    });
  }

  console.log("Tx hash:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Receipt status:", receipt.status, "block:", receipt.blockNumber);

  const poolCreated = await flaunch.getPoolCreatedFromTx(hash);
  if (poolCreated) {
    console.log("Token contract:", poolCreated.memecoin);
    console.log("Flaunch page: https://flaunch.gg/base/coin/" + poolCreated.memecoin);
  } else {
    console.log("PoolCreated event not found in tx", hash);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
