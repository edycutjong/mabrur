// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TIDR } from "../contracts/TIDR.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";

/// @notice Shared fixture: regulator-owned registry, one issuer, a licensed agency, one vendor per line,
///         a director with no claims, and two pilgrims (Ahmad, Siti) funded from the tIDR faucet.
abstract contract MabrurBase is Test {
    TIDR internal tidr;
    ClaimRegistry internal registry;
    MabrurPBM internal pbm;

    address internal regulator = makeAddr("regulator");
    address internal issuer = makeAddr("issuer");
    address internal agency = makeAddr("agency");
    uint256 internal agencyPk;
    address internal airline;
    uint256 internal airlinePk;
    address internal hotel;
    uint256 internal hotelPk;
    address internal visa;
    uint256 internal visaPk;
    address internal director;
    uint256 internal directorPk;
    address internal ahmad;
    uint256 internal ahmadPk;
    address internal siti;
    uint256 internal sitiPk;

    uint256 internal constant FLIGHT = 0;
    uint256 internal constant HOTEL = 1;
    uint256 internal constant VISA = 2;
    uint256 internal constant MARGIN = 3;

    /// Rp 32.000.000 package: FLIGHT 14M · HOTEL 9M · VISA 4M · MARGIN 5M
    uint256[4] internal split = [uint256(14_000_000), 9_000_000, 4_000_000, 5_000_000];

    function setUp() public virtual {
        (agency, agencyPk) = makeAddrAndKey("agency");
        (airline, airlinePk) = makeAddrAndKey("airline");
        (hotel, hotelPk) = makeAddrAndKey("hotel");
        (visa, visaPk) = makeAddrAndKey("visa");
        (director, directorPk) = makeAddrAndKey("director");
        (ahmad, ahmadPk) = makeAddrAndKey("ahmad");
        (siti, sitiPk) = makeAddrAndKey("siti");

        vm.warp(1_760_000_000);
        tidr = new TIDR();
        registry = new ClaimRegistry(regulator);
        pbm = new MabrurPBM(tidr, registry);

        uint256[] memory topics = new uint256[](4);
        topics[0] = 1;
        topics[1] = 2;
        topics[2] = 3;
        topics[3] = 4;
        vm.prank(regulator);
        registry.addTrustedIssuer(issuer, topics);

        uint64 exp = uint64(block.timestamp + 365 days);
        vm.startPrank(issuer);
        registry.issueClaim(agency, 1, exp);
        registry.issueClaim(airline, 2, exp);
        registry.issueClaim(hotel, 3, exp);
        registry.issueClaim(visa, 4, exp);
        vm.stopPrank();

        tidr.faucet(ahmad);
        tidr.faucet(siti);
    }

    // ─── helpers ──────────────────────────────────────────────────────────

    function _permit(uint256 pk, address owner, uint256 value, uint256 deadline)
        internal
        view
        returns (uint8 v, bytes32 r, bytes32 s)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
                owner,
                address(pbm),
                value,
                tidr.nonces(owner),
                deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", tidr.DOMAIN_SEPARATOR(), structHash));
        (v, r, s) = vm.sign(pk, digest);
    }

    function _book(uint256 pk, uint256[4] memory lines, uint64 ticketBy, uint64 departBy) internal returns (uint256) {
        address who = vm.addr(pk);
        uint256 total = lines[0] + lines[1] + lines[2] + lines[3];
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(pk, who, total, deadline);
        vm.prank(who);
        return pbm.book(agency, lines, ticketBy, departBy, deadline, v, r, s);
    }

    /// @dev Signs the permit first, so the expected revert lands on `book`, not on a helper view call.
    function _bookExpectRevert(uint256 pk, uint256[4] memory lines, uint64 ticketBy, uint64 departBy, bytes memory err)
        internal
    {
        address who = vm.addr(pk);
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(pk, who, lines[0] + lines[1] + lines[2] + lines[3], deadline);
        vm.prank(who);
        vm.expectRevert(err);
        pbm.book(agency, lines, ticketBy, departBy, deadline, v, r, s);
    }

    function _bookAhmad() internal returns (uint256) {
        return _book(ahmadPk, split, uint64(block.timestamp + 20 days), uint64(block.timestamp + 30 days));
    }

    function _bookSiti(uint64 ticketBy) internal returns (uint256) {
        return _book(sitiPk, split, ticketBy, uint64(block.timestamp + 30 days));
    }

    function _invoice(uint256 bookingId, uint8 line, uint256 amount, bytes32 ref)
        internal
        view
        returns (MabrurPBM.Invoice memory)
    {
        return MabrurPBM.Invoice({
            bookingId: bookingId, line: line, amount: amount, ref: ref, expiry: uint64(block.timestamp + 7 days)
        });
    }

    function _sign(uint256 pk, MabrurPBM.Invoice memory inv) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pbm.hashInvoice(inv));
        return abi.encodePacked(r, s, v);
    }

    function _signDeparture(uint256 pk, uint256 bookingId) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pbm.hashDeparture(bookingId));
        return abi.encodePacked(r, s, v);
    }

    function _spend(uint256 bookingId, uint256 vendorPk, uint8 line, uint256 amount, bytes32 ref) internal {
        MabrurPBM.Invoice memory inv = _invoice(bookingId, line, amount, ref);
        bytes memory sig = _sign(vendorPk, inv);
        vm.prank(agency);
        pbm.spend(bookingId, inv, sig);
    }

    function _remaining(uint256 id) internal view returns (uint256[4] memory) {
        return pbm.booking(id).remaining;
    }
}
