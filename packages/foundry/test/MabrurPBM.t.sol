// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MabrurBase } from "./MabrurBase.t.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";

contract MabrurPBMTest is MabrurBase {
    // ─── book ─────────────────────────────────────────────────────────────

    function test_Book_WrapsPrepaymentIntoEarmark() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Booking memory b = pbm.booking(id);
        assertEq(b.pilgrim, ahmad);
        assertEq(b.agency, agency);
        assertEq(b.deposited, 32_000_000);
        assertEq(_remaining(id)[FLIGHT], 14_000_000);
        assertEq(_remaining(id)[MARGIN], 5_000_000);
        assertEq(pbm.balanceOf(ahmad), 32_000_000);
        assertEq(tidr.balanceOf(address(pbm)), 32_000_000);
        assertEq(tidr.balanceOf(ahmad), 0);
        assertEq(id, pbm.bookingIdOf(ahmad, 0));
        assertEq(pbm.bookingNonce(ahmad), 1);
    }

    function test_Book_WorksWithPlainAllowanceWhenPermitIsGarbage() public {
        vm.prank(ahmad);
        tidr.approve(address(pbm), 32_000_000);
        vm.prank(ahmad);
        uint256 id = pbm.book(
            agency,
            split,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            0,
            0,
            bytes32(0),
            bytes32(0)
        );
        assertEq(pbm.booking(id).deposited, 32_000_000);
    }

    function test_Book_FrontRunPermitDoesNotBrickBooking() public {
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(ahmadPk, ahmad, 32_000_000, deadline);
        tidr.permit(ahmad, address(pbm), 32_000_000, deadline, v, r, s); // griefer submits it first
        vm.prank(ahmad);
        pbm.book(agency, split, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), deadline, v, r, s);
        assertEq(pbm.balanceOf(ahmad), 32_000_000);
    }

    function test_Book_RevertsAgencyNotLicensed() public {
        address rogue = makeAddr("rogue");
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = _permit(ahmadPk, ahmad, 32_000_000, deadline);
        vm.prank(ahmad);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.AgencyNotLicensed.selector, rogue));
        pbm.book(rogue, split, uint64(block.timestamp + 1 days), uint64(block.timestamp + 2 days), deadline, v, r, s);
    }

    function test_Book_RevertsInvalidDepartBy_Past() public {
        _bookExpectRevert(
            ahmadPk,
            split,
            uint64(block.timestamp),
            uint64(block.timestamp),
            abi.encodeWithSelector(MabrurPBM.InvalidDepartBy.selector)
        );
    }

    function test_Book_RevertsInvalidDepartBy_Beyond180Days() public {
        _bookExpectRevert(
            ahmadPk,
            split,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 181 days),
            abi.encodeWithSelector(MabrurPBM.InvalidDepartBy.selector)
        );
    }

    function test_Book_Accepts180DayHorizon() public {
        uint256 id = _book(ahmadPk, split, uint64(block.timestamp + 1 days), uint64(block.timestamp + 180 days));
        assertEq(pbm.booking(id).deposited, 32_000_000);
    }

    function test_Book_RevertsInvalidTicketBy_AfterDepartBy() public {
        _bookExpectRevert(
            ahmadPk,
            split,
            uint64(block.timestamp + 31 days),
            uint64(block.timestamp + 30 days),
            abi.encodeWithSelector(MabrurPBM.InvalidTicketBy.selector)
        );
    }

    function test_Book_RevertsInvalidTicketBy_NotInFuture() public {
        _bookExpectRevert(
            ahmadPk,
            split,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            abi.encodeWithSelector(MabrurPBM.InvalidTicketBy.selector)
        );
    }

    function test_Book_RevertsInvalidTicketBy_NoFlightLineWithEarlyTicketBy() public {
        uint256[4] memory noFlight = [uint256(0), 20_000_000, 4_000_000, 1_000_000];
        _bookExpectRevert(
            ahmadPk,
            noFlight,
            uint64(block.timestamp + 10 days),
            uint64(block.timestamp + 30 days),
            abi.encodeWithSelector(MabrurPBM.InvalidTicketBy.selector)
        );
    }

    function test_Book_RevertsInvalidSplit_Zero() public {
        uint256[4] memory zero;
        _bookExpectRevert(
            ahmadPk,
            zero,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            abi.encodeWithSelector(MabrurPBM.InvalidSplit.selector)
        );
    }

    function test_Book_RevertsInvalidSplit_MarginAbove20Percent() public {
        uint256[4] memory greedy = [uint256(14_000_000), 6_000_000, 4_000_000, 8_000_000]; // 25 %
        _bookExpectRevert(
            ahmadPk,
            greedy,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            abi.encodeWithSelector(MabrurPBM.InvalidSplit.selector)
        );
    }

    function test_Book_PerPilgrimIdsUnaffectedByOtherBookers() public {
        uint256 expected = pbm.bookingIdOf(ahmad, 0);
        _bookSiti(uint64(block.timestamp + 1 days)); // a third party books first
        assertEq(_bookAhmad(), expected);
    }

    // ─── the demo sequence ────────────────────────────────────────────────

    function test_Demo_EarmarkMismatch_SitiInvoiceOnAhmadBooking() public {
        uint256 ahmadId = _bookAhmad();
        uint256 sitiId = _bookSiti(uint64(block.timestamp + 1 days));
        MabrurPBM.Invoice memory inv = _invoice(sitiId, uint8(HOTEL), 9_000_000, "INV-HTL-0001");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.EarmarkMismatch.selector, ahmadId, sitiId));
        pbm.spend(ahmadId, inv, sig);
    }

    function test_Demo_VendorClaimMissing_DirectorCannotBePaid() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 9_000_000, "INV-HTL-DIR");
        bytes memory sig = _sign(directorPk, inv);
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.VendorClaimMissing.selector, director, uint256(3)));
        pbm.spend(id, inv, sig);
    }

    function test_Demo_FlightSpendPaysTheSignerNotTheAgency() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        assertEq(tidr.balanceOf(airline), 14_000_000);
        assertEq(tidr.balanceOf(agency), 0);
        assertEq(_remaining(id)[FLIGHT], 0);
        assertEq(pbm.balanceOf(ahmad), 18_000_000);
        assertEq(pbm.booking(id).flightVendor, airline);
    }

    function test_Demo_NotDeparted_AgencyCannotSignDeparture() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        bytes memory sig = _signDeparture(agencyPk, id);
        vm.expectRevert(MabrurPBM.NotDeparted.selector);
        pbm.releaseMargin(id, sig);
    }

    function test_Demo_PilgrimDepartureReleasesMargin() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        pbm.releaseMargin(id, _signDeparture(ahmadPk, id));
        assertEq(tidr.balanceOf(agency), 5_000_000);
        assertTrue(pbm.booking(id).marginReleased);
        assertTrue(pbm.booking(id).departed);
    }

    function test_Demo_RefundAtTicketBy_NoFlight() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        _spend(id, hotelPk, uint8(HOTEL), 9_000_000, "INV-HTL-0001");
        vm.warp(block.timestamp + 301);
        assertTrue(pbm.refundable(id));
        address neighbour = makeAddr("neighbour");
        vm.prank(neighbour); // anyone may trigger it
        pbm.refund(id);
        assertEq(tidr.balanceOf(siti), 23_000_000); // every unspent rupiah back
        assertEq(pbm.balanceOf(siti), 0);
        assertTrue(pbm.booking(id).refunded);
    }

    // ─── spend guards ─────────────────────────────────────────────────────

    function test_Spend_RevertsNotBookingAgency() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.expectRevert(MabrurPBM.NotBookingAgency.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsInvalidLine() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, 7, 1, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.InvalidLine.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsUseReleaseMargin() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(MARGIN), 1, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.UseReleaseMargin.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsInvoiceExpired() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.warp(inv.expiry + 1);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.InvoiceExpired.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsBadSignature() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1, "x");
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.BadSignature.selector);
        pbm.spend(id, inv, hex"1234");
    }

    function test_Spend_RevertsInvoiceReplayed() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1_000_000, "INV-HTL-0002");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        pbm.spend(id, inv, sig);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.InvoiceReplayed.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsSelfDealing_LicensedAgencyAsVendor() public {
        vm.prank(issuer);
        registry.issueClaim(agency, 3, uint64(block.timestamp + 30 days)); // agency also holds a HOTEL claim
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1, "x");
        bytes memory sig = _sign(agencyPk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.SelfDealing.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsZeroAmount() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 0, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.ZeroAmount.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsLineExceeded() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 9_000_001, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.LineExceeded.selector, uint8(HOTEL), uint256(9_000_000)));
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsFlightNotFullyPaid_Rp1TicketIsNotATicket() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(FLIGHT), 1, "INV-FLT-RP1");
        bytes memory sig = _sign(airlinePk, inv);
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.FlightNotFullyPaid.selector, uint256(14_000_000), uint256(1)));
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevertsFlightAlreadyPurchased() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(FLIGHT), 14_000_000, "INV-FLT-0002");
        bytes memory sig = _sign(airlinePk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.FlightAlreadyPurchased.selector);
        pbm.spend(id, inv, sig);
    }

    function test_Spend_RevokedVendorClaimBlocksPayment() public {
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 9_000_000, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(issuer);
        registry.revokeClaim(hotel, 3);
        vm.prank(agency);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.VendorClaimMissing.selector, hotel, uint256(3)));
        pbm.spend(id, inv, sig);
        assertEq(_remaining(id)[HOTEL], 9_000_000); // money stays earmarked
    }

    function test_SpendBlockedAfterTicketBy() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), 1, "x");
        bytes memory sig = _sign(hotelPk, inv);
        vm.warp(block.timestamp + 301);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.DeadlinePassed.selector);
        pbm.spend(id, inv, sig);
    }

    // ─── releaseMargin ────────────────────────────────────────────────────

    function test_ReleaseMargin_AirlineCoSigns() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        pbm.releaseMargin(id, _signDeparture(airlinePk, id));
        assertEq(tidr.balanceOf(agency), 5_000_000);
    }

    function test_ReleaseMargin_RevokedAirlineCannotCoSign() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        vm.prank(issuer);
        registry.revokeClaim(airline, 2);
        bytes memory sig = _signDeparture(airlinePk, id);
        vm.expectRevert(MabrurPBM.NotDeparted.selector);
        pbm.releaseMargin(id, sig);
    }

    function test_ReleaseMargin_UnpaidAirlineCannotCoSign() public {
        uint256 id = _bookAhmad();
        bytes memory sig = _signDeparture(airlinePk, id);
        vm.expectRevert(MabrurPBM.NotDeparted.selector);
        pbm.releaseMargin(id, sig);
    }

    function test_ReleaseMargin_RevertsMarginAlreadyReleased() public {
        uint256 id = _bookAhmad();
        bytes memory sig = _signDeparture(ahmadPk, id);
        pbm.releaseMargin(id, sig);
        vm.expectRevert(MabrurPBM.MarginAlreadyReleased.selector);
        pbm.releaseMargin(id, sig);
    }

    function test_ReleaseMargin_BlockedAfterRefund() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        vm.warp(block.timestamp + 301);
        pbm.refund(id);
        bytes memory sig = _signDeparture(sitiPk, id);
        vm.expectRevert(MabrurPBM.MarginAlreadyReleased.selector);
        pbm.releaseMargin(id, sig);
    }

    function test_ReleaseMargin_RevokedAgencyCannotTakeMargin() public {
        uint256 id = _bookAhmad();
        vm.prank(issuer);
        registry.revokeClaim(agency, 1);
        bytes memory sig = _signDeparture(ahmadPk, id);
        vm.expectRevert(abi.encodeWithSelector(MabrurPBM.AgencyNotLicensed.selector, agency));
        pbm.releaseMargin(id, sig);
        // …and the pilgrim is never stuck: refund still works after departBy
        vm.warp(block.timestamp + 31 days);
        pbm.refund(id);
        assertEq(tidr.balanceOf(ahmad), 32_000_000);
    }

    // ─── refund ───────────────────────────────────────────────────────────

    function test_Refund_RevertsNotYetRefundable() public {
        uint256 id = _bookAhmad();
        vm.expectRevert(MabrurPBM.NotYetRefundable.selector);
        pbm.refund(id);
    }

    function test_NoEarlyRefund_FlightPaid() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        vm.warp(block.timestamp + 301);
        vm.expectRevert(MabrurPBM.NotYetRefundable.selector);
        pbm.refund(id);
    }

    function test_Refund_AfterDepartByReturnsRemainderExceptReleasedMargin() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        pbm.releaseMargin(id, _signDeparture(ahmadPk, id));
        vm.warp(block.timestamp + 31 days);
        pbm.refund(id);
        assertEq(tidr.balanceOf(ahmad), 13_000_000); // HOTEL 9M + VISA 4M never spent
    }

    function test_Refund_RevertsNothingToRefund() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        vm.warp(block.timestamp + 301);
        pbm.refund(id);
        vm.expectRevert(MabrurPBM.NothingToRefund.selector);
        pbm.refund(id);
    }

    // ─── token rules ──────────────────────────────────────────────────────

    function test_NonTransferable_AhmadCannotMoveClaimToSiti() public {
        _bookAhmad();
        vm.prank(ahmad);
        vm.expectRevert(MabrurPBM.NonTransferable.selector);
        pbm.transfer(siti, 1);
    }

    function test_DirectDepositDisabled() public {
        vm.expectRevert(MabrurPBM.DirectDepositDisabled.selector);
        pbm.depositFor(ahmad, 1);
    }

    function test_DirectWithdrawDisabled() public {
        _bookAhmad();
        vm.prank(ahmad);
        vm.expectRevert(MabrurPBM.DirectWithdrawDisabled.selector);
        pbm.withdrawTo(ahmad, 1);
    }

    function test_Decimals_FollowRupiah() public view {
        assertEq(pbm.decimals(), 0);
        assertEq(tidr.decimals(), 0);
    }

    // ─── regulator view ───────────────────────────────────────────────────

    function test_RegulatorView_LiabilitiesFullyBacked() public {
        uint256 a = _bookAhmad();
        uint256 s = _bookSiti(uint64(block.timestamp + 300));
        _spend(a, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        _spend(s, hotelPk, uint8(HOTEL), 9_000_000, "INV-HTL-0001");
        (uint256 open, uint256 liabilities, uint256 earmarked) = pbm.regulatorView(agency);
        assertEq(open, 2);
        assertEq(liabilities, 64_000_000 - 23_000_000);
        assertEq(earmarked, liabilities);
        (uint256 sumEarmarks, uint256 supply, uint256 held) = pbm.conservation();
        assertEq(sumEarmarks, supply);
        assertEq(held, supply);
        vm.warp(block.timestamp + 301);
        pbm.refund(s);
        (open,,) = pbm.regulatorView(agency);
        assertEq(open, 1);
    }

    function test_Conservation_DonationShowsAsSurplusNotGap() public {
        _bookAhmad();
        address donor = makeAddr("donor");
        tidr.faucet(donor);
        vm.prank(donor);
        tidr.transfer(address(pbm), 1_000);
        (, uint256 supply, uint256 held) = pbm.conservation();
        assertEq(held, supply + 1_000);
    }

    // ─── lifecycles (gas snapshots feed N3) ───────────────────────────────

    function test_Lifecycle_HappyPath() public {
        uint256 id = _bookAhmad();
        _spend(id, airlinePk, uint8(FLIGHT), 14_000_000, "INV-FLT-0001");
        _spend(id, hotelPk, uint8(HOTEL), 9_000_000, "INV-HTL-0001");
        _spend(id, visaPk, uint8(VISA), 4_000_000, "INV-VSA-0001");
        pbm.releaseMargin(id, _signDeparture(ahmadPk, id));
        assertEq(pbm.totalSupply(), 0);
        assertEq(tidr.balanceOf(address(pbm)), 0);
        (uint256 open, uint256 liabilities,) = pbm.regulatorView(agency);
        assertEq(open, 0);
        assertEq(liabilities, 0);
    }

    function test_Lifecycle_Refund() public {
        uint256 id = _bookSiti(uint64(block.timestamp + 300));
        _spend(id, hotelPk, uint8(HOTEL), 9_000_000, "INV-HTL-0001");
        vm.warp(block.timestamp + 301);
        pbm.refund(id);
        assertEq(pbm.totalSupply(), 0);
        assertEq(tidr.balanceOf(address(pbm)), 0);
    }

    // ─── T1: captured issuer is bounded ───────────────────────────────────

    function test_CaptureIssuer_Bound() public {
        uint256 open = _bookAhmad();
        uint256 expired = _bookSiti(uint64(block.timestamp + 300));
        // a captured registry owner trusts a rogue issuer, who certifies the director
        address rogue = makeAddr("rogueIssuer");
        uint256[] memory topics = new uint256[](2);
        topics[0] = 2;
        topics[1] = 3;
        vm.prank(regulator);
        registry.addTrustedIssuer(rogue, topics);
        vm.startPrank(rogue);
        registry.issueClaim(director, 2, uint64(block.timestamp + 365 days));
        registry.issueClaim(director, 3, uint64(block.timestamp + 365 days));
        vm.stopPrank();
        vm.warp(block.timestamp + 301); // Siti's booking is now refund-only

        uint256 bound = _remaining(open)[FLIGHT] + _remaining(open)[HOTEL] + _remaining(open)[VISA];
        _spend(open, directorPk, uint8(FLIGHT), 14_000_000, "DIR-FLT");
        _spend(open, directorPk, uint8(HOTEL), 9_000_000, "DIR-HTL");
        pbm.releaseMargin(open, _signDeparture(directorPk, open)); // director co-signs as "airline"

        MabrurPBM.Invoice memory inv = _invoice(expired, uint8(HOTEL), 9_000_000, "DIR-HTL-2");
        bytes memory sig = _sign(directorPk, inv);
        vm.prank(agency);
        vm.expectRevert(MabrurPBM.DeadlinePassed.selector);
        pbm.spend(expired, inv, sig);

        assertLe(tidr.balanceOf(director), bound);
        assertEq(tidr.balanceOf(agency), 5_000_000); // margin only ever goes to the agency
        pbm.refund(expired);
        assertEq(tidr.balanceOf(siti), 32_000_000);
    }

    // ─── fuzz ─────────────────────────────────────────────────────────────

    function testFuzz_Split(uint256[4] memory lines) public {
        for (uint256 i; i < 4; ++i) {
            lines[i] = bound(lines[i], 0, 8_000_000);
        }
        uint256 total = lines[0] + lines[1] + lines[2] + lines[3];
        uint64 departBy = uint64(block.timestamp + 30 days);
        uint64 ticketBy = lines[FLIGHT] == 0 ? departBy : uint64(block.timestamp + 1 days);
        if (total == 0 || lines[MARGIN] * 5 > total) {
            _bookExpectRevert(
                ahmadPk, lines, ticketBy, departBy, abi.encodeWithSelector(MabrurPBM.InvalidSplit.selector)
            );
            return;
        }
        uint256 id = _book(ahmadPk, lines, ticketBy, departBy);
        assertEq(pbm.booking(id).deposited, total);
        assertEq(pbm.totalSupply(), total);
    }

    function testFuzz_SpendNeverExceedsLine(uint256 amount) public {
        amount = bound(amount, 1, 20_000_000);
        uint256 id = _bookAhmad();
        MabrurPBM.Invoice memory inv = _invoice(id, uint8(HOTEL), amount, "fuzz");
        bytes memory sig = _sign(hotelPk, inv);
        vm.prank(agency);
        if (amount > 9_000_000) {
            vm.expectRevert(abi.encodeWithSelector(MabrurPBM.LineExceeded.selector, uint8(HOTEL), uint256(9_000_000)));
        }
        pbm.spend(id, inv, sig);
        assertEq(_remaining(id)[HOTEL] + tidr.balanceOf(hotel), 9_000_000);
    }
}

