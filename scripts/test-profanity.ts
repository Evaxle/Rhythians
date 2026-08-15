import { censorProfanity } from "../lib/profanity";

let passed = 0;
let failed = 0;

function check(label: string, input: string, expected: string, expectedMatched: boolean) {
  const { filtered, matched } = censorProfanity(input);
  const ok = filtered === expected && matched === expectedMatched;
  if (ok) {
    passed++;
  } else {
    failed++;
    console.log(`  FAIL  ${label}`);
    console.log(`        input:    ${JSON.stringify(input)}`);
    console.log(`        expected: ${JSON.stringify(expected)} (matched=${expectedMatched})`);
    console.log(`        got:      ${JSON.stringify(filtered)} (matched=${matched})`);
  }
}

function group(title: string) {
  console.log(`\n== ${title} ==`);
}

// Direct words
group("direct words");
check("fuck", "fuck you", "**** you", true);
check("shit", "this is shit", "this is ****", true);
check("bitch", "You're a bitch", "You're a *****", true);
check("uppercase", "FUCKING hell", "******* hell", true);
check("slur", "NIGGER", "******", true);
check("faggot", "faggot", "******", true);
check("asshole", "asshole", "*******", true);
check("motherfucker", "motherfucker", "************", true);
check("wtf", "wtf are you doing", "*** are you doing", true);
check("omfg", "omfg", "****", true);
check("stfu", "stfu", "****", true);
check("twat", "twat", "****", true);

// Clean text
group("clean text");
check("clean 1", "hello world", "hello world", false);
check("clean 2", "The quick brown fox jumps over the lazy dog", "The quick brown fox jumps over the lazy dog", false);
check("punctuation", "Hello, world!", "Hello, world!", false);
check("mild not filtered", "what the hell is going on", "what the hell is going on", false);
check("sentence 1", "Hey everyone, how's it going today? Just checking in to say hi!", "Hey everyone, how's it going today? Just checking in to say hi!", false);
check("sentence 2", "That clip was amazing, great work on that play!", "That clip was amazing, great work on that play!", false);
check("sentence 3", "GG well played everyone, that was fun", "GG well played everyone, that was fun", false);
check("sentence 4", "Has anyone tried the new map yet? It's pretty cool.", "Has anyone tried the new map yet? It's pretty cool.", false);

// Leetspeak
group("leetspeak");
check("n1gger", "n1gger", "******", true);
check("sh!t", "sh!t happens", "**** happens", true);
check("b1tch", "b1tch", "*****", true);
check("f4g", "f4g", "***", true);
check("5h1t", "5h1t", "****", true);
check("tr4nnies", "tr4nnies", "********", true);
check("w3tb4ck", "w3tb4ck", "*******", true);
check("c0cksucker", "c0cksucker", "**********", true);
check("r4p1st", "r4p1st", "******", true);
check("wh0re", "wh0re", "*****", true);
check("5lut", "5lut", "****", true);
check("d1ckhead", "d1ckhead", "********", true);
check("@ss", "@ss", "***", true);
check("$hit", "$hit", "****", true);
check("a55", "a55", "***", true);
check("4$$", "4$$", "***", true);
check("not bad leet", "h4ck3r", "h4ck3r", false);

// Homoglyphs (Cyrillic, Greek, fullwidth)
group("homoglyphs");
check("cyrillic ass", "а55", "***", true);
check("greek alpha sigma", "ασσ", "***", true);
check("greek upsilon", "fυck", "****", true);
check("greek mu", "fμck", "****", true);
check("fullwidth", "ｆｕｃｋ", "****", true);
check("fullwidth upper", "ＦＵＣＫ", "****", true);
check("fullwidth mixed", "ｆＵｃＫ", "****", true);
check("cyrillic i in shit", "shіt", "****", true);
check("cyrillic i in nigger", "nіgger", "******", true);
check("cyrillic e in wetback", "wеtback", "*******", true);
check("cyrillic f", "фuck", "****", true);
check("greek phi", "φuck", "****", true);

// Accents, combining marks, zero-width/format chars
group("accents & combining & zero-width");
check("precomposed accent", "fúck", "****", true);
check("umlaut bypass -> fck", "fück", "****", true);
check("grave accent", "fùck", "****", true);
check("combining overlay", "s\u0336h\u0336i\u0336t\u0336", "********", true);
check("combining acute", "fu\u0301ck", "*****", true);
check("zero width space", "f\u200bu\u200bc\u200bk", "*******", true);
check("word joiner", "f\u2060u\u2060c\u2060k", "*******", true);
check("soft hyphen", "f\u00adu\u00adc\u00adk", "*******", true);
check("zero width joiner", "s\u200dh\u200di\u200dt", "*******", true);

