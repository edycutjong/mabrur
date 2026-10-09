// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test } from "forge-std/Test.sol";
import { TIDR } from "../contracts/TIDR.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";

/// @notice Drives MabrurPBM with random valid AND adversarial calls. Invalid variants must revert; the handler
///         swallows the revert and counts any that slipped through. Ghosts mirror every rupiah that left the PBM.
contract MabrurHandler is Test {
    TIDR public tidr;
    ClaimRegistry public registry;
    MabrurPBM public pbm;
    address public issuer;

    address[3] public pilgrims;
    uint256[3] internal pilgrimPks;
    address[2] public agencies;
    address[3] public vendors; // FLIGHT → airline, HOTEL → hotel, VISA → visa
    uint256[3] internal vendorPks;
    address public director;
    uint256 internal directorPk;
    address public stranger;
    uint256 internal strangerPk;
    address public donor;

    uint256[] public bookingIds;
    mapping(uint256 => uint256) public ghostSpent;
    mapping(uint256 => uint256) public ghostMarginPaid;
    mapping(uint256 => uint256) public ghostRefunded;
    uint256 public directorReceived;
    uint256 public donated;
    uint256 public lateSpends; // successful spends while the booking was refundable
    uint256 public badCallsSucceeded; // invalid spend / release variants that did NOT revert
    uint64 public maxDepartBy;
    uint256 internal refNonce;

    mapping(bytes32 => uint256) public calls;

    constructor(TIDR tidr_, ClaimRegistry registry_, MabrurPBM pbm_, address issuer_) {
        tidr = tidr_;
        registry = registry_;
        pbm = pbm_;
        issuer = issuer_;

        string[3] memory pn = ["pilgrim0", "pilgrim1", "pilgrim2"];
        for (uint256 i; i < 3; ++i) {
            (pilgrims[i], pilgrimPks[i]) = makeAddrAndKey(pn[i]);
        }
        agencies[0] = makeAddr("agency0");
        agencies[1] = makeAddr("agency1");
        (vendors[0], vendorPks[0]) = makeAddrAndKey("airline");
        (vendors[1], vendorPks[1]) = makeAddrAndKey("hotel");
        (vendors[2], vendorPks[2]) = makeAddrAndKey("visa");
        (director, directorPk) = makeAddrAndKey("director");
        (stranger, strangerPk) = makeAddrAndKey("stranger");
        donor = makeAddr("donor");

        uint64 exp = uint64(block.timestamp + 50 * 365 days);
        vm.startPrank(issuer);
        registry.issueClaim(agencies[0], registry.PPIU_AGENCY(), exp);
        registry.issueClaim(agencies[1], registry.PPIU_AGENCY(), exp);
        registry.issueClaim(vendors[0], registry.AIRLINE(), exp);
        registry.issueClaim(vendors[1], registry.HOTEL(), exp);
        registry.issueClaim(vendors[2], registry.VISA_PROVIDER(), exp);
        vm.stopPrank();
    }

    // ─── actions ──────────────────────────────────────────────────────────

    function book(uint256 pSeed, uint256 aSeed, uint256[4] memory lines, uint256 dSeed, uint256 tSeed) external {
        address p = pilgrims[pSeed % 3];
        address agency = agencies[aSeed % 2];

        lines[0] = bound(lines[0], 0, 20_000_000);
        lines[1] = bound(lines[1], 0, 15_000_000);
        lines[2] = bound(lines[2], 0, 5_000_000);
        if (lines[0] + lines[1] + lines[2] == 0) lines[1] = 1;
        lines[3] = bound(lines[3], 0, (lines[0] + lines[1] + lines[2]) / 4); // MARGIN ≤ 20 % of total
        uint256 total = lines[0] + lines[1] + lines[2] + lines[3];

        uint64 departBy = uint64(bound(dSeed, block.timestamp + 1, block.timestamp + pbm.MAX_HORIZON()));
        uint64 ticketBy = lines[0] == 0 ? departBy : uint64(bound(tSeed, block.timestamp + 1, departBy));

        if (tidr.balanceOf(p) < total) deal(address(tidr), p, total);
        _book(pSeed % 3, agency, lines, ticketBy, departBy, total);
    }

    function _book(uint256 pi, address agency, uint256[4] memory lines, uint64 ticketBy, uint64 departBy, uint256 total)
        internal
    {
        address p = pilgrims[pi];
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pilgrimPks[pi], _permitDigest(p, total, deadline));
        vm.prank(p);
        try pbm.book(agency, lines, ticketBy, departBy, deadline, v, r, s) returns (uint256 id) {
            bookingIds.push(id);
            if (departBy > maxDepartBy) maxDepartBy = departBy;
            calls["book.ok"]++;
        } catch {
            // only legitimate failure: agency1's PPIU claim was revoked
            if (registry.hasValidClaim(agency, registry.PPIU_AGENCY())) badCallsSucceeded++;
            calls["book.revert"]++;
        }
    }

    /// @param variant 0 valid · 1 cross-booking · 2 director-signed · 3 over-line · 4 bad line index
    function spend(uint256 bSeed, uint256 variant, uint256 lineSeed, uint256 amtSeed) external {
        if (bookingIds.length == 0) return;
        uint256 id = bookingIds[bSeed % bookingIds.length];
        MabrurPBM.Booking memory b = pbm.booking(id);
        variant = variant % 5;
        uint8 line = uint8(lineSeed % 3);
        uint256 pk = vendorPks[line];
        uint256 rem = b.remaining[line];

        MabrurPBM.Invoice memory inv = MabrurPBM.Invoice({
            bookingId: id, line: line, amount: 0, ref: bytes32(++refNonce), expiry: uint64(block.timestamp + 1 days)
        });

        if (variant == 0) {
            if (rem == 0) return;
            inv.amount = line == 0 ? rem : bound(amtSeed, 1, rem);
        } else if (variant == 1) {
            inv.bookingId = bookingIds[(bSeed % bookingIds.length + 1) % bookingIds.length];
            if (inv.bookingId == id) inv.bookingId = id ^ 1;
            inv.amount = rem == 0 ? 1 : bound(amtSeed, 1, rem);
        } else if (variant == 2) {
            pk = directorPk;
            inv.amount = rem == 0 ? 1 : bound(amtSeed, 1, rem);
        } else if (variant == 3) {
            inv.amount = rem + bound(amtSeed, 1, 1_000_000);
        } else {
            inv.line = uint8(bound(lineSeed, 4, 255));
            inv.amount = bound(amtSeed, 1, 1_000_000);
        }

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pbm.hashInvoice(inv));
        bool wasRefundable = pbm.refundable(id);
        uint256 dirBefore = tidr.balanceOf(director);

        vm.prank(b.agency);
        try pbm.spend(id, inv, abi.encodePacked(r, s, v)) {
            ghostSpent[id] += inv.amount;
            if (wasRefundable) lateSpends++;
            if (variant != 0) badCallsSucceeded++;
            calls["spend.ok"]++;
        } catch {
            calls["spend.revert"]++;
        }
        directorReceived += tidr.balanceOf(director) - dirBefore;
    }

    /// @param who 0 pilgrim · 1 flight vendor · 2 non-flight vendor · 3 stranger
    function releaseMargin(uint256 bSeed, uint256 who) external {
        if (bookingIds.length == 0) return;
        uint256 id = bookingIds[bSeed % bookingIds.length];
        MabrurPBM.Booking memory b = pbm.booking(id);
        who = who % 4;

        uint256 pk;
        if (who == 0) pk = pilgrimPks[_pilgrimIndex(b.pilgrim)];
        else if (who == 1) pk = vendorPks[0];
        else if (who == 2) pk = vendorPks[1 + (bSeed % 2)];
        else pk = strangerPk;

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, pbm.hashDeparture(id));
        uint256 m = b.remaining[3];
        try pbm.releaseMargin(id, abi.encodePacked(r, s, v)) {
            ghostMarginPaid[id] += m;
            if (who >= 2) badCallsSucceeded++;
            if (who == 1 && b.flightVendor != vendors[0]) badCallsSucceeded++;
            if (b.refunded || b.marginReleased) badCallsSucceeded++;
            calls["release.ok"]++;
        } catch {
            calls["release.revert"]++;
        }
    }

    function refund(uint256 bSeed) external {
        if (bookingIds.length == 0) return;
        uint256 id = bookingIds[bSeed % bookingIds.length];
        uint256 amt = _sum(pbm.booking(id).remaining);
        try pbm.refund(id) {
            ghostRefunded[id] += amt;
            calls["refund.ok"]++;
        } catch {
            calls["refund.revert"]++;
        }
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 20 days));
        calls["warp"]++;
    }

    /// @dev Rare (1 in 10 calls actually revokes) so the rest of the run still exercises spends.
    function revokeClaim(uint256 seed) external {
        if (seed % 10 != 0) return;
        uint256 t = (seed / 10) % 4;
        // topic ids are literals: a view call on registry here would consume the prank
        vm.prank(issuer);
        if (t == 0) registry.revokeClaim(vendors[0], 2);
        else if (t == 1) registry.revokeClaim(vendors[1], 3);
        else if (t == 2) registry.revokeClaim(vendors[2], 4);
        else registry.revokeClaim(agencies[1], 1);
        calls["revoke"]++;
    }

    function donate(uint256 amt) external {
        try tidr.faucet(donor) { }
        catch {
            return;
        }
        amt = bound(amt, 1, tidr.balanceOf(donor));
        vm.prank(donor);
        tidr.transfer(address(pbm), amt);
        donated += amt;
        calls["donate"]++;
    }

    // ─── end-of-run sweep (not a fuzz target) ───────────────────────────────

    function refundAll() external {
        vm.warp(uint256(maxDepartBy) + 1);
        for (uint256 i; i < bookingIds.length; ++i) {
            uint256 id = bookingIds[i];
            uint256 amt = _sum(pbm.booking(id).remaining);
            if (amt == 0) continue;
            pbm.refund(id); // must not revert: every booking is past departBy
            ghostRefunded[id] += amt;
        }
    }

    // ─── views ────────────────────────────────────────────────────────────

    function bookingCount() external view returns (uint256) {
        return bookingIds.length;
    }

    function sumRemaining(uint256 id) external view returns (uint256) {
        return _sum(pbm.booking(id).remaining);
    }

    function agencyCount() external pure returns (uint256) {
        return 2;
    }

    function _sum(uint256[4] memory r) internal pure returns (uint256) {
        return r[0] + r[1] + r[2] + r[3];
    }

    function _pilgrimIndex(address p) internal view returns (uint256) {
        for (uint256 i; i < 3; ++i) {
            if (pilgrims[i] == p) return i;
        }
        revert("unknown pilgrim");
    }

    function _permitDigest(address owner, uint256 value, uint256 deadline) internal view returns (bytes32) {
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
        return keccak256(abi.encodePacked("\x19\x01", tidr.DOMAIN_SEPARATOR(), structHash));
    }
}

