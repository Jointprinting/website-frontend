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
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        my: 10,
      }}
    >
      <Typography
        variant="overline"
        sx={{ letterSpacing: 3, color: 'text.secondary', mb: 1 }}
      >
        PREFER TO TALK IT OUT?
      </Typography>
      <Typography variant="h4" component="h2" align="center" sx={{ mb: 3 }}>
        Hop on a quick call about your next drop
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
        }}
        variant="contained"
        color="secondary"
        onClick={() => navigate('/contact')}
      >
        Talk with a merch nerd
      </Button>

      <Typography variant="subtitle1" sx={{ my: 3 }} align="center">
        15–20 minutes. Bring your logo, ideas, or chaos — we&apos;ll shape it
        into a clean lineup.
      </Typography>

      <Box
        component="img"
        src="https://mui.com/static/themes/onepirate/productBuoy.svg"
        alt="buoy"
        sx={{ width: 60, opacity: 0.7 }}
      />
    </Container>
  );
}

export default ProductSmokingHero;
