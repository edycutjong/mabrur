// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { TIDR } from "../contracts/TIDR.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";

/// @notice Shared plumbing for the demo scripts. Keys come from the environment (~/.config/mabrur/keys.env,
///         loaded by script/run.sh) and never live in this repo. Addresses come from TIDR_ADDR / REGISTRY_ADDR / PBM_ADDR.
abstract contract MabrurScript is Script {
    TIDR internal tidr;
    ClaimRegistry internal registry;
    MabrurPBM internal pbm;

    uint8 internal constant FLIGHT = 0;
    uint8 internal constant HOTEL = 1;
    uint8 internal constant VISA = 2;

    function _load() internal {
        tidr = TIDR(vm.envAddress("TIDR_ADDR"));
        registry = ClaimRegistry(vm.envAddress("REGISTRY_ADDR"));
        pbm = MabrurPBM(vm.envAddress("PBM_ADDR"));
    }

    function _pk(string memory role) internal view returns (uint256) {
        return vm.envUint(string.concat(role, "_PK"));
    }

    function _split() internal pure returns (uint256[4] memory) {
        return [uint256(14_000_000), 9_000_000, 4_000_000, 5_000_000];
    }

    /// @dev Faucet only below Rp 32.000.000 (cap is 100 calls per address per UTC day).
    function _fund(uint256 payerPk, address pilgrim) internal {
        if (tidr.balanceOf(pilgrim) < tidr.FAUCET_AMOUNT()) {
            vm.broadcast(payerPk);
            tidr.faucet(pilgrim);
        }
    }

    /// @dev One EIP-2612 permit signature + one book tx; returns the per-pilgrim booking id.
    function _book(uint256 pilgrimPk, address agency, uint256[4] memory lines, uint64 ticketBy, uint64 departBy)
        internal
        returns (uint256 id)
    {
        address pilgrim = vm.addr(pilgrimPk);
        uint256 total = lines[0] + lines[1] + lines[2] + lines[3];
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                pilgrim,
                address(pbm),
                total,
                tidr.nonces(pilgrim),
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pilgrimPk, keccak256(abi.encodePacked("\x19\x01", tidr.DOMAIN_SEPARATOR(), structHash)));
        id = pbm.bookingIdOf(pilgrim, pbm.bookingNonce(pilgrim));
        vm.broadcast(pilgrimPk);
        pbm.book(agency, lines, ticketBy, departBy, deadline, v, r, s);
    }

    function _invoice(uint256 bookingId, uint8 line, uint256 amount, string memory ref)
        internal
        view
        returns (MabrurPBM.Invoice memory)
    {
        return MabrurPBM.Invoice({
            bookingId: bookingId,
            line: line,
            amount: amount,
            ref: bytes32(bytes(ref)),
            expiry: uint64(block.timestamp + 60 days)
        });
    }

    function _sign(uint256 vendorPk, MabrurPBM.Invoice memory inv) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(vendorPk, pbm.hashInvoice(inv));
        return abi.encodePacked(r, s, v);
    }

    function _signDeparture(uint256 pk, uint256 bookingId) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pbm.hashDeparture(bookingId));
        return abi.encodePacked(r, s, v);
    }

    function _spend(uint256 agencyPk, uint256 bookingId, MabrurPBM.Invoice memory inv, bytes memory sig) internal {
        vm.broadcast(agencyPk);
        pbm.spend(bookingId, inv, sig);
    }

    /// @dev Serialises a signed invoice as JSON the agency console can paste or load from file.
    function _invoiceJson(string memory key, string memory label, MabrurPBM.Invoice memory inv, bytes memory sig)
        internal
        returns (string memory)
    {
        vm.serializeString(key, "label", label);
        vm.serializeString(key, "bookingId", vm.toString(inv.bookingId));
        vm.serializeUint(key, "line", inv.line);
        vm.serializeString(key, "amount", vm.toString(inv.amount));
        vm.serializeBytes32(key, "ref", inv.ref);
        vm.serializeUint(key, "expiry", inv.expiry);
        return vm.serializeBytes(key, "signature", sig);
    }

    function _log(string memory what, uint256 id) internal pure {
        console.log(what);
        console.logBytes32(bytes32(id));
    }
}
