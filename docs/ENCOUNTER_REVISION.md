# Encounter prose revision — 16 November 2026

The existing revision ends at **20052, Nagar Elder**, as confirmed by the source and its last commit, [`a742c390`](https://github.com/babunidev/Morkahja/commit/a742c3901cbfe869c4d1240a69fc7233bfa59c01). For the continuation, I approved the same cinematic encounter voice and a direct commit to `main` (D-042).

## Scope and writing choices

Codex (GPT-6; exact model variant not recorded) drafted and reviewed **140 descriptions**, from `20053` to `20193`. No `20154` exists in the source catalog; no record was invented to fill the gap. Babuni remains the human creative responsible for the world, canon, and writing direction.

Scenes use present-tense, third-person narration, concrete sensory details, and an ending before the player's decision. New prose avoids prescribing player thoughts or feelings. Dialogue is sparse; paragraph breaks follow a scene's movement. Rumored treasures and uncertain origins remain uncertain. Named characters, locations, anatomical traits, aid requests, and the engraved letters remain grounded in the original descriptions. Ordinary sensory staging is part of the prose adaptation, not a separate expansion of world lore.

The new texts use 88–140 whitespace-separated words: 56 have two paragraphs, 50 have three, and 34 have four. Earlier revisions, including the exceptional Keldor sequence and Atranor, were read as references and retained. The `Levelup!` system label is not a narrative scene and remains unchanged. The only earlier edit replaces `удар` with `strike` in `20025`.

## Verification

Verification ran in a separate Linux working copy based on `a742c3901cbfe869c4d1240a69fc7233bfa59c01`:

- `npm run verify:static-data` passed with the real referenced image directories present. The repository's check validates content structures, references, and image names.
- A complete Python JSON comparison against that Git revision passed: the same 203 keys in the same order, the same fields per record, and identical values for every field except `mEncounterText`. Exactly 141 text fields differ: the 140 rewrites and the one-word correction. The other 62 descriptions/labels are byte-for-byte unchanged as decoded strings.
- Coverage matched every existing ID at or above `20053`. No duplicate rewritten descriptions, replacement characters, or second-person pronouns occur in the new texts.
- The engraved-letter clues remain: `20081` A, `20083` H, `20084` K, `20085` J, `20086` O, `20087` M, `20089` A.
- `git diff --check` passed. The data diff changes only the intended text lines, preserving the original JSON layout.

Editorial review compared the source and drafts for regional identity, scene purpose, premature outcomes, repeated prose, and unsupported claims. The automated checks establish structural preservation, not literary quality. No application code changed; the full runtime release gate and browser layout checks were not run. No production files were changed and no deployment was performed. Git publication and a later release remain separate events.

**Release, 2026-11-16 22:56 UTC:** at Babuni's request, `a25ed410` went to the live server through `morkahja-deploy release` (see [the deployment record](DEPLOYMENT.md)). The live file now matches this commit byte for byte. The paragraphs were not read in the live game.

## Revised encounters

Counts below describe the committed prose. The source titles are preserved exactly.

| ID | Encounter | Words | Paragraphs |
| --- | --- | ---: | ---: |
| 20053 | Exhausted Verdani | 107 | 3 |
| 20054 | Drained Aevis | 102 | 2 |
| 20055 | Wounded Grimnir | 111 | 3 |
| 20056 | Venerable Grimnir | 105 | 2 |
| 20057 | Verdani Child | 101 | 3 |
| 20058 | Aevis Lady | 105 | 2 |
| 20059 | Rokur Blacksmith | 108 | 3 |
| 20060 | Verdani Treasury | 135 | 4 |
| 20061 | Frostwind Junkyard | 137 | 4 |
| 20062 | Market of Aetherion | 137 | 4 |
| 20063 | Ancient Inscription | 131 | 4 |
| 20064 | Altar of Umbrael | 107 | 2 |
| 20065 | Zeelai Feline | 104 | 3 |
| 20066 | Thirsty Grimnir | 106 | 2 |
| 20067 | Ferocious Silvermane | 105 | 3 |
| 20068 | Fey Greens | 138 | 4 |
| 20069 | Celestial Fields | 106 | 2 |
| 20070 | Enigmatic Prairies | 136 | 4 |
| 20071 | Arcane Meadows | 107 | 2 |
| 20072 | Tranquil Wilds | 104 | 2 |
| 20073 | Celestial Cairn | 104 | 3 |
| 20074 | Mysterious Cube | 133 | 4 |
| 20075 | Grumpy Fence | 105 | 2 |
| 20076 | Aevis Merchant | 107 | 3 |
| 20077 | Quicksilver Quagmire | 108 | 2 |
| 20078 | Unhinged Gobbl | 89 | 2 |
| 20079 | Fearfeaster Gobbl | 106 | 3 |
| 20080 | Dreamy Valley | 104 | 2 |
| 20081 | Arcadian Hills | 103 | 2 |
| 20082 | Alluring Fens | 105 | 3 |
| 20083 | Enchanted Gardens | 104 | 3 |
| 20084 | Mystical Vale | 100 | 2 |
| 20085 | Bucolic Dale | 105 | 2 |
| 20086 | Captivating Downs | 104 | 3 |
| 20087 | Radiant Heath | 102 | 2 |
| 20088 | Mesmerizing Hillsides | 105 | 2 |
| 20089 | Magical Glens | 105 | 3 |
| 20090 | Ethereal Glades | 102 | 2 |
| 20091 | Nagar Berserk | 107 | 4 |
| 20092 | Nagar Boar | 108 | 2 |
| 20093 | Bonecrusher | 103 | 3 |
| 20094 | Nagar Humpback | 104 | 2 |
| 20095 | Nagar Razorback | 108 | 3 |
| 20096 | Thunderhoof | 104 | 2 |
| 20097 | Yowler | 108 | 3 |
| 20098 | Common Chest | 104 | 2 |
| 20099 | Cliffs of Sarga | 103 | 3 |
| 20100 | Mountain Pass | 134 | 4 |
| 20101 | Rocks of Ohgar | 102 | 2 |
| 20102 | Frostwind Slopes | 103 | 2 |
| 20103 | Strange Boulder | 105 | 2 |
| 20104 | Sudden Rockslide | 111 | 4 |
| 20105 | The Giant | 104 | 2 |
| 20106 | Sarga Lioness | 103 | 3 |
| 20107 | Silver Wolf | 107 | 2 |
| 20108 | Shena Alpha | 105 | 2 |
| 20109 | Embersnout | 107 | 2 |
| 20110 | Mother Wolf | 112 | 3 |
| 20111 | Young Redeye | 101 | 2 |
| 20112 | Cursed Silvermane | 101 | 4 |
| 20113 | Cursed Liani | 105 | 2 |
| 20114 | Liani Guardian | 106 | 3 |
| 20115 | Liani Predator | 105 | 2 |
| 20116 | Aradia's Perch | 96 | 3 |
| 20117 | Thunderfly Matriarch | 98 | 4 |
| 20118 | Firecrest Bloodbeak | 102 | 2 |
| 20119 | Simple Treasure | 106 | 2 |
| 20120 | Bronze Vault | 134 | 4 |
| 20121 | Frost Strider | 105 | 2 |
| 20122 | Rocky Tundra | 104 | 2 |
| 20123 | Everwinter Trading Post | 104 | 4 |
| 20124 | Frostfang Alpha | 105 | 4 |
| 20125 | Raided Verdani Village | 135 | 4 |
| 20126 | Disheartened Rokur | 108 | 2 |
| 20127 | Eternal Twilight Grove | 103 | 3 |
| 20128 | Grimnir Rebels | 108 | 3 |
| 20129 | Everwinter Treasurechest | 105 | 2 |
| 20130 | Everwinter Guardian | 104 | 2 |
| 20131 | Everwinter Cave | 131 | 4 |
| 20132 | Frostbite Fergus | 106 | 2 |
| 20133 | Kaldric of Nekalos | 104 | 4 |
| 20134 | Seal of Nekalos | 131 | 4 |
| 20135 | Frostlace | 103 | 4 |
| 20136 | Lost Souls of Everwinter | 102 | 3 |
| 20137 | The Shattered Seer | 137 | 4 |
| 20138 | Skyreach Peak | 105 | 3 |
| 20139 | Lyria of Nekalos | 101 | 3 |
| 20140 | Misthowl | 101 | 2 |
| 20141 | Winterwisp Warden | 106 | 3 |
| 20142 | Frostfall Cascade | 136 | 4 |
| 20143 | Frostforged Vault | 101 | 3 |
| 20144 | The Scholar | 103 | 4 |
| 20145 | Spirit Stag | 109 | 3 |
| 20146 | Eldritch Stronghold | 102 | 2 |
| 20147 | Ironclad Reliquary | 99 | 2 |
| 20148 | Luminous Enclave | 135 | 4 |
| 20149 | Tempest Fury | 102 | 4 |
| 20150 | Timberclaw Wretch | 104 | 3 |
| 20151 | Auraglow Mireling | 105 | 4 |
| 20152 | Echowraith Skulker | 106 | 3 |
| 20153 | Lumbering Necrobrute | 104 | 3 |
| 20155 | Blightwatcher Raven | 106 | 2 |
| 20156 | Twilight Whisper Grove | 104 | 3 |
| 20157 | Enigmas End | 105 | 3 |
| 20158 | Path of Despair | 105 | 2 |
| 20159 | Gloomroot Expanse | 103 | 3 |
| 20160 | Wraithbone Pathway | 103 | 2 |
| 20161 | Skullstone Pass | 105 | 3 |
| 20162 | Sageglow Clearing | 138 | 4 |
| 20163 | Emberlost Wraith | 109 | 4 |
| 20164 | Flamecrazed Wanderer | 104 | 3 |
| 20165 | Gloomthorn Sentinel | 108 | 4 |
| 20166 | Stormshriek Harbinger | 106 | 3 |
| 20167 | Skyshard Guardian | 108 | 3 |
| 20168 | Skyheart Drifter | 106 | 3 |
| 20169 | Meadowheart Lostling | 104 | 3 |
| 20170 | Forestwander Sproutling | 104 | 2 |
| 20171 | Fringebound Escapee | 107 | 3 |
| 20172 | Skylore Scholar | 105 | 2 |
| 20173 | Verdantweave Envoy | 110 | 3 |
| 20174 | Flameheart Purifier | 103 | 3 |
| 20175 | Cinderheart Vanguard | 88 | 2 |
| 20176 | Frostclaw Behemoth | 109 | 3 |
| 20177 | Shadowmarket Mystic | 105 | 2 |
| 20178 | Sylvan Rune Gateway | 101 | 3 |
| 20179 | Roarback Mauler | 106 | 2 |
| 20180 | Gloomweaver Colossus | 103 | 2 |
| 20181 | The Archive of Echoes | 139 | 4 |
| 20182 | Aetherion Forge | 137 | 4 |
| 20183 | Harmonic Concert | 131 | 4 |
| 20184 | Garden of Elements | 140 | 4 |
| 20185 | Earthsinger's Challenge | 102 | 2 |
| 20186 | Melody's Bloomwalker | 105 | 4 |
| 20187 | Ember's Journeykindler | 104 | 3 |
| 20188 | Mystic Hearth's Seal | 107 | 3 |
| 20189 | Zephyr's Embrace | 108 | 3 |
| 20190 | Veilwalker | 88 | 2 |
| 20191 | Slumbering Ogru | 102 | 2 |
| 20192 | Nereval Elite | 103 | 3 |
| 20193 | Joyful Riverkeeper | 109 | 2 |
