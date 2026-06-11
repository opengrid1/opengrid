// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchToken} from "./LaunchToken.sol";

interface IUniswapV2Router02 {
    function factory() external view returns (address);
    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) external payable returns (uint256 amountToken, uint256 amountETH, uint256 liquidity);
}

/// @title Launchpad — fixed-price token launchpad for HyperEVM (no bonding curve)
/// @notice Creators launch a new token with a flat sale price, a soft cap and a hard cap.
///         Buyers pay native HYPE at the fixed price for the whole sale — no curve, the
///         first buyer pays the same as the last. When the sale succeeds, a configurable
///         share of the raise plus reserved tokens is paired into a UniswapV2-style DEX
///         pool (HyperSwap/KittenSwap) and the LP tokens are burned, the protocol takes
///         its fee, and the creator receives the remainder. If the soft cap is missed,
///         everyone refunds.
contract Launchpad {
    // ---------------------------------------------------------------- types

    enum Status {
        Live, // sale running (or waiting to be finalized/failed)
        Succeeded, // finalized: liquidity added, claims open
        Failed // soft cap missed: refunds open
    }

    struct Launch {
        address token;
        address creator;
        uint96 priceWeiPerToken; // HYPE wei per whole (1e18) token
        uint128 tokensForSale; // tokens sold to buyers at the fixed price
        uint128 tokensForLiquidity; // tokens reserved for the DEX pool
        uint128 tokensSold;
        uint128 raised; // HYPE collected from buyers
        uint96 softCap; // min raise (in HYPE wei) for the sale to succeed
        uint64 startTime;
        uint64 endTime;
        uint96 maxBuyPerWallet; // HYPE wei cap per wallet, 0 = unlimited
        uint16 liquidityBps; // share of the raise paired into the pool
        Status status;
    }

    struct CreateParams {
        string name;
        string symbol;
        uint128 tokensForSale;
        uint128 tokensForLiquidity;
        uint96 priceWeiPerToken;
        uint96 softCap;
        uint64 startTime;
        uint64 endTime;
        uint96 maxBuyPerWallet;
        uint16 liquidityBps; // e.g. 7000 = 70% of raise into LP
    }

    // ---------------------------------------------------------------- state

    uint16 public constant MAX_BPS = 10_000;
    uint16 public constant MIN_LIQUIDITY_BPS = 5_000; // at least half the raise must back the pool
    address public constant LP_BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    IUniswapV2Router02 public immutable router;
    address public owner;
    uint16 public protocolFeeBps; // taken from the raise on success
    address public feeRecipient;

    Launch[] public launches;
    // launchId => buyer => HYPE contributed
    mapping(uint256 => mapping(address => uint256)) public contributed;
    // launchId => buyer => tokens purchased (claimable after success)
    mapping(uint256 => mapping(address => uint256)) public purchased;

    uint256 private _locked = 1;

    // --------------------------------------------------------------- events

    event LaunchCreated(
        uint256 indexed launchId,
        address indexed token,
        address indexed creator,
        uint256 priceWeiPerToken,
        uint256 tokensForSale,
        uint256 hardCap
    );
    event Bought(uint256 indexed launchId, address indexed buyer, uint256 paid, uint256 tokensOut);
    event Finalized(uint256 indexed launchId, uint256 raised, uint256 liquidityHype, uint256 liquidityTokens);
    event LaunchFailed(uint256 indexed launchId, uint256 raised);
    event Claimed(uint256 indexed launchId, address indexed buyer, uint256 tokens);
    event Refunded(uint256 indexed launchId, address indexed buyer, uint256 amount);

    // ------------------------------------------------------------ modifiers

    modifier nonReentrant() {
        require(_locked == 1, "reentrancy");
        _locked = 2;
        _;
        _locked = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address router_, address feeRecipient_, uint16 protocolFeeBps_) {
        require(router_ != address(0) && feeRecipient_ != address(0), "zero address");
        require(protocolFeeBps_ <= 500, "fee > 5%");
        router = IUniswapV2Router02(router_);
        owner = msg.sender;
        feeRecipient = feeRecipient_;
        protocolFeeBps = protocolFeeBps_;
    }

    // ------------------------------------------------------------- creation

    /// @notice Deploy a new token and open its fixed-price sale.
    /// @dev The full supply (sale + liquidity) is minted straight to this contract;
    ///      the creator never holds tokens that aren't sold or pooled.
    function createLaunch(CreateParams calldata p) external returns (uint256 launchId, address token) {
        require(bytes(p.name).length > 0 && bytes(p.symbol).length > 0, "empty name/symbol");
        require(p.priceWeiPerToken > 0, "zero price");
        require(p.tokensForSale > 0 && p.tokensForLiquidity > 0, "zero allocation");
        require(p.startTime >= block.timestamp && p.endTime > p.startTime, "bad window");
        require(p.liquidityBps >= MIN_LIQUIDITY_BPS && p.liquidityBps <= MAX_BPS, "bad liquidityBps");

        uint256 hardCap = (uint256(p.tokensForSale) * p.priceWeiPerToken) / 1e18;
        require(hardCap > 0, "hard cap rounds to zero");
        require(p.softCap > 0 && p.softCap <= hardCap, "bad soft cap");

        token = address(
            new LaunchToken(p.name, p.symbol, uint256(p.tokensForSale) + p.tokensForLiquidity, address(this))
        );

        launchId = launches.length;
        launches.push(
            Launch({
                token: token,
                creator: msg.sender,
                priceWeiPerToken: p.priceWeiPerToken,
                tokensForSale: p.tokensForSale,
                tokensForLiquidity: p.tokensForLiquidity,
                tokensSold: 0,
                raised: 0,
                softCap: p.softCap,
                startTime: p.startTime,
                endTime: p.endTime,
                maxBuyPerWallet: p.maxBuyPerWallet,
                liquidityBps: p.liquidityBps,
                status: Status.Live
            })
        );

        emit LaunchCreated(launchId, token, msg.sender, p.priceWeiPerToken, p.tokensForSale, hardCap);
    }

    // --------------------------------------------------------------- buying

    /// @notice Buy at the fixed price. Excess HYPE (over the hard cap or wallet cap) is refunded.
    function buy(uint256 launchId) external payable nonReentrant {
        Launch storage l = launches[launchId];
        require(l.status == Status.Live, "not live");
        require(block.timestamp >= l.startTime, "not started");
        require(block.timestamp < l.endTime, "ended");
        require(msg.value > 0, "zero value");

        uint256 hardCap = (uint256(l.tokensForSale) * l.priceWeiPerToken) / 1e18;
        uint256 accept = msg.value;

        uint256 capRoom = hardCap - l.raised;
        if (accept > capRoom) accept = capRoom;

        if (l.maxBuyPerWallet > 0) {
            uint256 walletRoom = l.maxBuyPerWallet - contributed[launchId][msg.sender];
            if (accept > walletRoom) accept = walletRoom;
        }
        require(accept > 0, "cap reached");

        uint256 tokensOut = (accept * 1e18) / l.priceWeiPerToken;
        l.raised += uint128(accept);
        l.tokensSold += uint128(tokensOut);
        contributed[launchId][msg.sender] += accept;
        purchased[launchId][msg.sender] += tokensOut;

        emit Bought(launchId, msg.sender, accept, tokensOut);

        if (msg.value > accept) {
            (bool ok,) = msg.sender.call{value: msg.value - accept}("");
            require(ok, "refund failed");
        }
    }

    // ----------------------------------------------------------- settlement

    /// @notice Settle a sale: succeeds once the hard cap is hit, or after the end time
    ///         if the soft cap was reached; otherwise marks it failed and opens refunds.
    ///         Anyone may call.
    function finalize(uint256 launchId) external nonReentrant {
        Launch storage l = launches[launchId];
        require(l.status == Status.Live, "not live");

        uint256 hardCap = (uint256(l.tokensForSale) * l.priceWeiPerToken) / 1e18;
        bool soldOut = l.raised >= hardCap;
        require(soldOut || block.timestamp >= l.endTime, "still running");

        if (l.raised < l.softCap) {
            l.status = Status.Failed;
            emit LaunchFailed(launchId, l.raised);
            return;
        }

        l.status = Status.Succeeded;

        uint256 fee = (uint256(l.raised) * protocolFeeBps) / MAX_BPS;
        uint256 liquidityHype = (uint256(l.raised) * l.liquidityBps) / MAX_BPS;
        // Pool tokens scale with how much of the sale actually filled, so the
        // listing price never undercuts what buyers paid.
        uint256 liquidityTokens = (uint256(l.tokensForLiquidity) * l.raised) / hardCap;
        uint256 creatorProceeds = uint256(l.raised) - fee - liquidityHype;

        LaunchToken(l.token).approve(address(router), liquidityTokens);
        // Mins are 0 on purpose: if someone pre-seeds the pair to skew the ratio,
        // strict mins would brick finalize forever. The router's return values tell
        // us what was actually deposited; anything left over is settled below.
        (uint256 usedTokens, uint256 usedHype,) = router.addLiquidityETH{value: liquidityHype}(
            l.token,
            liquidityTokens,
            0,
            0,
            LP_BURN_ADDRESS, // LP burned: liquidity is locked forever
            block.timestamp
        );
        creatorProceeds += liquidityHype - usedHype;

        // Tokens not sold and not pooled stay out of circulation for good.
        uint256 leftover =
            uint256(l.tokensForSale) - l.tokensSold + (uint256(l.tokensForLiquidity) - usedTokens);
        if (leftover > 0) {
            LaunchToken(l.token).transfer(LP_BURN_ADDRESS, leftover);
        }

        if (fee > 0) {
            (bool okFee,) = feeRecipient.call{value: fee}("");
            require(okFee, "fee transfer failed");
        }
        if (creatorProceeds > 0) {
            (bool okCreator,) = l.creator.call{value: creatorProceeds}("");
            require(okCreator, "creator transfer failed");
        }

        emit Finalized(launchId, l.raised, usedHype, usedTokens);
    }

    /// @dev Accepts the router's dust refund during finalize.
    receive() external payable {}

    /// @notice Claim purchased tokens after a successful sale.
    function claim(uint256 launchId) external nonReentrant {
        Launch storage l = launches[launchId];
        require(l.status == Status.Succeeded, "not succeeded");
        uint256 amount = purchased[launchId][msg.sender];
        require(amount > 0, "nothing to claim");
        purchased[launchId][msg.sender] = 0;
        LaunchToken(l.token).transfer(msg.sender, amount);
        emit Claimed(launchId, msg.sender, amount);
    }

    /// @notice Recover contributed HYPE after a failed sale.
    function refund(uint256 launchId) external nonReentrant {
        Launch storage l = launches[launchId];
        require(l.status == Status.Failed, "not failed");
        uint256 amount = contributed[launchId][msg.sender];
        require(amount > 0, "nothing to refund");
        contributed[launchId][msg.sender] = 0;
        purchased[launchId][msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "refund failed");
        emit Refunded(launchId, msg.sender, amount);
    }

    // ----------------------------------------------------------------- view

    function launchCount() external view returns (uint256) {
        return launches.length;
    }

    function tokenOf(uint256 launchId) external view returns (address) {
        return launches[launchId].token;
    }

    function hardCapOf(uint256 launchId) external view returns (uint256) {
        Launch storage l = launches[launchId];
        return (uint256(l.tokensForSale) * l.priceWeiPerToken) / 1e18;
    }

    // ---------------------------------------------------------------- admin

    function setProtocolFee(uint16 bps) external onlyOwner {
        require(bps <= 500, "fee > 5%");
        protocolFeeBps = bps;
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        require(recipient != address(0), "zero address");
        feeRecipient = recipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero address");
        owner = newOwner;
    }
}
