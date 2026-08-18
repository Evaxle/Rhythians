const LEET_MAP = (() => {
  const map = new Int32Array(256);
  map[0x30] = 0x6f; // 0 -> o
  map[0x31] = 0x69; // 1 -> i
  map[0x32] = 0x7a; // 2 -> z
  map[0x33] = 0x65; // 3 -> e
  map[0x34] = 0x61; // 4 -> a
  map[0x35] = 0x73; // 5 -> s
  map[0x36] = 0x67; // 6 -> g
  map[0x37] = 0x74; // 7 -> t
  map[0x38] = 0x62; // 8 -> b
  map[0x39] = 0x67; // 9 -> g
  map[0x40] = 0x61; // @ -> a
  map[0x24] = 0x73; // $ -> s
  map[0x21] = 0x69; // ! -> i
  return map;
})();

const HOMOGRAPH_MAP = (() => {
  const map = new Map<number, number>();
  const set = (cp: number, to: number) => {
    map.set(cp, to);
  };
  // Cyrillic lookalikes
  set(0x430, 0x61); // а a
  set(0x435, 0x65); // е e
  set(0x43e, 0x6f); // о o
  set(0x440, 0x70); // р p
  set(0x441, 0x63); // с c
  set(0x445, 0x78); // х x
  set(0x43a, 0x6b); // к k
  set(0x43c, 0x6d); // м m
  set(0x442, 0x74); // т t
  set(0x43d, 0x68); // н h
  set(0x432, 0x62); // в b
  set(0x438, 0x75); // и u
  set(0x443, 0x79); // у y
  set(0x451, 0x65); // ё e
  set(0x456, 0x69); // і i
  set(0x457, 0x69); // ї i
  set(0x431, 0x62); // б b
  set(0x446, 0x75); // ц u
  set(0x448, 0x77); // ш w
  set(0x444, 0x66); // ф f
  // Greek lookalikes
  set(0x3b1, 0x61); // α a
  set(0x3b5, 0x65); // ε e
  set(0x3bf, 0x6f); // ο o
  set(0x3c1, 0x70); // ρ p
  set(0x3c3, 0x73); // σ s
  set(0x3c2, 0x73); // ς s
  set(0x3c7, 0x78); // χ x
  set(0x3ba, 0x6b); // κ k
  set(0x3bc, 0x75); // μ u
  set(0x3bd, 0x76); // ν v
  set(0x3c4, 0x74); // τ t
  set(0x3c5, 0x75); // υ u
  set(0x3b9, 0x69); // ι i
  set(0x3b7, 0x6e); // η n
  set(0x3c6, 0x66); // φ f
  set(0x3d5, 0x66); // ϕ f
  return map;
})();

const BAD_WORDS = new Set([
  "ass", "asses", "asshole", "assholes", "asshat", "asswipe", "assface", "assclown", "arse", "arsehole", "arseholes",
  "bastard", "bastards",
  "bitch", "bitches", "bitching", "bitchy", "biotch", "bich",
  "bollocks",
  "boner",
  "bullshit", "bullshitting", "bullshitter", "bullshitters",
  "cock", "cocks", "cockhead", "cocksucker", "cunt", "cunts", "cuntface", "cuntbag", "kunt",
  "dick", "dicks", "dickhead", "dickheads", "dickweed", "dickwad", "dickface", "dildo", "dildos", "douche", "douchebag", "douchebags",
  "fag", "fags", "faggot", "faggots", "fagot", "fagots",
  "fuck", "fucks", "fucked", "fucker", "fuckers", "fucking", "fuckin", "fuckhead", "fuckwad", "fucktard", "fuckface", "fuckboy", "fuckup", "fck", "fuq", "fuc", "fuk", "phuck", "fcuk",
  "jackass",
  "kike", "kikes",
  "motherfucker", "motherfuckers", "motherfucking", "mofo", "mothafucka", "mothafuckin",
  "nigga", "niggas", "niggaz", "nigger", "niggers",
  "piss", "pissing", "pissed",
  "pussy", "pussies", "pussi",
  "rape", "rapes", "rapist", "rapists",
  "retard", "retards", "retarded",
  "shit", "shits", "shitty", "shitting", "shithead", "shitstorm", "shitpost", "shitposting",
  "slut", "sluts", "slutty",
  "twat",
  "wank", "wanker", "wankers",
  "whore", "whores",
  "wtf", "omfg", "stfu",
  "beaner", "beaners", "chink", "chinks", "coon", "coons", "dyke", "dykes", "gook", "gooks",
  "kraut", "krauts", "spic", "spics", "tranny", "trannies", "wetback", "wetbacks",
  "mongoloid",
  "puta", "puto", "mierda", "cabron", "joder", "gilipollas", "pendejo",
  "merde", "putain", "connard", "connasse", "encule",
  "scheisse", "arschloch", "fick", "ficken", "fotze",
]);

