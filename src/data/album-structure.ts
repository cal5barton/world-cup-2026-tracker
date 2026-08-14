export const ALBUM_STRUCTURE = {
  totalPages: 112,
  totalStickers: 980,
  sections: [
    {
      name: "We Are Panini",
      pages: "1-1",
      description: "Panini Logo",
      stickersCount: 1,
    },
    {
      name: "FIFA World Cup 2026",
      pages: "2-2",
      description: "Emblemas, mascota, pelota",
      stickersCount: 5,
    },
    {
      name: "Host Countries",
      pages: "3-3",
      description: "Canada, Mexico, USA",
      stickersCount: 3,
    },
    {
      name: "Team Pages",
      pages: "4-99",
      description: "Equipos nacionales (20 láminas por equipo: 18 jugadores + 1 grupal + 1 escudo)",
      stickersCount: 960,
      stickersPerTeam: 20,
      teamCount: 48,
    },
    {
      name: "Special Content",
      pages: "100-112",
      description: "Calendario, mascota, pelota oficial, stickers especiales",
      stickersCount: 11,
    },
  ],
};

export interface Sticker {
  id?: string;
  number: number;
  name: string;
  country: string;
  countryCode: string;
  pageNumber: number;
  sectionType: 'regular' | 'special' | 'coca-cola' | 'mcdonalds';
  positionInPage: number;
  imageUrl?: string;
  createdAt?: string;
  /** Only present on coca-cola stickers — identifies which regional version */
  ccVersion?: 'v1' | 'v2' | 'v3' | 'v4';
}

export interface UserCollection {
  userId: string;
  totalStickers: number;
  hasCount: number;
  missingCount: number;
  percentageComplete: number;
  byCountry: Record<string, { has: number; total: number; percentage: number }>;
  missingList: Sticker[];
}

export interface StickerStats {
  totalStickers: number;
  byCountry: Record<string, number>;
  distribution: {
    regular: number;
    special: number;
    cocaCola: number;
    mcdonalds: number;
  };
}

export interface Country {
  code: string;
  name: string;
  stripes: [string, string, string];
  dir: 'h' | 'v';
  region: string;
  host?: boolean;
  primary: string;
}

