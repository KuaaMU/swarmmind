/**
 * @swarmmind/shared-types – public API
 *
 * Re-exports all v1 protocol types and Zod schemas from `./protocol`.
 */

export {
  DomainSchema,
  EvidencePointerSchema,
  AgentProposalSchema,
  ConsensusDecisionSchema,
  computeEvidenceRoot,
  computeDecisionHash,
} from "./protocol";

export type { Domain, EvidencePointer, AgentProposal, ConsensusDecision } from "./protocol";
