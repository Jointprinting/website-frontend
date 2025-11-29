// src/modules/views/ProductCTA.js
import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Container from '@mui/material/Container';
import Typography from '../components/Typography';
import TextField from '../components/TextField';
import Snackbar from '../components/Snackbar';
import Button from '../components/Button';

function ProductCTA() {
  const [open, setOpen] = React.useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Container component="section" sx={{ mt: 10, display: 'flex' }}>
      <Grid container>
        <Grid item xs={12} md={6} sx={{ zIndex: 1 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              bgcolor: 'secondary.light',
              py: 8,
              px: 3,
            }}
          >
            <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 420 }}>
              <Typography variant="overline" sx={{ letterSpacing: 3 }}>
                NOT READY TO ORDER YET?
              </Typography>
              <Typography variant="h4" component="h2" gutterBottom sx={{ mt: 1 }}>
                Get ideas in your inbox
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 300 }}>
                Drop your email and we&apos;ll send seasonal merch ideas and
                quick tips for getting the most out of your next run.
              </Typography>
              <TextField
                noBorder
                placeholder="Your work email"
                variant="standard"
                sx={{ width: '100%', mt: 3, mb: 2 }}
              />
              <Button
                type="submit"
                color="primary"
                variant="contained"
                sx={{ width: '100%', borderRadius: 999 }}
              >
                Send me ideas
              </Button>
            </Box>
          </Box>
        </Grid>

        <Grid
          item
          xs={12}
          md={6}
          sx={{ display: { md: 'block', xs: 'none' }, position: 'relative' }}
        >
          <Box
            sx={{
              position: 'absolute',
              top: -67,
              left: -67,
              right: 0,
              bottom: 0,
              width: '100%',
              background: 'url(/static/themes/onepirate/productCTAImageDots.png)',
            }}
          />
          <Box
            component="img"
            src="https://cdn.midjourney.com/1a20a760-213c-4835-a8cb-bbaf433917d9/0_1.webp"
            alt="call to action"
            sx={{
              position: 'absolute',
              top: -28,
              left: -28,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '90%',
              maxWidth: 600,
            }}
          />
        </Grid>
      </Grid>
      <Snackbar
        open={open}
        closeFunc={handleClose}
        message="Thanks — we’ll send you ideas, not spam."
      />
    </Container>
  );
}

export default ProductCTA;
