// src/modules/views/ProductSmokingHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Typography from '../components/Typography';
import { useNavigate } from 'react-router-dom';

function ProductSmokingHero() {
  const navigate = useNavigate();

  return (
    <Container
      component="section"
      sx={{
        my: 10,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: 960,
          borderRadius: 5,
          px: { xs: 3, sm: 6 },
          py: { xs: 4, sm: 6 },
          bgcolor: '#111715',
          color: 'common.white',
          textAlign: 'center',
          boxShadow: 6,
        }}
      >
        <Typography
          variant="overline"
          sx={{ letterSpacing: 3, color: 'grey.300', mb: 1 }}
        >
          PREFER TO TALK IT OUT?
        </Typography>

        <Typography variant="h4" component="h2" align="center" sx={{ mb: 2 }}>
          Hop on a quick call about your next drop
        </Typography>

        <Typography
          variant="subtitle1"
          sx={{ my: 2, maxWidth: 520, mx: 'auto', opacity: 0.9 }}
          align="center"
        >
          15–20 minutes. Bring your logo, ideas, or chaos — we&apos;ll shape it
          into a clean lineup.
        </Typography>

        <Button
          sx={{
            borderRadius: 999,
            px: 5,
            py: 1.8,
            fontSize: 18,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: 3,
            mt: 2,
          }}
          variant="contained"
          color="secondary"
          onClick={() => navigate('/contact')}
        >
          Request a free mockup & quote
        </Button>
      </Box>
    </Container>
  );
}

export default ProductSmokingHero;