// Separators inside words
group("separator obfuscation");
check("dotted", "f.u.c.k", "*******", true);
check("underscored", "f_u_c_k", "*******", true);
check("dashed", "b-i-t-c-h", "*********", true);
check("asterisk", "f*ck", "****", true);
check("backtick", "f`uck", "*****", true);
check("tilde", "f~uck", "*****", true);
check("apostrophe", "f'uck", "*****", true);
check("comma", "f,uck", "*****", true);
check("colon", "f:uck", "*****", true);
check("pipe", "f|uck", "*****", true);
check("slash", "f/uck", "*****", true);
check("plus", "f+uck", "*****", true);
check("equals", "f=uck", "*****", true);
check("semicolon", "f;uck", "*****", true);
check("caret", "f^uck", "*****", true);
check("ampersand", "f&uck", "*****", true);
check("trailing bang", "fuck!", "*****", true);
check("leading bang", "!fuck", "*****", true);
check("pipe every letter", "f|u|c|k", "*******", true);
check("slash split", "sh/it", "*****", true);
check("pipe in cunt", "cu|nt", "*****", true);
check("fully dotted", "f.u.c.k.e.r", "***********", true);
check("digit insert 0", "f0u0c0k", "*******", true);
check("digit insert 1", "f1u1c1k", "*******", true);
check("digit insert 5", "f5u5c5k", "*******", true);
check("bang insert", "f!u!c!k", "*******", true);

// Segmented / spaced-out words
group("segmented & spaced-out words");
check("spaced single letters", "f u c k", "* * * *", true);
check("two letter split", "fu ck", "** **", true);
check("three letter split", "fuc k", "*** k", true);
check("mixed split", "f u ck", "* * **", true);
check("after word", "the fu ck", "the ** **", true);
check("after article", "a fu ck", "a ** **", true);
check("after yes", "yes fu ck you", "yes ** ** you", true);
check("spaced fucker", "f u c k e r", "* * * * * *", true);
check("spaced fucks", "f u c k s", "* * * * *", true);
check("spaced shit", "s h i t", "* * * *", true);
check("spaced bitch", "b i t c h", "* * * * *", true);
check("spaced cunt", "c u n t", "* * * *", true);
check("spaced nigger", "n i g g e r", "* * * * * *", true);
check("spaced ass", "a s s", "* * *", true);
check("spaced twat", "t w a t", "* * * *", true);
check("spaced slut", "s l u t", "* * * *", true);
check("u s hit", "u s hit", "u * ***", true);
check("partial fu c", "fu c", "** *", true);
check("partial f u c", "f u c", "* * *", true);
check("spaced clean dock", "d o c k", "d o c k", false);
check("spaced clean rock", "r o c k", "r o c k", false);
check("spaced clean sock", "s o c k", "s o c k", false);
check("spaced clean class", "c l a s s", "c l a s s", false);
check("spaced clean pass", "p a s s", "p a s s", false);
check("spaced clean bass", "b a s s", "b a s s", false);
check("spaced clean yass", "y a s s", "y a s s", false);
check("spaced clean mass", "m a s s", "m a s s", false);
check("spaced clean good", "g o o d", "g o o d", false);
check("spaced clean hello", "h e l l o", "h e l l o", false);
check("spaced clean world", "w o r l d", "w o r l d", false);
check("spaced clean ur cool", "u r cool", "u r cool", false);
check("spaced clean hell", "go to h e l l", "go to h e l l", false);

// Stretched words
group("stretched words");
check("stretched 1", "fuuuck", "******", true);
check("stretched 2", "shiiiiit", "********", true);
check("stretched 3", "fuucck", "******", true);
check("stretched 4", "ffffffuck", "*********", true);
check("stretched 5", "biiiiitch", "*********", true);

// Inflections and compounds
group("inflections & compounds");
check("motherfuckers", "motherfuckers", "*************", true);
check("retarded", "retarded", "********", true);
check("bitches", "bitches", "*******", true);
check("assholes", "assholes", "********", true);
check("shitstorm", "shitstorm", "*********", true);
check("shitposting", "shitposting", "***********", true);
check("fucktard", "fucktard", "********", true);
check("fuckface", "fuckface", "********", true);
check("fuckboy", "fuckboy", "*******", true);
check("fucking", "fucking", "*******", true);
check("dickhead", "dickhead", "********", true);
check("fucked", "fucked", "******", true);
check("fucker", "fucker", "******", true);
check("whored", "whored", "******", true);

