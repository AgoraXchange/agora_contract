// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/ABBetting.sol";

contract DeployScript is Script {
    function run() external returns (ABBetting) {
        address deployer = msg.sender;
        
        console.log("Deploying with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast();
        
        // Deploy with deployer as oracle (for testing)
        ABBetting betting = new ABBetting(deployer);
        
        vm.stopBroadcast();
        
        console.log("ABBetting deployed at:", address(betting));
        console.log("Oracle address:", deployer);
        
        return betting;
    }
}