// Country codes for all 48 teams — ordered as they appear in the album
export const COUNTRIES: Country[] = [
  { code: 'MEX', name: 'Mexico',        primary: '#006847', stripes: ['#006847', '#FFFFFF', '#CE1126'], dir: 'v', region: 'CONCACAF', host: true },
  { code: 'RSA', name: 'South Africa',  primary: '#007A4D', stripes: ['#000000', '#FFB612', '#007A4D'], dir: 'h', region: 'CAF' },
  { code: 'KOR', name: 'South Korea',   primary: '#C60C30', stripes: ['#FFFFFF', '#C60C30', '#003478'], dir: 'h', region: 'AFC' },
  { code: 'CZE', name: 'Czechia',       primary: '#D7141A', stripes: ['#D7141A', '#FFFFFF', '#11457E'], dir: 'h', region: 'UEFA' },
  { code: 'CAN', name: 'Canada',        primary: '#FF0000', stripes: ['#FF0000', '#FFFFFF', '#FF0000'], dir: 'v', region: 'CONCACAF', host: true },
  { code: 'BIH', name: 'Bosnia',        primary: '#002395', stripes: ['#002395', '#FFCD00', '#002395'], dir: 'h', region: 'UEFA' },
  { code: 'QAT', name: 'Qatar',         primary: '#8D1B3D', stripes: ['#8D1B3D', '#FFFFFF', '#8D1B3D'], dir: 'h', region: 'AFC' },
  { code: 'SUI', name: 'Switzerland',   primary: '#FF0000', stripes: ['#FF0000', '#FFFFFF', '#FF0000'], dir: 'h', region: 'UEFA' },
  { code: 'BRA', name: 'Brazil',        primary: '#009C3B', stripes: ['#009C3B', '#FFDF00', '#009C3B'], dir: 'h', region: 'CONMEBOL' },
  { code: 'MAR', name: 'Morocco',       primary: '#C1272D', stripes: ['#C1272D', '#006233', '#C1272D'], dir: 'h', region: 'CAF' },
  { code: 'HAI', name: 'Haiti',         primary: '#00209F', stripes: ['#00209F', '#D21034', '#00209F'], dir: 'h', region: 'CONCACAF' },
  { code: 'SCO', name: 'Scotland',      primary: '#003F87', stripes: ['#003F87', '#FFFFFF', '#003F87'], dir: 'h', region: 'UEFA' },
  { code: 'USA', name: 'United States', primary: '#3C3B6E', stripes: ['#B22234', '#FFFFFF', '#3C3B6E'], dir: 'h', region: 'CONCACAF', host: true },
  { code: 'PAR', name: 'Paraguay',      primary: '#D52B1E', stripes: ['#D52B1E', '#FFFFFF', '#0038A8'], dir: 'h', region: 'CONMEBOL' },
  { code: 'AUS', name: 'Australia',     primary: '#00008B', stripes: ['#00008B', '#FFFFFF', '#FF0000'], dir: 'h', region: 'AFC' },
  { code: 'TUR', name: 'Turkey',        primary: '#E30A17', stripes: ['#E30A17', '#FFFFFF', '#E30A17'], dir: 'h', region: 'UEFA' },
  { code: 'GER', name: 'Germany',       primary: '#DD0000', stripes: ['#000000', '#DD0000', '#FFCE00'], dir: 'h', region: 'UEFA' },
  { code: 'CUW', name: 'Curaçao',       primary: '#003DA5', stripes: ['#003DA5', '#F7DB00', '#003DA5'], dir: 'h', region: 'CONCACAF' },
  { code: 'CIV', name: 'Ivory Coast',   primary: '#FF6600', stripes: ['#FF6600', '#FFFFFF', '#009A44'], dir: 'v', region: 'CAF' },
  { code: 'ECU', name: 'Ecuador',       primary: '#FFD100', stripes: ['#FFD100', '#003893', '#FF0000'], dir: 'h', region: 'CONMEBOL' },
  { code: 'NED', name: 'Netherlands',   primary: '#AE1C28', stripes: ['#AE1C28', '#FFFFFF', '#21468B'], dir: 'h', region: 'UEFA' },
  { code: 'JPN', name: 'Japan',         primary: '#BC002D', stripes: ['#FFFFFF', '#BC002D', '#FFFFFF'], dir: 'h', region: 'AFC' },
  { code: 'SWE', name: 'Sweden',        primary: '#006AA7', stripes: ['#006AA7', '#FECC02', '#006AA7'], dir: 'h', region: 'UEFA' },
  { code: 'TUN', name: 'Tunisia',       primary: '#E70013', stripes: ['#E70013', '#FFFFFF', '#E70013'], dir: 'h', region: 'CAF' },
  { code: 'BEL', name: 'Belgium',       primary: '#FAD916', stripes: ['#000000', '#FAD916', '#EF3340'], dir: 'v', region: 'UEFA' },
  { code: 'EGY', name: 'Egypt',         primary: '#CE1126', stripes: ['#CE1126', '#FFFFFF', '#000000'], dir: 'h', region: 'CAF' },
  { code: 'IRN', name: 'Iran',          primary: '#239F40', stripes: ['#239F40', '#FFFFFF', '#DA0000'], dir: 'h', region: 'AFC' },
  { code: 'NZL', name: 'New Zealand',   primary: '#00247D', stripes: ['#00247D', '#CC142B', '#FFFFFF'], dir: 'h', region: 'OFC' },
  { code: 'ESP', name: 'Spain',         primary: '#C60B1E', stripes: ['#C60B1E', '#FFC400', '#C60B1E'], dir: 'h', region: 'UEFA' },
  { code: 'CPV', name: 'Cape Verde',    primary: '#003893', stripes: ['#003893', '#FFFFFF', '#CF2027'], dir: 'h', region: 'CAF' },
  { code: 'KSA', name: 'Saudi Arabia',  primary: '#006C35', stripes: ['#006C35', '#FFFFFF', '#006C35'], dir: 'h', region: 'AFC' },
  { code: 'URU', name: 'Uruguay',       primary: '#5EB6E4', stripes: ['#FFFFFF', '#5EB6E4', '#FFFFFF'], dir: 'h', region: 'CONMEBOL' },
  { code: 'FRA', name: 'France',        primary: '#0055A4', stripes: ['#0055A4', '#FFFFFF', '#EF4135'], dir: 'v', region: 'UEFA' },
  { code: 'SEN', name: 'Senegal',       primary: '#00853F', stripes: ['#00853F', '#FDEF42', '#E31B23'], dir: 'v', region: 'CAF' },
  { code: 'IRQ', name: 'Iraq',          primary: '#CE1126', stripes: ['#CE1126', '#FFFFFF', '#000000'], dir: 'h', region: 'AFC' },
  { code: 'NOR', name: 'Norway',        primary: '#EF2B2D', stripes: ['#EF2B2D', '#FFFFFF', '#002868'], dir: 'h', region: 'UEFA' },
  { code: 'ARG', name: 'Argentina',     primary: '#74ACDF', stripes: ['#74ACDF', '#FFFFFF', '#74ACDF'], dir: 'h', region: 'CONMEBOL' },
  { code: 'ALG', name: 'Algeria',       primary: '#006233', stripes: ['#006233', '#FFFFFF', '#006233'], dir: 'h', region: 'CAF' },
  { code: 'AUT', name: 'Austria',       primary: '#ED2939', stripes: ['#ED2939', '#FFFFFF', '#ED2939'], dir: 'h', region: 'UEFA' },
  { code: 'JOR', name: 'Jordan',        primary: '#007A3D', stripes: ['#007A3D', '#FFFFFF', '#000000'], dir: 'h', region: 'AFC' },
  { code: 'POR', name: 'Portugal',      primary: '#006600', stripes: ['#006600', '#CC0000', '#006600'], dir: 'v', region: 'UEFA' },
  { code: 'COD', name: 'Congo DR',      primary: '#007FFF', stripes: ['#007FFF', '#FFCD00', '#CE1126'], dir: 'h', region: 'CAF' },
  { code: 'UZB', name: 'Uzbekistan',    primary: '#1EB53A', stripes: ['#1EB53A', '#FFFFFF', '#CE1126'], dir: 'h', region: 'AFC' },
  { code: 'COL', name: 'Colombia',      primary: '#FCD116', stripes: ['#FCD116', '#003087', '#CE1126'], dir: 'h', region: 'CONMEBOL' },
  { code: 'ENG', name: 'England',       primary: '#CF142B', stripes: ['#FFFFFF', '#CF142B', '#FFFFFF'], dir: 'h', region: 'UEFA' },
  { code: 'CRO', name: 'Croatia',       primary: '#FF0000', stripes: ['#FF0000', '#FFFFFF', '#0035A0'], dir: 'h', region: 'UEFA' },
  { code: 'GHA', name: 'Ghana',         primary: '#006B3F', stripes: ['#006B3F', '#FCD116', '#CE1126'], dir: 'h', region: 'CAF' },
  { code: 'PAN', name: 'Panama',        primary: '#1F3B92', stripes: ['#CE1126', '#FFFFFF', '#1F3B92'], dir: 'h', region: 'CONCACAF' },
];

