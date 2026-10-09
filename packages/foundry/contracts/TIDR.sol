// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/// @title tIDR — test rupiah with NO monetary value
/// @notice Stand-in for an IDR stablecoin (none with EIP-2612 permit is usable on Arbitrum One).
///         Whole rupiah (decimals = 0). Anyone may faucet Rp 32.000.000 to any address, ≤ 100× per address per UTC day.
contract TIDR is ERC20, ERC20Permit {
    uint256 public constant FAUCET_AMOUNT = 32_000_000;
    uint256 public constant FAUCET_DAILY_LIMIT = 100;

    /// @dev to => UTC day number => faucet calls that day
    mapping(address => mapping(uint256 => uint256)) public faucetCalls;

    error FaucetLimitReached(address to);

    constructor() ERC20("Test Rupiah (no value)", "tIDR") ERC20Permit("Test Rupiah (no value)") { }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function faucet(address to) external {
        uint256 day = block.timestamp / 1 days;
        if (faucetCalls[to][day] >= FAUCET_DAILY_LIMIT) revert FaucetLimitReached(to);
        faucetCalls[to][day]++;
        _mint(to, FAUCET_AMOUNT);
    }
}
