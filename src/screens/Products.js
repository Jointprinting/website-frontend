// src/screens/Studio.js
//
// Password-protected admin/studio page.
// Three tabs:
//   1) S&S Smart Sync — paste style numbers, auto-pull from S&S
//   2) PDF Catalog Import — give you a prompt + ChatGPT, you paste back JSON
//   3) Manual entry — Alpha Broder XML fallback

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
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Typography from '../modules/components/Typography';
import config from '../config.json';

const TOKEN_KEY = 'jpStudioToken';

// The exact prompt the user pastes into ChatGPT alongside their PDF
const CHATGPT_PROMPT = `You are helping me extract products from a catalog PDF for my e-commerce site.

For EACH product in the PDF I'll attach, return ONE JSON object with this exact shape:

{
  "style": "UNIQUE-STYLE-CODE",        // SKU, item number, or product code from the PDF — must be unique
  "name": "Product Name",               // Short product name (e.g., "Insulated Tumbler 20oz")
  "vendor": "Brand or supplier name",   // The supplier brand name if visible, otherwise "Joint Printing"
  "description": "Short description",   // 1-2 sentences describing the product
  "category": "Promo",                  // Pick ONE: "Shirts", "Pants", "Hoodies", "Hats", "Promo"
  "type": "Unisex",                     // Pick ONE: "Unisex", "Male", "Female", "Kids"
  "priceRangeBottom": 8,                // Lowest price as a number (no $ sign)
  "priceRangeTop": 14,                  // Highest price as a number (no $ sign)
  "sizeRangeBottom": "OS",              // First size, or "OS" for one-size items
  "sizeRangeTop": "OS",                 // Last size, or "OS"
  "colors": ["Black", "White", "Red"],  // Array of color names available
  "colorCodes": ["#000000", "#FFFFFF", "#B22234"],  // Matching hex codes (best guess)
  "imageUrls": ["https://..."],         // Array of image URLs IF the PDF contains them, otherwise empty array
  "tag": "New Arrival",                 // Pick ONE: "Best Seller", "New Arrival", "Our Favorite", "Clearance", "Exclusive"
  "rating": 5
}

Return ONLY a JSON ARRAY of these objects, with NO markdown code fences, NO commentary, NO explanation. Just the raw JSON array, ready to parse.

If you can't determine a field with confidence, use sensible defaults:
- description: "Premium {category} from our promo collection"
- priceRangeBottom: 5, priceRangeTop: 15 (for promo items)
- colors: ["Black"], colorCodes: ["#000000"]
- imageUrls: []
- tag: "New Arrival"
- rating: 5`;

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
  const [ssOverrideCat, setSsOverrideCat] = React.useState('');
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

  // ────────── PDF/JSON catalog import state ──────────
  const [pdfDefaultTag, setPdfDefaultTag] = React.useState('New Arrival');
  const [pdfDefaultCategory, setPdfDefaultCategory] = React.useState('Promo');
  const [pdfJson, setPdfJson] = React.useState('');
  const [pdfBusy, setPdfBusy] = React.useState(false);
  const [pdfResults, setPdfResults] = React.useState(null);
  const [promptCopied, setPromptCopied] = React.useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CHATGPT_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch (_) {
      alert('Could not copy. Select the prompt text manually and copy with Ctrl/Cmd+C.');
    }
  };

  const runJsonImport = async () => {
    if (!pdfJson.trim()) {
      alert('Paste the JSON array from ChatGPT into the box below first.');
      return;
    }
    let parsed;
    try {
      // Strip ```json fences if ChatGPT included them despite the prompt
      const cleaned = pdfJson.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
      parsed = JSON.parse(cleaned);
    } catch (e) {
      alert('That doesn\'t look like valid JSON. Make sure you copied the entire array, including the [ and ]. Error: ' + e.message);
      return;
    }
    if (!Array.isArray(parsed)) {
      alert('Expected a JSON array of products. Got: ' + typeof parsed);
      return;
    }
    if (parsed.length === 0) {
      alert('The JSON array is empty.');
      return;
    }
    if (parsed.length > 100) {
      if (!window.confirm(`That's ${parsed.length} products. Continue?`)) return;
    }
    setPdfBusy(true);
    setPdfResults(null);
    try {
      const res = await axios.post(
        `${config.backendUrl}/api/products/import-json`,
        {
          products: parsed,
          defaultTag: pdfDefaultTag,
          defaultCategory: pdfDefaultCategory,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPdfResults(res.data);
      if (res.data?.created > 0 || res.data?.updated > 0) {
        setPdfJson(''); // Clear textarea on success
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Import failed';
      alert('Import error: ' + msg);
    } finally {
      setPdfBusy(false);
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
            Manage your product catalog
          </MuiTypography>
        </Box>
        <Button onClick={onLogout} startIcon={<LogoutIcon />} variant="outlined" size="small" sx={{ borderRadius: 2, textTransform: 'none', alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
          Sign out
        </Button>
      </Stack>

      <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant={mobile ? 'scrollable' : 'fullWidth'} scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="S&S Smart Sync" />
          <Tab label="PDF Catalog Import" />
          <Tab label="Manual entry" />
        </Tabs>

        {/* ───────────────── Tab 0: S&S Sync ───────────────── */}
        {tab === 0 && (
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <MuiTypography variant="body2" color="text.secondary" mb={2.5}>
              Drop in one or more S&amp;S style numbers (e.g. <code>3001C</code>, <code>5000</code>, <code>18500</code>).
              We&apos;ll fetch all colors/sizes and auto-detect <em>category</em>,
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

        {/* ───────────────── Tab 1: PDF Catalog Import ───────────────── */}
        {tab === 1 && (
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <MuiTypography variant="body2" color="text.secondary" mb={2.5}>
              Add catalog items (dispensary promos, drinkware, etc.) without manually
              uploading each one. You&apos;ll use ChatGPT (which you already pay for) to
              extract products from the PDF, then paste the result here.
            </MuiTypography>

            {/* Step 1 */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, bgcolor: '#f5fbf7' }}>
              <MuiTypography variant="subtitle1" fontWeight={800} sx={{ mb: 1, color: '#1a3d2b' }}>
                Step 1 — Copy the prompt
              </MuiTypography>
              <MuiTypography variant="body2" color="text.secondary" mb={2}>
                Click below to copy the extraction prompt to your clipboard.
              </MuiTypography>
              <Button
                variant="contained"
                onClick={copyPrompt}
                startIcon={<ContentCopyIcon />}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#0e2218' } }}
              >
                {promptCopied ? '✓ Copied!' : 'Copy extraction prompt'}
              </Button>
            </Paper>

            {/* Step 2 */}
            <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderRadius: 2, bgcolor: '#f5fbf7' }}>
              <MuiTypography variant="subtitle1" fontWeight={800} sx={{ mb: 1, color: '#1a3d2b' }}>
                Step 2 — Paste it into ChatGPT with your PDF
              </MuiTypography>
              <MuiTypography variant="body2" color="text.secondary" mb={2}>
                Open ChatGPT, attach your catalog PDF, paste the prompt, and send.
                ChatGPT will return a JSON array of products.
              </MuiTypography>
              <Button
                variant="outlined"
                component="a"
                href="https://chat.openai.com/"
                target="_blank"
                rel="noopener noreferrer"
                startIcon={<OpenInNewIcon />}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                Open ChatGPT
              </Button>
            </Paper>

            {/* Step 3 */}
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f5fbf7' }}>
              <MuiTypography variant="subtitle1" fontWeight={800} sx={{ mb: 1, color: '#1a3d2b' }}>
                Step 3 — Paste the JSON output here
              </MuiTypography>
              <MuiTypography variant="body2" color="text.secondary" mb={2}>
                Copy ChatGPT&apos;s entire response (the whole array starting with
                <code> [</code> and ending with <code>]</code>) and paste it below.
              </MuiTypography>

              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <FormControl fullWidth>
                    <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Default tag (used if missing in JSON)</MuiTypography>
                    <Select size="small" value={pdfDefaultTag} onChange={(e) => setPdfDefaultTag(e.target.value)}>
                      <MenuItem value="Best Seller">Best Seller</MenuItem>
                      <MenuItem value="New Arrival">New Arrival</MenuItem>
                      <MenuItem value="Clearance">Clearance</MenuItem>
                      <MenuItem value="Our Favorite">Our Favorite</MenuItem>
                      <MenuItem value="Exclusive">Exclusive</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl fullWidth>
                    <MuiTypography variant="caption" sx={{ mb: 0.5 }}>Default category (used if missing)</MuiTypography>
                    <Select size="small" value={pdfDefaultCategory} onChange={(e) => setPdfDefaultCategory(e.target.value)}>
                      <MenuItem value="Promo">Promo</MenuItem>
                      <MenuItem value="Shirts">Shirts</MenuItem>
                      <MenuItem value="Pants">Pants</MenuItem>
                      <MenuItem value="Hoodies">Hoodies</MenuItem>
                      <MenuItem value="Hats">Hats</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <TextField
                  label="JSON output from ChatGPT"
                  placeholder='[{"style": "ABC123", "name": "Insulated Tumbler 20oz", ...}, ...]'
                  multiline
                  minRows={6}
                  maxRows={14}
                  value={pdfJson}
                  onChange={(e) => setPdfJson(e.target.value)}
                  fullWidth
                  sx={{ fontFamily: 'monospace' }}
                  InputProps={{ sx: { fontFamily: 'monospace', fontSize: 13 } }}
                />

                <Button
                  onClick={runJsonImport}
                  disabled={pdfBusy}
                  variant="contained"
                  size="large"
                  startIcon={pdfBusy ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon />}
                  sx={{ borderRadius: 2, py: 1.4, fontWeight: 700, textTransform: 'none' }}
                >
                  {pdfBusy ? 'Importing…' : 'Import products'}
                </Button>

                {pdfResults && (
                  <Box sx={{ mt: 1 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                      <Chip label={`${pdfResults.created || 0} added`} color="success" size="small" />
                      <Chip label={`${pdfResults.updated || 0} updated`} color="info" size="small" />
                      {pdfResults.failed?.length ? (
                        <Chip label={`${pdfResults.failed.length} failed`} color="error" size="small" />
                      ) : null}
                    </Stack>
                    {pdfResults.products?.length > 0 && (
                      <Stack spacing={0.5}>
                        {pdfResults.products.map((p) => (
                          <MuiTypography key={p.style} variant="body2">
                            ✓ {p.style} — {p.name} <em style={{ color: '#666' }}>({p.category})</em>
                          </MuiTypography>
                        ))}
                      </Stack>
                    )}
                    {pdfResults.failed?.length > 0 && (
                      <Stack spacing={0.5} mt={1}>
                        {pdfResults.failed.map((f, i) => (
                          <MuiTypography key={i} variant="body2" color="error">
                            ✗ {f.style || `item #${i + 1}`}: {f.reason}
                          </MuiTypography>
                        ))}
                      </Stack>
                    )}
                  </Box>
                )}
              </Stack>
            </Paper>
          </Box>
        )}

        {/* ───────────────── Tab 2: Manual entry ───────────────── */}
        {tab === 2 && (
          <Box sx={{ p: { xs: 2.5, sm: 4 } }}>
            <MuiTypography variant="body2" color="text.secondary" mb={2.5}>
              Manual entry uses your existing Alpha Broder XML feed. Use this as a fallback
              if neither sync option above has the style you need.
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
