# Morkahja — contributor and AI rules

**Human creative:** Babuni

Respect original game design, existing player data and the source-backed development journal. Distinguish author's creative direction from AI-generated prototypes and implementations. Document changes in README, CHANGELOG and docs/DEVLOG with evidence; keep dated original DEVLOG intact. Do not claim tests without execution, do not place credentials in Git, and never erase contributor credits such as the named composer.

## Repository-local documentation standard

Before writing or changing project documentation, read [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md). These rules travel with this repository and do not depend on the babuni.dev ChatGPT Project. Preserve all project-specific technical, creative, canon, safety, licensing, and historical rules in this file; follow the linked standard for public first-person narrative, human–AI attribution, concise development journals, decision records, and evidence-based verification. **Babuni** is the human creative; **babuni.dev** is the website/portfolio, not the person. Preserve third-party credits and historical legal notices. References above to a dated “documentation-only audit” describe that past task, not a permanent ban on later authorized implementation.

## Ongoing development-record workflow (4 November 2026)

Every meaningful implementation, bug fix, security change, or **explicitly approved** design decision must be documented in the same branch/PR when practical. Documentation is part of the work, not an optional later cleanup.

1. Read this file and `docs/DOCUMENTATION.md` first. Preserve the historical root `DEVLOG.md` verbatim; append contemporary, source-backed human-facing entries to `docs/DEVLOG.md`.
2. Update `CHANGELOG.md` for actual committed behavior, `ROADMAP.md` for progress/deferred tasks, `docs/DECISIONS.md` for confirmed human decisions, and `docs/ARCHITECTURE.md` for meaningful technical boundaries. Update `README.md` when readers need to discover the status or instructions.
3. For each substantive change, record date, scope, branch/PR or commit, affected subsystem, human direction versus AI implementation, verification commands and environments, known failures, limitations, and merge/deployment status. A passing isolated test does not imply that the complete release gate passed or that production was updated.
4. Do not convert an observed behavior into a guarantee, assume a discussion approved a feature, or silently mark unmerged work as released. Never publish credentials, recovery keys, player data, or private conversations.
5. Concurrent writes to player/avatar JSONB documents require extra care: an atomic `setPlayer`/`setAvatar` top-level JSONB merge does **not** make read–modify–write calculations on nested objects safe. For currency, rewards, counters, sessions, and inventory use appropriate row locking/transactions and concurrency regression tests.
6. On Nobara/Linux, provide a safe **update → run → test** workflow with project paths and PostgreSQL/Podman prerequisites. The developer's main working tree can have unpublished commits and uncommitted changes. Do not reset, clean, force-pull, or change their main checkout without explicit authorization; prefer separate Git worktrees for review.
