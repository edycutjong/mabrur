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
    }

    address public immutable owner;

    mapping(address => bool) private _trusted;
    mapping(address => mapping(uint256 => bool)) private _issuerTopics;
    mapping(address => uint256[]) private _issuerTopicList;
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
        _clearTopics(issuer);
        uint256[] storage list = _issuerTopicList[issuer];
        for (uint256 i; i < topics.length; ++i) {
            if (topics[i] < PPIU_AGENCY || topics[i] > VISA_PROVIDER) revert UnknownTopic(topics[i]);
            _issuerTopics[issuer][topics[i]] = true;
            list.push(topics[i]);
        }
        _trusted[issuer] = true;
        emit TrustedIssuerAdded(issuer, topics);
    }

    function removeTrustedIssuer(address issuer) external onlyOwner {
        _clearTopics(issuer);
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
        claims[subject][topic] = Claim({ issuer: msg.sender, expiry: expiry, revoked: false });
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
        return c.issuer != address(0) && !c.revoked && block.timestamp < c.expiry && hasClaimTopic(c.issuer, topic);
    }

    function _clearTopics(address issuer) private {
        uint256[] storage list = _issuerTopicList[issuer];
        for (uint256 i; i < list.length; ++i) {
            _issuerTopics[issuer][list[i]] = false;
        }
        delete _issuerTopicList[issuer];
    }
}
