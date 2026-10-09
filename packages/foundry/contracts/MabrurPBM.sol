// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { ERC20Wrapper } from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Wrapper.sol";
import { IERC20Permit } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ClaimRegistry } from "./ClaimRegistry.sol";

/// @title MabrurPBM — purpose-bound umrah prepayment
/// @notice A pilgrim's prepayment is wrapped into mUMRAH: a non-transferable, per-booking earmark split into
///         FLIGHT / HOTEL / VISA / MARGIN lines. The agency can move money only by presenting an EIP-712 invoice
///         signed by a claim-verified vendor (the payee IS the signer). The margin unlocks only on a departure
///         signature. After `ticketBy` with no ticket paid, or after `departBy`, ANYONE can refund every unspent
///         rupiah to the pilgrim. No owner, no pause, no upgrade path touches balances.
contract MabrurPBM is ERC20Wrapper, EIP712, ReentrancyGuard {
    enum Line {
        FLIGHT,
        HOTEL,
        VISA,
        MARGIN
    }

    struct Invoice {
        uint256 bookingId;
        uint8 line; // uint8, not Line, so out-of-range values reach InvalidLine
        uint256 amount;
        bytes32 ref;
        uint64 expiry;
    }

    struct Booking {
        address pilgrim;
        address agency;
        uint64 ticketBy;
        uint64 departBy;
        bool departed;
        bool marginReleased;
        bool refunded;
        address flightVendor;
        uint256[4] remaining;
        uint256 deposited;
    }

    /// @notice PMA 8/2018 Pasal 11(5): departure at most six months after registration.
    uint256 public constant MAX_HORIZON = 180 days;
    /// @notice Agency fee (ujrah) cap: MARGIN ≤ 20 % of the package.
    uint256 public constant MAX_MARGIN_BPS = 2000;

    bytes32 public constant INVOICE_TYPEHASH =
        keccak256("Invoice(uint256 bookingId,uint8 line,uint256 amount,bytes32 ref,uint64 expiry)");
    bytes32 public constant DEPARTURE_TYPEHASH = keccak256("Departure(uint256 bookingId)");

    ClaimRegistry public immutable registry;

    mapping(uint256 => Booking) private _bookings;
    mapping(address => uint256) public bookingNonce;
    mapping(bytes32 => bool) public usedInvoice;

    /// @dev Running totals: earmarked mirrors Σ remaining; deposited/paidOut is an independent ledger (regulator view).
    mapping(address => uint256) public agencyEarmarked;
    mapping(address => uint256) public agencyDeposited;
    mapping(address => uint256) public agencyPaidOut;
    mapping(address => uint256) public agencyOpenBookings;
    uint256 public totalEarmarked;

    event Booked(
        uint256 indexed id,
        address indexed pilgrim,
        address indexed agency,
        uint256[4] lines,
        uint64 ticketBy,
        uint64 departBy
    );
    event Spent(uint256 indexed id, uint8 line, address indexed vendor, uint256 amount, bytes32 ref);
    event MarginReleased(uint256 indexed id, address indexed agency, uint256 amount, address confirmedBy);
    event Refunded(uint256 indexed id, address indexed pilgrim, uint256 amount, address indexed caller);

    error AgencyNotLicensed(address agency);
    error InvalidSplit();
    error InvalidDepartBy();
    error InvalidTicketBy();
    error ZeroAmount();
    error FlightAlreadyPurchased();
    error FlightNotFullyPaid(uint256 lineAmount, uint256 invoiceAmount);
    error SelfDealing();
    error NotBookingAgency();
    error EarmarkMismatch(uint256 booking, uint256 invoiceBooking);
    error VendorClaimMissing(address signer, uint256 topic);
    error LineExceeded(uint8 line, uint256 remaining);
    error DeadlinePassed();
    error InvoiceExpired();
    error InvoiceReplayed();
    error BadSignature();
    error UseReleaseMargin();
    error InvalidLine();
    error NotDeparted();
    error MarginAlreadyReleased();
    error NotYetRefundable();
    error NothingToRefund();
    error NonTransferable();
    error DirectDepositDisabled();
    error DirectWithdrawDisabled();

    constructor(IERC20 underlyingToken, ClaimRegistry registry_)
        ERC20("Mabrur Umrah Prepayment", "mUMRAH")
        ERC20Wrapper(underlyingToken)
        EIP712("Mabrur Umrah Prepayment", "1")
    {
        registry = registry_;
    }

    // ─── Core flow ─────────────────────────────────────────────────────────

    /// @notice Pilgrim books a package: one permit signature + this tx wraps her rupiah into a per-booking earmark.
    function book(
        address agency,
        uint256[4] calldata lines,
        uint64 ticketBy,
        uint64 departBy,
        uint256 permitDeadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external nonReentrant returns (uint256 bookingId) {
        if (!registry.hasValidClaim(agency, registry.PPIU_AGENCY())) {
            revert AgencyNotLicensed(agency);
        }
        if (departBy <= block.timestamp || departBy > block.timestamp + MAX_HORIZON) revert InvalidDepartBy();
        if (ticketBy <= block.timestamp || ticketBy > departBy) revert InvalidTicketBy();
        uint256 total = lines[0] + lines[1] + lines[2] + lines[3];
        if (total == 0 || lines[uint8(Line.MARGIN)] * 10_000 > total * MAX_MARGIN_BPS) revert InvalidSplit();
        // without a FLIGHT line the ticket-by branch could never clear
        if (lines[uint8(Line.FLIGHT)] == 0 && ticketBy != departBy) revert InvalidTicketBy();

        // a front-run permit must not brick booking; an existing allowance also works
        try IERC20Permit(address(underlying())).permit(msg.sender, address(this), total, permitDeadline, v, r, s) { }
            catch { }
        super.depositFor(msg.sender, total);

        bookingId = bookingIdOf(msg.sender, bookingNonce[msg.sender]++);
        Booking storage b = _bookings[bookingId];
        b.pilgrim = msg.sender;
        b.agency = agency;
        b.ticketBy = ticketBy;
        b.departBy = departBy;
        b.remaining = lines;
        b.deposited = total;

        agencyEarmarked[agency] += total;
        agencyDeposited[agency] += total;
        agencyOpenBookings[agency]++;
        totalEarmarked += total;
        emit Booked(bookingId, msg.sender, agency, lines, ticketBy, departBy);
    }

    /// @notice The agency's only way to move money: a vendor-signed invoice. The payee is the signer, always.
    function spend(uint256 bookingId, Invoice calldata inv, bytes calldata vendorSig) external nonReentrant {
        Booking storage b = _bookings[bookingId];
        if (msg.sender != b.agency) revert NotBookingAgency();
        if (refundable(bookingId)) revert DeadlinePassed();
        if (inv.bookingId != bookingId) revert EarmarkMismatch(bookingId, inv.bookingId);
        if (inv.line > uint8(Line.MARGIN)) revert InvalidLine();
        if (inv.line == uint8(Line.MARGIN)) revert UseReleaseMargin();
        if (block.timestamp > inv.expiry) revert InvoiceExpired();

        bytes32 digest = hashInvoice(inv);
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(digest, vendorSig);
        if (err != ECDSA.RecoverError.NoError) revert BadSignature();
        uint256 topic = topicOf(inv.line);
        if (!registry.hasValidClaim(signer, topic)) revert VendorClaimMissing(signer, topic);
        if (usedInvoice[digest]) revert InvoiceReplayed();
        if (signer == b.agency) revert SelfDealing();
        if (inv.amount == 0) revert ZeroAmount();
        if (inv.line == uint8(Line.FLIGHT)) {
            // "tiket lunas": exactly one FLIGHT invoice, and it must pay the whole FLIGHT line
            if (b.flightVendor != address(0)) revert FlightAlreadyPurchased();
            if (inv.amount != b.remaining[inv.line]) revert FlightNotFullyPaid(b.remaining[inv.line], inv.amount);
            b.flightVendor = signer;
        } else if (inv.amount > b.remaining[inv.line]) {
            revert LineExceeded(inv.line, b.remaining[inv.line]);
        }

        usedInvoice[digest] = true;
        b.remaining[inv.line] -= inv.amount;
        _payOut(b, inv.amount);
        emit Spent(bookingId, inv.line, signer, inv.amount, inv.ref);
        SafeERC20.safeTransfer(underlying(), signer, inv.amount);
    }

    /// @notice Releases the MARGIN line to the agency on a Departure signature by the pilgrim,
    ///         or by the one still-licensed airline paid from this booking's FLIGHT line. Anyone may submit.
    function releaseMargin(uint256 bookingId, bytes calldata departureSig) external nonReentrant {
        Booking storage b = _bookings[bookingId];
        if (b.marginReleased || b.refunded) revert MarginAlreadyReleased();
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(hashDeparture(bookingId), departureSig);
        bool airlineOk = b.flightVendor != address(0) && signer == b.flightVendor
            && registry.hasValidClaim(signer, registry.AIRLINE());
        if (err != ECDSA.RecoverError.NoError || b.pilgrim == address(0) || (signer != b.pilgrim && !airlineOk)) {
            revert NotDeparted();
        }
        if (!registry.hasValidClaim(b.agency, registry.PPIU_AGENCY())) revert AgencyNotLicensed(b.agency);

        uint256 m = b.remaining[uint8(Line.MARGIN)];
        b.departed = true;
        b.marginReleased = true;
        b.remaining[uint8(Line.MARGIN)] = 0;
        _payOut(b, m);
        emit MarginReleased(bookingId, b.agency, m, signer);
        if (m > 0) SafeERC20.safeTransfer(underlying(), b.agency, m);
    }

    /// @notice Permissionless: a neighbour, an NGO or the regulator can return every unspent rupiah to the pilgrim.
    function refund(uint256 bookingId) external nonReentrant {
        if (!refundable(bookingId)) revert NotYetRefundable();
        Booking storage b = _bookings[bookingId];
        uint256 amt = b.remaining[0] + b.remaining[1] + b.remaining[2] + b.remaining[3];
        if (amt == 0) revert NothingToRefund();
        delete b.remaining;
        b.refunded = true;
        _payOut(b, amt);
        emit Refunded(bookingId, b.pilgrim, amt, msg.sender);
        SafeERC20.safeTransfer(underlying(), b.pilgrim, amt);
    }

    // ─── Disabled wrapper paths ────────────────────────────────────────────

    function depositFor(address, uint256) public pure override returns (bool) {
        revert DirectDepositDisabled();
    }

    function withdrawTo(address, uint256) public pure override returns (bool) {
        revert DirectWithdrawDisabled();
    }

    /// @dev A prepaid service claim is personal: only mint (book) and burn (spend / release / refund) move mUMRAH.
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) revert NonTransferable();
        super._update(from, to, value);
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    function booking(uint256 id) external view returns (Booking memory) {
        return _bookings[id];
    }

    function bookingIdOf(address pilgrim, uint256 nonce) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(pilgrim, nonce)));
    }

    /// @notice Refundable after departBy, or after ticketBy if no FLIGHT invoice was paid.
    function refundable(uint256 id) public view returns (bool) {
        Booking storage b = _bookings[id];
        if (b.pilgrim == address(0)) return false;
        return block.timestamp > b.departBy || (b.flightVendor == address(0) && block.timestamp > b.ticketBy);
    }

    /// @notice Regulator panel: liabilities (deposits − payouts, independent ledger) and earmarked (Σ open lines).
    function regulatorView(address agency)
        external
        view
        returns (uint256 openBookings, uint256 liabilities, uint256 earmarked)
    {
        return (agencyOpenBookings[agency], agencyDeposited[agency] - agencyPaidOut[agency], agencyEarmarked[agency]);
    }

    /// @notice Live solvency: underlyingHeld ≥ wrappedSupply (anyone can donate tIDR, so ≥ not ==).
    function conservation() external view returns (uint256 sumEarmarks, uint256 wrappedSupply, uint256 underlyingHeld) {
        return (totalEarmarked, totalSupply(), underlying().balanceOf(address(this)));
    }

    function hashInvoice(Invoice calldata inv) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(INVOICE_TYPEHASH, inv.bookingId, inv.line, inv.amount, inv.ref, inv.expiry))
        );
    }

    function hashDeparture(uint256 bookingId) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(DEPARTURE_TYPEHASH, bookingId)));
    }

    function topicOf(uint8 line) public view returns (uint256) {
        if (line == uint8(Line.FLIGHT)) return registry.AIRLINE();
        if (line == uint8(Line.HOTEL)) return registry.HOTEL();
        if (line == uint8(Line.VISA)) return registry.VISA_PROVIDER();
        revert InvalidLine();
    }

    // ─── Internal ──────────────────────────────────────────────────────────

    /// @dev Effects for every outflow: burn the pilgrim's claim and update both ledgers.
    function _payOut(Booking storage b, uint256 amt) private {
        agencyEarmarked[b.agency] -= amt;
        agencyPaidOut[b.agency] += amt;
        totalEarmarked -= amt;
        if (amt > 0) _burn(b.pilgrim, amt);
        if (b.remaining[0] + b.remaining[1] + b.remaining[2] + b.remaining[3] == 0 && amt > 0) {
            agencyOpenBookings[b.agency]--;
        }
    }
}
