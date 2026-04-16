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

const catalogs = [
  {
    title: 'Prototype → Production',
    description:
      'Custom wood display plaques, 3D-printed mascots and tap handles, slate coasters and trays. Unique products for brands that want something nobody else has.',
    tags: ['Wood', '3D Printing', 'Slate', 'Retail Display'],
    file: '/catalogs/prototype-to-production.pdf',
    accent: '#2e7d32',
    emoji: '🪵',
  },
  {
    title: 'USA 250 Promo Collection',
    description:
      'Patriotic promo products timed for America\'s 250th anniversary in 2026. Sunglasses, drinkware, bags, apparel, stickers, and more — all customizable.',
    tags: ['Drinkware', 'Bags', 'Apparel', 'Promos'],
    file: '/catalogs/usa-250-promos.pdf',
    accent: '#b71c1c',
    emoji: '🇺🇸',
  },
  {
    title: 'JP × Dispensary',
    description:
      'Apparel and merch built specifically for cannabis dispensaries — branded tees, hoodies, headgear, and giveaway items. Staff uniforms to customer gifts.',
    tags: ['Apparel', 'Dispensary', 'Staff Uniforms', 'Giveaways'],
    file: '/catalogs/dispensary-catalog.pdf',
    accent: '#1b5e20',
    emoji: '🌿',
  },
  {
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
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh', py: 8 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Chip
            label="Joint Printing · Product Catalogs"
            sx={{ mb: 2, bgcolor: '#e5f4ea', color: '#045625', fontWeight: 600 }}
          />
          <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
            Browse Our Catalogs
          </Typography>
          <Typography
            variant="h6"
            sx={{ fontWeight: 300, color: 'text.secondary', maxWidth: 580, mx: 'auto' }}
          >
            Flip through our product lines, pricing, and options. See something you like?
            Book a call and we'll put together a mockup.
          </Typography>
        </Box>

        {/* Catalog Cards */}
        <Grid container spacing={4}>
          {catalogs.map((cat) => (
            <Grid item xs={12} sm={6} key={cat.title}>
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
                }}
              >
                <CardContent sx={{ flex: 1, p: 3 }}>
                  <Box sx={{ fontSize: 36, mb: 1.5 }}>{cat.emoji}</Box>
                  <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                    {cat.title}
                  </Typography>
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
                <CardActions sx={{ px: 3, pb: 3, gap: 1 }}>
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
            mt: 8,
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
            sx={{ opacity: 0.85, mb: 3, maxWidth: 480, mx: 'auto' }}
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
