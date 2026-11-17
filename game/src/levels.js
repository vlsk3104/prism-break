// The six hand-designed prism walls. Each row is 12 characters, one per
// column: '.' empty, '1' normal, '2' armored (2 HP), '3' armored (3 HP),
// 'X' explosive (chain-detonates its neighbours), 'S' steel (unbreakable).
// Layouts are drawn to teach one idea at a time: open rows first, then
// diamonds, steel frames, crossfire pockets, the armored vault, and a
// final heart where every type is mixed together.

export const BRICK_TYPES = {
  '1': { kind: 'normal', hp: 1 },
  '2': { kind: 'armored', hp: 2 },
  '3': { kind: 'armored', hp: 3 },
  X: { kind: 'explosive', hp: 1 },
  S: { kind: 'steel', hp: Infinity },
};

export const LEVELS = [
  {
    name: 'First Light',
    hint: 'Break the wall. Catch what falls.',
    rows: [
      '111111111111',
      '111111111111',
      '11X111111X11',
      '111122221111',
      '.1111111111.',
    ],
  },
  {
    name: 'Diamond Core',
    hint: 'The core is armored. Crack it twice.',
    rows: [
      '.....11.....',
      '....1221....',
      '...12XX21...',
      '..122222221.',
      '...12XX21...',
      '....1221....',
      '.....11.....',
    ],
  },
  {
    name: 'Steel Garden',
    hint: 'Steel never breaks. Go around it.',
    rows: [
      'S1111111111S',
      '1S22222222S1',
      '11X2SSSS2X11',
      '111222222111',
      '.11X1111X11.',
      '..11111111..',
    ],
  },
  {
    name: 'Crossfire',
    hint: 'Explosives in the pockets. Chain them.',
    rows: [
      'X1111SS1111X',
      '1X112211X2X1',
      '1112X22X2111',
      '.S11122111S.',
      '2111X22X1112',
      'X2112211121X',
      'X1111SS1111X',
    ],
  },
  {
    name: 'Armored Vault',
    hint: 'Three-hit armor guards the vault.',
    rows: [
      '333333333333',
      '322222222223',
      '32X222222X23',
      '322S3333S223',
      '111X1111X111',
      '.1111111111.',
      '..22222222..',
    ],
  },
  {
    name: 'Prism Heart',
    hint: 'Everything you have learned. Good luck.',
    rows: [
      '.11..XX..11.',
      '1221X33X1221',
      '122233332221',
      'S122X33X221S',
      '11222XX22211',
      '.1122222211.',
      '..11X22X11..',
      '...111111...',
    ],
  },
];