/// @notice N1 proof: across R runs × D calls the money never leaks. `forge test --match-contract Invariant -vv`.
contract InvariantTest is Test {
    TIDR internal tidr;
    ClaimRegistry internal registry;
    MabrurPBM internal pbm;
    MabrurHandler internal handler;

    function setUp() public {
        vm.warp(1_760_000_000);
        address regulator = makeAddr("regulator");
        address issuer = makeAddr("issuer");
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

        handler = new MabrurHandler(tidr, registry, pbm, issuer);

        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = MabrurHandler.book.selector;
        selectors[1] = MabrurHandler.spend.selector;
        selectors[2] = MabrurHandler.releaseMargin.selector;
        selectors[3] = MabrurHandler.refund.selector;
        selectors[4] = MabrurHandler.warp.selector;
        selectors[5] = MabrurHandler.revokeClaim.selector;
        selectors[6] = MabrurHandler.donate.selector;
        targetSelector(FuzzSelector({ addr: address(handler), selectors: selectors }));
        targetContract(address(handler));
    }

    function _sumAllRemaining() internal view returns (uint256 sum) {
        uint256 n = handler.bookingCount();
        for (uint256 i; i < n; ++i) {
            sum += handler.sumRemaining(handler.bookingIds(i));
        }
    }

    function invariant_conservation() public view {
        uint256 supply = pbm.totalSupply();
        assertEq(_sumAllRemaining(), supply, "sum remaining != supply");
        assertEq(pbm.totalEarmarked(), supply, "totalEarmarked != supply");
        assertEq(tidr.balanceOf(address(pbm)), supply + handler.donated(), "held != supply + donated");
    }

    function invariant_agencyLedger() public view {
        uint256 sum;
        for (uint256 i; i < 2; ++i) {
            address a = handler.agencies(i);
            uint256 earmarked = pbm.agencyEarmarked(a);
            sum += earmarked;
            assertEq(pbm.agencyDeposited(a) - pbm.agencyPaidOut(a), earmarked, "deposited - paidOut != earmarked");
            (, uint256 liabilities, uint256 e) = pbm.regulatorView(a);
            assertEq(liabilities, e, "regulatorView mismatch");
        }
        assertEq(sum, pbm.totalSupply(), "sum agencyEarmarked != supply");
    }

    function invariant_perBooking() public view {
        uint256 n = handler.bookingCount();
        for (uint256 i; i < n; ++i) {
            uint256 id = handler.bookingIds(i);
            assertEq(
                pbm.booking(id).deposited,
                handler.sumRemaining(id) + handler.ghostSpent(id) + handler.ghostMarginPaid(id)
                    + handler.ghostRefunded(id),
                "per-booking conservation"
            );
        }
    }

    function invariant_solvency() public view {
        assertGe(tidr.balanceOf(address(pbm)), pbm.totalSupply(), "insolvent");
    }

    function invariant_noLeakToUnclaimed() public view {
        assertEq(handler.directorReceived(), 0, "director received funds");
        assertEq(tidr.balanceOf(handler.director()), 0, "director holds tIDR");
    }

    function invariant_noLateSpend() public view {
        assertEq(handler.lateSpends(), 0, "spend while refundable");
    }

    function invariant_invalidCallsRevert() public view {
        assertEq(handler.badCallsSucceeded(), 0, "an invalid call succeeded");
    }

    function afterInvariant() public {
        handler.refundAll();
        assertEq(pbm.totalSupply(), 0, "supply left after sweep");
        assertEq(tidr.balanceOf(address(pbm)), handler.donated(), "held != donated after sweep");
        invariant_perBooking();
        invariant_agencyLedger();
    }
}
