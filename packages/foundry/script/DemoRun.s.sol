// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MabrurScript} from "./MabrurScript.s.sol";
import {MabrurPBM} from "../contracts/MabrurPBM.sol";

/// @notice The broadcast demo ledger (feeds DEMO.md and script/cost.sh):
///         Siti book (ticket-by +600 s) → Siti HOTEL spend → Ahmad book → Ahmad FLIGHT/HOTEL/VISA → Ahmad-signed
///         releaseMargin. Run DemoRefund.s.sol ≥ 11 minutes later for Siti's refund.
contract DemoRun is MabrurScript {
    function run() external {
        _load();
        uint256 agencyPk = _pk("AGENCY");
        address agency = vm.addr(agencyPk);
        uint256 ahmadPk = _pk("AHMAD");
        uint256 sitiPk = _pk("SITI");
        _fund(_pk("DEPLOYER"), vm.addr(sitiPk));
        _fund(_pk("DEPLOYER"), vm.addr(ahmadPk));

        uint64 departBy = uint64(block.timestamp + 30 days);
        uint256 sitiId = _book(sitiPk, agency, _split(), uint64(block.timestamp + 600), departBy);
        MabrurPBM.Invoice memory sh = _invoice(sitiId, HOTEL, 9_000_000, "INV-HTL-DR-S");
        _spend(agencyPk, sitiId, sh, _sign(_pk("VENDOR_HOTEL"), sh));

        uint256 ahmadId = _book(ahmadPk, agency, _split(), uint64(block.timestamp + 20 days), departBy);
        MabrurPBM.Invoice memory f = _invoice(ahmadId, FLIGHT, 14_000_000, "INV-FLT-DR-A");
        _spend(agencyPk, ahmadId, f, _sign(_pk("VENDOR_FLIGHT"), f));
        MabrurPBM.Invoice memory h = _invoice(ahmadId, HOTEL, 9_000_000, "INV-HTL-DR-A");
        _spend(agencyPk, ahmadId, h, _sign(_pk("VENDOR_HOTEL"), h));
        MabrurPBM.Invoice memory v = _invoice(ahmadId, VISA, 4_000_000, "INV-VSA-DR-A");
        _spend(agencyPk, ahmadId, v, _sign(_pk("VENDOR_VISA"), v));
        bytes memory dep = _signDeparture(ahmadPk, ahmadId);
        vm.broadcast(agencyPk); // anyone may submit the pilgrim's departure signature
        pbm.releaseMargin(ahmadId, dep);

        vm.serializeString("run", "ahmadBookingId", vm.toString(ahmadId));
        string memory out = vm.serializeString("run", "sitiBookingId", vm.toString(sitiId));
        vm.writeJson(out, "./script/out/demorun.json");
        _log("ahmadId", ahmadId);
        _log("sitiId", sitiId);
    }
}
