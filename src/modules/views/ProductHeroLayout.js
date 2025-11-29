// src/modules/views/ProductHeroLayout.js
import * as React from 'react';
import Box from '@mui/material/Box';
import { styled } from '@mui/material/styles';

const ProductHeroLayoutRoot = styled('section')(({ theme }) => ({
  color: theme.palette.common.white,
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  backgroundSize: 'cover',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center',
  [theme.breakpoints.up('sm')]: {
    height: '90vh',
    minHeight: 520,
    maxHeight: 900,
  },
  [theme.breakpoints.down('sm')]: {
    minHeight: 420,
  },
}));

export default function ProductHeroLayout(props) {
  const { sxBackground, children } = props;

  return (
    <ProductHeroLayoutRoot sx={sxBackground}>
      {/* Dark gradient overlay on top of the background image */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to bottom, rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.85))',
          zIndex: 0,
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          px: 3,
          maxWidth: 880,
        }}
      >
        {children}
      </Box>
    </ProductHeroLayoutRoot>
  );
}
