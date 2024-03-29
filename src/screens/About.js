import * as React from 'react';
import { Box, Stack } from '@mui/material';
import Typography from '../modules/components/Typography';

function About() {
  return (
    <Box>
        <Box sx={{ height: '50vh', py:2, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center",
                backgroundImage:'url(https://images.pexels.com/photos/2237801/pexels-photo-2237801.jpeg?auto=compress&cs=tinysrgb&w=800)'
            }}
        >
            <Typography color="#06752b" align="center" variant="h1" fontWeight="bold">
                About Us
            </Typography>
            <Typography color="inherit" align="center" variant="h5" >
                We're just as cool as the
            </Typography>
            <Typography color="inherit" align="center" variant="h5" >
                merch we make.
            </Typography>
        </Box>
        <Box py="20vh">
            <Typography color="royalblue" align="center" variant="h2" >
                12,346
            </Typography>
            <Typography color="inherit" align="center" variant="h4" mb="10vh">
                Garments Printed
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10}>
                <Stack spacing={1} alignItems="center">
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/facebook.svg' alt='facebook' />
                    <Typography color="inherit" align="center" fontSize="10px" fontWeight="bold"> "This merch is rad" </Typography>
                </Stack>
                <Stack spacing={1} alignItems="center">
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/google.svg' alt='glassdoor' />
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/stars.svg' alt='stars5-1' />
                </Stack>
                <Stack spacing={1} alignItems="center">
                <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/glassdoor.svg' alt='glassdoor' />
                <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/stars.svg' alt='stars5-1' />
                </Stack>
                <Stack alignItems="center">
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/yelp.svg' alt='yelp' />
                    <Typography color="inherit" align="center" fontSize="10px" fontWeight="bold"> "These guys are awesome!" </Typography>
                </Stack>
            </Stack>
        </Box>
        <Box py="20vh">
            <Typography align="center" variant="h2" >
                Our Story
            </Typography>
            <Typography color="inherit" align="center" variant="h4" mb="10vh">
                Garments Printed
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10}>
                <Stack spacing={1} alignItems="center">
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/facebook.svg' alt='facebook' />
                    <Typography color="inherit" align="center" fontSize="10px" fontWeight="bold"> "This merch is rad" </Typography>
                </Stack>
                <Stack spacing={1} alignItems="center">
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/google.svg' alt='glassdoor' />
                    <img src='https://fp.freshprints.com/assets/icons/about-us/reviews/stars.svg' alt='stars5-1' />
                </Stack>
            </Stack>
        </Box>
    </Box>
  );
}

export default About;