// Abbreviations and misspellings
group("abbreviations & misspellings");
check("fck", "fck", "***", true);
check("fuq", "fuq", "***", true);
check("bich", "bich", "****", true);
check("kunt", "kunt", "****", true);
check("pussi", "pussi", "*****", true);
check("mofo", "mofo", "****", true);
check("mothafucka", "mothafucka", "**********", true);
check("fuk", "fuk", "***", true);
check("phuck", "phuck", "*****", true);
check("fcuk", "fcuk", "****", true);
check("fuc", "fuc", "***", true);

// Foreign profanity
group("foreign profanity");
check("spanish puta", "puta", "****", true);
check("spanish mierda", "mierda", "******", true);
check("spanish cabron", "cabron", "******", true);
check("spanish joder", "joder", "*****", true);
check("french merde", "merde", "*****", true);
check("french putain", "putain", "******", true);
check("french connard", "connard", "*******", true);
check("french encule", "enculé", "******", true);
check("german scheisse", "scheisse", "********", true);
check("german arschloch", "arschloch", "*********", true);
check("german fick", "fick", "****", true);
check("german ficken", "ficken", "******", true);
check("german fotze", "fotze", "*****", true);

// Mixed bypass attempts
group("mixed bypass attempts");
check("leet + separators", "5h.i.t", "******", true);
check("leet + accent", "fùck", "****", true);
check("case + homoglyph", "wЕtBаck", "*******", true);
check("fullwidth + separator", "ｆ.ｕ.ｃ.ｋ", "*******", true);
check("digit + letter mix", "fuck4", "*****", true);

// False positives (must stay clean)
group("false positives (scunthorpe & innocent words)");
check("fp class", "class", "class", false);
check("fp classic", "classic literature", "classic literature", false);
check("fp grass", "grass", "grass", false);
check("fp grass 2", "Grass is green", "Grass is green", false);
check("fp pass", "pass", "pass", false);
check("fp bass", "bass", "bass", false);
check("fp mass", "mass", "mass", false);
check("fp assist", "assist", "assist", false);
check("fp assistant", "assistant", "assistant", false);
check("fp assassin", "assassin", "assassin", false);
check("fp assembly", "assembly", "assembly", false);
check("fp assertion", "assert", "assert", false);
check("fp assignment", "assignment", "assignment", false);
check("fp association", "association", "association", false);
check("fp bassist", "bassist", "bassist", false);
check("fp passenger", "passenger", "passenger", false);
check("fp passport", "passport", "passport", false);
check("fp compassion", "compassion", "compassion", false);
check("fp passing", "passing", "passing", false);
check("fp massage", "massage", "massage", false);
check("fp shitake", "shitake mushrooms", "shitake mushrooms", false);
check("fp pussycat", "pussycat", "pussycat", false);
check("fp pussyfoot", "pussyfoot", "pussyfoot", false);
check("fp fuchsia", "fuchsia", "fuchsia", false);
check("fp fuchsia 2", "the fuchsia plant", "the fuchsia plant", false);
check("fp cockatoo", "cockatoo", "cockatoo", false);
check("fp cocktail", "cocktail", "cocktail", false);
check("fp peacock", "peacock", "peacock", false);
check("fp dickens", "dickens", "dickens", false);
check("fp cuntry", "cuntry", "cuntry", false);
check("fp cuntinuous", "cuntinuous", "cuntinuous", false);
check("fp scunthorpe", "scunthorpe", "scunthorpe", false);
check("fp circumstances", "circumstances", "circumstances", false);
check("fp cummerbund", "cummerbund", "cummerbund", false);
check("fp cumulative", "cumulative", "cumulative", false);
check("fp niggardly", "niggardly", "niggardly", false);
check("fp shame", "shame", "shame", false);
check("fp shadow", "shadow", "shadow", false);
check("fp shuttle", "shuttle", "shuttle", false);
check("fp analysis", "analysis", "analysis", false);
check("fp ellipsis", "...", "...", false);
check("fp empty", "", "", false);
check("fp spaced class", "c l a s s", "c l a s s", false);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
