import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const CREATOR = "0x8B353FebE45911D12bEA9Efe0b549909b417eD8b";

const pk = process.env.WALLET_PK;
if (!pk) {
  console.error("WALLET_PK env var is required");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
if (account.address.toLowerCase() !== CREATOR.toLowerCase()) {
  console.error(`WALLET_PK is for ${account.address}, expected creator ${CREATOR}`);
  process.exit(1);
}

const transport = http(process.env.BASE_RPC_URL);
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });
const flaunch = createFlaunch({ publicClient, walletClient });

// LORE is a v1.2 coin; v1.1 & v1.2 share the same FeeEscrow -> isV1: false
const claimable = await flaunch.creatorRevenue(CREATOR, false);
console.log("Claimable creator revenue:", formatEther(claimable), "ETH");
if (claimable === 0n) {
  console.log("Nothing to claim.");
  process.exit(0);
}

const before = await publicClient.getBalance({ address: CREATOR });
console.log("Wallet ETH before:", formatEther(before));

console.log("Withdrawing creator revenue to", CREATOR, "...");
const hash = await flaunch.withdrawCreatorRevenue({ recipient: CREATOR, isV1: false });
console.log("Claim tx hash:", hash);

const receipt = await publicClient.waitForTransactionReceipt({ hash });
console.log(`Status: ${receipt.status} | Block: ${receipt.blockNumber} | Gas used: ${receipt.gasUsed}`);

const after = await publicClient.getBalance({ address: CREATOR });
console.log("Wallet ETH after:", formatEther(after));
console.log("Net change:", formatEther(after - before), "ETH (after gas)");
console.log("BaseScan:", `https://basescan.org/tx/${hash}`);
