import { useEffect, useState, type CSSProperties } from 'react';
import { revealMenuWhenReady } from '../transitions/menuReadiness.js';
import { APP_VERSION } from '../../appVersion.js';
import { ClosePanelButton } from '../common/ClosePanelButton.js';
import {
  protectedOverlaySurfaceProps,
  protectedOverlayTextStyle,
} from '../protectedImage.js';
import { LineFrame, framedStyle } from '../common/LineFrame.js';
import { frameDividerStyle } from '../common/simpleFrame.js';

const OVERLAY_FADE_MS = 300;

interface PatchNoteGroup {
  title: string;
  notes: string[];
}

interface PatchRelease {
  id: string;
  version: string;
  period: string;
  /** Flat bullets when there are no topic groups. */
  notes?: string[];
  /** Topic groups for larger releases. */
  groups?: PatchNoteGroup[];
}

/** Newest release first; oldest last. */
const PATCH_RELEASES: PatchRelease[] = [
  {
    id: 'beta-82',
    version: '0.9.0-beta.82',
    period: '21 Nov 2026',
    notes: [
      'A new avatar starts with the three essences of its own element: Rokur fire, Verdani water, Aevis air, Grimnir earth.',
      'Essences of other elements are lost first, two at a time (the last one alone); then your own, one at a time.',
      'A roll of 25 or higher has a one-in-five chance to bring an extra essence of your own element.',
      'Bigger pictures in the Inventory and Skillbook.',
    ],
  },
  {
    id: 'beta-81',
    version: '0.9.0-beta.81',
    period: '21 Nov 2026',
    notes: [
      'Many solutions have new pictures, and they show whole inside their frames. Older pictures are no longer cut off at the edges.',
      'Inventory and Skillbook show their name on the plate at the top of the frame; tap it to close them.',
      'A reward\'s tooltip waits until the reward has arrived in its place.',
    ],
  },
  {
    id: 'beta-80',
    version: '0.9.0-beta.80',
    period: '21 Nov 2026',
    notes: [
      'Every solution now sits in a drawn golden frame: essences carry their god\'s element in the corners, and rare treasures get a richer ring. The frame stays with it wherever it goes, even in flight.',
      'A small hexagon on each item shows how many charges you hold, in the inventory, the skillbook and on the solutions an encounter offers.',
      'The first solutions have new pictures, among them Arcane Intellect, Haggling, Open Lock and Search.',
    ],
  },
  {
    id: 'beta-79',
    version: '0.9.0-beta.79',
    period: '19 Nov 2026',
    notes: [
      'Playing together is smoother: choices, Continue and the next encounter now appear the moment they happen.',
      'The adventurers who answer a Call for help wait quietly while you level up, and keep a quicker pace.',
      'Nobody in a party is set aside for being slow; anyone can leave a room whenever they like.',
    ],
  },
  {
    id: 'beta-78',
    version: '0.9.0-beta.78',
    period: '18 Nov 2026',
    notes: [
      'A level-up now lets you choose your reward: pick one of three, and your roll decides how many more come with it. A 20 brings something rare.',
      'Every solution and every die rises and hovers with its roll before it flies into the encounter, and the number flies into your avatar, where your roll now stands big.',
      'What you used and how the roll came together are in your avatar\'s tooltip.',
      'Losses and rewards wait until the roll has flown in, and hovering rolls hide behind Lore, Inventory, the Skillbook and the map.',
      'Rooms that nobody can return to are cleared away.',
    ],
  },
  {
    id: 'beta-77',
    version: '0.9.0-beta.77',
    period: '17 Nov 2026',
    notes: [
      'The name on the top of the encounter is now the land where the story happens, and the map opens right where it takes place.',
      'In an encounter that needs several solutions, an item that runs out is refilled from another item of the same kind.',
      'A single roll of the dice shows its number for a moment, then flies into the encounter like a solution.',
      'An encounter you just played waits for three others before it can come back.',
      'The loading screen shows the version.',
    ],
  },
  {
    id: 'beta-76',
    version: '0.9.0-beta.76',
    period: '17 Nov 2026',
    notes: [
      "A world map of Morkahja: the name of your land now sits on the top edge of the encounter, and clicking it opens the map where you are. Drag it to explore, and zoom with the wheel or two fingers.",
      'The encounter name greets you for a moment when you arrive, then leaves the picture.',
      'The weather moves on more often and keeps its course when you change land, so storms come more often. Music and weather fade in and out, with shorter breaks between pieces.',
      'Fades and volume now work on iPhone and iPad.',
      'Morkahja has its own mouse cursors.',
    ],
  },
  {
    id: 'beta-75',
    version: '0.9.0-beta.75',
    period: '15 Nov 2026',
    notes: [
      'Using a resurrection item in Atranor spends that item.',
      'Solution stacks disappear into the encounter when they are finished, and they no longer stay on Atranor or a level-up.',
    ],
  },
  {
    id: 'beta-74',
    version: '0.9.0-beta.74',
    period: '15 Nov 2026',
    notes: [
      'In an encounter that needs more than one solution, a die shows its number when it rises. Those dice then fly into the encounter, as a solution does.',
      'Dice from an encounter that just ended no longer stay on screen when Atranor or a level-up begins.',
      'A hovering die or solution no longer glows, and a stack of dice stays upright.',
      'A finished total of 25 adds one extra normal item. When the encounter already gives five rewards, one of those gains two charges instead.',
      'The weather fades from one land into the next.',
    ],
  },
  {
    id: 'beta-73',
    version: '0.9.0-beta.73',
    period: '15 Nov 2026',
    notes: [
      'In an encounter that needs more than one solution, each die rises and hovers after it spins. Rolling again pushes the earlier die up.',
    ],
  },
  {
    id: 'beta-72',
    version: '0.9.0-beta.72',
    period: '15 Nov 2026',
    notes: [
      'Aetherion, the city, has its own weather, through all four stages.',
    ],
  },
  {
    id: 'beta-71',
    version: '0.9.0-beta.71',
    period: '15 Nov 2026',
    notes: [
      'A solution and the dice both play for 1.73 seconds.',
      'The Scribes notice no longer sits on a gray square.',
    ],
  },
  {
    id: 'beta-70',
    version: '0.9.0-beta.70',
    period: '15 Nov 2026',
    notes: [
      'The new weather belongs to Everwinter Valley.',
    ],
  },
  {
    id: 'beta-69',
    version: '0.9.0-beta.69',
    period: '15 Nov 2026',
    notes: [
      'New weather was prepared for a named land, then placed with Everwinter Valley.',
    ],
  },
  {
    id: 'beta-68',
    version: '0.9.0-beta.68',
    period: '15 Nov 2026',
    notes: [
      'A harder encounter rolls once for each solution it asks for. The same item still rises and hovers for every charge. The dice spins once for each roll it owes.',
    ],
  },
  {
    id: 'beta-67',
    version: '0.9.0-beta.67',
    period: '15 Nov 2026',
    notes: [
      'The Cursed Forest of Keldor has its own weather, including Roarback Mauler.',
    ],
  },
  {
    id: 'beta-66',
    version: '0.9.0-beta.66',
    period: '15 Nov 2026',
    notes: [
      'The next encounter usually stays in the same region. A roll of 15 or higher on a d20 leaves for another one.',
      'The result on your portrait shows how the number was made: the roll, then its bonus and the difficulty.',
    ],
  },
  {
    id: 'beta-65',
    version: '0.9.0-beta.65',
    period: '15 Nov 2026',
    notes: [
      'Inventory, the skillbook and lore are a little quieter.',
    ],
  },
  {
    id: 'beta-64',
    version: '0.9.0-beta.64',
    period: '15 Nov 2026',
    notes: [
      'A weather bed plays under the encounter, with its own volume in Settings. It fades in over one second and out over two.',
      'Using a solution plays one of eight lines, a little quieter than the other effects. Reward lines are a little quieter too.',
    ],
  },
  {
    id: 'beta-63',
    version: '0.9.0-beta.63',
    period: '14 Nov 2026',
    notes: [
      'Every sound now sits with the level-up fanfare. The fanfare itself is unchanged.',
    ],
  },
  {
    id: 'beta-62',
    version: '0.9.0-beta.62',
    period: '14 Nov 2026',
    notes: [
      'Call for help reaches up to five free adventurers, friends first. A full group cannot call. The horn on that notice waits a minute before it sounds again.',
    ],
  },
  {
    id: 'beta-61',
    version: '0.9.0-beta.61',
    period: '14 Nov 2026',
    notes: [
      'The backpack, the skillbook and Call for help each play their own sound.',
    ],
  },
  {
    id: 'beta-60',
    version: '0.9.0-beta.60',
    period: '14 Nov 2026',
    notes: [
      'Makaya’s voice lines were brought to one level. A later update matches every sound to the level-up fanfare.',
    ],
  },
  {
    id: 'beta-59',
    version: '0.9.0-beta.59',
    period: '14 Nov 2026',
    notes: [
      'Rolls are a d20 again. A primary solution is d20+7, a secondary is d20+5, and the total is shown even past 20.',
    ],
  },
  {
    id: 'beta-58',
    version: '0.9.0-beta.58',
    period: '14 Nov 2026',
    notes: [
      'Taking a reward plays a voice line. A skill, an item and each god’s essence have their own lines, and losing an essence does too.',
    ],
  },
  {
    id: 'beta-57',
    version: '0.9.0-beta.57',
    period: '14 Nov 2026',
    notes: [
      'The item shown in a solution slot is the one that is used. One item stays in a single slot.',
    ],
  },
  {
    id: 'beta-56-nov-4-14',
    version: '0.9.0-beta.56',
    period: '4–14 Nov 2026',
    groups: [
      {
        title: 'A new home',
        notes: [
          'Morkahja now lives at babuni.dev/Morkahja.',
          'Game content comes from the server, so new encounters and fixes reach you on your next visit, and the game loads faster.',
          'Three adventurers live in the world now: Varrokh, Sylvaen and Thalyss. Sylvaen and Thalyss answer Call for help.',
        ],
      },
      {
        title: 'The game screen',
        notes: [
          'A new game screen: the encounter picture on top, your party in the middle, and Call for help, Inventory, Skillbook and Lore below.',
          'Rewards grow out of the encounter and losses fly in from where you kept them. Tap each one to collect it, and collecting the last one continues.',
          'Collected items show in your Inventory and Skillbook at once.',
          'A new frame around the encounter. Its bottom line is a timer: from a new encounter until its solutions are ready, and from your choice until your rewards, losses or Continue can be used.',
          'Tooltips everywhere on the game screen point at their item, open after a short pause, and appear on a long press on phones without using the item. A line now separates each title from its text.',
          'Playing alone, your avatar gets the whole space between the solutions and the buttons.',
          'Tapping an avatar opens its details in a framed card that points at it, like the tooltips.',
          'Your lives sit on your avatar: five essence slots on the bottom of the portrait. Losses leave from them, new essences fly in, and the next encounter refills them from your inventory.',
          'Each essence slot keeps its own essence: after a loss or a new essence the others no longer change pictures.',
          'Atranor items go to your inventory, not the essence slots, and a bad roll no longer takes them in place of an essence.',
          'Spent solutions and rewards no longer flash in the corner of the encounter before they fly.',
          'When you choose a solution, the other choices fade out while it plays.',
          'Encounters that need several solutions: tap them one at a time and they hover above their slots until the set is complete, then fly in together. Each one rolls on its own and the rolls are averaged; with too few, the dice rolls for the missing ones.',
        ],
      },
      {
        title: 'Phones and menus',
        notes: [
          'The game, the welcome screen, avatar creation and the menus fit and stay centred on phone screens.',
          'Avatar creation is rearranged: all choices on top, a big avatar with its name below, and clear rings around what you picked.',
          'Undo and redo in avatar creation: step back to an earlier combination, change it, and step forward again.',
          'Every panel, menu, button and tooltip has the new line frame with cut corners.',
          'Menus, Lore, Inventory and Skillbook open once their pictures are loaded; the button you pressed pulses meanwhile. A new avatar fades in once it is ready.',
          'In encounters that need several solutions, each solution plays its animation, rises to hover above its slot and shows its own roll as it arrives; a chosen solution stays chosen. The dice shows its roll when it finishes the set.',
          'A lore gem you pick up flies to the top left of your avatar and waits there; when you continue, it sinks into your avatar. It no longer takes a reward place.',
          'About Us has Privacy Policy and Terms of Service buttons at the bottom, next to Donation.',
          'New Terms of Service and Privacy Policy in plain words, and the welcome screen\'s Restore button is now called Use Your Key.',
          'Tooltips fade softly in and out; inventory items on phones open their tooltip with a tap anywhere on the item.',
          'A new title picker on your profile, in the game’s own style.',
          'The Friends list fits on phones, and its buttons grow and glow like the others.',
        ],
      },
      {
        title: 'Fixes',
        notes: [
          'Turns no longer stall after choosing a solution or the dice.',
          'A level-up can no longer be played twice, and the lore gem flies to your avatar.',
          'Call for help now reaches players with a paused solo adventure.',
          'Purchases, lore gems and joining a party are safe against double grants and races; rolls stay secret until you choose.',
          'Fixed a screen that could freeze the browser tab during an encounter.',
        ],
      },
    ],
  },
  {
    id: 'beta-2-2-jun-8-9',
    version: '0.9.0-beta.2.2',
    period: '8–9 Jun 2026',
    groups: [
      {
        title: 'How you play',
        notes: [
          'Play always opens a room — solo or party, one path. Your encounter is rolled when you enter.',
          'Continue is yours to press — outcomes no longer auto-advance after a choice.',
          'Misery and Hardship losses match the server — the items you see leave are the items that leave.',
          'Solo checkpoints — leave a solo room and Play picks up where you left off.',
          'Join from friends, Scribes, or help invites uses the same portrait handoff as solo Play.',
          'Level-up and Atranor (solo) — one Continue step when the room is ready; no extra waiting ack.',
          'Continue sync — misleading “isn’t ready to continue” toasts removed; the room quietly catches up instead.',
        ],
      },
      {
        title: 'Party fairness',
        notes: [
          'Leaving after a choice still counts — inventory, XP, and events commit even if you disconnect.',
          'Rejoin the same encounter and your result is waiting; if the party moved on, you join the current one.',
          'Choice badges on every portrait — including your own — with dice/solution icon and revealed d20 roll bottom-right.',
          'Badges fade in at their final corner (no center snap); pulse animation stays smooth when the roll arrives late.',
        ],
      },
      {
        title: 'Death & fallen souls',
        notes: [
          'A fatal Atranor roll marks your avatar as failed — not deleted. Progress survives a refresh.',
          'Sacrifice — offer a fallen soul for gems (level × 10); restores Fortune-tier essence and steps past Atranor in one go.',
          'Hall of Fame — lay a soul to rest with Same Soul / New Avatar; deceased avatars join your profile wall.',
          'Finalizing death clears solo rooms, leaves parties, and blocks that soul from play until you start anew.',
          'The death screen waits until you press Continue — checkpoint parks when the overlay opens.',
          'Deceased avatars cannot create, join, select, or re-enter rooms; friendlier messages when the server blocks an action.',
        ],
      },
      {
        title: 'Welcome & creation',
        notes: [
          'Refreshed create-journey steps, recovery key info, and a cleaner welcome gateway.',
          'New avatar creation atmosphere — starfield backdrop and solution inflow into the hub.',
          'Profile wall of fame — one deduped list per avatar; failed souls stay out of living slots; cards show level, encounters, and fallen date.',
          'Selectable achievement display titles on your profile.',
        ],
      },
    ],
  },
  {
    id: 'beta-2-1-jun-6-7',
    version: '0.9.0-beta.2.1',
    period: '6–7 Jun 2026',
    notes: [
      'Solution charges — using a solution now costs charges based on encounter difficulty; tooltips show when your inventory is short.',
      'Witness events — allies see the actor’s real roll and rewards on level-up and Atranor; outcomes wait for Continue.',
      'Fate label — the middle roll tier displays as Fate (same mechanics as before).',
      'Party choice badges — dice, solution, or focus icons on portraits when a player is ready (with hover details).',
      'Level-up fixes — no double level-ups; inventory stays correct when a party moves into a level-up encounter.',
      'Smoother party transitions — normal encounters and system events share the same fade flow.',
      'Level-up sound plays once when a party level-up event appears.',
      'Encounter tooltips on side party slots render above center portraits and the reward block.',
    ],
  },
  {
    id: 'beta-2-late-may-jun',
    version: '0.9.0-beta.2',
    period: 'late May – 2 Jun 2026',
    groups: [
      {
        title: 'Multiplayer',
        notes: [
          'Encounter rooms for up to 3 players — shared encounters, choices, and Continue.',
          'Call for help — invite friends or other online players into your room.',
          'Witness events — level-ups and Atranor visible to everyone in the room, not only the roller.',
          'Party slots show who’s ready; improved join toasts and “waiting for party” flow.',
          'Lore gems can be earned for the whole party in a room.',
          'Soul Link — permanently link your account to one Adventurer; Spiritguide achievement chain.',
        ],
      },
      {
        title: 'Shop & support',
        notes: [
          'Dice skins — unlock account-wide styles for your dice.',
          'Expansions shop UI refreshed.',
          'Stripe checkout for expansions and dice skins (optional; gems gameplay unchanged).',
          'PayPal donation link still in About Us.',
        ],
      },
      {
        title: 'UI & gameplay',
        notes: [
          'Clearer result screen and reward fly animations.',
          'Tooltips improved on touch; inventory and skillbook less likely to block taps.',
          'Larger encounter titles; updated dice art.',
          'Tooltips hide when the result layer is showing.',
          'Privacy and Terms on signup.',
        ],
      },
      {
        title: 'Progression & social',
        notes: [
          'Daily rewards consider progress across achievement chains.',
          'Scribes toasts for achievements; better lines for room joins and help.',
          'Firestarter progress shows in Scribes.',
        ],
      },
      {
        title: 'Content',
        notes: [
          'Many new encounters and art (forests, meadows, mountains, Everwinter, Verdani, Liani, Ashen Revenant, and more).',
        ],
      },
      {
        title: 'Removed',
        notes: [
          'Seal of Norghor subscription removed from beta. Expansions unlock with gems as before.',
        ],
      },
      {
        title: 'Fixes',
        notes: [
          'Solo rooms no longer spam odd toasts.',
          'Party Continue and ally choices sync more reliably.',
          'Various room join, help, and server stability fixes.',
        ],
      },
    ],
  },
  {
    id: 'beta-1',
    version: '0.9.0-beta.1',
    period: '26 May 2026',
    notes: [
      'Public beta — first tagged beta release on https://arcanitebrothers.com.',
      'Encounter rooms foundation — up to 3 players, server-backed party state, call for help.',
    ],
  },
];

