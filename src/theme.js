import { createTheme } from '@mui/material/styles';
import { green, grey, red } from '@mui/material/colors';
import '@fontsource/work-sans'; // Import the font
import '@fontsource/roboto-condensed';

const rawTheme = createTheme({
  palette: {
    primary: {
      light: '#69696a',
      main: '#28282a',
      dark: '#1e1e1f',
    },
    // Brand green — JP Forest (see src/brand.js). main drives every
    // `color="secondary"` CTA, focus ring, and selection accent, so the whole
    // public site's primary green lives here in one place.
    secondary: {
      light: '#e3ede2', // Pale Sage
      main: '#1a3d2b',  // JP Forest
      dark: '#14301f',  // Forest Deep (hover/pressed)
    },
    // Emerald CTA — the public site's click-me primary fills. Uses a RICHER
    // green than the #4ade80 accent: as a large filled pill, #4ade80 washes out
    // to pale mint, so CTAs use the deeper #22c55e to read vivid (the accent
    // #4ade80 stays for eyebrows / links / code chips). INK text because white
    // fails contrast on emerald. Scoped: the Studio admin never uses color="cta".
    cta: {
      main: '#22c55e',         // Emerald (CTA fill)
      dark: '#16a34a',         // Emerald Deep (hover / pressed)
      contrastText: '#111816', // INK
    },
    warning: {
      main: '#ffc071',
      dark: '#ffb25e',
    },
    error: {
      light: red[50],
      main: red[500],
      dark: red[700],
    },
    success: {
      light: green[50],
      main: green[500],
      dark: green[700],
    },
  },
  typography: {
    fontFamily: "'Work Sans', sans-serif",
    fontSize: 14,
    fontWeightLight: 300, // Work Sans
    fontWeightRegular: 400, // Work Sans
    fontWeightMedium: 700, // Roboto Condensed
  },
});

const fontHeader = {
  color: rawTheme.palette.text.primary,
  fontWeight: rawTheme.typography.fontWeightMedium,
  fontFamily: "'Roboto Condensed', sans-serif",
  textTransform: 'uppercase',
};

const theme = {
  ...rawTheme,
  palette: {
    ...rawTheme.palette,
    background: {
      ...rawTheme.palette.background,
      default: rawTheme.palette.common.white,
      placeholder: grey[200],
    },
  },
  typography: {
    ...rawTheme.typography,
    fontHeader,
    h1: {
      ...rawTheme.typography.h1,
      ...fontHeader,
      letterSpacing: 0,
      fontSize: 60,
    },
    h2: {
      ...rawTheme.typography.h2,
      ...fontHeader,
      fontSize: 48,
    },
    h3: {
      ...rawTheme.typography.h3,
      ...fontHeader,
      fontSize: 42,
    },
    h4: {
      ...rawTheme.typography.h4,
      ...fontHeader,
      fontSize: 36,
    },
    h5: {
      ...rawTheme.typography.h5,
      fontSize: 20,
      fontWeight: rawTheme.typography.fontWeightLight,
    },
    h6: {
      ...rawTheme.typography.h6,
      ...fontHeader,
      fontSize: 18,
    },
    subtitle1: {
      ...rawTheme.typography.subtitle1,
      fontSize: 18,
    },
    body1: {
      ...rawTheme.typography.body2,
      fontWeight: rawTheme.typography.fontWeightRegular,
      fontSize: 16,
    },
    body2: {
      ...rawTheme.typography.body1,
      fontSize: 14,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    // Global motion + tactility pass: every interactive surface eases the
    // same way (200ms standard curve), buttons lift a hair on hover, cards
    // shed the harsh default shadows. Studio screens style themselves with
    // their own dark palette but inherit the same motion language.
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform 200ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          '@media (hover: hover)': {
            '&:hover': { transform: 'translateY(-1px)' },
            '&:active': { transform: 'translateY(0)' },
          },
        },
        contained: {
          boxShadow: '0 1px 2px rgba(20, 30, 24, 0.18)',
          '&:hover': { boxShadow: '0 6px 16px rgba(20, 30, 24, 0.22)' },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: { boxShadow: '0 1px 3px rgba(20, 30, 24, 0.07), 0 4px 14px rgba(20, 30, 24, 0.05)' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          transition: 'transform 250ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiLink: {
      styleOverrides: {
        root: { transition: 'color 150ms ease, opacity 150ms ease' },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 14 },
      },
    },
  },
};

export default theme;