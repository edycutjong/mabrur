//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./DeployHelpers.s.sol";
import { TIDR } from "../contracts/TIDR.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";

/// @notice Deploys tIDR, ClaimRegistry (owner = REGULATOR_ADDR) and MabrurPBM, then exports SE-2 deployments.
/// yarn deploy --network arbitrum  (or forge script … --broadcast --slow --verify)
contract DeployScript is ScaffoldETHDeploy {
    function run() external ScaffoldEthDeployerRunner {
        address regulator = vm.envOr("REGULATOR_ADDR", deployer);
        TIDR tidr = new TIDR();
        ClaimRegistry registry = new ClaimRegistry(regulator);
        MabrurPBM pbm = new MabrurPBM(tidr, registry);
        deployments.push(Deployment("TIDR", address(tidr)));
        deployments.push(Deployment("ClaimRegistry", address(registry)));
        deployments.push(Deployment("MabrurPBM", address(pbm)));
        console.log("TIDR", address(tidr));
        console.log("ClaimRegistry", address(registry));
        console.log("MabrurPBM", address(pbm));
    }
}
