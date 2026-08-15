export type SettingsSection = {
  slug: string;
  title: string;
  summary: string;
  content: string[];
  tips?: string[];
};

export type PatternVariant = {
  name: string;
  description: string;
  grid: Array<[number, number]>;
};

export type KnowledgePattern = {
  slug: string;
  name: string;
  tagline: string;
  grid: Array<[number, number]>;
  about: string;
  variants: PatternVariant[];
};

export const settingsSections: SettingsSection[] = [
  {
    slug: "approach-rate",
    title: "Approach Rate",
    summary: "Controls how far ahead notes are visualized and how much time you get to read them.",
    content: [
      "Approach Rate (AR) sets how far in advance notes appear and travel toward the hit plane. It is the single most important setting for readability.",
      "In Rhythia the editor exposes it as an Approach rate preview that controls how far ahead notes are visualized; in-game it ranges roughly 0–200 with a default near 40. Lower values make notes appear closer to the hit moment (less reaction time, more flow reading). Higher values give notes more travel distance, so you can pre-plan movement further in advance.",
      "Players tuning AR usually pair it with their sensitivity: a higher AR rewards a faster, more confident aim since notes spend longer on screen.",
    ],
    tips: [
      "If you keep missing early, try lowering AR slightly.",
      "If notes feel cramped and you are always reacting late, raise it.",
    ],
  },
  {
    slug: "approach-distance",
    title: "Approach Distance / Spawn Distance",
    summary: "How far from the camera notes spawn before they begin approaching the hit plane.",
    content: [
      "Spawn Distance (SD) is where notes first appear in 3D space before travelling to the hit plane. Combined with Approach Rate, it defines the total visible travel a note makes.",
      "The editor's 3D mode previews 3D blocks and their related spawn distance, so you can feel exactly how much runway each note gets. In-game this is often shown as a Spawn Distance slider (default near 40, range up to 200).",
      "A larger spawn distance means notes are visible earlier but also travel further, which can feel floaty; a smaller one makes notes feel 'on top of you' quickly. Tune it with AR so the runway feels comfortable.",
    ],
    tips: [
      "Keep AR and SD balanced — raising both can make notes feel distant and slow.",
    ],
  },
  {
    slug: "sensitivity-dpi",
    title: "Sensitivity & DPI",
    summary: "How mouse movement is converted into cursor movement — and how the two relate.",
    content: [
      "DPI is a hardware property of your mouse (dots per inch the sensor reports). Sensitivity is the in-game multiplier applied on top of that raw movement. They correlate multiplicatively: effective cursor speed = DPI × sensitivity.",
      "Doubling DPI and halving sensitivity keeps the same effective speed, so players treat them as one combined number. What matters is the effective dots-per-degree you aim with.",
      "Higher effective speed covers the grid with less hand travel (great for jumps and streams), but reduces precision on small spacing. Lower speed is steadier but demands more physical movement and can feel slow on long jumps.",
      "Rhythia is a mouse-aim rhythm game, so sensitivity directly controls how far your cursor travels between notes. Find one speed you can hit wide jumps without overshooting and small notes without jitter.",
    ],
    tips: [
      "Start near default, then only change effective speed ±10% and play several maps before judging.",
      "Consistency beats raw speed — a speed you can control on a 30-minute session is the right one.",
    ],
  },
  {
    slug: "parallax",
    title: "Parallax & Depth",
    summary: "The 3D perspective effect that makes notes shift position as they approach.",
    content: [
      "Because Rhythia renders in 3D, notes have parallax: they move across the screen and change apparent position as they travel toward you. The camera height and depth (FOV and camera Z) control how strong this effect is.",
      "Stronger parallax looks flashy but can make the note you are about to hit land somewhere different from where you first aimed. Weaker/slower camera movement keeps aim mostly on the hit plane.",
      "Parallax matters most when using spin mode or camera motion, because the view rotates under the notes. If you find yourself aiming at where a note 'was' rather than where it lands, reduce camera depth or disable spin.",
    ],
    tips: [
      "When learning, keep the camera stable so aim maps cleanly to the grid.",
      "Use parallax deliberately to read depth on streams rather than as decoration.",
    ],
  },
  {
    slug: "spin-mode",
    title: "Spin Mode",
    summary: "Rotates the camera/playfield during gameplay for a rotating view.",
    content: [
      "Spin mode rotates the view of the playfield while notes approach, so the whole grid turns under you. It is a visual/gameplay modifier that changes how you read direction and aim.",
      "Because rotation changes every note's position relative to your cursor, spin mode demands stronger reading and continuous tracking. Some players find it more immersive; others disable it to keep a fixed reference frame.",
      "It pairs with parallax: with spin enabled the camera motion constantly shifts where a note will land, so your sensitivity and AR need to feel comfortable with moving reference points.",
    ],
    tips: [
      "Practice spin mode on low AR maps first so you can read where the grid will be at hit time.",
    ],
  },
  {
    slug: "note-meshes",
    title: "Note Meshes",
    summary: "Custom 3D models for notes that change their visual size, shape, and clarity.",
    content: [
      "Note meshes replace the default note appearance with imported 3D models (.mesh or .obj files) or generated shapes. In Settings → Notes you can import an image or mesh, or select Build.",
      "A mesh's size and silhouette change how readable notes are and how much of the playfield they cover. A bulky mesh can visually 'hide' a following note or make spacing feel denser than it is.",
      "Small, clean meshes with high contrast against the background are generally the most playable. Flashy meshes are fun but can make it harder to judge exact hit timing.",
      "If the game crashes after importing a mesh, delete the folder from `%appdata%\\CapoRhythia\\skins\\notes` and Rhythia will fall back to the default note appearance.",
    ],
    tips: [
      "Prefer meshes with a clear center or edge so your aim has an obvious target.",
      "Keep the same mesh across maps to build muscle memory for its visual size.",
    ],
  },
  {
    slug: "half-ghost",
    title: "Half Ghost",
    summary: "Fades out part of the notes so upcoming notes stay readable.",
    content: [
      "Half Ghost affects how notes are rendered as they approach — commonly fading or ghosting notes so that the playfield stays clean and the note you must hit next stands out.",
      "It helps reduce visual clutter on dense patterns: instead of a wall of notes, only the notes near the hit plane are fully opaque while earlier ones appear faded.",
      "Players who rely on reading far ahead sometimes disable it to keep every note clearly visible; players who aim by the 'next note' often keep it on for cleaner flow.",
    ],
    tips: [
      "If dense streams look muddy, try enabling Half Ghost.",
      "If you feel notes 'disappear' too early, disable it.",
    ],
  },
  {
    slug: "note-pushback",
    title: "Note Pushback / Note Offset",
    summary: "Shifts note timing relative to the audio to correct sync.",
    content: [
      "Note Pushback (or Note Offset) moves the hit timing of notes forward or backward relative to the audio. A positive pushback makes notes arrive later; a negative one makes them arrive earlier.",
      "This is the in-game equivalent of the online offset: 'Shift note offset for the map' in milliseconds. It corrects when hits consistently feel early or late even though the map is timed correctly.",
      "Tune it by playing a map and checking whether your misses are consistently early (push notes back) or consistently late (push them forward). Small 2–5 ms adjustments can change a map from frustrating to smooth.",
    ],
    tips: [
      "Adjust in small increments and test on a map you know well.",
      "Pushback is about sync, not difficulty — set it once and leave it.",
    ],
  },
  {
    slug: "other-impactful",
    title: "Other Settings That Make a Difference",
    summary: "The remaining settings worth tuning for performance and readability.",
    content: [
      "Background dimming reduces visual noise so notes stand out; dim more when the map background is bright or busy.",
      "Colorsets define note colors. Pick colors that contrast with the background for maximum readability.",
      "Hit sound volume and hitsound selection give audio feedback for timing; too quiet makes sync harder to feel, too loud can mask the music.",
      "Cursor skin changes the cursor look — small, high-contrast cursors track better than large ones.",
      "Borders help frame the playfield; a subtle border keeps your eye on the grid.",
      "Keybinds are fully rebindable in Settings → Keybinds, including quick restart (`) and give-up (R) which matter during long sessions.",
      "Volume is adjustable globally by holding Alt in the lower-right corner.",
    ],
    tips: [
      "Dim the background and use a bright colorset as a baseline for consistent reading.",
      "Rebind quick restart somewhere comfortable — it is the most-used key while grinding a map.",
    ],
  },
];

