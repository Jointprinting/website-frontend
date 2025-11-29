// src/modules/views/ProductSmokingHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useNavigate } from 'react-router-dom';

function ProductSmokingHero() {
  const navigate = useNavigate();

  return (
    <Box
      component="section"
      sx={{
        bgcolor: '#f5f5f5',
        py: { xs: 6, md: 10 },
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Paper
          elevation={4}
          sx={{
            borderRadius: 4,
            px: { xs: 3, md: 6 },
            py: { xs: 4, md: 6 },
            textAlign: 'center',
            bgcolor: '#101712',
            color: 'common.white',
          }}
        >
          <Typography
            variant="overline"
            color="inherit"
            sx={{ letterSpacing: 3, opacity: 0.85, mb: 1 }}
          >
            PREFER TO TALK IT OUT?
          </Typography>

          <Typography
            variant="h4"
            component="h2"
            color="inherit"
            sx={{ mb: 2, fontWeight: 600 }}
          >
            HOP ON A QUICK CALL ABOUT YOUR NEXT DROP
          </Typography>

          <Typography
            variant="body1"
            color="inherit"
            sx={{ mb: 4, maxWidth: 520, mx: 'auto', opacity: 0.9 }}
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
              boxShadow: 4,
              bgcolor: 'secondary.main',
              '&:hover': { bgcolor: 'secondary.dark' },
            }}
            variant="contained"
            onClick={() => navigate('/contact')}
          >
            Talk to us about your drop
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default ProductSmokingHero;
