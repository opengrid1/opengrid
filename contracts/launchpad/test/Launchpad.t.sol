// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Launchpad, IUniswapV2Router02} from "../src/Launchpad.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

/// Minimal router stub: takes the tokens + ETH at face value and reports them used.
contract MockRouter is IUniswapV2Router02 {
    function factory() external view returns (address) {
        return address(this);
    }

    function addLiquidityETH(address token, uint256 amountTokenDesired, uint256, uint256, address, uint256)
        external
        payable
        returns (uint256, uint256, uint256)
    {
        LaunchToken(token).transferFrom(msg.sender, address(this), amountTokenDesired);
        return (amountTokenDesired, msg.value, 1);
    }
}

contract LaunchpadTest is Test {
    Launchpad pad;
    MockRouter router;
    address creator = makeAddr("creator");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address feeRecipient = makeAddr("fees");

    function setUp() public {
        router = new MockRouter();
        pad = new Launchpad(address(router), feeRecipient, 100); // 1% fee
        vm.deal(alice, 1000 ether);
        vm.deal(bob, 1000 ether);
    }

    function _create() internal returns (uint256 id) {
        vm.prank(creator);
        (id,) = pad.createLaunch(
            Launchpad.CreateParams({
                name: "Test Token",
                symbol: "TEST",
                tokensForSale: 1_000_000e18,
                tokensForLiquidity: 500_000e18,
                priceWeiPerToken: 0.0001 ether, // hard cap = 100 HYPE
                softCap: 10 ether,
                startTime: uint64(block.timestamp),
                endTime: uint64(block.timestamp + 1 days),
                maxBuyPerWallet: 0,
                liquidityBps: 7000
            })
        );
    }

    function test_buyAtFixedPrice() public {
        uint256 id = _create();
        vm.prank(alice);
        pad.buy{value: 1 ether}(id);
        assertEq(pad.purchased(id, alice), 10_000e18); // 1 / 0.0001

        // last buyer pays the same rate as the first — no curve
        vm.prank(bob);
        pad.buy{value: 50 ether}(id);
        assertEq(pad.purchased(id, bob), 500_000e18);
    }

    function test_hardCapExcessRefunded() public {
        uint256 id = _create();
        uint256 before = alice.balance;
        vm.prank(alice);
        pad.buy{value: 150 ether}(id); // hard cap is 100
        assertEq(before - alice.balance, 100 ether);
        assertEq(pad.purchased(id, alice), 1_000_000e18);
    }

    function test_finalizeSuccessPaysEveryone() public {
        uint256 id = _create();
        vm.prank(alice);
        pad.buy{value: 100 ether}(id); // sell out

        pad.finalize(id);

        assertEq(feeRecipient.balance, 1 ether); // 1% of 100
        assertEq(address(router).balance, 70 ether); // 70% to LP
        assertEq(creator.balance, 29 ether); // remainder

        vm.prank(alice);
        pad.claim(id);
        assertEq(LaunchToken(pad.tokenOf(id)).balanceOf(alice), 1_000_000e18);
    }

    function test_softCapMissRefunds() public {
        uint256 id = _create();
        vm.prank(alice);
        pad.buy{value: 5 ether}(id); // below 10 soft cap

        vm.warp(block.timestamp + 2 days);
        pad.finalize(id);

        uint256 before = alice.balance;
        vm.prank(alice);
        pad.refund(id);
        assertEq(alice.balance - before, 5 ether);

        vm.prank(alice);
        vm.expectRevert("not succeeded");
        pad.claim(id);
    }

    function test_partialFillScalesLiquidity() public {
        uint256 id = _create();
        vm.prank(alice);
        pad.buy{value: 50 ether}(id); // half the hard cap

        vm.warp(block.timestamp + 2 days);
        pad.finalize(id);

        address token = pad.tokenOf(id);
        // half the liquidity reserve pooled, the rest burned with unsold tokens
        assertEq(LaunchToken(token).balanceOf(address(router)), 250_000e18);
        assertEq(
            LaunchToken(token).balanceOf(pad.LP_BURN_ADDRESS()),
            500_000e18 + 250_000e18 // unsold sale tokens + unpooled liquidity tokens
        );
    }

    function test_cannotBuyAfterEnd() public {
        uint256 id = _create();
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert("ended");
        pad.buy{value: 1 ether}(id);
    }

    function test_walletCapEnforced() public {
        vm.prank(creator);
        (uint256 id,) = pad.createLaunch(
            Launchpad.CreateParams({
                name: "Capped",
                symbol: "CAP",
                tokensForSale: 1_000_000e18,
                tokensForLiquidity: 500_000e18,
                priceWeiPerToken: 0.0001 ether,
                softCap: 10 ether,
                startTime: uint64(block.timestamp),
                endTime: uint64(block.timestamp + 1 days),
                maxBuyPerWallet: 2 ether,
                liquidityBps: 7000
            })
        );
        uint256 before = alice.balance;
        vm.prank(alice);
        pad.buy{value: 5 ether}(id);
        assertEq(before - alice.balance, 2 ether); // excess over wallet cap returned
    }
}
