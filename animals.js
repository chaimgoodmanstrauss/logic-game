// Animal pool. Every animal has a unique (color, habitats, legs) profile, so any hand is separable.
// Pictures: drop a generated image at images/<id>.png (see image_prompts.md); the emoji is the fallback.
const ANIMALS = [
  // black and white
  { id: 'panda',       name: 'Giant Panda',     emoji: '🐼', color: 'bw',       habitats: ['land'],               legs: 4 },
  { id: 'penguin',     name: 'Penguin',         emoji: '🐧', color: 'bw',       habitats: ['sea', 'land'],        legs: 2 },
  { id: 'orca',        name: 'Orca',            emoji: '🐋', color: 'bw',       habitats: ['sea'],                legs: 0 },
  { id: 'magpie',      name: 'Magpie',          emoji: '🐦', color: 'bw',       habitats: ['land', 'air'],        legs: 2 },
  { id: 'albatross',   name: 'Albatross',       emoji: '🕊️', color: 'bw',       habitats: ['sea', 'air'],         legs: 2 },
  { id: 'seagull',     name: 'Herring Gull',    emoji: '🪽', color: 'bw',       habitats: ['sea', 'land', 'air'], legs: 2 },
  // brown
  { id: 'bear',        name: 'Brown Bear',      emoji: '🐻', color: 'brown',    habitats: ['land'],               legs: 4 },
  { id: 'otter',       name: 'Sea Otter',       emoji: '🦦', color: 'brown',    habitats: ['sea'],                legs: 4 },
  { id: 'eagle',       name: 'Golden Eagle',    emoji: '🦅', color: 'brown',    habitats: ['land', 'air'],        legs: 2 },
  { id: 'snake',       name: 'Brown Snake',     emoji: '🐍', color: 'brown',    habitats: ['land'],               legs: 0 },
  { id: 'octopus',     name: 'Octopus',         emoji: '🐙', color: 'brown',    habitats: ['sea'],                legs: 'many' },
  { id: 'tarantula',   name: 'Tarantula',       emoji: '🕷️', color: 'brown',    habitats: ['land'],               legs: 'many' },
  { id: 'ostrich',     name: 'Ostrich',         emoji: '🦃', color: 'brown',    habitats: ['land'],               legs: 2 },
  { id: 'turtle',      name: 'Sea Turtle',      emoji: '🐢', color: 'brown',    habitats: ['sea', 'land'],        legs: 4 },
  // colorful
  { id: 'parrot',      name: 'Scarlet Macaw',   emoji: '🦜', color: 'colorful', habitats: ['land', 'air'],        legs: 2 },
  { id: 'frog',        name: 'Dart Frog',       emoji: '🐸', color: 'colorful', habitats: ['land'],               legs: 4 },
  { id: 'clownfish',   name: 'Clownfish',       emoji: '🐠', color: 'colorful', habitats: ['sea'],                legs: 0 },
  { id: 'crab',        name: 'Lightfoot Crab',  emoji: '🦀', color: 'colorful', habitats: ['sea', 'land'],        legs: 'many' },
  { id: 'coralsnake',  name: 'Coral Snake',     emoji: '🪱', color: 'colorful', habitats: ['land'],               legs: 0 },
  { id: 'flyingfish',  name: 'Flying Fish',     emoji: '🐟', color: 'colorful', habitats: ['sea', 'air'],         legs: 0 },
  { id: 'butterfly',   name: 'Monarch Butterfly', emoji: '🦋', color: 'colorful', habitats: ['land', 'air'],      legs: 'many' },
  { id: 'mallard',     name: 'Mallard Drake',   emoji: '🦆', color: 'colorful', habitats: ['sea', 'land', 'air'], legs: 2 },
];

// Atoms: each is a predicate on an animal.
const ATOMS = [
  { key: 'bw',      label: 'black and white', group: 'color',   test: a => a.color === 'bw' },
  { key: 'brown',   label: 'brown',           group: 'color',   test: a => a.color === 'brown' },
  { key: 'colorful',label: 'colorful',        group: 'color',   test: a => a.color === 'colorful' },
  { key: 'sea',     label: 'sea-dwelling',    group: 'habitat', test: a => a.habitats.includes('sea') },
  { key: 'land',    label: 'land-dwelling',   group: 'habitat', test: a => a.habitats.includes('land') },
  { key: 'air',     label: 'air-dwelling',    group: 'habitat', test: a => a.habitats.includes('air') },
  { key: 'legless', label: 'legless',         group: 'legs',    test: a => a.legs === 0 },
  { key: 'two',     label: 'two-legged',      group: 'legs',    test: a => a.legs === 2 },
  { key: 'four',    label: 'four-legged',     group: 'legs',    test: a => a.legs === 4 },
  { key: 'many',    label: 'many-legged',     group: 'legs',    test: a => a.legs === 'many' },
];

// Templates: arity, and how many blanks they have.
const TEMPLATES = [
  { op: 'and', arity: 2, label: 'AND' },
  { op: 'or',  arity: 2, label: 'OR' },
  { op: 'if',  arity: 2, label: 'IF … THEN' },
  { op: 'not', arity: 1, label: 'NOT' },
];

if (typeof module !== 'undefined') module.exports = { ANIMALS, ATOMS, TEMPLATES };
