// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MabrurScript} from "./MabrurScript.s.sol";
import {MabrurPBM} from "../contracts/MabrurPBM.sol";

/// @notice Re-runnable, 2–4 min before every live slot (mentor walk-through, video, Demo Day):
///         a fresh Pak Ahmad (ticketBy +20 d, departBy +30 d) and a fresh Ibu Siti whose HOTEL is pre-paid and whose
///         ticket-by lapses SITI_TICKET_BY_OFFSET seconds from now (default 300) with no ticket bought.
///         Writes the pre-signed invoices the agency console loads to script/out/invoices.json.
contract SeedDemo is MabrurScript {
    function run() external {
        _load();
        uint64 sitiOffset = uint64(vm.envOr("SITI_TICKET_BY_OFFSET", uint256(300)));
        _fund(_pk("DEPLOYER"), vm.addr(_pk("SITI")));
        _fund(_pk("DEPLOYER"), vm.addr(_pk("AHMAD")));

        uint64 departBy = uint64(block.timestamp + 30 days);
        address agency = vm.addr(_pk("AGENCY"));
        uint256 sitiId = _book(_pk("SITI"), agency, _split(), uint64(block.timestamp) + sitiOffset, departBy);
        MabrurPBM.Invoice memory sitiHotel = _invoice(sitiId, HOTEL, 9_000_000, "INV-HTL-0001");
        bytes memory sitiHotelSig = _sign(_pk("VENDOR_HOTEL"), sitiHotel);
        _spend(_pk("AGENCY"), sitiId, sitiHotel, sitiHotelSig);
        uint256 ahmadId = _book(_pk("AHMAD"), agency, _split(), uint64(block.timestamp + 20 days), departBy);

        string memory a =
            _invoiceJson("a", "1. Siti's hotel invoice on Ahmad -> EarmarkMismatch", sitiHotel, sitiHotelSig);
        _writeOut(ahmadId, sitiId, a, block.timestamp + sitiOffset);
        _log("ahmadId", ahmadId);
        _log("sitiId", sitiId);
    }

    function _writeOut(uint256 ahmadId, uint256 sitiId, string memory earmarkMismatch, uint256 sitiTicketBy) internal {
        vm.serializeString("seed", "earmarkMismatch", earmarkMismatch);
        vm.serializeString(
            "seed",
            "vendorClaimMissing",
            _signed(
                "b",
                "2. Director-signed hotel -> VendorClaimMissing",
                "DIRECTOR",
                ahmadId,
                HOTEL,
                9_000_000,
                "INV-HTL-DIR-0001"
            )
        );
        vm.serializeString(
            "seed",
            "flight",
            _signed(
                "c",
                "3. PT Contoh GSA airline 14M -> paid",
                "VENDOR_FLIGHT",
                ahmadId,
                FLIGHT,
                14_000_000,
                "INV-FLT-0001"
            )
        );
        vm.serializeString(
            "seed",
            "hotel",
            _signed("d", "4. Hotel Ahmad 9M -> paid", "VENDOR_HOTEL", ahmadId, HOTEL, 9_000_000, "INV-HTL-0003")
        );
        vm.serializeString(
            "seed",
            "visa",
            _signed("e", "5. Visa Ahmad 4M -> paid", "VENDOR_VISA", ahmadId, VISA, 4_000_000, "INV-VSA-0001")
        );
        vm.serializeString("seed", "ahmadBookingId", vm.toString(ahmadId));
        vm.serializeString("seed", "sitiBookingId", vm.toString(sitiId));
        vm.serializeAddress("seed", "agency", vm.addr(_pk("AGENCY")));
        vm.serializeAddress("seed", "pbm", address(pbm));
        vm.serializeUint("seed", "chainId", block.chainid);
        string memory out = vm.serializeUint("seed", "sitiTicketBy", sitiTicketBy);
        vm.writeJson(out, "./script/out/invoices.json");
    }

    function _signed(
        string memory key,
        string memory label,
        string memory signerRole,
        uint256 bookingId,
        uint8 line,
        uint256 amount,
        string memory ref
    ) internal returns (string memory) {
        MabrurPBM.Invoice memory inv = _invoice(bookingId, line, amount, ref);
        return _invoiceJson(key, label, inv, _sign(_pk(signerRole), inv));
    }
}
