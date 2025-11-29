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
    <Box
      component="section"
      sx={{
        bgcolor: '#f5f5f5',
        py: 10,
      }}
    >
      <Container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Box
          sx={{
            bgcolor: '#111816',
            color: 'common.white',
            borderRadius: 4,
            px: { xs: 3, sm: 6 },
            py: { xs: 5, sm: 6 },
            textAlign: 'center',
            boxShadow: 6,
            maxWidth: 720,
            width: '100%',
          }}
        >
          <Typography
            variant="overline"
            color="inherit"
            sx={{
              letterSpacing: 3,
              color: 'rgba(255,255,255,0.75)',
              mb: 1,
            }}
          >
            PREFER TO TALK IT OUT?
          </Typography>

          <Typography
            variant="h4"
            component="h2"
            color="inherit"
            sx={{ mb: 2, fontWeight: 600 }}
          >
            Hop on a quick call about your next drop
          </Typography>

          <Typography
            variant="body1"
            color="inherit"
            sx={{ mb: 4, opacity: 0.9, maxWidth: 520, mx: 'auto' }}
          >
            15–20 minutes. Bring your logo, ideas, or chaos — we&apos;ll shape
            it into a clean lineup.
          </Typography>

          <Button
            sx={{
              borderRadius: 999,
              px: 5,
              py: 1.8,
              fontSize: 18,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: 5,
            }}
            variant="contained"
            color="secondary"
            onClick={() => navigate('/contact')}
          >
            Request a free mockup & quote
          </Button>
        </Box>
      </Container>
    </Box>
  );
}

export default ProductSmokingHero;
