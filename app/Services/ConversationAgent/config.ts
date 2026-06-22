/**
 * Runtime safety config for the SAV agent.
 *
 * During the draft-first rollout of the email channel, write actions stay
 * conservative: the agent drafts replies for human review and does NOT mutate
 * Shopify orders. Flip these once email auto-send is trusted (Phase 4).
 */
export const SavAgentConfig = {
  /**
   * When false, the updateOrderAddress tool only validates the request and
   * ESCALATES to a human — it never calls the Shopify orderUpdate mutation.
   */
  orderAddressMutationEnabled: false,
}
