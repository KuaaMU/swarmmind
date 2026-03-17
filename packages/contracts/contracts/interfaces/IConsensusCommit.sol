// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IConsensusCommit - Interface for the on-chain consensus commit/challenge registry
interface IConsensusCommit {
    /// @notice Emitted when a new consensus commit is anchored
    event CommitAnchored(
        bytes32 indexed roundId,
        bytes32 indexed commitHash,
        address indexed submitter,
        uint256 challengeExpiresAt
    );

    /// @notice Emitted when a challenge is raised against a commit
    event ChallengeRaised(
        bytes32 indexed roundId,
        address indexed challenger,
        string reason
    );

    /// @notice Emitted when a challenge is resolved
    event ChallengeResolved(
        bytes32 indexed roundId,
        bool upheld,
        address indexed resolver
    );

    /// @notice Emitted when a commit's challenge window closes without dispute
    event CommitFinalized(bytes32 indexed roundId);

    struct CommitRecord {
        bytes32 roundId;
        bytes32 commitHash;
        address submitter;
        uint256 anchoredAt;
        uint256 challengeExpiresAt;
        bool challenged;
        bool finalized;
        bool challengeUpheld;
    }

    /// @notice Anchor an off-chain consensus commit hash on-chain
    /// @param roundId    Unique round identifier (bytes32 of the round string)
    /// @param commitHash SHA-256 hash produced by the off-chain ConsensusEngine
    /// @param challengeWindowSecs Duration (seconds) during which challenges are accepted
    function anchor(
        bytes32 roundId,
        bytes32 commitHash,
        uint256 challengeWindowSecs
    ) external;

    /// @notice Raise a challenge against an anchored commit during the window
    /// @param roundId Identifier of the round being challenged
    /// @param reason  Human-readable reason for the challenge
    function challenge(bytes32 roundId, string calldata reason) external;

    /// @notice Resolve a challenge (owner only)
    /// @param roundId  Identifier of the round under challenge
    /// @param upheld   True if the challenge is upheld (commit invalidated)
    function resolveChallenge(bytes32 roundId, bool upheld) external;

    /// @notice Mark a commit as finalized once the challenge window has passed
    /// @param roundId Identifier of the round to finalize
    function finalize(bytes32 roundId) external;

    /// @notice Retrieve a commit record by round ID
    function getCommit(bytes32 roundId) external view returns (CommitRecord memory);

    /// @notice Check whether a commit is currently in its challenge window
    function isChallengeOpen(bytes32 roundId) external view returns (bool);
}
