// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IPaymentSettlement.sol";
import "./interfaces/IAgentRegistry.sol";

/// @title PaymentSettlement - On-chain payment audit trail for agent-to-agent micropayments
/// @notice Records USDC transfers between SwarmMind agents on X Layer
contract PaymentSettlement is IPaymentSettlement, Ownable {
    IERC20 public immutable usdc;
    IAgentRegistry public registry;

    uint256 public paymentCount;
    mapping(bytes32 => Payment) public payments;
    bytes32[] public paymentIds;

    constructor(address _usdc, address _registry) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        registry = IAgentRegistry(_registry);
    }

    /// @notice Settle a single agent-to-agent payment
    /// @param to Recipient agent address
    /// @param amount USDC amount (6 decimals)
    /// @param serviceType Type of service (e.g., "signal", "risk_assessment")
    /// @return paymentId Unique payment identifier
    function settlePayment(
        address to,
        uint256 amount,
        string calldata serviceType
    ) external returns (bytes32 paymentId) {
        require(amount > 0, "Amount must be positive");
        require(to != address(0), "Invalid recipient");
        require(to != msg.sender, "Cannot pay self");

        require(
            usdc.transferFrom(msg.sender, to, amount),
            "USDC transfer failed"
        );

        paymentId = keccak256(
            abi.encodePacked(msg.sender, to, amount, block.timestamp, paymentCount)
        );

        payments[paymentId] = Payment({
            from: msg.sender,
            to: to,
            amount: amount,
            serviceType: serviceType,
            timestamp: block.timestamp,
            txRef: paymentId
        });

        paymentIds.push(paymentId);
        paymentCount++;

        // Update registry earnings/spending
        try registry.recordPayment(msg.sender, to, amount) {} catch {}

        emit PaymentSettled(paymentId, msg.sender, to, amount, serviceType);
    }

    /// @notice Settle multiple payments in a single transaction (gas optimization)
    /// @param recipients Array of recipient addresses
    /// @param amounts Array of USDC amounts
    /// @param serviceTypes Array of service type strings
    function batchSettle(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string[] calldata serviceTypes
    ) external {
        require(
            recipients.length == amounts.length && amounts.length == serviceTypes.length,
            "Array length mismatch"
        );
        require(recipients.length > 0, "Empty batch");
        require(recipients.length <= 20, "Batch too large");

        uint256 totalAmount = 0;
        bytes32 batchId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, paymentCount)
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            require(amounts[i] > 0, "Amount must be positive");
            require(recipients[i] != address(0), "Invalid recipient");

            require(
                usdc.transferFrom(msg.sender, recipients[i], amounts[i]),
                "USDC transfer failed"
            );

            bytes32 paymentId = keccak256(
                abi.encodePacked(msg.sender, recipients[i], amounts[i], block.timestamp, paymentCount)
            );

            payments[paymentId] = Payment({
                from: msg.sender,
                to: recipients[i],
                amount: amounts[i],
                serviceType: serviceTypes[i],
                timestamp: block.timestamp,
                txRef: batchId
            });

            paymentIds.push(paymentId);
            paymentCount++;
            totalAmount += amounts[i];

            try registry.recordPayment(msg.sender, recipients[i], amounts[i]) {} catch {}

            emit PaymentSettled(paymentId, msg.sender, recipients[i], amounts[i], serviceTypes[i]);
        }

        emit BatchSettled(batchId, recipients.length, totalAmount);
    }

    /// @notice Get payment details by ID
    function getPayment(bytes32 paymentId) external view returns (Payment memory) {
        return payments[paymentId];
    }

    /// @notice Get recent payment IDs (paginated)
    /// @param offset Starting index
    /// @param limit Max number of results
    function getRecentPayments(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        if (offset >= paymentIds.length) {
            return new bytes32[](0);
        }

        uint256 end = offset + limit;
        if (end > paymentIds.length) {
            end = paymentIds.length;
        }

        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = paymentIds[i];
        }

        return result;
    }

    /// @notice Update registry reference
    function updateRegistry(address _registry) external onlyOwner {
        registry = IAgentRegistry(_registry);
    }
}
