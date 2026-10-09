export const colors = {
  bg: '#080D12', surface: '#121B24', surfaceRaised: '#1C2935', border: '#344452',
  text: '#F4F7FA', muted: '#B5C0CA', accent: '#69D7C5', accentText: '#071713',
  danger: '#FF7777', dangerSurface: '#351B20', success: '#83D6A1', warning: '#F2C66D',
  signal: { 1: '#7DB9E8', 2: '#73C9C0', 3: '#E4CF72', 4: '#F0A35E', 5: '#F27B78' },
  rain: { yellow: '#E4CF72', orange: '#F0A35E', red: '#F27B78' },
} as const;

export const font = { xs: 14, sm: 16, md: 18, lg: 22, xl: 28, xxl: 32 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const minTouch = 48 as const;
