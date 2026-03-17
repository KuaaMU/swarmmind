// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title SwarmChallenge – Challenge mechanism for SwarmMind v1 consensus decisions
/// @notice Challengers can dispute a committed decision within a configurable time
///         window.  The contract owner (governance / multi-sig) resolves disputes;
///         a v2 implementation can replace resolution with a decentralised jury.
/// @dev    Workflow:
///           1. Off-chain verifier calls `registerCommit(decisionHash)` after anchoring.
///           2. Anyone calls `openChallenge(decisionHash)` within the window.
///           3. Owner calls `resolveChallenge(id, upheld)` to finalise the outcome.
contract SwarmChallenge {
    // ─── Data Structures ──────────────────────────────────────────────────────

    struct Challenge {
        address challenger;
        bytes32 decisionHash;
        uint256 openedAt;
        bool resolved;
        bool successful;
    }

    // ─── Events ───────────────────────────────────────────────────────────────

    /// @notice Emitted when a new challenge is opened.
    event ChallengeOpened(
        uint256 indexed id,
        bytes32 indexed decisionHash,
        address challenger
    );

    /// @notice Emitted when a challenge is resolved.
    event ChallengeResolved(uint256 indexed id, bool successful);

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Duration (seconds) challengers have to dispute a committed decision.
    uint256 public challengeWindow = 1 days;

    /// @notice Owner address — set at construction, can call `resolveChallenge`.
    address public immutable owner;

    /// @notice Records when each decisionHash was registered for challenge tracking.
    mapping(bytes32 => uint256) public commitTime;

    /// @notice All challenges by their sequential ID.
    mapping(uint256 => Challenge) public challenges;

    /// @notice Next challenge ID to be assigned.
    uint256 public nextId;

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor() {
        owner = msg.sender;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "SwarmChallenge: caller is not owner");
        _;
    }

    // ─── External Functions ───────────────────────────────────────────────────

    /// @notice Register a commit timestamp for a decision hash.
    ///         Should be called by the verifier service immediately after
    ///         `SwarmCommit.commitDecision` succeeds.
    /// @param decisionHash  The same bytes32 passed to SwarmCommit.
    function registerCommit(bytes32 decisionHash) external {
        if (commitTime[decisionHash] == 0) {
            commitTime[decisionHash] = block.timestamp;
        }
    }

    /// @notice Open a challenge against a committed decision.
    /// @param decisionHash  The bytes32 decision hash to challenge.
    /// @return id           The assigned challenge ID.
    function openChallenge(bytes32 decisionHash) external returns (uint256 id) {
        require(commitTime[decisionHash] > 0, "SwarmChallenge: unknown decision");
        require(
            block.timestamp <= commitTime[decisionHash] + challengeWindow,
            "SwarmChallenge: challenge window passed"
        );

        id = nextId++;
        challenges[id] = Challenge({
            challenger: msg.sender,
            decisionHash: decisionHash,
            openedAt: block.timestamp,
            resolved: false,
            successful: false
        });

        emit ChallengeOpened(id, decisionHash, msg.sender);
    }

    /// @notice Resolve an open challenge.
    /// @dev    v1: owner/arbitrator resolves; v2: decentralised jury.
    /// @param id         Challenge ID returned by `openChallenge`.
    /// @param successful Whether the challenge should be upheld (true = slash committer).
    function resolveChallenge(uint256 id, bool successful) external onlyOwner {
        Challenge storage c = challenges[id];
        require(c.openedAt > 0, "SwarmChallenge: challenge not found");
        require(!c.resolved, "SwarmChallenge: already resolved");

        c.resolved = true;
        c.successful = successful;

        emit ChallengeResolved(id, successful);
    }
}
