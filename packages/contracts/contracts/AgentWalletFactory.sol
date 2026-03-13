// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentWallet - Minimal wallet for AI agents on X Layer
contract AgentWallet {
    address public owner;
    bool private initialized;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function initialize(address _owner) external {
        require(!initialized, "Already initialized");
        owner = _owner;
        initialized = true;
    }

    /// @notice Execute an arbitrary call (for approvals, transfers, etc.)
    function execute(
        address target,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Execution failed");
        return result;
    }

    /// @notice Approve a token spender
    function approveToken(
        address token,
        address spender,
        uint256 amount
    ) external onlyOwner {
        (bool success, ) = token.call(
            abi.encodeWithSignature("approve(address,uint256)", spender, amount)
        );
        require(success, "Approve failed");
    }

    /// @notice Withdraw ETH/OKB to owner
    function withdraw() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }

    receive() external payable {}
}

/// @title AgentWalletFactory - CREATE2 deterministic wallet factory
/// @notice Deploys minimal proxy wallets for AI agents on X Layer
contract AgentWalletFactory is Ownable {
    address public immutable walletImplementation;

    mapping(address => address[]) public walletsByOwner;
    address[] public allWallets;

    event WalletCreated(address indexed owner, address indexed wallet, bytes32 salt);

    constructor() Ownable(msg.sender) {
        walletImplementation = address(new AgentWallet());
    }

    /// @notice Deploy a new wallet using CREATE2 for deterministic addresses
    /// @param salt Unique salt for deterministic address generation
    /// @return wallet The address of the newly created wallet
    function createWallet(bytes32 salt) external returns (address wallet) {
        wallet = Clones.cloneDeterministic(walletImplementation, salt);
        AgentWallet(payable(wallet)).initialize(msg.sender);

        walletsByOwner[msg.sender].push(wallet);
        allWallets.push(wallet);

        emit WalletCreated(msg.sender, wallet, salt);
    }

    /// @notice Predict the address of a wallet before deployment
    /// @param salt The salt that would be used for creation
    function predictWalletAddress(bytes32 salt) external view returns (address) {
        return Clones.predictDeterministicAddress(walletImplementation, salt);
    }

    /// @notice Get all wallets owned by an address
    function getWalletsByOwner(address owner_) external view returns (address[] memory) {
        return walletsByOwner[owner_];
    }

    /// @notice Get total number of wallets created
    function getWalletCount() external view returns (uint256) {
        return allWallets.length;
    }
}
