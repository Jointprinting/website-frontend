// src/screens/Catalogs.js
//
// Public catalogs page. Pulls the published list from the backend, renders
// each one with its style preset (see ../common/catalogPresets), and shows
// the discount toast if the admin has enabled it in Studio.
//
// PDF resolution is static-first: any catalog whose pdfFileName matches a
// file shipped under /public/catalogs/ is served as a static asset, so the
// default catalogs keep working even when the backend is asleep, errored,
// or hasn't been seeded. Admin-uploaded catalogs (whose filenames aren't in
// the static set) fall through to /api/catalogs/:id/pdf as before.
//
// If the backend list call fails or returns nothing, we render a hardcoded
// fallback of the four default catalogs instead of an error / empty state,
// so end users always get something usable.

import * as React from 'react';
import axios from 'axios';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '../modules/components/Typography';
import { getPreset } from '../common/catalogPresets';
import CatalogToast from '../common/CatalogToast';
import JpLoader from '../common/JpLoader';
import config from '../config.json';

// Filenames present under public/catalogs/. Any catalog whose pdfFileName is
// in this set is served as a static asset instead of going through the
// backend's GridFS stream — bulletproof against backend outages and cold
// starts. To add a new bulletproof catalog: drop the PDF into
// public/catalogs/ and add its filename here (and to FALLBACK_CATALOGS if
// it should show up without a backend at all).
const LOCAL_CATALOG_FILES = new Set([
  'prototype-to-production.pdf',
  'usa-250-promos.pdf',
  'dispensary-catalog.pdf',
  'dispo-promos.pdf',
]);

