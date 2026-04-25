// src/screens/Catalogs.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '../modules/components/Typography';

// Inline SVG of the US flag — guaranteed to render the same way
// on every device, unlike the 🇺🇸 emoji which sometimes falls back to "US".
const UsFlag = ({ width = 56, height = 36 }) => (
  <Box
    component="svg"
    viewBox="0 0 760 400"
    sx={{ width, height, display: 'block', borderRadius: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Flag of the United States"
  >
    <rect width="760" height="400" fill="#fff" />
    {/* 7 red stripes */}
    {[0, 2, 4, 6, 8, 10, 12].map((i) => (
      <rect key={i} y={(i * 400) / 13} width="760" height={400 / 13} fill="#B22234" />
    ))}
    {/* Blue canton */}
    <rect width={760 * 0.4} height={(400 / 13) * 7} fill="#3C3B6E" />
    {/* Stars (simple 5x6 grid is close enough at this size) */}
    {Array.from({ length: 9 }).map((_, row) =>
      Array.from({ length: row % 2 === 0 ? 6 : 5 }).map((_, col) => {
        const xStep = (760 * 0.4) / 12;
        const yStep = ((400 / 13) * 7) / 10;
        const cx = xStep + col * xStep * 2 + (row % 2 === 0 ? 0 : xStep);
        const cy = yStep + row * yStep;
        return (
          <text
            key={`${row}-${col}`}
            x={cx}
            y={cy + 6}
            fontSize="22"
            fill="#fff"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
          >
            ★
          </text>
        );
      })
    )}
  </Box>
);

// Renders the title with red / dark / blue word coloring for the USA 250 card
const AmericaTitle = () => (
  <Typography variant="h5" component="h2" sx={{ fontWeight: 800, mb: 1, lineHeight: 1.25 }}>
    <Box component="span" sx={{ color: '#B22234' }}>USA's </Box>
    <Box component="span" sx={{ color: '#0A2B5C' }}>250th Anniversary </Box>
    <Box component="span" sx={{ color: '#B22234' }}>Promo </Box>
    <Box component="span" sx={{ color: '#0A2B5C' }}>Collection</Box>
  </Typography>
);

const catalogs = [
  {
    key: 'prototype',
    title: 'Prototype → Production',
    description:
      'Custom wood display plaques, 3D-printed mascots and tap handles, slate coasters and trays. Unique products for brands that want something nobody else has.',
    tags: ['Wood', '3D Printing', 'Slate', 'Retail Display'],
    file: '/catalogs/prototype-to-production.pdf',
    accent: '#2e7d32',
    emoji: '🪵',
  },
  {
    key: 'usa250',
    // title rendered as a custom component (red/blue) when this entry is patriotic
    titleNode: <AmericaTitle />,
    description:
      "Patriotic promo products timed for America's 250th anniversary in 2026. Sunglasses, drinkware, bags, apparel, stickers, and more — all customizable.",
    tags: ['Drinkware', 'Bags', 'Apparel', 'Promos'],
    file: '/catalogs/usa-250-promos.pdf',
    accent: '#B22234',
    flag: true,
  },
  {
    key: 'dispensary',
    title: 'JP × Dispensary',
    description:
      'Apparel and merch built specifically for cannabis dispensaries — branded tees, hoodies, headgear, and giveaway items. Staff uniforms to customer gifts.',
    tags: ['Apparel', 'Dispensary', 'Staff Uniforms', 'Giveaways'],
    file: '/catalogs/dispensary-catalog.pdf',
    accent: '#1b5e20',
    emoji: '🌿',
  },
  {
    key: 'dispoPromos',
    title: 'Dispensary Promos',
    description:
      'Promotional add-ons for dispensary retail — stickers, accessories, and branded items designed to drive loyalty and repeat visits.',
    tags: ['Promos', 'Dispensary', 'Accessories'],
    file: '/catalogs/dispo-promos.pdf',
    accent: '#004d40',
    emoji: '🎁',
  },
];

function Catalogs() {
  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: { xs: 6, md: 8 } }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: { xs: 4, md: 6 }, textAlign: 'center' }}>
          <Chip
            label="Joint Printing · Product Catalogs"
            sx={{ mb: 2, bgcolor: '#e5f4ea', color: '#045625', fontWeight: 600 }}
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

        {/* Catalog Cards */}
        <Grid container spacing={{ xs: 3, md: 4 }}>
          {catalogs.map((cat) => (
            <Grid item xs={12} sm={6} key={cat.key}>
              <Card
                elevation={3}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  borderTop: `4px solid ${cat.accent}`,
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 8,
                  },
                  // Subtle red/white/blue background hint for the patriotic card
                  ...(cat.flag && {
                    background:
                      'linear-gradient(135deg, rgba(178,34,52,0.04) 0%, #ffffff 50%, rgba(10,43,92,0.05) 100%)',
                  }),
                }}
              >
                <CardContent sx={{ flex: 1, p: { xs: 2.5, sm: 3 } }}>
                  <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center' }}>
                    {cat.flag ? (
                      <UsFlag width={56} height={36} />
                    ) : (
                      <Box sx={{ fontSize: 36, lineHeight: 1 }}>{cat.emoji}</Box>
                    )}
                  </Box>
                  {cat.titleNode ? (
                    cat.titleNode
                  ) : (
                    <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                      {cat.title}
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2, lineHeight: 1.65 }}
                  >
                    {cat.description}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {cat.tags.map((tag) => (
                      <Chip
                        key={tag}
                        label={tag}
                        size="small"
                        sx={{
                          bgcolor: `${cat.accent}15`,
                          color: cat.accent,
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
                    href={cat.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    sx={{
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 700,
                      bgcolor: cat.accent,
                      '&:hover': { bgcolor: cat.accent, filter: 'brightness(1.1)' },
                    }}
                  >
                    View Catalog
                  </Button>
                  <Button
                    component="a"
                    href={cat.file}
                    download
                    variant="outlined"
                    sx={{
                      borderRadius: 999,
                      textTransform: 'none',
                      fontWeight: 600,
                      borderColor: cat.accent,
                      color: cat.accent,
                      '&:hover': { borderColor: cat.accent, bgcolor: `${cat.accent}08` },
                    }}
                  >
                    Download
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

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
            Book a free 30-min call
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default Catalogs;
