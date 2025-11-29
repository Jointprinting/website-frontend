// src/modules/views/ProductCategories.js
import * as React from 'react';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Container from '@mui/material/Container';
import Typography from '../components/Typography';
import { useNavigate } from 'react-router-dom';

const ImageBackdrop = styled('div')(({ theme }) => ({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  background: '#000',
  opacity: 0.45,
  transition: theme.transitions.create('opacity'),
}));

const ImageIconButton = styled(ButtonBase)(({ theme }) => ({
  position: 'relative',
  display: 'block',
  padding: 0,
  borderRadius: 0,
  height: '40vh',
  [theme.breakpoints.down('md')]: {
    width: '100% !important',
    height: 120,
  },
  '&:hover': {
    zIndex: 1,
  },
  '&:hover .imageBackdrop': {
    opacity: 0.18,
  },
  '&:hover .imageMarked': {
    opacity: 0,
  },
  '& .imageTitle': {
    position: 'relative',
    padding: `${theme.spacing(2)} ${theme.spacing(4)} 14px`,
  },
  '& .imageMarked': {
    height: 3,
    width: 18,
    background: theme.palette.common.white,
    position: 'absolute',
    bottom: -2,
    left: 'calc(50% - 9px)',
    transition: theme.transitions.create('opacity'),
  },
}));

// Framed like a brand/merch system, all tiles still go to /products
const tiles = [
  {
    url: 'https://images.pexels.com/photos/4641825/pexels-photo-4641825.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Launch drops & campaigns',
    subtitle: 'Tees, hoodies and hats built around a moment.',
    width: '33.33%',
    tab: '/products',
  },
  {
    url: 'https://images.pexels.com/photos/4498143/pexels-photo-4498143.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Team & staff uniforms',
    subtitle: 'Pieces your crew actually wants to wear.',
    width: '33.34%',
    tab: '/products',
  },
  {
    url: 'https://images.pexels.com/photos/9594432/pexels-photo-9594432.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Retail & repeat sellers',
    subtitle: 'Blanks and placements tuned for your shelves.',
    width: '33.33%',
    tab: '/products',
  },
];

export default function ProductCategories() {
  const navigate = useNavigate();

  return (
    <Container component="section" sx={{ mt: 10, mb: 12 }}>
      <Typography
        variant="overline"
        align="center"
        sx={{ letterSpacing: 3, color: 'text.secondary' }}
      >
        WHERE WE PLUG INTO YOUR BRAND
      </Typography>
      <Typography
        variant="h4"
        marked="center"
        align="center"
        component="h2"
        sx={{ mt: 1 }}
      >
        From launch drops to everyday uniforms
      </Typography>

      <Box sx={{ mt: 6, display: 'flex', flexWrap: 'wrap' }}>
        {tiles.map((tile) => (
          <ImageIconButton
            key={tile.title}
            onClick={() => navigate(tile.tab)}
            style={{ width: tile.width }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundSize: 'cover',
                backgroundPosition: 'center 40%',
                backgroundImage: `url(${tile.url})`,
              }}
            />
            <ImageBackdrop className="imageBackdrop" />
            <Box
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'common.white',
                px: 2,
              }}
            >
              <Typography
                component="h3"
                variant="h6"
                color="inherit"
                className="imageTitle"
                sx={{ textTransform: 'none' }}
              >
                {tile.title}
                <div className="imageMarked" />
              </Typography>
              <Typography
                variant="body2"
                sx={{ mt: 0.5, opacity: 0.9, maxWidth: 260 }}
              >
                {tile.subtitle}
              </Typography>
            </Box>
          </ImageIconButton>
        ))}
      </Box>
    </Container>
  );
}
