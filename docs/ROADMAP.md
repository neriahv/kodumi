# Roadmap

The current release is a functioning local workshop, with deterministic labs, real test execution, optional model-generated changes, and review-gated draft PRs.

## Next: strengthen the engineering workflow

- Add developer-editable proposed patches with repeated validation.
- Add dependency-aware retrieval and explicit source selection for larger repository snapshots.
- Evaluate AI fixes against a held-out set of seeded bugs; measure success rate, regressions, duration, and token usage.
- Add an isolated runner service for full repository validation with tightly bounded dependencies and network access.
- Add retryable provider orchestration, tests for branch/PR recovery, and clearer provider diagnostics.
- Add semantic diff rendering and syntax highlighting with self-hosted assets.

## Later: shared hosted product

- Authentication and per-user/repository authorization.
- Database-backed persistence, durable job queue, worker isolation, and storage quotas.
- GitHub App installation instead of a shared personal token.
- Hardened execution infrastructure, abuse controls, secret scanning/redaction, retention controls, and audit logs.
- CI-based validation of imported code before any “verified” label.

## Creative extensions

- Mentor mode that offers hints before a repair.
- A dependency map grounded in parsed imports.
- Replay with versioned snapshots of each meaningful patch attempt.
- Two-solution comparisons with independently measured outcomes.

These are proposed extensions, not implemented capabilities.
