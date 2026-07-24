# Accelerate Phase 1 by owner decision

## Status

Accepted

## Context

The original product specification required thirty consecutive days of Phase 0 usage before Phase 1 could begin. The product owner explicitly authorized advancing without that observation period because the farm needs the reproductive and health workflows sooner.

## Decision

REJO may begin Phase 1 implementation immediately. The local-first data model, offline capture behavior, recoverable records, farm isolation, and explicit business-date handling remain mandatory. Phase 1 work will still be delivered in dependency order: reproductive facts and derived state, animal timeline and alerts, health and milk withholding, then optional double tank readings.

## Consequences

The team accepts that Phase 1 usability and alert quality will have less evidence from real Phase 0 behavior. The original thirty-day observation remains a recommended pilot validation activity and does not become a release gate for Phase 1.
