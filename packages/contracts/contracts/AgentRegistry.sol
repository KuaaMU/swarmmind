// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IAgentRegistry.sol";

/// @title AgentRegistry - On-chain agent service directory for SwarmMind
/// @notice Manages registration, pricing, and reputation of AI agents on X Layer
contract AgentRegistry is IAgentRegistry, Ownable {
    mapping(address => AgentInfo) public agents;
    address[] public agentList;
    mapping(AgentRole => address[]) private agentsByRole;

    constructor() Ownable(msg.sender) {}

    /// @notice Register a new agent in the directory
    /// @param name Human-readable agent name
    /// @param role Agent role (SCOUT, ORACLE, EXECUTOR, MANAGER)
    /// @param serviceEndpoint URL where the agent's API is accessible
    /// @param pricePerCall Price in USDC (6 decimals) per service call
    function registerAgent(
        string calldata name,
        AgentRole role,
        string calldata serviceEndpoint,
        uint256 pricePerCall
    ) external {
        require(!agents[msg.sender].isActive, "Agent already registered");
        require(bytes(name).length > 0, "Name required");
        require(bytes(serviceEndpoint).length > 0, "Endpoint required");

        agents[msg.sender] = AgentInfo({
            wallet: msg.sender,
            name: name,
            role: role,
            serviceEndpoint: serviceEndpoint,
            pricePerCall: pricePerCall,
            totalEarnings: 0,
            totalSpending: 0,
            isActive: true,
            registeredAt: block.timestamp
        });

        agentList.push(msg.sender);
        agentsByRole[role].push(msg.sender);

        emit AgentRegistered(msg.sender, name, role);
    }

    /// @notice Update the price per call for an agent's service
    /// @param newPrice New price in USDC (6 decimals)
    function updatePricing(uint256 newPrice) external {
        require(agents[msg.sender].isActive, "Agent not registered");
        agents[msg.sender].pricePerCall = newPrice;
        emit PricingUpdated(msg.sender, newPrice);
    }

    /// @notice Record a payment between two agents (called by PaymentSettlement)
    /// @param from Payer agent address
    /// @param to Payee agent address
    /// @param amount Payment amount in USDC
    function recordPayment(
        address from,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (agents[from].isActive) {
            agents[from].totalSpending += amount;
        }
        if (agents[to].isActive) {
            agents[to].totalEarnings += amount;
        }
        emit PaymentRecorded(from, to, amount);
    }

    /// @notice Deactivate an agent
    function deactivateAgent() external {
        require(agents[msg.sender].isActive, "Agent not registered");
        agents[msg.sender].isActive = false;
        emit AgentDeactivated(msg.sender);
    }

    /// @notice Update service endpoint URL
    /// @param newEndpoint New service URL
    function updateEndpoint(string calldata newEndpoint) external {
        require(agents[msg.sender].isActive, "Agent not registered");
        require(bytes(newEndpoint).length > 0, "Endpoint required");
        agents[msg.sender].serviceEndpoint = newEndpoint;
    }

    /// @notice Get all active agents with a specific role
    /// @param role The role to filter by
    /// @return result Array of active agent addresses with the given role
    function getActiveAgentsByRole(AgentRole role) external view returns (address[] memory) {
        address[] storage roleAgents = agentsByRole[role];
        uint256 activeCount = 0;

        for (uint256 i = 0; i < roleAgents.length; i++) {
            if (agents[roleAgents[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory result = new address[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < roleAgents.length; i++) {
            if (agents[roleAgents[i]].isActive) {
                result[idx] = roleAgents[i];
                idx++;
            }
        }

        return result;
    }

    /// @notice Get total number of registered agents
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /// @notice Get agent info by address
    function getAgent(address wallet) external view returns (AgentInfo memory) {
        return agents[wallet];
    }

    /// @notice Transfer registry ownership (enables PaymentSettlement to call recordPayment)
    function setPaymentSettlement(address settlement) external onlyOwner {
        transferOwnership(settlement);
    }
}
