// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MabrurScript } from "./MabrurScript.s.sol";

/// @notice After Siti's ticket-by passed with no ticket bought: a third party (the deployer key, standing in for a
///         neighbour or the regulator) triggers the permissionless refund of every unspent rupiah.
contract DemoRefund is MabrurScript {
    function run() external {
        _load();
        string memory json = vm.readFile("./script/out/demorun.json");
        uint256 sitiId = vm.parseUint(vm.parseJsonString(json, ".sitiBookingId"));
        require(pbm.refundable(sitiId), "Siti not refundable yet: wait for ticketBy");
        vm.broadcast(_pk("DEPLOYER"));
        pbm.refund(sitiId);
        _log("refunded sitiId", sitiId);
    }
}