const INFLECTIONS = new Set(["s", "es", "ed", "ing", "er", "ers", "e", "a", "i", "y", "ie", "ies", "d", "en", "n"]);

const BAD_BY_FIRST = new Map<number, string[]>();
for (const word of BAD_WORDS) {
  const first = word.charCodeAt(0);
  const list = BAD_BY_FIRST.get(first);
  if (list) list.push(word);
  else BAD_BY_FIRST.set(first, [word]);
}

function tokenKey(part: string): string {
  const text = part.normalize("NFKD").toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 256) {
      if (code === 0x21 && (i === 0 || i === text.length - 1)) continue;
      const c = LEET_MAP[code] || code;
      if (c >= 97 && c <= 122) out.push(c);
    } else {
      const mapped = HOMOGRAPH_MAP.get(code);
      if (mapped !== undefined) out.push(mapped);
    }
  }
  return String.fromCharCode(...out);
}

function lettersKey(part: string): string {
  const text = part.normalize("NFKD").toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 256) {
      if (code >= 97 && code <= 122) out.push(code);
    } else {
      const mapped = HOMOGRAPH_MAP.get(code);
      if (mapped !== undefined) out.push(mapped);
    }
  }
  return String.fromCharCode(...out);
}

function collapseRepeats(s: string): string {
  let out = "";
  let prev = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c !== prev) {
      out += s[i];
      prev = c;
    }
  }
  return out;
}

function startsWithBadWord(norm: string): boolean {
  const list = BAD_BY_FIRST.get(norm.charCodeAt(0));
  if (!list) return false;
  for (const word of list) {
    if (norm.startsWith(word)) {
      const suffix = norm.slice(word.length);
      if (INFLECTIONS.has(suffix)) return true;
    }
  }
  return false;
}

function matchesBadWord(norm: string): boolean {
  if (norm.length < 3) return false;
  if (BAD_WORDS.has(norm)) return true;
  if (startsWithBadWord(norm)) return true;
  const collapsed = collapseRepeats(norm);
  if (collapsed !== norm) {
    if (BAD_WORDS.has(collapsed)) return true;
    if (startsWithBadWord(collapsed)) return true;
  }
  return false;
}

export function isProfane(text: string): boolean {
  return censorProfanity(text).matched;
}

export function censorProfanity(input: string): { filtered: string; matched: boolean } {
  if (!input) return { filtered: input, matched: false };

  const parts = input.split(/(\s+)/);
  const flags = new Array<boolean>(parts.length).fill(false);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part || part.length === 0 || part.charCodeAt(0) <= 32) continue;
    if (matchesBadWord(tokenKey(part)) || matchesBadWord(lettersKey(part))) flags[i] = true;
  }

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (flags[i] || !part || part.length === 0 || part.charCodeAt(0) <= 32) continue;
    const normLength = tokenKey(part).length;
    if (normLength < 1 || normLength > 3) continue;

    const run: { index: number; norm: string }[] = [];
    let j = i;
    let total = 0;
    while (j < parts.length) {
      const p = parts[j];
      if (!p || p.length === 0 || p.charCodeAt(0) <= 32) {
        j++;
        continue;
      }
      const norm = tokenKey(p);
      if (norm.length < 1 || norm.length > 3) break;
      total += norm.length;
      if (total > 12) break;
      run.push({ index: j, norm });
      j++;
    }

    if (run.length >= 2) {
      let bestStart = -1;
      let bestEnd = -1;
      for (let s = 0; s < run.length; s++) {
        let acc = "";
        for (let k = s; k < run.length; k++) {
          acc += run[k].norm;
          const minLength = s > 0 ? 4 : 3;
          if (acc.length >= minLength && matchesBadWord(acc)) {
            bestStart = s;
            bestEnd = k;
          }
        }
      }
      if (bestStart >= 0) {
        for (let k = bestStart; k <= bestEnd; k++) flags[run[k].index] = true;
      }
    }
    i = j - 1;
  }

  let matched = false;
  const out = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    if (flags[i]) {
      matched = true;
      out[i] = "*".repeat(parts[i].length);
    } else {
      out[i] = parts[i];
    }
  }

  return { filtered: out.join(""), matched };
}
