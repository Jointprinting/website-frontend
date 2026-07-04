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
import { Link as ReactRouterLink, useLocation } from 'react-router-dom';
import AppBar from '../modules/components/AppBar';
import Toolbar from '../modules/components/Toolbar';
import useMediaQuery from '@mui/material/useMediaQuery';
import boxLogo from '../modules/images/logo_white.webp';

const NAV_LINKS = [
  { label: 'PRODUCTS',     to: '/products' },
  { label: 'CATALOGS',     to: '/catalogs' },
  // The dispensary vertical is the #1 audience — link the landing page so a shop
  // owner browsing the site (and search crawlers) can actually reach it.
  { label: 'DISPENSARIES', to: '/dispensaries' },
  { label: 'ABOUT',        to: '/about' },
  { label: 'CONTACT',      to: '/contact' },
  { label: 'FAQ',          to: '/faq' },
];

// Desktop nav link with a brand-green underline that slides in on hover and
// stays put on the current page — quiet feedback for where you are.
function NavLink({ label, to, active }) {
  return (
    <Typography
      component={ReactRouterLink}
      to={to}
      sx={{
        position: 'relative',
        color: 'white',
        textDecoration: 'none',
        fontWeight: 900,
        fontSize: 14,
        fontFamily: 'Roboto Condensed',
        py: 0.5,
        opacity: active ? 1 : 0.92,
        transition: 'opacity 150ms ease',
        '&:hover': { opacity: 1 },
        '&::after': {
          content: '""',
          position: 'absolute',
          left: 0,
          bottom: 0,
          height: 2,
          width: '100%',
          borderRadius: 1,
          backgroundColor: '#4ade80',
          transform: active ? 'scaleX(1)' : 'scaleX(0)',
          transformOrigin: 'left center',
          transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
        '&:hover::after': { transform: 'scaleX(1)' },
      }}
    >
      {label}
    </Typography>
  );
}

function Navbar() {
  const mobile = useMediaQuery('(max-width: 800px)');
  const { pathname } = useLocation();

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
            <ListItem key="Catalogs" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/catalogs"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="Catalogs" />
              </ListItemButton>
            </ListItem>
            <ListItem divider key="Dispensaries" disablePadding>
              <ListItemButton
                component={ReactRouterLink}
                to="/dispensaries"
                onClick={() => setOpenDrawer(false)}
              >
                <ListItemText primary="Dispensaries" />
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
      // position="sticky" instead of "fixed". Fixes the white-bar gap that
      // appeared between the announcement bar and the page content. With
      // sticky, the navbar flows in document layout (no placeholder Toolbar
      // needed) and still pins to the top once you scroll past the banner.
      <AppBar position="sticky">
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
            {NAV_LINKS.map((l) => (
              <NavLink key={l.to} {...l} active={pathname === l.to} />
            ))}
          </Stack>
        </Toolbar>
      </AppBar>
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
        {/* One grow region per side (left spacer above, this box below) so the
            logo/wordmark sits at true center next to the hamburger. */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', flex: 1 }}>
          <DrawerComponent />
        </Box>
      </Stack>
    </Box>
  );
}

export default Navbar;
