// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ClaimRegistry — ERC-3643-shaped trusted-issuer registry
/// @notice Mirrors the ITrustedIssuersRegistry surface (addTrustedIssuer / removeTrustedIssuer / isTrustedIssuer /
///         hasClaimTopic). Deviation: issuers are EOAs, not ONCHAINID IClaimIssuer contracts.
///         The owner is the REGULATOR key (stand-in for Kemenag), never the agency.
contract ClaimRegistry {
    uint256 public constant PPIU_AGENCY = 1;
    uint256 public constant AIRLINE = 2;
    uint256 public constant HOTEL = 3;
    uint256 public constant VISA_PROVIDER = 4;

    struct Claim {
        address issuer;
        uint64 expiry;
        bool revoked;
        uint64 epoch; // issuer epoch at issuance: removing an issuer retires every claim it issued, for good
    }

    address public immutable owner;

    mapping(address => bool) private _trusted;
    mapping(address => mapping(uint256 => bool)) private _issuerTopics;
    /// @dev issuer => topic => epoch. Bumped whenever the issuer loses the topic (narrowed or removed), so giving
    ///      the topic back never resurrects claims it issued before.
    mapping(address => mapping(uint256 => uint64)) public topicEpoch;
    /// @dev subject => topic => latest claim
    mapping(address => mapping(uint256 => Claim)) public claims;

    event TrustedIssuerAdded(address indexed issuer, uint256[] topics);
    event TrustedIssuerRemoved(address indexed issuer);
    event ClaimIssued(address indexed issuer, address indexed subject, uint256 indexed topic, uint64 expiry);
    event ClaimRevoked(address indexed issuer, address indexed subject, uint256 indexed topic);

    error NotRegistryOwner();
    error IssuerNotTrustedForTopic(address issuer, uint256 topic);
    error NotClaimIssuer();
    error InvalidExpiry();
    error UnknownTopic(uint256 topic);

    constructor(address regulator) {
        owner = regulator;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotRegistryOwner();
        _;
    }

    function addTrustedIssuer(address issuer, uint256[] calldata topics) external onlyOwner {
        bool[5] memory keep;
        for (uint256 i; i < topics.length; ++i) {
            if (topics[i] < PPIU_AGENCY || topics[i] > VISA_PROVIDER) revert UnknownTopic(topics[i]);
            keep[topics[i]] = true;
        }
        for (uint256 t = PPIU_AGENCY; t <= VISA_PROVIDER; ++t) {
            if (_issuerTopics[issuer][t] && !keep[t]) topicEpoch[issuer][t]++;
            _issuerTopics[issuer][t] = keep[t];
        }
        _trusted[issuer] = true;
        emit TrustedIssuerAdded(issuer, topics);
    }

    function removeTrustedIssuer(address issuer) external onlyOwner {
        for (uint256 t = PPIU_AGENCY; t <= VISA_PROVIDER; ++t) {
            if (_issuerTopics[issuer][t]) {
                topicEpoch[issuer][t]++;
                _issuerTopics[issuer][t] = false;
            }
        }
        _trusted[issuer] = false;
        emit TrustedIssuerRemoved(issuer);
    }

    function isTrustedIssuer(address issuer) external view returns (bool) {
        return _trusted[issuer];
    }

    function hasClaimTopic(address issuer, uint256 topic) public view returns (bool) {
        return _trusted[issuer] && _issuerTopics[issuer][topic];
    }

    function issueClaim(address subject, uint256 topic, uint64 expiry) external {
        if (topic < PPIU_AGENCY || topic > VISA_PROVIDER) revert UnknownTopic(topic);
        if (!hasClaimTopic(msg.sender, topic)) revert IssuerNotTrustedForTopic(msg.sender, topic);
        if (expiry <= block.timestamp) revert InvalidExpiry();
        // one trusted issuer can never overwrite (and so un-revoke or cut short) another issuer's live or revoked
        // claim; an expired claim, or one whose issuer lost the topic, is free to be re-certified
        Claim memory prev = claims[subject][topic];
        if (
            prev.issuer != address(0) && prev.issuer != msg.sender && _isCurrent(prev, topic)
                && (prev.revoked || block.timestamp < prev.expiry)
        ) revert NotClaimIssuer();
        claims[subject][topic] =
            Claim({ issuer: msg.sender, expiry: expiry, revoked: false, epoch: topicEpoch[msg.sender][topic] });
        emit ClaimIssued(msg.sender, subject, topic, expiry);
    }

    /// @notice Only the issuer of the subject's current claim may revoke it.
    function revokeClaim(address subject, uint256 topic) external {
        Claim storage c = claims[subject][topic];
        if (c.issuer != msg.sender) revert NotClaimIssuer();
        c.revoked = true;
        emit ClaimRevoked(msg.sender, subject, topic);
    }

    /// @notice Valid = issuer still trusted for the topic, not revoked, not expired.
    function hasValidClaim(address subject, uint256 topic) external view returns (bool) {
        Claim memory c = claims[subject][topic];
        return c.issuer != address(0) && !c.revoked && block.timestamp < c.expiry && _isCurrent(c, topic);
    }

    /// @dev The claim's issuer is still trusted for the topic and has not been removed since it issued the claim.
    function _isCurrent(Claim memory c, uint256 topic) private view returns (bool) {
        return hasClaimTopic(c.issuer, topic) && c.epoch == topicEpoch[c.issuer][topic];
    }
}

