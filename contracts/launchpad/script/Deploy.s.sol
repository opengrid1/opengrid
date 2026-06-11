// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Launchpad} from "../src/Launchpad.sol";

/// Usage:
///   export PRIVATE_KEY=0x...
///   export ROUTER=0x...          # UniswapV2-style router on HyperEVM (HyperSwap/KittenSwap)
///   export FEE_RECIPIENT=0x...   # defaults to the deployer
///   forge script script/Deploy.s.sol --rpc-url hyperevm --broadcast
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address router = vm.envAddress("ROUTER");
        address feeRecipient = vm.envOr("FEE_RECIPIENT", vm.addr(pk));
        uint16 feeBps = uint16(vm.envOr("PROTOCOL_FEE_BPS", uint256(100))); // 1% default

        vm.startBroadcast(pk);
        Launchpad pad = new Launchpad(router, feeRecipient, feeBps);
        vm.stopBroadcast();

        console.log("Launchpad deployed at:", address(pad));
    }
}
