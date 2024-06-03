import * as React from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Container from '@mui/material/Container';
import Typography from '../modules/components/Typography';
import Stack from '@mui/material/Stack';
//import TextField from '../modules/components/TextField';
import { SocialIcon } from 'react-social-icons'
import jpstacked from '../modules/images/jpstacked.webp'

function Copyright() {
  return (
    <React.Fragment>
      {'© '}
      <Link color="inherit" href="/">
        Joint Printing LLC
      </Link>
    </React.Fragment>
  );
}

export default function Footer() {
  return (
    <Typography
      component="footer"
      sx={{ display: 'flex', bgcolor: 'secondary.light' }}
    >
      <Stack direction="row" spacing='10vw' width="100%" py={'6vh'}>
          <Box flex={1} />
          <Stack spacing='2vh'>
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box width='48px' mr={1} >
                <SocialIcon url="https://www.instagram.com" bgColor="black" target="_blank"/>
              </Box>
              <Box width='48px'>
                <SocialIcon url="https://www.tiktok.com" target="_blank"/>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} width="170px">
              <Typography>© </Typography>
              <Link color="inherit" href="/">
                Joint Printing LLC
              </Link>
            </Stack>
          </Stack>
          <Stack>
            <Typography variant="h6" marked="left" gutterBottom>
              Company
            </Typography>
            <Box component="ul" sx={{ m: 0, listStyle: 'none', p: 0 }}>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/products">Products</Link>
              </Box>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/about">About</Link>
              </Box>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/contact">Contact</Link>
              </Box>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/faq">FAQ</Link>
              </Box>
            </Box>
          </Stack>
          <Stack item xs={6} sm={4} md={2}>
            <Typography variant="h6" marked="left" gutterBottom>
              Legal
            </Typography>
            <Box component="ul" sx={{ m: 0, listStyle: 'none', p: 0 }}>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/terms">Terms</Link>
              </Box>
              <Box component="li" sx={{ py: 0.5 }}>
                <Link href="/privacy">Privacy</Link>
              </Box>
            </Box>
          </Stack>
          <Stack direction="row" width="100%">
            <Box flex={1}/>
            <img src={jpstacked} alt="logo" width="150px" height="auto"/>
          </Stack>
          <Box flex={1} />
        </Stack>
    </Typography>
  );
}