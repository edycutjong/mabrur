// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MabrurBase } from "./MabrurBase.t.sol";
import { ClaimRegistry } from "../contracts/ClaimRegistry.sol";

contract ClaimRegistryCoverageTest is MabrurBase {
    /// @notice Direct external call to hasClaimTopic (line 80) — previously never called externally
    function test_HasClaimTopic_TrueForTrustedIssuerWithValidTopic() public view {
        bool result = registry.hasClaimTopic(issuer, 1);
        assertTrue(result);
    }

    /// @notice Direct external call to hasClaimTopic with valid topic that issuer lacks
    function test_HasClaimTopic_FalseForTrustedIssuerWithoutTopic() public {
        address newIssuer = makeAddr("newIssuer");
        uint256[] memory limitedTopics = new uint256[](1);
        limitedTopics[0] = 1;
        vm.prank(regulator);
        registry.addTrustedIssuer(newIssuer, limitedTopics);
        assertFalse(registry.hasClaimTopic(newIssuer, 2));
    }

    /// @notice Direct external call to hasClaimTopic with untrusted issuer
    function test_HasClaimTopic_FalseForUntrustedIssuer() public {
        address nobody = makeAddr("nobody");
        assertFalse(registry.hasClaimTopic(nobody, 1));
    }

    /// @notice Branch coverage for line 54: topic < PPIU_AGENCY (topic = 0)
    function test_AddTrustedIssuer_RevertsTopicBelowRange() public {
        address newIssuer = makeAddr("belowRange");
        uint256[] memory invalidTopics = new uint256[](1);
        invalidTopics[0] = 0; // less than PPIU_AGENCY (1)
        vm.prank(regulator);
        vm.expectRevert(abi.encodeWithSelector(ClaimRegistry.UnknownTopic.selector, uint256(0)));
        registry.addTrustedIssuer(newIssuer, invalidTopics);
    }

    /// @notice Branch coverage for line 54: topic > VISA_PROVIDER (topic = 5)
    function test_AddTrustedIssuer_RevertsTopicAboveRange() public {
        address newIssuer = makeAddr("aboveRange");
        uint256[] memory invalidTopics = new uint256[](1);
        invalidTopics[0] = 5; // greater than VISA_PROVIDER (4)
        vm.prank(regulator);
        vm.expectRevert(abi.encodeWithSelector(ClaimRegistry.UnknownTopic.selector, uint256(5)));
        registry.addTrustedIssuer(newIssuer, invalidTopics);
    }

    /// @notice Mixed invalid and valid topics to ensure first invalid one reverts
    function test_AddTrustedIssuer_RevertsOnFirstInvalidInMixedTopics() public {
        address newIssuer = makeAddr("mixed");
        uint256[] memory mixedTopics = new uint256[](2);
        mixedTopics[0] = 1; // valid
        mixedTopics[1] = 10; // invalid (> 4)
        vm.prank(regulator);
        vm.expectRevert(abi.encodeWithSelector(ClaimRegistry.UnknownTopic.selector, uint256(10)));
        registry.addTrustedIssuer(newIssuer, mixedTopics);
    }

    /// @notice Verify hasClaimTopic correctly returns false after narrowing
    function test_HasClaimTopic_FalseAfterNarrowing() public {
        assertTrue(registry.hasClaimTopic(issuer, 2)); // initially airline topic trusted

        uint256[] memory narrowedTopics = new uint256[](3);
        narrowedTopics[0] = 1;
        narrowedTopics[1] = 3;
        narrowedTopics[2] = 4;
        vm.prank(regulator);
        registry.addTrustedIssuer(issuer, narrowedTopics); // remove topic 2

        assertFalse(registry.hasClaimTopic(issuer, 2));
    }

    /// @notice All four valid topics at boundaries
    function test_HasClaimTopic_AllValidTopicsAtBoundaries() public view {
        assertTrue(registry.hasClaimTopic(issuer, 1)); // PPIU_AGENCY
        assertTrue(registry.hasClaimTopic(issuer, 2)); // AIRLINE
        assertTrue(registry.hasClaimTopic(issuer, 3)); // HOTEL
        assertTrue(registry.hasClaimTopic(issuer, 4)); // VISA_PROVIDER
    }

    /// @notice Ensure hasClaimTopic is false for topic just outside valid range
    function test_HasClaimTopic_FalseForTopicBelowRange() public view {
        assertFalse(registry.hasClaimTopic(issuer, 0));
    }

    /// @notice Ensure hasClaimTopic is false for topic just outside valid range above
    function test_HasClaimTopic_FalseForTopicAboveRange() public view {
        assertFalse(registry.hasClaimTopic(issuer, 5));
    }
}
