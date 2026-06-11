# HyperEVM Launchpad (fixed-price, no bonding curve)

A token launchpad for [HyperEVM](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/hyperevm) that deliberately **does not use a bonding curve**. Every buyer in a sale pays the same flat price — the first buyer gets the same rate as the last. When a sale succeeds, liquidity is automatically deployed to a UniswapV2-style DEX and the LP tokens are burned.

## How a launch works

1. **Create.** A creator calls `createLaunch` with a name/symbol, a fixed price (HYPE wei per token), the token amounts for sale and for liquidity, a soft cap, hard cap window (start/end), an optional per-wallet buy cap, and the share of the raise that goes into the pool (`liquidityBps`, minimum 50%). The full supply is minted directly to the launchpad — the creator never holds unsold tokens.
2. **Buy.** Anyone sends native HYPE to `buy` during the window. Price is flat; overpayment past the hard cap or wallet cap is refunded in the same transaction.
3. **Finalize.** Anyone can call `finalize` once the hard cap is hit, or after the end time.
   - **Soft cap reached:** the protocol fee (max 5%) is taken, `liquidityBps` of the raise plus a pro-rata share of the liquidity reserve is added to the DEX pool, LP tokens are sent to the dead address (liquidity locked forever), unsold/unpooled tokens are burned, and the creator receives the remaining HYPE. Buyers then `claim` their tokens.
   - **Soft cap missed:** the launch is marked failed and every buyer can `refund` their full contribution.

Because the pool's token amount scales with how much of the sale filled, the DEX listing price always equals the sale price — no instant arbitrage against buyers on partial fills.

## Contracts

| File | Purpose |
| --- | --- |
| `src/Launchpad.sol` | Factory + sale logic: create, buy, finalize, claim, refund |
| `src/LaunchToken.sol` | Minimal fixed-supply ERC20 (no owner, no mint, no transfer hooks) |
| `script/Deploy.s.sol` | Foundry deploy script |
| `test/Launchpad.t.sol` | Test suite (7 tests, mock router) |

## Build & test

```bash
cd contracts/launchpad
forge install foundry-rs/forge-std   # or: git clone --depth 1 https://github.com/foundry-rs/forge-std lib/forge-std
forge test -vv
```

## Deploy to HyperEVM

```bash
export PRIVATE_KEY=0x...
export ROUTER=0x...            # a UniswapV2-style router (e.g. HyperSwap V2 or KittenSwap)
export FEE_RECIPIENT=0x...     # optional, defaults to deployer
export PROTOCOL_FEE_BPS=100    # optional, default 1%

forge script script/Deploy.s.sol --rpc-url hyperevm --broadcast
```

RPC endpoints are preconfigured in `foundry.toml`:

- **Mainnet:** chain id `999`, `https://rpc.hyperliquid.xyz/evm`
- **Testnet:** chain id `998`, `https://rpc.hyperliquid-testnet.xyz/evm`

> **HyperEVM big blocks:** contract deployments often exceed the small-block gas limit (2M). Flip your deployer address to big blocks (30M gas, ~1 min blocks) before deploying — via the `evmUserModify` L1 action or a community toggle UI — then flip back for normal usage.

> **Router address:** verify the router you pass against the DEX's official docs/explorer before deploying. The launchpad pairs against native HYPE via `addLiquidityETH` (the router wraps to WHYPE, `0x5555555555555555555555555555555555555555`, internally).

## Security properties & known trade-offs

- Reentrancy-guarded on all value-moving functions; checks-effects-interactions throughout.
- `finalize` is permissionless, so a creator can't hold buyer funds hostage.
- LP is burned, not time-locked — rug-by-liquidity-pull is impossible.
- `addLiquidityETH` is called with zero mins on purpose: strict mins would let anyone brick `finalize` forever by pre-seeding the pair. The actual deposited amounts are taken from the router's return values and any unused HYPE goes to the creator. An attacker who pre-skews the pair only donates value to it.
- This is a reference implementation and has **not been audited**. Test on HyperEVM testnet (chain id 998) before putting real funds behind it.
