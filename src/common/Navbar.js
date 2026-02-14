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
  const mobile = useMediaQuery('(max-width: 800px)');

  const DrawerComponent = () => {
    const [openDrawer, setOpenDrawer] = React.useState(false);

    return (
      <>
        <Drawer
          anchor="right"
          onClose={() => setOpenDrawer(false)}
          open={openDrawer}
        >
          <List>
            <ListItem divider key="Products" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/products"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="Products" />
              </ListItemButton>
            </ListItem>

            <ListItem key="About" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/about"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="About" />
              </ListItemButton>
            </ListItem>

            <ListItem key="Contact" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/contact"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="Contact" />
              </ListItemButton>
            </ListItem>

            <ListItem key="FAQ" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/faq"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="FAQ" />
              </ListItemButton>
            </ListItem>
          </List>
        </Drawer>

        <IconButton
          onClick={() => setOpenDrawer((prev) => !prev)}
          sx={{ ml: 'auto' }}
          aria-label="Open menu"
        >
          <MenuIcon sx={{ color: 'white', fontSize: 30 }} />
        </IconButton>
      </>
    );
  };

  if (!mobile) {
    return (
      <div>
        <AppBar position="fixed">
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Stack
              direction="row"
              alignItems="center"
              component={ReactRouterLink}
              to="/"
              sx={{ textDecoration: 'none' }}
            >
              <img src={boxLogo} alt="logo" width="60" height="auto" />
              <Typography
                sx={{
                  ml: 1,
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 22,
                  fontFamily: 'Roboto Condensed',
                }}
              >
                JOINT PRINTING
              </Typography>
            </Stack>

            <Stack direction="row" spacing={4} alignItems="center">
              <Typography
                component={ReactRouterLink}
                to="/products"
                sx={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 14,
                  fontFamily: 'Roboto Condensed',
                }}
              >
                PRODUCTS
              </Typography>
              <Typography
                component={ReactRouterLink}
                to="/about"
                sx={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 14,
                  fontFamily: 'Roboto Condensed',
                }}
              >
                ABOUT
              </Typography>
              <Typography
                component={ReactRouterLink}
                to="/contact"
                sx={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 14,
                  fontFamily: 'Roboto Condensed',
                }}
              >
                CONTACT
              </Typography>
              <Typography
                component={ReactRouterLink}
                to="/faq"
                sx={{
                  color: 'white',
                  textDecoration: 'none',
                  fontWeight: 900,
                  fontSize: 14,
                  fontFamily: 'Roboto Condensed',
                }}
              >
                FAQ
              </Typography>
            </Stack>
          </Toolbar>
        </AppBar>
        <Toolbar />
      </div>
    );
  }

  return (
    <Box component="nav">
      <Stack
        direction="row"
        alignItems="center"
        px={2}
        py={0.7}
        bgcolor="primary.main"
      >
        <Box sx={{ flexGrow: 1 }} />

        <Stack
          direction="row"
          alignItems="center"
          component={ReactRouterLink}
          to="/"
          sx={{ textDecoration: 'none' }}
        >
          <img src={boxLogo} alt="logo" width="36" height="auto" />
          <Typography
            variant="h6"
            fontSize={18}
            align="center"
            sx={{ color: 'white', textDecoration: 'none', ml: 1 }}
          >
            Joint Printing
          </Typography>
        </Stack>

        <Box sx={{ flexGrow: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
          <DrawerComponent />
        </Box>
      </Stack>
    </Box>
  );
}

export default Navbar;
