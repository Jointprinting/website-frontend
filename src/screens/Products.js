// src/screens/Products.js
import { React, useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, Divider, Rating, Pagination,
  CircularProgress, Button, Tooltip, TextField, InputAdornment,
  useMediaQuery, Grid, Paper, Avatar, IconButton, Drawer,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import config from '../config.json';
import QuoteDialog from '../common/QuoteDialog';

// ─── constants ───────────────────────────────────────────────────────────────
const BRAND = { bg: '#0c1a11', panel: '#0f2218', green: '#4ade80', muted: 'rgba(255,255,255,0.6)' };

const CATEGORIES = ['All', 'Shirts', 'Hoodies', 'Hats', 'Pants'];

const SS_BRANDS = [
  'Bella + Canvas', 'Gildan', 'Port & Company', 'Port Authority',
  'Sport-Tek', 'Next Level', 'Alternative Apparel', 'Hanes',
  'District', 'Carhartt', 'Jerzees', 'Champion',
  'Independent Trading Co.', 'Comfort Colors', 'LAT Apparel',
];

const TAG_COLOR = { 'Best Seller': 'success', 'New Arrival': 'error', 'Our Favorite': 'warning' };

// ─── ProductCard ─────────────────────────────────────────────────────────────
function ProductCard({ item, isSelected, onToggle, onNavigate }) {
  const imgSrc = item.image || item.productFrontImages?.[0];
  return (
    <Paper
      elevation={isSelected ? 5 : 1}
      sx={{
        borderRadius: 2.5, overflow: 'hidden', position: 'relative',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? '#4ade80' : 'divider',
        transition: 'transform 150ms, box-shadow 150ms, border-color 150ms',
        '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
        display: 'flex', flexDirection: 'column', bgcolor: '#fff',
      }}
    >
      <Box
        onClick={onNavigate}
        sx={{
          cursor: onNavigate ? 'pointer' : 'default',
          position: 'relative', bgcolor: '#f7f7f7',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          minHeight: { xs: 170, sm: 210 },
        }}
      >
        {imgSrc ? (
          <img
            src={imgSrc} alt={item.name} loading="lazy"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box sx={{ width: '100%', height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.disabled">{item.style}</Typography>
          </Box>
        )}
        {item.tag && (
          <Chip
            label={item.tag} size="small" color={TAG_COLOR[item.tag] || 'info'}
            sx={{ position: 'absolute', top: 10, left: 10, fontWeight: 700, fontSize: 11 }}
          />
        )}
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2 }, display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: { xs: 10, sm: 11 } }}>
          {item.vendor}
        </Typography>
        <Typography fontWeight={600} sx={{
          fontSize: { xs: 13, sm: 15 }, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: { xs: 34, sm: 40 },
        }}>
          {item.name}
        </Typography>
        <Rating value={item.rating || 4.5} readOnly size="small" precision={0.5} sx={{ mt: 0.25 }} />
        {(item.priceRangeBottom || item.priceRangeTop) && (
          <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
            <Typography fontWeight={700} sx={{ fontSize: { xs: 13, sm: 14 } }}>
              ${item.priceRangeBottom} – ${item.priceRangeTop}
            </Typography>
            <Typography variant="caption" color="text.secondary" fontSize={10}>est.</Typography>
          </Stack>
        )}
        <Box flexGrow={1} />
        <Button
          variant={isSelected ? 'contained' : 'outlined'}
          size="small" fullWidth
          sx={{
            mt: 1.5, textTransform: 'none', borderRadius: 999, fontSize: { xs: 12, sm: 13 },
            ...(isSelected ? { bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' } } : {}),
          }}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isSelected ? '✓ Added to quote' : '+ Add to quote'}
        </Button>
      </Box>
    </Paper>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────
function SidebarContent({ category, setCategory, activeBrand, setActiveBrand, onClose }) {
  return (
    <Stack sx={{ height: '100%', bgcolor: BRAND.bg, color: '#fff', p: 3, minWidth: 220 }} spacing={3}>
      {onClose && (
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography fontWeight={800} sx={{ color: BRAND.green, letterSpacing: 1 }}>Filters</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: BRAND.muted }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {/* Category */}
      <Box>
        <Typography variant="overline" sx={{ color: BRAND.muted, letterSpacing: 2, fontSize: 10, display: 'block', mb: 1 }}>
          Category
        </Typography>
        <Stack spacing={0.5}>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              onClick={() => { setCategory(cat); onClose?.(); }}
              sx={{
                justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600,
                fontSize: 14, px: 1.5, borderRadius: 1.5,
                color: category === cat ? BRAND.green : BRAND.muted,
                bgcolor: category === cat ? 'rgba(74,222,128,0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: '#fff' },
              }}
            >
              {cat}
            </Button>
          ))}
        </Stack>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />

      {/* Brands */}
      <Box>
        <Typography variant="overline" sx={{ color: BRAND.muted, letterSpacing: 2, fontSize: 10, display: 'block', mb: 1 }}>
          Browse Brand
        </Typography>
        <Stack spacing={0.25}>
          <Button
            onClick={() => { setActiveBrand(''); onClose?.(); }}
            sx={{
              justifyContent: 'flex-start', textTransform: 'none', fontWeight: 600,
              fontSize: 13, px: 1.5, borderRadius: 1.5,
              color: activeBrand === '' ? BRAND.green : BRAND.muted,
              bgcolor: activeBrand === '' ? 'rgba(74,222,128,0.1)' : 'transparent',
              '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: '#fff' },
            }}
          >
            Our Featured Picks
          </Button>
          {SS_BRANDS.map((b) => (
            <Button
              key={b}
              onClick={() => { setActiveBrand(b); onClose?.(); }}
              sx={{
                justifyContent: 'flex-start', textTransform: 'none', fontWeight: 500,
                fontSize: 12, px: 1.5, borderRadius: 1.5,
                color: activeBrand === b ? BRAND.green : BRAND.muted,
                bgcolor: activeBrand === b ? 'rgba(74,222,128,0.1)' : 'transparent',
                '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: '#fff' },
              }}
            >
              {b}
            </Button>
          ))}
        </Stack>
      </Box>

      {/* Decorative brand mark */}
      <Box sx={{ flexGrow: 1 }} />
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.06)', pt: 2 }}>
        <Typography sx={{
          fontFamily: 'ui-monospace, "SF Mono", monospace',
          fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.18)',
          textTransform: 'uppercase', lineHeight: 1.8,
        }}>
          JOINT<br />PRINTING
        </Typography>
      </Box>
    </Stack>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
function Products() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:768px)');

  const [category, setCategory] = useState('All');
  const [activeBrand, setActiveBrand] = useState('');     // '' = our DB products
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // DB products (featured picks)
  const [dbProducts, setDbProducts] = useState([]);
  const [dbPages, setDbPages] = useState(0);
  const [dbLoading, setDbLoading] = useState(true);

  // S&S brand browse
  const [browseProducts, setBrowseProducts] = useState([]);
  const [browsePages, setBrowsePages] = useState(0);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  // Quote tray
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const PER_PAGE = 24;
  const isBrowse = activeBrand !== '';

  // ── sessionStorage tray ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = window.sessionStorage.getItem('jpSelectedProducts');
      if (s) { const p = JSON.parse(s); if (Array.isArray(p)) setSelectedProducts(p); }
    } catch (_) {}
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts)); } catch (_) {}
  }, [selectedProducts]);

  // ── search debounce ───────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 600);
    return () => clearTimeout(t);
  }, [searchInput]);

  // reset page when brand / category changes
  useEffect(() => { setPage(1); }, [activeBrand, category]);

  // ── DB products fetch ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isBrowse) return;
    setDbLoading(true);
    const cat = category === 'All' ? '' : category;
    fetch(`${config.backendUrl}/api/products?page=${page}&limit=${PER_PAGE}&category=${cat}&search=${encodeURIComponent(search)}`)
      .then((r) => r.json())
      .then((d) => { setDbProducts(d.products || []); setDbPages(d.totalPages || 0); })
      .catch(console.error)
      .finally(() => setDbLoading(false));
  }, [isBrowse, page, category, search]);

  // ── S&S brand browse fetch ────────────────────────────────────────────────
  const fetchBrowse = useCallback(async () => {
    if (!activeBrand) return;
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const cat = category === 'All' ? '' : category;
      const url = `${config.backendUrl}/api/products/ss/browse?brand=${encodeURIComponent(activeBrand)}&page=${page}&limit=${PER_PAGE}&search=${encodeURIComponent(search)}&category=${cat}`;
      const res = await fetch(url);
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not load catalog');
      setBrowseProducts(d.products || []);
      setBrowsePages(d.totalPages || 0);
      setBrowseTotal(d.total || 0);
    } catch (err) {
      setBrowseError(err.message || 'Could not load catalog. Please try again.');
    } finally {
      setBrowseLoading(false);
    }
  }, [activeBrand, page, category, search]);

  useEffect(() => {
    if (isBrowse) fetchBrowse();
  }, [isBrowse, fetchBrowse]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const toggleSelected = (item) => {
    setSelectedProducts((cur) => {
      if (cur.some((p) => p.style === item.style)) return cur.filter((p) => p.style !== item.style);
      return [...cur, {
        style: item.style, name: item.name, vendor: item.vendor, tag: item.tag,
        thumbnail: item.image || item.productFrontImages?.[0] || '',
      }];
    });
  };

  const products = isBrowse ? browseProducts : dbProducts;
  const totalPages = isBrowse ? browsePages : dbPages;
  const loading = isBrowse ? browseLoading : dbLoading;

  // ── render ────────────────────────────────────────────────────────────────
  const SIDEBAR_W = 230;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f5f5', position: 'relative' }}>

      {/* ── DESKTOP SIDEBAR ─────────────────────────────────────────────── */}
      {!isMobile && (
        <Box sx={{
          width: SIDEBAR_W, flexShrink: 0, position: 'sticky', top: 0,
          height: '100vh', overflowY: 'auto',
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          <SidebarContent
            category={category} setCategory={setCategory}
            activeBrand={activeBrand} setActiveBrand={setActiveBrand}
            onClose={null}
          />
        </Box>
      )}

      {/* ── MOBILE DRAWER ───────────────────────────────────────────────── */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 260, bgcolor: BRAND.bg } }}>
        <SidebarContent
          category={category} setCategory={setCategory}
          activeBrand={activeBrand} setActiveBrand={setActiveBrand}
          onClose={() => setDrawerOpen(false)}
        />
      </Drawer>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────── */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* TOP SEARCH + HEADER BAR */}
        <Box sx={{
          bgcolor: BRAND.bg,
          px: { xs: 2, sm: 3, md: 4 }, py: { xs: 1.5, sm: 2 },
          position: 'sticky', top: 0, zIndex: 100,
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isMobile && (
              <IconButton onClick={() => setDrawerOpen(true)} sx={{ color: BRAND.green, flexShrink: 0 }}>
                <FilterListIcon />
              </IconButton>
            )}
            <Box sx={{ flexGrow: 1 }}>
              <TextField
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search styles, brands, categories…"
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} /></InputAdornment>,
                  sx: {
                    bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 2,
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
                    '&:hover fieldset': { borderColor: 'rgba(74,222,128,0.5)' },
                    '&.Mui-focused fieldset': { borderColor: BRAND.green },
                    '& input': { color: '#fff' },
                    '& input::placeholder': { color: 'rgba(255,255,255,0.35)', opacity: 1 },
                  },
                }}
              />
            </Box>
            {search && (
              <Chip
                label={`"${search}"`} size="small" variant="outlined"
                onDelete={() => { setSearch(''); setSearchInput(''); }}
                sx={{ color: BRAND.green, borderColor: BRAND.green, '& .MuiChip-deleteIcon': { color: BRAND.green } }}
              />
            )}
          </Stack>
        </Box>

        {/* PAGE TITLE + CONTEXT */}
        <Box sx={{ px: { xs: 2, sm: 3, md: 4 }, pt: { xs: 2.5, sm: 3 }, pb: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 3 }}>
            STEP 1 · PICK YOUR BLANKS
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'baseline' }} spacing={{ sm: 1.5 }} mt={0.5}>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 22, sm: 28 } }}>
              {activeBrand ? activeBrand : 'Our Catalog'}
            </Typography>
            {isBrowse && browseTotal > 0 && !browseLoading && (
              <Typography variant="body2" color="text.secondary">
                {browseTotal} style{browseTotal !== 1 ? 's' : ''}
              </Typography>
            )}
          </Stack>
          {isBrowse && (
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              Browsing the full {activeBrand} lineup — add what you like and we'll quote it for you.
            </Typography>
          )}
        </Box>

        {/* PRODUCT GRID AREA */}
        <Box sx={{ flex: 1, px: { xs: 2, sm: 3, md: 4 }, pb: selectedProducts.length > 0 ? { xs: 14, sm: 12 } : 5 }}>

          {loading && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="55vh" gap={2}>
              <CircularProgress size={44} thickness={4} sx={{ color: '#1a3d2b' }} />
              <Typography variant="body2" color="text.secondary">
                {isBrowse ? `Loading ${activeBrand}…` : 'Loading catalog…'}
              </Typography>
            </Box>
          )}

          {!loading && browseError && isBrowse && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="40vh" gap={2}>
              <Typography color="error.main" textAlign="center" maxWidth={400}>{browseError}</Typography>
              <Button variant="outlined" onClick={fetchBrowse} sx={{ textTransform: 'none' }}>Retry</Button>
              <Button color="inherit" size="small" onClick={() => setActiveBrand('')} sx={{ textTransform: 'none' }}>
                Back to featured picks
              </Button>
            </Box>
          )}

          {!loading && !browseError && products.length === 0 && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="40vh" gap={1.5}>
              <Typography color="text.secondary">No styles found.</Typography>
              {search && (
                <Button size="small" variant="outlined" onClick={() => { setSearch(''); setSearchInput(''); }} sx={{ textTransform: 'none' }}>
                  Clear search
                </Button>
              )}
            </Box>
          )}

          {!loading && !browseError && products.length > 0 && (
            <>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {products.map((item, idx) => {
                  const isSelected = selectedProducts.some((p) => p.style === item.style);
                  return (
                    <Grid item xs={6} sm={4} md={4} lg={3} key={item._id || item.style || idx}>
                      <ProductCard
                        item={item}
                        isSelected={isSelected}
                        onToggle={() => toggleSelected(item)}
                        onNavigate={!isBrowse ? () => navigate('/product?styleCode=' + item.style) : null}
                      />
                    </Grid>
                  );
                })}
              </Grid>
              {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 4, mb: 2 }}>
                  <Pagination count={totalPages} page={page} onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* ── STICKY QUOTE BAR ────────────────────────────────────────────── */}
      {selectedProducts.length > 0 && (
        <Box sx={{
          position: 'fixed', bottom: { xs: 10, sm: 16 }, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'background.paper', boxShadow: 8, borderRadius: 999,
          px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 1.25 },
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          zIndex: 1300, border: '1px solid', borderColor: 'rgba(26,61,43,0.3)',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedProducts.slice(0, isMobile ? 3 : 5).map((p) => (
              <Tooltip key={p.style} title={`Remove ${p.name || ''}`} arrow placement="top">
                <Box
                  onClick={() => setSelectedProducts((c) => c.filter((x) => x.style !== p.style))}
                  sx={{ position: 'relative', cursor: 'pointer', '&:hover .rx': { opacity: 1 } }}
                >
                  <Avatar src={p.thumbnail || undefined}
                    sx={{ width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, fontSize: 12 }}>
                    {p.name?.[0] || '?'}
                  </Avatar>
                  <Box className="rx" sx={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 150ms',
                  }}>
                    <CloseIcon sx={{ color: '#fff', fontSize: 13 }} />
                  </Box>
                </Box>
              </Tooltip>
            ))}
            {selectedProducts.length > (isMobile ? 3 : 5) && (
              <Avatar sx={{ width: isMobile ? 26 : 30, height: isMobile ? 26 : 30, fontSize: 11, bgcolor: 'grey.400' }}>
                +{selectedProducts.length - (isMobile ? 3 : 5)}
              </Avatar>
            )}
          </Stack>
          <Typography variant="body2" sx={{ fontSize: { xs: 12, sm: 14 }, whiteSpace: 'nowrap', color: 'text.secondary' }}>
            {selectedProducts.length} {selectedProducts.length === 1 ? 'item' : 'items'}
          </Typography>
          {!isMobile && <Divider orientation="vertical" flexItem />}
          <Button
            variant="contained" size="small"
            sx={{
              textTransform: 'none', borderRadius: 999, whiteSpace: 'nowrap',
              fontSize: { xs: 12, sm: 13 }, bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
            }}
            onClick={() => setQuoteOpen(true)}
          >
            {isMobile ? 'Get quote' : 'Request mockup & quote'}
          </Button>
        </Box>
      )}

      <QuoteDialog
        open={quoteOpen}
        onClose={(submitted) => { setQuoteOpen(false); if (submitted) setSelectedProducts([]); }}
        products={selectedProducts}
      />
    </Box>
  );
}

export default Products;