// Defensive second-pass match: if a backend catalog has a title we recognize
// as a default, route it to the matching static PDF even when its
// pdfFileName was changed (e.g. the admin re-uploaded with a custom name).
// Keys are normalized titles (lowercase, ASCII letters + digits only).
function normalizeTitle(t) {
  return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
const TITLE_TO_LOCAL_FILE = new Map([
  ['prototypeproduction',         'prototype-to-production.pdf'],
  ['prototypetoproduction',       'prototype-to-production.pdf'],
  ['usas250thanniversarypromocollection', 'usa-250-promos.pdf'],
  ['usa250promos',                'usa-250-promos.pdf'],
  ['jpdispensary',                'dispensary-catalog.pdf'],
  ['jptimesdispensary',           'dispensary-catalog.pdf'],
  ['jpxdispensary',               'dispensary-catalog.pdf'],
  ['dispensarycatalog',           'dispensary-catalog.pdf'],
  ['dispensarypromos',            'dispo-promos.pdf'],
  ['dispopromos',                 'dispo-promos.pdf'],
]);

// Rendered when the backend is unreachable or returns an empty list. Mirrors
// the seed catalogs in scripts/seedCatalogs.js — the four catalogs we want
// available at all times. _id values are fake strings so React keys stay
// unique without colliding with real Mongo ObjectIds.
const FALLBACK_CATALOGS = [
  {
    _id:         'static-prototype-to-production',
    title:       'Prototype → Production',
    description: 'Custom wood display plaques, 3D-printed mascots and tap handles, slate coasters and trays. Unique products for brands that want something nobody else has.',
    tags:        ['Wood', '3D Printing', 'Slate', 'Retail Display'],
    stylePreset: 'default',
    accentColor: '#2e7d32',
    emoji:       '🪵',
    pdfFileName: 'prototype-to-production.pdf',
  },
  {
    _id:         'static-usa-250-promos',
    title:       "USA's 250th Anniversary Promo Collection",
    description: "Patriotic promo products timed for America's 250th anniversary in 2026. Sunglasses, drinkware, bags, apparel, stickers, and more — all customizable.",
    tags:        ['Drinkware', 'Bags', 'Apparel', 'Promos'],
    stylePreset: 'patriotic',
    accentColor: '#B22234',
    emoji:       '🇺🇸',
    pdfFileName: 'usa-250-promos.pdf',
  },
  {
    _id:         'static-dispensary',
    title:       'JP × Dispensary',
    description: 'Apparel and merch built specifically for cannabis dispensaries — branded tees, hoodies, headgear, and giveaway items. Staff uniforms to customer gifts.',
    tags:        ['Apparel', 'Dispensary', 'Staff Uniforms', 'Giveaways'],
    stylePreset: 'canopy',
    accentColor: '#1b5e20',
    emoji:       '🌿',
    pdfFileName: 'dispensary-catalog.pdf',
  },
  {
    _id:         'static-dispo-promos',
    title:       'Dispensary Promos',
    description: 'Promotional add-ons for dispensary retail — stickers, accessories, and branded items designed to drive loyalty and repeat visits.',
    tags:        ['Promos', 'Dispensary', 'Accessories'],
    stylePreset: 'canopy',
    accentColor: '#004d40',
    emoji:       '🎁',
    pdfFileName: 'dispo-promos.pdf',
  },
];

// Builds the view/download URLs for a catalog, preferring a static asset
// when (a) its pdfFileName matches a known local file or (b) its title
// normalizes to one we recognize as a default. The title path covers
// backend catalogs whose PDFs were re-uploaded with custom filenames.
function resolveCatalogUrls(cat) {
  let staticFile = null;
  if (cat.pdfFileName && LOCAL_CATALOG_FILES.has(cat.pdfFileName)) {
    staticFile = cat.pdfFileName;
  } else {
    const titleHit = TITLE_TO_LOCAL_FILE.get(normalizeTitle(cat.title));
    if (titleHit) staticFile = titleHit;
  }
  if (staticFile) {
    const staticUrl = `/catalogs/${staticFile}`;
    return { pdfUrl: staticUrl, downloadUrl: staticUrl, isStatic: true };
  }
  const apiUrl = `${config.backendUrl}/api/catalogs/${cat._id}/pdf`;
  return { pdfUrl: apiUrl, downloadUrl: `${apiUrl}?download=1`, isStatic: false };
}

function Catalogs() {
  const [catalogs, setCatalogs] = React.useState([]);
  const [loading, setLoading]   = React.useState(true);

  // We deliberately don't surface fetch errors — the render path falls back
  // to FALLBACK_CATALOGS when the response is empty or fails, so the page
  // always has something useful to show. Errors are logged for debugging.
  React.useEffect(() => {
    let cancelled = false;
    axios.get(`${config.backendUrl}/api/catalogs`)
      .then((r) => {
        if (!cancelled && Array.isArray(r.data)) setCatalogs(r.data);
      })
      .catch((e) => {
        console.warn('[catalogs] backend fetch failed, using static fallback:', e?.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center' }}>
          <Chip
            label="Joint Printing · Product Catalogs"
            sx={{ mb: 2, bgcolor: '#e5f4ea', color: '#1a3d2b', fontWeight: 600 }}
          />
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{ fontWeight: 700, fontSize: { xs: 30, md: 42 } }}
          >
            Browse Our Catalogs
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 300, color: 'text.secondary', maxWidth: 580, mx: 'auto', px: 2 }}
          >
            Flip through our product lines, pricing, and options. See something you like?
            Book a call and we'll put together a mockup.
          </Typography>
        </Box>

        {/* Body — loading or grid (the grid falls back to the static defaults
            whenever the backend returns nothing or errors, so users never see
            a dead-end page). */}
        {loading ? (
          <Stack alignItems="center" sx={{ py: 8 }}>
            <JpLoader size={64} label="Loading catalogs…" tone="light" />
          </Stack>
        ) : (
          <Grid container spacing={{ xs: 3, md: 4 }}>
            {(catalogs.length > 0 ? catalogs : FALLBACK_CATALOGS).map((cat) => {
              const preset = getPreset(cat.stylePreset);
              const accent = cat.accentColor || preset.defaultAccent;
              const { pdfUrl, downloadUrl } = resolveCatalogUrls(cat);

              return (
                <Grid item xs={12} sm={6} key={cat._id}>
                  <Card
                    elevation={3}
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 3,
                      borderTop: `4px solid ${accent}`,
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 8,
                      },
                      ...preset.cardSx,
                    }}
                  >
                    <CardContent sx={{ flex: 1, p: { xs: 2.5, sm: 3 } }}>
                      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center' }}>
                        {preset.renderIcon(cat)}
                      </Box>
                      {preset.renderTitle(cat)}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2, lineHeight: 1.65 }}
                      >
                        {cat.description}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {(cat.tags || []).map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              bgcolor: `${accent}15`,
                              color: accent,
                              fontWeight: 600,
                              fontSize: 11,
                            }}
                          />
                        ))}
                      </Box>
                    </CardContent>
                    <CardActions
                      sx={{
                        px: { xs: 2.5, sm: 3 },
                        pb: { xs: 2.5, sm: 3 },
                        gap: 1,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Button
                        component="a"
                        href={pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="contained"
                        sx={{
                          borderRadius: 999,
                          textTransform: 'none',
                          fontWeight: 700,
                          bgcolor: accent,
                          '&:hover': { bgcolor: accent, filter: 'brightness(1.1)' },
                        }}
                      >
                        View Catalog
                      </Button>
                      <Button
                        component="a"
                        href={downloadUrl}
                        download={cat.pdfFileName || true}
                        variant="outlined"
                        sx={{
                          borderRadius: 999,
                          textTransform: 'none',
                          fontWeight: 600,
                          borderColor: accent,
                          color: accent,
                          '&:hover': { borderColor: accent, bgcolor: `${accent}08` },
                        }}
                      >
                        Download
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Bottom CTA */}
        <Box
          sx={{
            mt: { xs: 6, md: 8 },
            p: { xs: 4, sm: 6 },
            bgcolor: '#111816',
            borderRadius: 4,
            textAlign: 'center',
            color: 'white',
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1.5 }}>
            Don't see exactly what you need?
          </Typography>
          <Typography
            variant="body1"
            sx={{ opacity: 0.85, mb: 3, maxWidth: 480, mx: 'auto', px: 2 }}
          >
            We source from hundreds of suppliers. If you saw something in a photo that
            isn't listed, reach out — we'll put together a custom quote and mockup.
          </Typography>
          <Button
            component="a"
            href="https://calendly.com/nate-jointprinting/30min"
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            color="secondary"
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.5,
              fontSize: 16,
              fontWeight: 700,
              textTransform: 'none',
            }}
          >
            Book a free 15-min call
          </Button>
        </Box>
      </Container>

      {/* Floating discount toast — only renders if enabled in Studio. */}
      <CatalogToast />
    </Box>
  );
}

export default Catalogs;
