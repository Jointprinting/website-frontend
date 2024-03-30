import * as React from 'react';
import { Box, Stack } from '@mui/material';
import Typography from '../modules/components/Typography';
import Avatar from '@mui/material/Avatar';

function About() {
  return (
    <Box>
        <Box sx={{ height: '50vh', py:2, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center",
                backgroundImage:'url(https://img.freepik.com/free-photo/blur-shopping-mall_1203-8809.jpg?size=626&ext=jpg&ga=GA1.1.1224184972.1711670400&semt=ais)'
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
        <Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Our Story
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={6}>
                <img src='https://fp.freshprints.com/assets/icons/about-us/our_story_girl_new.png' alt='story' style={{height:'30vw', width: 'auto'}} />
                <Stack spacing={1} alignItems="center" maxWidth="35vw">
                    <Typography align="center" variant="h4">From Collegiate to Corporate</Typography>
                    <Typography>We’ve been making trendy merch for college students since 2013, but never thought much about the corporate market. Then we noticed that the handful of businesses that did work with us always stuck around… for years.

We started with: why do they like working with us?

Today we’re at: we get it and we’ve leveled up.

We now stand by our ability to create high-quality and on-brand merch for students and companies alike. No more crappy t-shirts or cheap pens that people toss immediately. We put your logo on merch that means something. Merch your community will proudly wear.</Typography>
                </Stack>
                
            </Stack>
        </Box>

        <Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Awesome Values
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={6}>
                <Stack spacing={1} alignItems="center" maxWidth="35vw">
                    <Typography align="center" variant="h4">From Collegiate to Corporate</Typography>
                    <Typography>We’ve been making trendy merch for college students since 2013, but never thought much about the corporate market. Then we noticed that the handful of businesses that did work with us always stuck around… for years.

We started with: why do they like working with us?

Today we’re at: we get it and we’ve leveled up.

We now stand by our ability to create high-quality and on-brand merch for students and companies alike. No more crappy t-shirts or cheap pens that people toss immediately. We put your logo on merch that means something. Merch your community will proudly wear.</Typography>
                </Stack>
                <img src='https://fp.freshprints.com/assets/icons/about-us/our_story_girl_new.png' alt='story' style={{height:'30vw', width: 'auto'}} />

                
            </Stack>
        </Box>

        <Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Our Team
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={6}>
                <Avatar alt="Remy Sharp" src="/static/images/avatar/1.jpg" sx={{ width: 80, height: 80 }} />
                <Avatar alt="Travis Howard" src="/static/images/avatar/2.jpg" sx={{ width: 80, height: 80 }}/>
                <Avatar alt="Cindy Baker" src="/static/images/avatar/3.jpg" sx={{ width: 80, height: 80 }} />
            </Stack>
        </Box>
    </Box>
  );
}

export default About;