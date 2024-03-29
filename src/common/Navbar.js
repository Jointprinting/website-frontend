import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Link as ReactRouterLink } from 'react-router-dom';
import AppBar from '../modules/components/AppBar';
import Toolbar from '../modules/components/Toolbar';

const rightLink = {
  fontSize: 16,
  color: 'common.white',
  ml: 3,
};

function Navbar() {
  return (
    <div>
      <AppBar position="fixed">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }} component={ReactRouterLink} to="/"/>
            <Typography component={ReactRouterLink} to="/" 
                sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:22, fontFamily:'Roboto Condensed'}}
            >
                BRANDNAME
            </Typography>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Stack direction="row" spacing={4}>
                <Typography component={ReactRouterLink} to="/product" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    PRODUCT
                </Typography>
                <Typography component={ReactRouterLink} to="/services" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    SERVICES
                </Typography>
                <Typography component={ReactRouterLink} to="/about" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    ABOUT
                </Typography>
                <Typography component={ReactRouterLink} to="/contact" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    CONTACT
                </Typography>
            </Stack>
            </Box>
        </Toolbar>
      </AppBar>
      <Toolbar />
    </div>
  );
}

export default Navbar;