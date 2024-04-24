import * as React from 'react';
import { Box, Stack } from '@mui/material';
import Typography from '../modules/components/Typography';
//import Avatar from '@mui/material/Avatar';
import storyImage from '../modules/images/storyImage.webp'

function About() {
  return (
    <Box>
        <Box sx={{ height: '50vh', py:2, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center",
                backgroundImage:'url(https://images.pexels.com/photos/1254736/pexels-photo-1254736.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2)'
            }}
        >
            <Typography color="#06752b" align="center" variant="h1" fontWeight="bold">
                About Us
            </Typography>
            <Typography color="inherit" align="center" variant="h5" >
                Every print tells a story. 
            </Typography>
            <Typography color="inherit" align="center" variant="h5" >
                Let’s tell yours.
            </Typography>
        </Box>
        <Box py="18vh">
            <Typography color="royalblue" align="center" variant="h2" >
                12,346
            </Typography>
            <Typography color="inherit" align="center" variant="h4" mb="6vh">
                Garments Printed
            </Typography>
            <Box display="flex" justifyContent="center">
                <img src={'https://cdn.midjourney.com/1a20a760-213c-4835-a8cb-bbaf433917d9/0_0.webp'} alt='garments' width='40%' height='auto' />
            </Box>
            { /* Reviews sections */}
            {/*
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
            </Stack> */}
        </Box>
        <Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Our Story
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={8}>
                <img src={storyImage} alt='story' style={{ width: '27vw', height: 'auto'}} />
                <Stack spacing={2} alignItems="center" maxWidth="35vw">
                    <Typography align="center" variant="h4">Rooted in Excellence</Typography>
                    <Typography>At Joint Printing, our roots are grounded in the belief that there's always room for innovation.</Typography>
                    <Typography>
                        Our story began when the desire to fully realize our potential outgrew the confines of our previous roles. 
                        Fueled by the conviction that we could offer more, we embarked on an entrepreneurial voyage, crafting a company that's as dynamic and forward-thinking as the clients we serve. 
                    </Typography>
                    <Typography>
                        We're not just another printing service; we're a collective of visionaries committed to bringing your brand’s story into the physical world with unmatched quality and precision.
                    </Typography>
                    <Typography>
                        Here at Joint Printing, your vision is entrusted to a team that cares deeply about bringing it to life, ensuring every detail is not just printed, but imprinted with excellence.
                    </Typography>
                </Stack>
                
            </Stack>
        </Box>

        <Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Mission & Values
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={6}>
                <Stack spacing={2} alignItems="start" maxWidth="35vw">
                    <Typography variant="h4">Our Mission</Typography>
                    <Typography sx={{pb: 2}}>To elevate brands with stellar print solutions and high-quality apparel that blends craftsmanship with convenience, giving you clothing that fully encapsulates your company's spirit.</Typography>

                    <Typography variant="h4" >Our Values</Typography>
                    <Typography>At Joint Printing, we're all about sparking joy in the print process. We’re in the business of making connections — not just between suppliers and clients but also between your brand and your audience. 
                        Think of us as your creative sidekick; we're here to ensure that each print piece not only looks fantastic but also resonates with your brand's playful spirit and ambition.
                    </Typography>
                </Stack>
                <img src='https://images.pexels.com/photos/7666429/pexels-photo-7666429.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2' alt='story' style={{width:'33vw', height: 'auto'}} />

                
            </Stack>
        </Box>

        {/*<Box pt="5vh" pb="20vh">
            <Typography align="center" variant="h2" >
                Our Team
            </Typography>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={10} pt={6}>
                <Avatar alt="Remy Sharp" src="/static/images/avatar/1.jpg" sx={{ width: 80, height: 80 }} />
                <Avatar alt="Travis Howard" src="/static/images/avatar/2.jpg" sx={{ width: 80, height: 80 }}/>
                <Avatar alt="Cindy Baker" src="/static/images/avatar/3.jpg" sx={{ width: 80, height: 80 }} />
            </Stack>
        </Box>*/}
    </Box>
  );
}

export default About;