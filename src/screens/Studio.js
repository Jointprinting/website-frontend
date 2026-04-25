// src/screens/Studio.js
//
// Password-protected admin/studio page.
// Two modes:
//   1) Smart S&S sync — paste one or many style numbers, we pull from
//      ssactivewear.com and auto-fill the product (category, type, colors,
//      price, sizes, images). Manual fields are optional overrides.
//   2) Manual entry — same form Admin used to have, kept as a fallback.

import * as React from 'react';
import axios from 'axios';
import {
  Box,
  Stack,
  TextField,
  MenuItem,
  Button,
  useMediaQuery,
  FormControl,
  Select,
  Paper,
  Container,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  IconButton,
  Chip,
  Divider,
  Typography as MuiTypography,
  InputAdornment,
} from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import Typography from '../modules/components/Typography';
import config from '../config.json';

const TOKEN_KEY = 'jpStudioToken';

function Login({ onAuthed }) {
  const [pw, setPw] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!pw) return;
    setBusy(true);
    try {
      const res = await axios.post(`${config.backendUrl}/api/auth/studio-login`, { password: pw });
      if (res.data?.token) {
        sessionStorage.setItem(TOKEN_KEY, res.data.token);
        onAuthed(res.data.token);
      } else {
        setErr('Login failed.');
      }
    } catch (e) {
      setErr(e?.response?.data?.message || 'Wrong password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 3, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2} alignItems="center" mb={2}>
          <Box sx={{ bgcolor: '#1a3d2b', color: '#4ade80', width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon />
          </Box>
          <MuiTypography variant="h5" fontWeight={800}>Joint Printing · Studio</MuiTypography>
          <MuiTypography variant="body2" color="text.secondary" textAlign="center">
            Enter your studio password to continue.
          </MuiTypography>
        </Stack>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField
              autoFocus
              type={show ? 'text' : 'password'}
              label="Password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              fullWidth
              size="medium"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShow((s) => !s)}
                      edge="end"
                      size="small"
                      aria-label="Toggle password visibility"
                    >
                      {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            {err && <Alert severity="error" sx={{ borderRadius: 2 }}>{err}</Alert>}
            <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
              {busy ? <CircularProgress size={22} /> : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}

function StudioBody({ token, onLogout }) {
  const mobile = useMediaQuery('(max-width: 800px)');
  const [tab, setTab] = React.useState(0);

  // ────────── Smart S&S sync state ──────────
  const [ssStyles, setSsStyles] = React.useState('');
  const [ssTag, setSsTag] = React.useState('New Arrival');
  const [ssOverrideCat, setSsOverrideCat] = React.useState(''); // empty = auto
  const [ssOverrideType, setSsOverrideType] = React.useState('');
  const [ssMarkup, setSsMarkup] = React.useState(2.5);
  const [ssBusy, setSsBusy] = React.useState(false);
  const [ssResults, setSsResults] = React.useState(null);

  const runSsSync = async () => {
    const list = ssStyles
      .split(/[\s,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!list.length) {
      alert('Add at least one S&S style number, e.g. 3001C or 5000.');
      return;
    }
    setSsBusy(true);
    setSsResults(null);
    try {
      const res = await axios.post(
        `${config.backendUrl}/api/products/ss/sync`,
        {
          styles: list,
          tag: ssTag,
          markup: Number(ssMarkup) || 2.5,
          overrideCategory: ssOverrideCat || undefined,
          overrideType: ssOverrideType || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSsResults(res.data);
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Sync failed';
      alert('S&S sync error: ' + msg);
    } finally {
      setSsBusy(false);
    }
  };

  // ────────── Manual entry state ──────────
  const [styleCode, setStyleCode] = React.useState('');
  const [priceRangeBottom, setPriceRangeBottom] = React.useState('');
  const [priceRangeTop, setPriceRangeTop] = React.useState('');
  const [rating, setRating] = React.useState(5);
  const [tag, setTag] = React.useState('Best Seller');
  const [category, setCategory] = React.useState('Shirts');
  const [type, setType] = React.useState('Unisex');
  const [busy, setBusy] = React.useState(false);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!styleCode || !priceRangeBottom || !priceRangeTop) {
      alert('Please fill out all fields');
      return;
    }
    try {
      setBusy(true);
      await axios.post(
        `${config.backendUrl}/api/products/add`,
        { styleCode, priceRangeBottom, priceRangeTop, rating, tag, category, type },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Product added.');
      setStyleCode(''); setPriceRangeBottom(''); setPriceRangeTop('');
    } catch (err) {
      alert(`Could not add product: ${err?.response?.data?.message || 'Unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <MuiTypography variant="h4" fontWeight={800}>Studio</MuiTypography>
          <MuiTypography variant="body2" color="text.secondary">
            Manage your product catalog · powered by S&S Activewear
          </MuiTypography>
        </Box>
        <Button onClick={onLogout} startIcon={<LogoutIcon />} variant="outlined" size="small" sx={{ borderRadius: 2, textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          Sign out
        </Button>
      </Stack>

      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="S&S Smart Sync" />
          <Tab label="Manual entry" />
        </Tabs>

        {tab === 0 && (
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <MuiTypography variant="body2" color="text.secondary" mb={2.5}>
              Drop in one or more S&amp;S style numbers (e.g. <code>3001C</code>, <code>5000</code>, <code>18500</code>).
              We'll fetch all colors/sizes and auto-detect <em>category</em>,
              <em> fit</em>, and pricing. Anything you set below overrides the auto-detect.
            </MuiTypography>

            <Stack spacing={2}>
              <TextField
                label="S&S style numbers"
                placeholder="3001C, 5000, 18500"
                multiline
                minRows={2}
                value={ssStyles}
                onChange={(e) => setSsStyles(e.target.value)}
                fullWidth
                helperText="Separate by comma, space, or new line."
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Default tag</MuiTypography>
                  <Select size="small" value={ssTag} onChange={(e) => setSsTag(e.target.value)}>
                    <MenuItem value="Best Seller">Best Seller</MenuItem>
                    <MenuItem value="New Arrival">New Arrival</MenuItem>
                    <MenuItem value="Clearance">Clearance</MenuItem>
                    <MenuItem value="Our Favorite">Our Favorite</MenuItem>
                    <MenuItem value="Exclusive">Exclusive</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Markup multiplier</MuiTypography>
                  <TextField
                    size="small"
                    type="number"
                    inputProps={{ step: 0.1, min: 1 }}
                    value={ssMarkup}
                    onChange={(e) => setSsMarkup(e.target.value)}
                    helperText="2.5× cost is a typical printed-apparel margin"
                  />
                </FormControl>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth>
                  <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Override category (leave blank = auto)</MuiTypography>
                  <Select size="small" value={ssOverrideCat} onChange={(e) => setSsOverrideCat(e.target.value)}>
                    <MenuItem value=""><em>Auto-detect</em></MenuItem>
                    <MenuItem value="Shirts">Shirts</MenuItem>
                    <MenuItem value="Pants">Pants</MenuItem>
                    <MenuItem value="Hoodies">Hoodies</MenuItem>
                    <MenuItem value="Hats">Hats</MenuItem>
                  </Select>
                </FormControl>
                <FormControl fullWidth>
                  <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Override fit (leave blank = auto)</MuiTypography>
                  <Select size="small" value={ssOverrideType} onChange={(e) => setSsOverrideType(e.target.value)}>
                    <MenuItem value=""><em>Auto-detect</em></MenuItem>
                    <MenuItem value="Unisex">Unisex</MenuItem>
                    <MenuItem value="Male">Male</MenuItem>
                    <MenuItem value="Female">Female</MenuItem>
                    <MenuItem value="Kids">Kids</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              <Button
                onClick={runSsSync}
                disabled={ssBusy}
                variant="contained"
                size="large"
                startIcon={ssBusy ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                sx={{ borderRadius: 2, py: 1.4, fontWeight: 700, textTransform: 'none' }}
              >
                {ssBusy ? 'Syncing from S&S…' : 'Sync from S&S Activewear'}
              </Button>

              {ssResults && (
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ mb: 2 }} />
                  <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                    <Chip label={`${ssResults.created || 0} added`} color="success" size="small" />
                    <Chip label={`${ssResults.updated || 0} updated`} color="info" size="small" />
                    {ssResults.failed?.length ? (
                      <Chip label={`${ssResults.failed.length} failed`} color="error" size="small" />
                    ) : null}
                  </Stack>
                  {ssResults.products?.length > 0 && (
                    <Stack spacing={0.5}>
                      {ssResults.products.map((p) => (
                        <MuiTypography key={p.style} variant="body2">
                          ✓ <strong>{p.vendor}</strong> {p.style} — {p.name} <em style={{ color: '#666' }}>({p.category}, {p.type})</em>
                        </MuiTypography>
                      ))}
                    </Stack>
                  )}
                  {ssResults.failed?.length > 0 && (
                    <Stack spacing={0.5} mt={1}>
                      {ssResults.failed.map((f) => (
                        <MuiTypography key={f.style} variant="body2" color="error">
                          ✗ {f.style}: {f.reason}
                        </MuiTypography>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <MuiTypography variant="body2" color="text.secondary" mb={2.5}>
              Manual entry uses your existing Alpha Broder XML feed. Use this as a fallback
              if the S&S sync above doesn't have a style you need.
            </MuiTypography>
            <form onSubmit={handleManualSubmit}>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="h6">Style Code</Typography>
                  <TextField value={styleCode} onChange={(e) => setStyleCode(e.target.value)} variant="outlined" fullWidth size={mobile ? 'small' : 'medium'} required />
                </Box>
                <Box>
                  <Typography variant="h6">Price Range ($)</Typography>
                  <Stack direction="row" width="100%" spacing={2} alignItems="center">
                    <TextField value={priceRangeBottom} type="number" onChange={(e) => setPriceRangeBottom(e.target.value)} variant="outlined" size={mobile ? 'small' : 'medium'} required />
                    <Typography variant="h6">-</Typography>
                    <TextField value={priceRangeTop} type="number" onChange={(e) => setPriceRangeTop(e.target.value)} variant="outlined" size={mobile ? 'small' : 'medium'} required />
                  </Stack>
                </Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth>
                    <Typography variant="h6">Rating</Typography>
                    <Select value={rating} onChange={(e) => setRating(e.target.value)}>
                      {[5, 4, 3, 2, 1].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <Typography variant="h6">Tag</Typography>
                    <Select value={tag} onChange={(e) => setTag(e.target.value)}>
                      <MenuItem value="Best Seller">Best Seller</MenuItem>
                      <MenuItem value="New Arrival">New Arrival</MenuItem>
                      <MenuItem value="Clearance">Clearance</MenuItem>
                      <MenuItem value="Our Favorite">Our Favorite</MenuItem>
                      <MenuItem value="Exclusive">Exclusive</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth>
                    <Typography variant="h6">Category</Typography>
                    <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                      <MenuItem value="Shirts">Shirts</MenuItem>
                      <MenuItem value="Pants">Pants</MenuItem>
                      <MenuItem value="Hoodies">Hoodies</MenuItem>
                      <MenuItem value="Hats">Hats</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <Typography variant="h6">Type</Typography>
                    <Select value={type} onChange={(e) => setType(e.target.value)}>
                      <MenuItem value="Unisex">Unisex</MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Kids">Kids</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>
                <Button variant="contained" disabled={busy} size={mobile ? 'medium' : 'large'} type="submit" fullWidth sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
                  {busy ? <CircularProgress size={22} /> : 'Add product'}
                </Button>
              </Stack>
            </form>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default function Studio() {
  const [token, setToken] = React.useState(null);

  React.useEffect(() => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (t) {
      // Quick verification: hit a protected endpoint
      axios
        .get(`${config.backendUrl}/api/auth/verify`, { headers: { Authorization: `Bearer ${t}` } })
        .then(() => setToken(t))
        .catch(() => {
          sessionStorage.removeItem(TOKEN_KEY);
          setToken(null);
        });
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      {token
        ? <StudioBody token={token} onLogout={handleLogout} />
        : <Login onAuthed={setToken} />}
    </Box>
  );
}
