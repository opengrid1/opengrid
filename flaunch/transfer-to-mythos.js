import { createFlaunch } from "@flaunch/sdk";
import { createPublicClient, createWalletClient, http, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

const NEW_WALLET = "0xcB59181b251BB98133b7200c34F1619864d291D5";
const FLAUNCH_V1_2 = "0x516af52d0c629b5e378da4dc64ecb0744ce10109"; // Flaunch v1.2 NFT
const TOKEN_ID = 110893n;

const pk = process.env.WALLET_PK;
if (!pk) {
  console.error("WALLET_PK env var is required");
  process.exit(1);
}

const account = privateKeyToAccount(pk);
const transport = http(process.env.BASE_RPC_URL);
const publicClient = createPublicClient({ chain: base, transport });
const walletClient = createWalletClient({ account, chain: base, transport });
const sdk = createFlaunch({ publicClient, walletClient });

const erc721Abi = [
  { name: "ownerOf", type: "function", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "address" }] },
  { name: "safeTransferFrom", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "address" }, { type: "uint256" }], outputs: [] },
];

console.log("Old wallet:", account.address);
console.log("New wallet:", NEW_WALLET);

// Step 1: claim any newly accrued creator fees directly to the new wallet
const claimable = await sdk.creatorRevenue(account.address, false);
console.log("\n[1] Claimable creator fees:", formatEther(claimable), "ETH");
if (claimable > 0n) {
  const hash = await sdk.withdrawCreatorRevenue({ recipient: NEW_WALLET });
  console.log("    Claim tx (recipient = new wallet):", hash);
  const r = await publicClient.waitForTransactionReceipt({ hash });
  console.log("    Status:", r.status, "| Block:", r.blockNumber.toString());
} else {
  console.log("    Nothing to claim — skipping");
}

// Step 2: transfer the creator NFT (fee recipient rights)
const ownerBefore = await publicClient.readContract({ address: FLAUNCH_V1_2, abi: erc721Abi, functionName: "ownerOf", args: [TOKEN_ID] });
console.log("\n[2] NFT #" + TOKEN_ID, "owner before:", ownerBefore);
if (ownerBefore.toLowerCase() !== account.address.toLowerCase()) {
  console.error("    Old wallet does not own the NFT — aborting");
  process.exit(1);
}
const nftHash = await walletClient.writeContract({
  address: FLAUNCH_V1_2,
  abi: erc721Abi,
  functionName: "safeTransferFrom",
  args: [account.address, NEW_WALLET, TOKEN_ID],
});
console.log("    NFT transfer tx:", nftHash);
const nftReceipt = await publicClient.waitForTransactionReceipt({ hash: nftHash });
console.log("    Status:", nftReceipt.status, "| Block:", nftReceipt.blockNumber.toString());
const ownerAfter = await publicClient.readContract({ address: FLAUNCH_V1_2, abi: erc721Abi, functionName: "ownerOf", args: [TOKEN_ID] });
console.log("    Owner after:", ownerAfter);

// Step 3: sweep remaining ETH (balance minus gas reserve incl. L1 data fee buffer)
const balance = await publicClient.getBalance({ address: account.address });
const fees = await publicClient.estimateFeesPerGas();
const gasReserve = 21000n * fees.maxFeePerGas + 3_000_000_000_000n; // + 0.000003 ETH L1-fee buffer
const value = balance - gasReserve;
console.log("\n[3] Old wallet balance:", formatEther(balance), "ETH | sweeping:", formatEther(value), "ETH");
if (value <= 0n) {
  console.error("    Balance too low to sweep — aborting sweep");
  process.exit(1);
}
const sweepHash = await walletClient.sendTransaction({
  to: NEW_WALLET,
  value,
  gas: 21000n,
  maxFeePerGas: fees.maxFeePerGas,
  maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
});
console.log("    Sweep tx:", sweepHash);
const sweepReceipt = await publicClient.waitForTransactionReceipt({ hash: sweepHash });
console.log("    Status:", sweepReceipt.status, "| Block:", sweepReceipt.blockNumber.toString());

// Final verification
const [oldBal, newBal, finalClaimable] = await Promise.all([
  publicClient.getBalance({ address: account.address }),
  publicClient.getBalance({ address: NEW_WALLET }),
  sdk.creatorRevenue(account.address, false),
]);
console.log("\n=== Final state ===");
console.log("NFT #" + TOKEN_ID, "owner:", ownerAfter);
console.log("Old wallet ETH:", formatEther(oldBal));
console.log("New wallet ETH:", formatEther(newBal));
console.log("Residual claimable on old wallet:", formatEther(finalClaimable));
