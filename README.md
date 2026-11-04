# Morkahja

**Author:** Babuni.dev

An evolving browser-based role-playing game project set in the world of Morkahja.

The repository contains the client, server, shared code, and a development journal (`DEVLOG.md`). The client and server have their own package manifests; the client README currently contains the Vite starter instructions.

Authorship and creative direction belong to **Babuni.dev**. AI-assisted implementation is documented separately from the original project direction.

## Development documentation

- [Concept](CONCEPT.md) · [Roadmap](ROADMAP.md) · [Changelog](CHANGELOG.md)
- [Architecture](docs/ARCHITECTURE.md) · [Design evidence](docs/DECISIONS.md) · [Development journal](docs/DEVLOG.md)
- [AI collaborator rules](AGENTS.md)

The journal distinguishes source-based reconstruction, author direction, AI assistance, and independently verified behavior.

## Historical documentation audit — #30 (27 October 2026)

The project's **primary development record** is the [original dated DEVLOG](DEVLOG.md), which chronicles the browser game from May 16 to June 7, 2026. The supporting documents interpret that journal but do not supersede it. The workspace's current version field is **0.9.0-beta.2.2**; the original journal describes it as a public pre-1.0 beta, not a independently revalidated live service.

The original record follows the move from structured encounter/solution data into a playable React/Vite client, Express services and shared TypeScript contracts. It traces the encounter loop, SCRIBES event feed, avatar lifecycle, achievement/reward systems, expansion unlocks, friends and social surfaces, plus later deployment and security considerations. These stages are historical **development claims from the journal**, not new tests performed in this audit.

**Additional documentation:** [Visual and interaction design](docs/DESIGN.md) · [Content and provenance](docs/CONTENT.md) · [AI collaboration](docs/AI_COLLABORATION.md). The audit preserves Babuni.dev's authorship, separately credits music contributor Nikita Malko, and does not modify the original journal, game code or player data.

## Public repository preparation — 31 October 2026

The standard documentation is maintained in this actual project repository. See [publication preparation](docs/PUBLISHING.md) for the current review, remaining permissions and migration order. Visibility has not changed.

## Current development notes — 4 November 2026

Recent security and persistence work is under review, **not merged into `main` or deployed**: [PR #5 — single-use session authentication challenges](https://github.com/babunidev/Morkahja/pull/5) and [PR #6 — atomic player/avatar persistence](https://github.com/babunidev/Morkahja/pull/6). PR #6 builds on PR #5.

On the isolated Nobara test checkout, `npm run test:session-auth --prefix server` and `npm run test:persistence --prefix server` passed against local PostgreSQL. CI also passed these, achievements, dice, static data checks, and the client build. The complete release gate remains red because of previously existing server TypeScript errors; production behavior has not been verified. See [architecture](docs/ARCHITECTURE.md), [roadmap](ROADMAP.md), [decisions](docs/DECISIONS.md), and [development journal](docs/DEVLOG.md) for the boundaries.

Separate browser tabs can presently use the same account, including different avatars. This is an observed behavior deliberately left unchanged, not yet a fully validated multi-avatar feature.
