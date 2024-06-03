import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import { Link as ReactRouterLink } from 'react-router-dom';
import AppBar from '../modules/components/AppBar';
import Toolbar from '../modules/components/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import boxLogo from '../modules/images/logo_white.webp';

function Navbar() {
  const mobile = useMediaQuery("(max-width: 800px)");

  const DrawerComponent = () => {
    const [openDrawer, setOpenDrawer] = React.useState(false);
    return (
        <>
        <Drawer anchor = 'right' onClose = {() => setOpenDrawer(false)} open = {openDrawer} >
            <List>
                <ListItem divider key={"Products"} disablePadding>
                    <ListItemButton component={ReactRouterLink} to="/products">
                        <ListItemText primary={"Products"} />
                    </ListItemButton>
                </ListItem>
                

                <ListItem key={"About"} disablePadding>
                    <ListItemButton component={ReactRouterLink} to="/about">
                        <ListItemText primary={"About"} />
                    </ListItemButton>
                </ListItem>

                <ListItem key={"Contact"} disablePadding>
                    <ListItemButton component={ReactRouterLink} to="/contact">
                        <ListItemText primary={"Contact"} />
                    </ListItemButton>
                </ListItem>

                <ListItem key={"FAQ"} disablePadding>
                    <ListItemButton component={ReactRouterLink} to="/faq">
                        <ListItemText primary={"FAQ"} />
                    </ListItemButton>
                </ListItem>
            </List>
        </Drawer>
        <IconButton onClick = {() => setOpenDrawer(!openDrawer)} sx={{ml:'auto'}}>
            <MenuIcon sx={{color:'inherit', fontSize:'30px', color: 'white'}}/>
        </IconButton>
        </>
    )
  }

  return (
    !mobile ?
    <div>
      <AppBar position="fixed">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }} component={ReactRouterLink} to="/"/>
            <img src={boxLogo} alt="logo" width="60px" height="auto"/>
            <Typography component={ReactRouterLink} to="/" 
                sx={{ml: 1, color:"white", textDecoration: 'none', fontWeight: '900', fontSize:22, fontFamily:'Roboto Condensed'}}
            >
                JOINT PRINTING
            </Typography>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
            <Stack direction="row" spacing={4}>
                <Typography component={ReactRouterLink} to="/products" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    PRODUCTS
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
                <Typography component={ReactRouterLink} to="/faq" 
                    sx={{color:"white", textDecoration: 'none', fontWeight: '900', fontSize:14, fontFamily:'Roboto Condensed'}}
                >
                    FAQ
                </Typography>
            </Stack>
            </Box>
        </Toolbar>
      </AppBar>
      <Toolbar />
    </div>
    :
    <Stack direction="row" alignItems="center" px={2} py={0.7} bgcolor='primary.main'>
        {/*<Box mt={1} sx={{":hover": {cursor: 'pointer'}}}  component={ReactRouterLink} to="/"><img src={logo} alt="logo" width="40px"/></Box>
        <Box sx={{flexGrow: 1}}/>*/}
        <Box sx={{flexGrow: 1}}/>
        <Stack direction="row" to="/" alignItems="center" ml='46px'>
            <img src={boxLogo} alt="logo" width="36px" height="auto" textDecoration='none'/>
            <Typography variant="h6" fontSize={18} align="center" component={ReactRouterLink} to="/" 
            sx={{color: 'white', textDecoration: 'none', ml:1 }}>
                Joint Printing
            </Typography>
        </Stack>
        <Box sx={{flexGrow: 1}}/>
        <Box flex={1} justifyContent="right">
        <DrawerComponent/>
        </Box>
    </Stack>
  );
}

export default Navbar;