// Quick lookup map
export const COUNTRY_BY_CODE: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map(c => [c.code, c])
);

// FIFA 3-letter code → ISO 3166-1 alpha-2 (used by flag-icons CSS library)
// Special cases: ENG = gb-eng, SCO = gb-sct (sub-national flags)
export const FIFA_TO_ISO: Record<string, string> = {
  ALG: 'dz', ARG: 'ar', AUS: 'au', AUT: 'at',
  BEL: 'be', BIH: 'ba', BRA: 'br',
  CAN: 'ca', CIV: 'ci', COD: 'cd', COL: 'co', CPV: 'cv',
  CRO: 'hr', CUW: 'cw', CZE: 'cz',
  ECU: 'ec', EGY: 'eg', ENG: 'gb-eng', ESP: 'es',
  FRA: 'fr', GER: 'de', GHA: 'gh',
  HAI: 'ht', IRN: 'ir', IRQ: 'iq',
  JOR: 'jo', JPN: 'jp', KOR: 'kr', KSA: 'sa',
  MAR: 'ma', MEX: 'mx', NED: 'nl', NOR: 'no', NZL: 'nz',
  PAN: 'pa', PAR: 'py', POR: 'pt',
  QAT: 'qa', RSA: 'za', SCO: 'gb-sct', SEN: 'sn',
  SUI: 'ch', SWE: 'se', TUN: 'tn', TUR: 'tr',
  URU: 'uy', USA: 'us', UZB: 'uz',
};

// Section order for the tracker
export const SECTION_ORDER = [
  'COVER', 'TRN', 'HOST', 'CC',
  ...COUNTRIES.map(c => c.code),
];

// Human-readable section labels
export const SECTION_LABELS: Record<string, string> = {
  COVER: 'Cover',
  TRN: 'Tournament',
  HOST: 'Host Nations',
  CC: 'Coca-Cola',
  ...Object.fromEntries(COUNTRIES.map(c => [c.code, c.name])),
};

// Derive sticker section key from existing data
export function getStickerSectionKey(countryCode: string, number: number): string {
  if (countryCode === 'WP') return 'COVER';
  if (countryCode.startsWith('CC')) return 'CC'; // Normalize CCv1, CCv2, etc. to 'CC'
  if (countryCode === 'FWC') {
    if (number <= 6) return 'TRN';
    return 'HOST';
  }
  return countryCode;
}

// Derive sticker type for the modal
export function getStickerType(name: string, countryCode: string, number: number): string {
  if (countryCode === 'WP') return 'cover';
  if (countryCode === 'FWC' && number <= 6) {
    if (name.toLowerCase().includes('emblem')) return 'emblem';
    if (name.toLowerCase().includes('mascot')) return 'mascot';
    if (name.toLowerCase().includes('slogan')) return 'slogan';
    if (name.toLowerCase().includes('ball')) return 'ball';
    if (name.toLowerCase().includes('trophy')) return 'trophy';
    return 'emblem';
  }
  if (countryCode === 'FWC') return 'host';
  if (name === 'Emblem' || name === 'Team Photo') return 'squad';
  return 'player';
}