export const patterns: KnowledgePattern[] = [
  {
    slug: "stream",
    name: "Stream",
    tagline: "A continuous sequence of notes at a stable divisor.",
    grid: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
    ],
    about:
      "Streams are the bread and butter of rhythm games: notes flow at a constant rhythm with no large gaps. They test speed and consistency rather than tricky reading. Keep their route legible and give the player a clear entrance and exit so they know when the stream starts and ends.",
    variants: [
      {
        name: "Straight stream",
        description: "Notes travel along a single axis or row, emphasizing pure speed.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
          [0, 1],
          [1, 1],
          [2, 1],
          [1, 2],
          [0, 2],
        ],
      },
      {
        name: "Serpentine stream",
        description: "The stream snakes across the grid (as shown), adding gentle direction changes.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 1],
          [0, 1],
          [0, 2],
          [1, 2],
          [2, 2],
        ],
      },
      {
        name: "Stream with kicks",
        description: "A stream where every 4th note is a jump or double note to accent the beat.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [2, 1],
          [1, 1],
          [0, 1],
          [0, 2],
          [1, 2],
          [2, 2],
        ],
      },
      {
        name: "Stream into jump",
        description: "A stream that closes on a wide jump, converting speed into an aim spike.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 1],
          [0, 1],
          [0, 2],
          [1, 2],
          [0, 0],
          [2, 2],
        ],
      },
    ],
  },
  {
    slug: "jump",
    name: "Jump",
    tagline: "Two notes separated by a large distance.",
    grid: [
      [0, 0],
      [2, 2],
    ],
    about:
      "A jump places two notes far apart, forcing a fast cursor flick between them. Jumps emphasize strong sounds and test aim. Consecutive jumps become tiring quickly, so use them to punctuate rather than sustain.",
    variants: [
      {
        name: "Cross-grid jump",
        description: "A full-corner jump across the whole grid (shown).",
        grid: [
          [0, 0],
          [2, 2],
        ],
      },
      {
        name: "Adjacent jump",
        description: "A smaller jump between neighboring cells, lighter on aim.",
        grid: [
          [0, 0],
          [0, 1],
        ],
      },
      {
        name: "Jumpstream",
        description: "Jumps repeated in a steady rhythm to test stamina under constant aim.",
        grid: [
          [0, 0],
          [2, 2],
          [0, 1],
          [2, 1],
          [0, 2],
          [2, 2],
        ],
      },
      {
        name: "Nested jump",
        description: "A jump followed immediately by another jump in the opposite direction.",
        grid: [
          [0, 0],
          [2, 2],
          [2, 0],
          [0, 2],
          [0, 0],
          [2, 2],
        ],
      },
    ],
  },
  {
    slug: "slide",
    name: "Slide",
    tagline: "A short sequence moving in one direction.",
    grid: [
      [0, 0],
      [0, 1],
      [0, 2],
    ],
    about:
      "Slides are short directional runs — three or four notes sweeping along one axis. They work well for sustained or rising sounds. Build regular slides with the Brush tool, or curved/off-grid versions with the Path tool for a flowing feel.",
    variants: [
      {
        name: "Horizontal slide",
        description: "Notes sweep left-to-right or right-to-left along a row.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      {
        name: "Vertical slide",
        description: "Notes travel up or down a column (shown).",
        grid: [
          [0, 0],
          [0, 1],
          [0, 2],
        ],
      },
      {
        name: "Diagonal slide",
        description: "A corner-to-corner sweep adding mild aim movement.",
        grid: [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
      },
      {
        name: "Curved slide",
        description: "Built with Path for an arc that bends between grid lines.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [2, 2],
        ],
      },
    ],
  },
  {
    slug: "stack",
    name: "Stack",
    tagline: "Multiple notes at the same or nearly the same position.",
    grid: [
      [1, 1],
      [1, 1],
      [1, 1],
    ],
    about:
      "Stacks place repeated notes on one spot, representing repeated hits without adding movement. They are great for drum hits or repeated chants. Beware: dense stacks may hide their length — the player cannot tell how many notes are stacked from the visual alone.",
    variants: [
      {
        name: "Double stack",
        description: "Two notes on the same cell — a quick double hit.",
        grid: [
          [1, 1],
          [1, 1],
        ],
      },
      {
        name: "Triple+ stack",
        description: "Three or more notes on one cell, often on a triplet rhythm.",
        grid: [
          [1, 1],
          [1, 1],
          [1, 1],
          [1, 1],
        ],
      },
      {
        name: "Tilted stack",
        description: "Notes land on nearly the same position with a tiny offset to suggest motion.",
        grid: [
          [1, 1],
          [1, 1],
          [0, 1],
          [2, 1],
        ],
      },
      {
        name: "Stack into jump",
        description: "A stack that resolves by flinging out to a distant note.",
        grid: [
          [1, 1],
          [1, 1],
          [0, 0],
          [2, 2],
        ],
      },
    ],
  },
  {
    slug: "spiral",
    name: "Spiral",
    tagline: "A sequence rotating around a center.",
    grid: [
      [1, 1],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 2],
      [0, 2],
      [0, 1],
      [0, 0],
    ],
    about:
      "Spirals orbit a central point, testing continuous control as the cursor traces a rotating shape. Use the transform panel to rotate a selected motif, then check that the result remains readable during gameplay.",
    variants: [
      {
        name: "Clockwise spiral",
        description: "Rotates around the center in a clockwise direction (shown).",
        grid: [
          [1, 1],
          [2, 1],
          [2, 2],
          [1, 2],
          [0, 2],
          [0, 1],
          [0, 0],
          [1, 0],
          [2, 0],
        ],
      },
      {
        name: "Counter-clockwise spiral",
        description: "Mirrored rotation for variety and directional coverage.",
        grid: [
          [1, 1],
          [0, 1],
          [0, 2],
          [1, 2],
          [2, 2],
          [2, 1],
          [2, 0],
          [1, 0],
          [0, 0],
        ],
      },
      {
        name: "Tight spiral",
        description: "A small radius around the center for control-focused play.",
        grid: [
          [1, 1],
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
          [1, 0],
        ],
      },
      {
        name: "Spiral entrance/exit",
        description: "Spirals that begin or end on an accent note to bookend the motion.",
        grid: [
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
          [1, 0],
          [2, 1],
          [1, 2],
          [0, 1],
        ],
      },
    ],
  },
  {
    slug: "anchor",
    name: "Anchor",
    tagline: "A repeating position alternates with moving notes.",
    grid: [
      [1, 1],
      [0, 0],
      [1, 1],
      [2, 2],
      [1, 1],
      [0, 2],
    ],
    about:
      "Anchors hold one hand or one cursor reference point while the other notes move around it. They create a stable reference for reading, but they increase wrist/control demands because the anchored position keeps being re-hit from different directions.",
    variants: [
      {
        name: "Anchor + jump",
        description: "The anchor is hit, then a jump moves out and back to the anchor.",
        grid: [
          [1, 1],
          [0, 0],
          [1, 1],
          [2, 2],
          [1, 1],
        ],
      },
      {
        name: "Anchor + stream",
        description: "A stream runs while a note returns to the anchor on each repeat.",
        grid: [
          [1, 1],
          [0, 1],
          [1, 1],
          [0, 1],
          [1, 1],
          [0, 1],
        ],
      },
      {
        name: "Double anchor",
        description: "Two anchor cells alternate while moving notes pass between them.",
        grid: [
          [1, 1],
          [1, 0],
          [1, 1],
          [1, 0],
          [0, 1],
          [1, 1],
          [1, 0],
          [1, 1],
        ],
      },
      {
        name: "Swinging anchor",
        description: "The anchor gradually drifts to a new position across the section.",
        grid: [
          [1, 1],
          [0, 0],
          [0, 1],
          [1, 1],
          [2, 0],
          [1, 1],
          [0, 2],
          [1, 1],
        ],
      },
    ],
  },
  {
    slug: "off-grid-path",
    name: "Off-grid Path",
    tagline: "A sequence between standard grid points.",
    grid: [
      [0, 0],
      [1, 1],
      [2, 0],
      [1, 1],
      [0, 2],
      [1, 1],
      [2, 2],
    ],
    about:
      "Off-grid paths place notes between the standard 3×3 intersections, using Grid divisor, free placement, or the Path tool. Its purpose and direction should remain obvious during gameplay — an off-grid note that reads as on-grid is a reading trap.",
    variants: [
      {
        name: "Half-grid path",
        description: "Notes snap to half divisions, readable as a subtle offset.",
        grid: [
          [0, 0],
          [2, 0],
          [0, 2],
          [2, 2],
        ],
      },
      {
        name: "Free-placed path",
        description: "Hand-placed off-grid notes for deliberate final adjustments.",
        grid: [
          [0, 0],
          [2, 1],
          [0, 2],
          [2, 0],
          [1, 2],
        ],
      },
      {
        name: "Curved off-grid path",
        description: "A Path-built arc that bends through off-grid space.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 2],
          [0, 2],
          [0, 1],
          [1, 1],
        ],
      },
      {
        name: "Hybrid grid/off-grid",
        description: "Mostly on-grid with a single off-grid motif used for a distinct phrase.",
        grid: [
          [0, 0],
          [1, 1],
          [2, 2],
          [0, 2],
          [1, 1],
          [2, 0],
        ],
      },
    ],
  },
  {
    slug: "burst",
    name: "Burst",
    tagline: "A short, fast cluster of notes — a mini-stream.",
    grid: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [1, 1],
    ],
    about:
      "A burst is a handful of notes in quick succession, shorter than a stream but denser in feel. Bursts punctuate a section without the stamina drain of a full stream. They test the same speed skill in a compact package.",
    variants: [
      {
        name: "Straight burst",
        description: "A 4–6 note run along one line.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
          [2, 1],
        ],
      },
      {
        name: "Jump burst",
        description: "A burst that includes one wide jump to add an aim accent.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [0, 2],
          [2, 2],
        ],
      },
      {
        name: "Directional burst",
        description: "A burst with a deliberate direction change (shown).",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [2, 1],
          [1, 1],
        ],
      },
      {
        name: "End-anchored burst",
        description: "A burst that terminates on a stack or anchor note.",
        grid: [
          [0, 0],
          [1, 0],
          [2, 0],
          [1, 1],
          [1, 1],
        ],
      },
    ],
  },
];

