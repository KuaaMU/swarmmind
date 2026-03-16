// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IConsensusCommit.sol";

/// @title ConsensusCommit - On-chain anchor registry for SwarmMind CRCN consensus rounds
/// @notice Stores SHA-256 commit hashes produced by the off-chain ConsensusEngine.
///         Anyone can raise a challenge during the configurable window; the contract
///         owner (governance or multi-sig) resolves disputes.
/// @dev    The SHA-256 `commitHash` is computed off-chain as
///         SHA-256(roundId :: finalClaim :: weightedScore) and passed as bytes32.
///         This enables cheap on-chain anchoring without replicating full execution.
contract ConsensusCommit is IConsensusCommit, Ownable {
    /// @dev roundId (bytes32) → CommitRecord
    mapping(bytes32 => CommitRecord) private _commits;

    /// @dev ordered list of round IDs for enumeration
    bytes32[] private _roundIds;

    /// @dev minimum challenge window to avoid griefing (1 minute)
    uint256 public constant MIN_CHALLENGE_WINDOW = 60;

    /// @dev maximum challenge window (30 days)
    uint256 public constant MAX_CHALLENGE_WINDOW = 30 days;

    constructor() Ownable(msg.sender) {}

    // ─── Anchoring ────────────────────────────────────────────────────────────

    /// @inheritdoc IConsensusCommit
    function anchor(
        bytes32 roundId,
        bytes32 commitHash,
        uint256 challengeWindowSecs
    ) external override {
        require(roundId != bytes32(0), "Invalid roundId");
        require(commitHash != bytes32(0), "Invalid commitHash");
        require(
            challengeWindowSecs >= MIN_CHALLENGE_WINDOW,
            "Window too short"
        );
        require(
            challengeWindowSecs <= MAX_CHALLENGE_WINDOW,
            "Window too long"
        );
        require(_commits[roundId].anchoredAt == 0, "Round already anchored");

        uint256 expiresAt = block.timestamp + challengeWindowSecs;

        _commits[roundId] = CommitRecord({
            roundId: roundId,
            commitHash: commitHash,
            submitter: msg.sender,
            anchoredAt: block.timestamp,
            challengeExpiresAt: expiresAt,
            challenged: false,
            finalized: false,
            challengeUpheld: false
        });

        _roundIds.push(roundId);

        emit CommitAnchored(roundId, commitHash, msg.sender, expiresAt);
    }

    // ─── Challenging ──────────────────────────────────────────────────────────

    /// @inheritdoc IConsensusCommit
    function challenge(bytes32 roundId, string calldata reason) external override {
        CommitRecord storage rec = _commits[roundId];
        require(rec.anchoredAt != 0, "Round not found");
        require(!rec.finalized, "Round already finalized");
        require(!rec.challenged, "Already challenged");
        require(
            block.timestamp <= rec.challengeExpiresAt,
            "Challenge window closed"
        );
        require(bytes(reason).length > 0, "Reason required");

        rec.challenged = true;

        emit ChallengeRaised(roundId, msg.sender, reason);
    }

    // ─── Resolution ───────────────────────────────────────────────────────────

    /// @inheritdoc IConsensusCommit
    function resolveChallenge(bytes32 roundId, bool upheld) external override onlyOwner {
        CommitRecord storage rec = _commits[roundId];
        require(rec.anchoredAt != 0, "Round not found");
        require(rec.challenged, "Not challenged");
        require(!rec.finalized, "Already finalized");

        rec.finalized = true;
        rec.challengeUpheld = upheld;

        emit ChallengeResolved(roundId, upheld, msg.sender);

        if (!upheld) {
            emit CommitFinalized(roundId);
        }
    }

    // ─── Finalization ─────────────────────────────────────────────────────────

    /// @inheritdoc IConsensusCommit
    function finalize(bytes32 roundId) external override {
        CommitRecord storage rec = _commits[roundId];
        require(rec.anchoredAt != 0, "Round not found");
        require(!rec.challenged, "Pending challenge – use resolveChallenge");
        require(!rec.finalized, "Already finalized");
        require(
            block.timestamp > rec.challengeExpiresAt,
            "Challenge window still open"
        );

        rec.finalized = true;

        emit CommitFinalized(roundId);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @inheritdoc IConsensusCommit
    function getCommit(bytes32 roundId) external view override returns (CommitRecord memory) {
        require(_commits[roundId].anchoredAt != 0, "Round not found");
        return _commits[roundId];
    }

    /// @inheritdoc IConsensusCommit
    function isChallengeOpen(bytes32 roundId) external view override returns (bool) {
        CommitRecord storage rec = _commits[roundId];
        return
            rec.anchoredAt != 0 &&
            !rec.finalized &&
            block.timestamp <= rec.challengeExpiresAt;
    }

    /// @notice Total number of anchored rounds
    function roundCount() external view returns (uint256) {
        return _roundIds.length;
    }

    /// @notice Paginated list of round IDs
    /// @param offset Starting index
    /// @param limit  Max results (capped at 100)
    function getRoundIds(
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory) {
        if (offset >= _roundIds.length) return new bytes32[](0);

        uint256 cappedLimit = limit > 100 ? 100 : limit;
        uint256 end = offset + cappedLimit;
        if (end > _roundIds.length) end = _roundIds.length;

        bytes32[] memory result = new bytes32[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            result[i - offset] = _roundIds[i];
        }
        return result;
    }
}