const FOOTER_NOTE =
  'You’re playing the public beta. More updates soon — thank you for testing Morkahja.';
/** Opens the babuni.dev living grid on Morkahja's Changelog module. */
const CHANGELOG_URL = 'https://www.babuni.dev/#project=morkahja-rpg&bloom=big&read=changes';

const changelogLinkStyle: CSSProperties = {
  display: 'block',
  marginTop: 6,
  color: '#ffcc66',
  fontSize: '0.82rem',
};

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 8,
  display: 'grid',
  placeItems: 'center',
  padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
  background: 'rgba(8, 4, 2, 0.72)',
  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
  pointerEvents: 'auto',
};

const panelStyle: CSSProperties = {
  // Padding included, so the panel fits inside a phone screen.
  width: 'min(100%, 456px)',
  maxHeight: 'min(86vh, 640px)',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gap: 12,
  padding: '20px 18px 16px',
  border: '1px solid rgba(255, 204, 102, 0.62)',
  borderRadius: 14,
  background: 'rgba(12, 7, 5, 0.92)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.55)',
  color: '#f7efe0',
  fontFamily: 'Georgia, serif',
  ...protectedOverlayTextStyle,
  boxSizing: 'border-box',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
};

const titleGroupStyle: CSSProperties = {
  display: 'grid',
  gap: 2,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.45rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.06em',
};

const subtitleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(247, 239, 224, 0.62)',
  fontSize: '0.82rem',
  letterSpacing: '0.04em',
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '4px 2px 2px',
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  ...protectedOverlayTextStyle,
};

const releaseListStyle: CSSProperties = {
  display: 'grid',
  gap: 20,
};

const releaseBlockStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  paddingBottom: 16,
  ...frameDividerStyle({ side: 'bottom', bleed: 2 }),
};

const releaseHeadingStyle: CSSProperties = {
  margin: 0,
  color: '#ffcc66',
  fontSize: '1.08rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.05em',
};

const groupListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
};

const groupStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
};

const groupTitleStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(255, 204, 102, 0.88)',
  fontSize: '0.92rem',
  fontWeight: 400,
  fontFamily: 'Breathe Fire, Georgia, serif',
  letterSpacing: '0.04em',
};

const noteListStyle: CSSProperties = {
  margin: 0,
  paddingLeft: '1.1rem',
  display: 'grid',
  gap: 6,
};

const noteItemStyle: CSSProperties = {
  color: 'rgba(247, 239, 224, 0.86)',
  fontSize: '0.9rem',
  lineHeight: 1.5,
};

const footerNoteStyle: CSSProperties = {
  margin: 0,
  paddingTop: 10,
  ...frameDividerStyle({ side: 'top', bleed: 9 }),
  color: 'rgba(247, 239, 224, 0.78)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
  textAlign: 'center',
};

