// src/modules/views/ProductSmokingHero.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '../components/Typography';
import { useNavigate } from 'react-router-dom';

function ProductSmokingHero() {
  const navigate = useNavigate();

  return (
    <Box
      component="section"
      sx={{
        my: 10,
        px: 2,
        bgcolor: '#f5f5f5', // light page background so the card pops
        display: 'flex',
        justifyContent: 'center',
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
          elevation={6}
          sx={{
            width: '100%',
            borderRadius: 4,
            px: { xs: 3, sm: 6 },
            py: { xs: 5, sm: 6 },
            textAlign: 'center',
            bgcolor: '#101613', // deep green/black card
            color: 'common.white',
          }}
        >
          <Typography
            variant="overline"
            sx={{
              letterSpacing: 3,
              color: 'grey.300',
              mb: 1.5,
            }}
          >
            PREFER TO TALK IT OUT?
          </Typography>

          <Typography
            variant="h4"
            component="h2"
            sx={{ mb: 2.5 }}
            color="common.white"
          >
            Hop on a quick call about your next drop
          </Typography>

          <Typography
            variant="body1"
            sx={{
              maxWidth: 560,
              mx: 'auto',
              mb: 4,
              color: 'common.white',
            }}
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
            }}
            variant="contained"
            color="secondary"
            onClick={() => navigate('/contact')}
          >
            Contact us about your next drop
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}

export default ProductSmokingHero;
