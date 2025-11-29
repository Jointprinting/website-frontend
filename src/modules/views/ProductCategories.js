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
  opacity: 0.35,
  transition: theme.transitions.create('opacity'),
}));

const ImageIconButton = styled(ButtonBase)(({ theme }) => ({
  position: 'relative',
  display: 'block',
  padding: 0,
  borderRadius: 18,
  height: '40vh',
  overflow: 'hidden',
  [theme.breakpoints.down('md')]: {
    width: '100% !important',
    height: 140,
  },
  '&:hover': {
    zIndex: 1,
  },
  '&:hover .imageBackdrop': {
    opacity: 0.15,
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

const tiles = [
  {
    url: 'https://images.pexels.com/photos/4641825/pexels-photo-4641825.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Core Apparel',
    subtitle: 'Tees, crews & hoodies that actually get worn.',
    width: '33.33%',
    tab: '/products',
  },
  {
    url: 'https://images.pexels.com/photos/4498143/pexels-photo-4498143.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Headwear & Layers',
    subtitle: 'Caps, beanies, and outerwear that travel with your audience.',
    width: '33.34%',
    tab: '/products',
  },
  {
    url: 'https://images.pexels.com/photos/9594432/pexels-photo-9594432.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
    title: 'Promo & Accessories',
    subtitle: 'Totes, drinkware, and extras that feel on-brand — not junk.',
    width: '33.33%',
    tab: '/products',
  },
];

export default function ProductCategories() {
  const navigate = useNavigate();

  return (
    <Box component="section" sx={{ mt: 8, mb: 12, bgcolor: '#f7f7f7' }}>
      <Container sx={{ pt: 6, pb: 2 }}>
        <Typography
          variant="overline"
          align="center"
          sx={{ letterSpacing: 3, color: 'text.secondary' }}
        >
          WHAT WE LOVE TO BUILD
        </Typography>
        <Typography
          variant="h4"
          marked="center"
          align="center"
          component="h2"
          sx={{ mt: 1, mb: 5 }}
        >
          The pieces your audience actually keeps
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
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
