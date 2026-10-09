// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MabrurBase } from "./MabrurBase.t.sol";
import { MabrurPBM } from "../contracts/MabrurPBM.sol";

/// @title MabrurPBMCoverageTest
/// @notice Targeted tests to reach 100% coverage for MabrurPBM.sol
contract MabrurPBMCoverageTest is MabrurBase {
    // ─── topicOf coverage ──────────────────────────────────────────────────

    function test_TopicOf_FlightReturnsAirline() external view {
        uint256 topic = pbm.topicOf(uint8(MabrurPBM.Line.FLIGHT));
        assertEq(topic, registry.AIRLINE(), "topicOf(FLIGHT) should return AIRLINE");
    }

    function test_TopicOf_HotelReturnsHotel() external view {
        uint256 topic = pbm.topicOf(uint8(MabrurPBM.Line.HOTEL));
        assertEq(topic, registry.HOTEL(), "topicOf(HOTEL) should return HOTEL");
    }

    function test_TopicOf_VisaReturnsVisaProvider() external view {
        uint256 topic = pbm.topicOf(uint8(MabrurPBM.Line.VISA));
        assertEq(topic, registry.VISA_PROVIDER(), "topicOf(VISA) should return VISA_PROVIDER");
    }

    function test_TopicOf_MarginRevertsInvalidLine() external {
        vm.expectRevert(MabrurPBM.InvalidLine.selector);
        pbm.topicOf(uint8(MabrurPBM.Line.MARGIN));
    }

    function test_TopicOf_OutOfRangeRevertsInvalidLine() external {
        // Use a value beyond the enum range (255)
        vm.expectRevert(MabrurPBM.InvalidLine.selector);
        pbm.topicOf(uint8(255));
    }

    // ─── refundable coverage ──────────────────────────────────────────────

    function test_Refundable_FalseForNonExistentBooking() external view {
        // Call refundable with a booking ID that was never created
        // This exercises the early return for non-existent bookings (pilgrim == address(0))
        bool result = pbm.refundable(pbm.bookingIdOf(address(0x1234), 999));
        assertFalse(result, "refundable should return false for non-existent booking");
    }

    function test_Refundable_FalseBeforeAnyDeadline() external {
        uint256 bookingId = _bookAhmad();

        // No time has passed; both deadlines are in the future
        bool result = pbm.refundable(bookingId);
        assertFalse(result, "refundable should be false before ticketBy");
    }

    function test_Refundable_TrueAfterDepartBy() external {
        uint256 bookingId = _bookAhmad();
        // Warp past departBy
        vm.warp(block.timestamp + 31 days);

        bool result = pbm.refundable(bookingId);
        assertTrue(result, "refundable should be true after departBy");
    }

    function test_Refundable_TrueAfterTicketByWithoutFlightPaid() external {
        uint256 bookingId = _bookSiti(uint64(block.timestamp + 5 days)); // ticketBy in 5 days
        // Warp past ticketBy but before departBy
        vm.warp(block.timestamp + 6 days);

        bool result = pbm.refundable(bookingId);
        assertTrue(result, "refundable should be true after ticketBy when no flight is paid");
    }

    function test_Refundable_FalseAfterTicketByWhenFlightPaid() external {
        uint256 bookingId = _bookAhmad();
        // Pay the flight line
        _spend(bookingId, airlinePk, uint8(MabrurPBM.Line.FLIGHT), split[FLIGHT], bytes32(uint256(1)));

        // Warp past ticketBy but before departBy
        vm.warp(block.timestamp + 21 days);

        bool result = pbm.refundable(bookingId);
        assertFalse(result, "refundable should be false after ticketBy when flight is paid");
    }
}