export function getSettingsSection(slug: string): SettingsSection | undefined {
  return settingsSections.find((section) => section.slug === slug);
}

export function getPattern(slug: string): KnowledgePattern | undefined {
  return patterns.find((pattern) => pattern.slug === slug);
}

export function getPublishedArticleCount(): number {
  return settingsSections.length + patterns.length;
}

export function searchKnowledge(query: string, take = 10) {
  const q = query.toLowerCase();
  const results: Array<{
    id: string;
    title: string;
    slug: string;
    description: string;
    category: { slug: string; name: string };
  }> = [];

  for (const section of settingsSections) {
    if (
      section.title.toLowerCase().includes(q) ||
      section.summary.toLowerCase().includes(q) ||
      section.content.some((paragraph) => paragraph.toLowerCase().includes(q))
    ) {
      results.push({
        id: `settings/${section.slug}`,
        title: section.title,
        slug: section.slug,
        description: section.summary,
        category: { slug: "settings", name: "Settings Guide" },
      });
    }
  }

  for (const pattern of patterns) {
    if (
      pattern.name.toLowerCase().includes(q) ||
      pattern.about.toLowerCase().includes(q) ||
      pattern.tagline.toLowerCase().includes(q)
    ) {
      results.push({
        id: `patterns/${pattern.slug}`,
        title: pattern.name,
        slug: pattern.slug,
        description: pattern.tagline,
        category: { slug: "patterns", name: "Patterns Wiki" },
      });
    }
  }

  return results.slice(0, take);
}
