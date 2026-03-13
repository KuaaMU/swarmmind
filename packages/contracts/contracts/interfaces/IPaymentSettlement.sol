// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPaymentSettlement {
    struct Payment {
        address from;
        address to;
        uint256 amount;
        string serviceType;
        uint256 timestamp;
        bytes32 txRef;
    }

    event PaymentSettled(
        bytes32 indexed paymentId,
        address indexed from,
        address indexed to,
        uint256 amount,
        string serviceType
    );

    event BatchSettled(bytes32 indexed batchId, uint256 count, uint256 totalAmount);
}