function renderNoteList(notes: string[], keyPrefix: string) {
  return (
    <ul style={noteListStyle}>
      {notes.map((note, index) => (
        <li key={`${keyPrefix}-${index}`} style={noteItemStyle}>
          {note}
        </li>
      ))}
    </ul>
  );
}

export function PatchNotesOverlay({
  onClose,
  open,
}: {
  onClose: () => void;
  open: boolean;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }

    // Shown once the pictures inside are loaded; the opening button pulses meanwhile.
    const cancelReveal = revealMenuWhenReady(
      null,
      () => document.querySelector('[data-morkahja-menu="patch-notes"]'),
      () => {
        setVisible(true);
      },
    );

    return () => {
      cancelReveal();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      data-morkahja-menu="patch-notes"
      aria-label="Patch notes"
      onClick={onClose}
      role="presentation"
      {...protectedOverlaySurfaceProps}
      style={{
        ...backdropStyle,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <section
        aria-labelledby="patch-notes-overlay-title"
        onClick={(event) => {
          event.stopPropagation();
        }}
        {...protectedOverlaySurfaceProps}
        style={framedStyle(panelStyle)}
      >
        <LineFrame background={panelStyle.background} />
        <header style={headerStyle}>
          <div style={titleGroupStyle}>
            <h2 id="patch-notes-overlay-title" style={titleStyle}>
              PATCH NOTES
            </h2>
            <p style={subtitleStyle}>Version {APP_VERSION} · newest first</p>
          </div>
          <ClosePanelButton onClose={onClose} pressKey="patch-notes-close" />
        </header>
        <div data-patch-notes-scroll="" style={bodyStyle}>
          <style>
            {'[data-patch-notes-scroll]::-webkit-scrollbar { display: none; }'}
          </style>
          <div style={releaseListStyle}>
            {PATCH_RELEASES.map((release, releaseIndex) => (
              <article
                key={release.id}
                style={{
                  ...releaseBlockStyle,
                  ...(releaseIndex === PATCH_RELEASES.length - 1
                    ? { borderWidth: 0, borderImageSource: 'none', paddingBottom: 0 }
                    : {}),
                }}
              >
                <h3 style={releaseHeadingStyle}>
                  {release.version} · {release.period}
                </h3>
                {release.notes ? renderNoteList(release.notes, release.id) : null}
                {release.groups ? (
                  <div style={groupListStyle}>
                    {release.groups.map((group) => (
                      <section key={`${release.id}-${group.title}`} style={groupStyle}>
                        <h4 style={groupTitleStyle}>{group.title}</h4>
                        {renderNoteList(group.notes, `${release.id}-${group.title}`)}
                      </section>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
        <footer>
          <p style={footerNoteStyle}>
            {FOOTER_NOTE}
            <a href={CHANGELOG_URL} rel="noopener noreferrer" style={changelogLinkStyle} target="_blank">
              Full changelog
            </a>
          </p>
        </footer>
      </section>
    </div>
  );
}

export default PatchNotesOverlay;
