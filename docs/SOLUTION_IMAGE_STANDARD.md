# Solution artwork standard — Morkahja

**Creative direction:** Babuni  
**Decision:** D-051, 2026-11-21  
**Status:** Approved visual standard for new and reworked solution artwork. Documentation is not evidence that existing images, game rendering, or production assets have been migrated.

## Source of truth and review order

Solution records are defined in `server/game/solutiondata.json`. For each solution, inspect its numeric `mSolutionID`, `mSolutionName`, `mSolutionText`, `mSolutionInventoryType` and `mSolutionIconName`. Open and examine the current artwork at `client/public/game/solutionimages/<mSolutionIconName>.webp` before drafting a replacement. Preserve the record's identity, established function, and recognizable visual motifs where they make sense.

Consult [MorkahjaWorld](https://github.com/babunidev/MorkahjaWorld) for relevant races, places, magic, cultures, materials, elemental relationships, and mythic symbols, citing the specific lore files in review notes. The lore archive is authoritative for world canon; a new graphic interpretation must not silently establish new canon. Where a solution's description and world lore appear inconsistent, flag the difference rather than inventing a resolution.

## Shared icon format

- **Canvas:** 512 × 512 pixels, square.
- **Delivery:** compressed WebP with true transparency outside a complete circular image. Keep an RGBA-capable master during creation.
- **Size target:** about 0.077 MB (77 KB) where good legibility and fidelity allow; file size is a goal, **not** a reason to sacrifice an image or conceal artifacts. Inspect the original asset's dimensions and byte size.
- **Shape:** one circle, centered and allowed to reach the canvas edges (diameter up to 512 pixels). No corner background, shadow canvas, rectangular fill, or ornamental border.
- **Frame:** **never paint an inventory frame into the asset**. The game will add frames separately in a later design change; that runtime change is not yet implemented by this standard.
- **Composition:** every visible object, gesture, particle, glow and other element is confined to the circle. Mask alpha outside the circle even if source artwork overflows it. Avoid cutting off key object features. Allow appropriate interior breathing room where an eventual frame might cover the outer rim.
- **Design:** rich, readable fantasy illustration, with an expressive silhouette, restrained detail at small display sizes, and established Morkahja materials/colors. A close-up or more abstract view is welcome when it expresses the solution better than a full object.

## Items and abilities

**Physical items and tools:** Show an object or an intentional close-up against an atmospheric, continuous circular background, usually in the family's deep copper-red tones unless the source artwork or lore warrants another treatment. A whole object is not compulsory; its important form and purpose must remain clear. Never let the object or its magical effects project outside the background circle.

**Abilities and skills:** Do **not** force a small object onto an empty disc. Fill the circular area with the action, force, magical phenomenon, or visual metaphor that communicates the skill. These images are likewise frameless and circular; all effects stop at the circle's edge. Preserve recognizable existing motifs when appropriate.

## One-by-one replacement workflow

1. Work in ascending numeric solution ID unless Babuni specifies an exception. Note when several IDs refer to one icon or when icons have no matching solution.
2. Read the complete solution record and inspect its original image. Check relevant [world lore](https://github.com/babunidev/MorkahjaWorld) before interpreting characters, symbols, cultures, or magic.
3. Draft an illustration that obeys the item/ability distinction and circle mask. The source artwork is a reference, not proof of a canonical appearance.
4. Export 512 × 512 WebP; measure actual bytes and alpha; inspect both the full icon and a small in-game-sized thumbnail. Confirm pixels outside the circle are transparent and nothing visually projects beyond it.
5. Keep the original image intact until the replacement is reviewed. Track **proposed**, **approved**, **committed**, **tested in game**, and **deployed** independently; an exported local WebP is not a committed or released game change.
6. When a replacement is accepted, use its existing `mSolutionIconName` as the production basename, preserve any contributor attribution, and document the replacement in `docs/DEVLOG.md` and `CHANGELOG.md`, including validation and deployment status.

## New solution artwork

For approved new solutions not yet in the game catalog, use the corresponding `docs/encounter-drafts/<encounterID>.md` specification and the content production ledger as source authority. Inspect related existing solution and encounter artwork, consult world lore, and apply the same technical standards. A creative approval does not activate game records. Track local export, approval, asset upload, runtime verification and deployment separately.

## Revision ledger

| Solution | Class | Original asset | Status |
| --- | --- | --- | --- |
| 10001 — Arcane Intellect | Ability | `skill_learn.webp` | Local frameless WebP draft exported and checked (512 × 512, 49,272 bytes, transparent beyond circle); **not committed to the game, approved, tested in game or deployed** |
| 10440 — Wordkeeper's Stone | Item / Speechcraft | New asset `10440_wordkeepers_stone.webp` | Creatively approved 2026-11-27; local WebP verified (512 × 512 RGBA, 76,720 bytes, zero nontransparent pixels outside circle); repository upload, runtime test and deployment pending. Source: [20232](encounter-drafts/20232.md). |

The source file for the current 10001 icon shows a central golden arcane glyph, teal energy, and amber energy, with a painted frame. The [Common Arts](https://github.com/babunidev/MorkahjaWorld/blob/main/Magic/Common_Arts.md#arcane-intellect) entry identifies this skill with absorbing and mastering strength, cunning, and magic. The [Elemental Foundation](https://github.com/babunidev/MorkahjaWorld/blob/main/Magic/Elemental_Foundation.md) describes Aether as the connector and transformer of material elements. These are design references, not permission to alter the game's mechanics.

### 10001 draft review note — 2026-11-21

The first proposed redesign keeps the original icon's four-point golden arcane motif, with blue and amber currents suggesting elements meeting through Aether. It has no painted frame and stays within a circular alpha mask. This is an interpretive artwork concept, not a new canonical depiction of a named artefact. The PNG/WebP were exported as downloadable conversation attachments, not placed in the repository's image directory. The export was generated by ChatGPT (GPT-6) with Python/Pillow and CairoSVG after the image-editing tool could not use the repository original as an editable reference; it should be evaluated as a **prototype**. Alpha bounds, dimensions and byte size were checked locally; gameplay rendering and human acceptance have not been checked.
