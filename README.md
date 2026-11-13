# Morkahja

Morkahja is a browser-based roleplaying game set in Babuni's original fantasy world. Encounters, characters, achievements, choices and social features connect a playable application to a larger body of places, peoples and stories.

**Creative direction:** Babuni · **Project:** browser game and server · **Status:** active development; release and production claims require separate verification

**Play:** https://www.babuni.dev/Morkahja/ — returning players restore their journey with their Morkahja recovery-key file, because browser storage does not carry over from the former address. See the [deployment record](docs/DEPLOYMENT.md).

The game and the world archive are distinct projects. The writing and worldbuilding live in [MorkahjaWorld](https://github.com/babunidev/MorkahjaWorld); this repository contains the game's client, server, shared contracts and development history.

## What the game explores

The existing development record follows the project from structured encounter and solution data into a playable React/Vite client, Express services and shared TypeScript contracts. It describes encounters, avatar progression, achievements and rewards, an event feed known as Scribes, and various social and account systems.

These are parts of a developing game, not an assertion that every system has passed a fresh end-to-end or production test. The [concept](CONCEPT.md) sets the creative direction, while [architecture](docs/ARCHITECTURE.md) and [content](docs/CONTENT.md) explain the technical organization.

## Where to begin

| Interested in… | Read… |
| --- | --- |
| The game idea | [Concept](CONCEPT.md) · [Design](docs/DESIGN.md) |
| Current work and unresolved risks | [Roadmap](ROADMAP.md) · [Deployment](docs/DEPLOYMENT.md) |
| Code and data boundaries | [Architecture](docs/ARCHITECTURE.md) · [Content](docs/CONTENT.md) |
| What changed | [Changelog](CHANGELOG.md) |
| How the project evolved | [Curated journal](docs/DEVLOG.md) · [Original journal](DEVLOG.md) |
| Creative and technical decisions | [Decisions](docs/DECISIONS.md) · [AI collaboration](docs/AI_COLLABORATION.md) |
| Dated audits, PR checks and gameplay notes | [Historical status notes](docs/RELEASE_STATUS_HISTORY.md) |

## Development and verification

The repository separates client and server packages. Read their own manifests and environment documentation before starting local services; they do not necessarily share the same commands or credentials.

The project has ongoing work concerning session authentication, concurrent player/avatar persistence and regression tests. Earlier records describe isolated Nobara database tests and CI results for two pull requests dated **4 November 2026**. Those results do not by themselves verify a merged branch or deployed production build; see [the historical test and PR notes](docs/RELEASE_STATUS_HISTORY.md) and current pull request status.

For multiplayer testing against a local database, `server/scripts/bot-adventurers.ts` runs three bot players that play like normal accounts; see [the architecture notes](docs/ARCHITECTURE.md).

Player data, credentials and remote game files are sensitive and must not be copied into public documentation. A source review, simulated test, local database test, complete release gate and live deployment are different kinds of evidence.

## Development story

The original [development log](DEVLOG.md) follows the game's formation from **May to June 2026** and remains preserved. The [curated journal](docs/DEVLOG.md) records later direction, design changes, AI-assisted work and verified outcomes in a shorter reading form.

The human creative owns the game's idea, world and design decisions. AI assistance contributes drafts, code and analysis where recorded; it does not replace creative authorship. Named third-party credits, including music contributions, are retained in the project records.

Before changing source or documentation, read [AGENTS.md](AGENTS.md) and [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md).

## License

Original game software uses [MIT](LICENSE). Babuni's original creative content is shared under [CC BY 4.0](CONTENT_LICENSE.md). Commissioned music and independently sourced sounds are excluded; their specific permissions apply.
