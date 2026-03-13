// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAgentRegistry {
    enum AgentRole { SCOUT, ORACLE, EXECUTOR, MANAGER }

    struct AgentInfo {
        address wallet;
        string name;
        AgentRole role;
        string serviceEndpoint;
        uint256 pricePerCall;
        uint256 totalEarnings;
        uint256 totalSpending;
        bool isActive;
        uint256 registeredAt;
    }

    event AgentRegistered(address indexed wallet, string name, AgentRole role);
    event AgentDeactivated(address indexed wallet);
    event PricingUpdated(address indexed wallet, uint256 newPrice);
    event PaymentRecorded(address indexed from, address indexed to, uint256 amount);

    function recordPayment(address from, address to, uint256 amount) external;
}