contract ClaimRegistryTest is MabrurBase {
    function test_RevertsNotRegistryOwner() public {
        uint256[] memory topics = new uint256[](1);
        topics[0] = 3;
        vm.prank(agency); // the agency can never make itself an issuer
        vm.expectRevert(ClaimRegistry.NotRegistryOwner.selector);
        registry.addTrustedIssuer(agency, topics);
    }

    function test_RevertsIssuerNotTrustedForTopic() public {
        vm.prank(director);
        vm.expectRevert(abi.encodeWithSelector(ClaimRegistry.IssuerNotTrustedForTopic.selector, director, uint256(3)));
        registry.issueClaim(director, 3, uint64(block.timestamp + 1 days));
    }

    function test_RevertsNotClaimIssuer() public {
        vm.prank(director);
        vm.expectRevert(ClaimRegistry.NotClaimIssuer.selector);
        registry.revokeClaim(hotel, 3);
    }

    function test_RevertsInvalidExpiry() public {
        vm.prank(issuer);
        vm.expectRevert(ClaimRegistry.InvalidExpiry.selector);
        registry.issueClaim(hotel, 3, uint64(block.timestamp));
    }

    function test_RevertsUnknownTopic() public {
        vm.prank(issuer);
        vm.expectRevert(abi.encodeWithSelector(ClaimRegistry.UnknownTopic.selector, uint256(9)));
        registry.issueClaim(hotel, 9, uint64(block.timestamp + 1 days));
    }

    function test_ClaimExpires() public {
        assertTrue(registry.hasValidClaim(hotel, 3));
        vm.warp(block.timestamp + 366 days);
        assertFalse(registry.hasValidClaim(hotel, 3));
    }

    function test_RemovingIssuerInvalidatesItsClaims() public {
        vm.prank(regulator);
        registry.removeTrustedIssuer(issuer);
        assertFalse(registry.hasValidClaim(hotel, 3));
        assertFalse(registry.isTrustedIssuer(issuer));
    }

    function test_OtherIssuerCannotUnrevokeOrOverwriteClaim() public {
        address issuerB = makeAddr("issuerB");
        uint256[] memory topics = new uint256[](2);
        topics[0] = 1;
        topics[1] = 2;
        vm.prank(regulator);
        registry.addTrustedIssuer(issuerB, topics);
        vm.prank(issuer);
        registry.revokeClaim(airline, 2);
        vm.startPrank(issuerB);
        vm.expectRevert(ClaimRegistry.NotClaimIssuer.selector);
        registry.issueClaim(airline, 2, uint64(block.timestamp + 1 days)); // cannot un-revoke
        vm.expectRevert(ClaimRegistry.NotClaimIssuer.selector);
        registry.issueClaim(agency, 1, uint64(block.timestamp + 1)); // cannot cut the agency licence short
        vm.stopPrank();
        assertFalse(registry.hasValidClaim(airline, 2));
        assertTrue(registry.hasValidClaim(agency, 1));
    }

    function test_ReAddedIssuerDoesNotResurrectOldClaims() public {
        uint256[] memory topics = new uint256[](1);
        topics[0] = 3;
        vm.startPrank(regulator);
        registry.removeTrustedIssuer(issuer);
        registry.addTrustedIssuer(issuer, topics);
        vm.stopPrank();
        assertFalse(registry.hasValidClaim(hotel, 3));
        vm.prank(issuer);
        registry.issueClaim(hotel, 3, uint64(block.timestamp + 1 days)); // a fresh claim is valid again
        assertTrue(registry.hasValidClaim(hotel, 3));
    }

    function test_SuccessorIssuerCanReplaceRemovedIssuersClaim() public {
        address issuerB = makeAddr("issuerB");
        uint256[] memory topics = new uint256[](1);
        topics[0] = 3;
        vm.startPrank(regulator);
        registry.removeTrustedIssuer(issuer);
        registry.addTrustedIssuer(issuerB, topics);
        vm.stopPrank();
        vm.prank(issuerB);
        registry.issueClaim(hotel, 3, uint64(block.timestamp + 1 days));
        assertTrue(registry.hasValidClaim(hotel, 3));
    }

    function test_NarrowedThenRestoredTopicDoesNotResurrectClaims() public {
        uint256[] memory noAirline = new uint256[](3);
        noAirline[0] = 1;
        noAirline[1] = 3;
        noAirline[2] = 4;
        uint256[] memory all = new uint256[](4);
        (all[0], all[1], all[2], all[3]) = (1, 2, 3, 4);
        vm.startPrank(regulator);
        registry.addTrustedIssuer(issuer, noAirline);
        assertFalse(registry.hasValidClaim(airline, 2));
        assertTrue(registry.hasValidClaim(hotel, 3)); // kept topics stay valid
        registry.addTrustedIssuer(issuer, all);
        vm.stopPrank();
        assertFalse(registry.hasValidClaim(airline, 2));
        assertTrue(registry.hasValidClaim(hotel, 3));
    }

    function test_ExpiredClaimOfOtherIssuerDoesNotBlockRecertification() public {
        address issuerB = makeAddr("issuerB");
        uint256[] memory topics = new uint256[](1);
        topics[0] = 3;
        vm.prank(regulator);
        registry.addTrustedIssuer(issuerB, topics);
        vm.warp(block.timestamp + 366 days); // issuer A's hotel claim lapsed
        vm.prank(issuerB);
        registry.issueClaim(hotel, 3, uint64(block.timestamp + 1 days));
        assertTrue(registry.hasValidClaim(hotel, 3));
    }

    function test_FaucetDailyLimit() public {
        address m = makeAddr("mentor");
        for (uint256 i; i < 100; ++i) {
            tidr.faucet(m);
        }
        vm.expectRevert();
        tidr.faucet(m);
        vm.warp(block.timestamp + 1 days);
        tidr.faucet(m);
        assertEq(tidr.balanceOf(m), 101 * 32_000_000);
    }
}
