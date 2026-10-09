// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MabrurScript} from "./MabrurScript.s.sol";
import {MabrurPBM} from "../contracts/MabrurPBM.sol";

/// @notice One-time setup: regulator trusts the issuer; issuer licenses the agency and the three vendors;
///         Ahmad-backup books once (ticketBy == departBy, so it never turns refundable early) and the agency pays
///         one HOTEL invoice on it. Writes script/out/backup.json for script/proof.sh (mined reverts).
contract Setup is MabrurScript {
    function run() external {
        _load();
        uint256 agencyPk = _pk("AGENCY");
        address agency = vm.addr(agencyPk);
        uint256 issuerPk = _pk("ISSUER");
        uint256 hotelPk = _pk("VENDOR_HOTEL");

        if (!registry.isTrustedIssuer(vm.addr(issuerPk))) {
            uint256[] memory topics = new uint256[](4);
            topics[0] = 1;
            topics[1] = 2;
            topics[2] = 3;
            topics[3] = 4;
            vm.broadcast(_pk("REGULATOR"));
            registry.addTrustedIssuer(vm.addr(issuerPk), topics);
        }
        uint64 exp = uint64(block.timestamp + 365 days);
        vm.startBroadcast(issuerPk);
        registry.issueClaim(agency, 1, exp);
        registry.issueClaim(vm.addr(_pk("VENDOR_FLIGHT")), 2, exp);
        registry.issueClaim(vm.addr(hotelPk), 3, exp);
        registry.issueClaim(vm.addr(_pk("VENDOR_VISA")), 4, exp);
        vm.stopBroadcast();

        uint256 backupPk = _pk("AHMAD_BACKUP");
        _fund(backupPk, vm.addr(backupPk));
        uint64 departBy = uint64(block.timestamp + 175 days);
        uint256 backupId = _book(backupPk, agency, _split(), departBy, departBy);

        MabrurPBM.Invoice memory paid = _invoice(backupId, HOTEL, 3_000_000, "INV-HTL-0002");
        bytes memory paidSig = _sign(hotelPk, paid);
        _spend(agencyPk, backupId, paid, paidSig);
        MabrurPBM.Invoice memory dir = _invoice(backupId, HOTEL, 3_000_000, "INV-HTL-DIR-0002");
        bytes memory dirSig = _sign(_pk("DIRECTOR"), dir);

        string memory paidJson = _invoiceJson("paid", "INV-HTL-0002 (paid; replay -> InvoiceReplayed)", paid, paidSig);
        string memory dirJson = _invoiceJson("dir", "INV-HTL-DIR-0002 (director; -> VendorClaimMissing)", dir, dirSig);
        vm.serializeString("backup", "backupId", vm.toString(backupId));
        vm.serializeString("backup", "paidInvoice", paidJson);
        string memory out = vm.serializeString("backup", "directorInvoice", dirJson);
        vm.writeJson(out, "./script/out/backup.json");
        _log("backupId", backupId);
    }
}
