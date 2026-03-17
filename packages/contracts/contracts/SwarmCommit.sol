// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SwarmCommit – On-chain commitment registry for SwarmMind v1 decisions
/// @notice Stores SHA-256 decision hashes produced by the off-chain consensus engine.
///         Each decision is keyed by its `decisionHash`; duplicate submissions are
///         rejected to ensure each consensus round is anchored exactly once.
/// @dev    The `decisionHash` is computed off-chain as:
///           SHA-256(decisionId + "::" + domain + "::" + finalClaim + "::" +
///                   finalScore.toFixed(8) + "::" + evidenceRoot)
///         This enables cheap on-chain anchoring without replaying full execution.
contract SwarmCommit {
    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted each time a new decision is anchored on-chain.
    /// @param decisionHash  SHA-256 of the canonical decision payload (bytes32).
    /// @param evidenceRoot  Merkle root over evidence pointer hashes (bytes32).
    /// @param domainId      Numeric identifier of the intelligence domain.
    /// @param committer     Address that submitted the commitment.
    /// @param timestamp     Block timestamp at the time of commitment.
    event DecisionCommitted(
        bytes32 indexed decisionHash,
        bytes32 indexed evidenceRoot,
        uint256 indexed domainId,
        address committer,
        uint256 timestamp
    );

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Returns true if a given decisionHash has already been committed.
    mapping(bytes32 => bool) public committed;

    // ─── External Functions ───────────────────────────────────────────────────

    /// @notice Anchor a consensus decision on-chain.
    /// @param decisionHash  SHA-256 hex digest of the decision payload (as bytes32).
    /// @param evidenceRoot  Merkle root of all evidence pointers (as bytes32).
    /// @param domainId      Numeric ID representing the intelligence domain.
    function commitDecision(
        bytes32 decisionHash,
        bytes32 evidenceRoot,
        uint256 domainId
    ) external {
        require(decisionHash != bytes32(0), "SwarmCommit: zero decisionHash");
        require(!committed[decisionHash], "SwarmCommit: already committed");

        committed[decisionHash] = true;

        emit DecisionCommitted(decisionHash, evidenceRoot, domainId, msg.sender, block.timestamp);
    }
}
