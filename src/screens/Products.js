// src/screens/Products.js
import { React, useState, useEffect } from 'react';
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
const SIDEBAR_BG  = '#0c1a11';
const GREEN       = '#4ade80';
const MUTED       = 'rgba(255,255,255,0.55)';
const SIDEBAR_W   = 220;

const CATEGORIES = ['All', 'Shirts', 'Hoodies', 'Hats', 'Pants'];

const BRANDS = [
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
    <Paper elevation={isSelected ? 5 : 1} sx={{
      borderRadius: 2.5, overflow: 'hidden', position: 'relative',
      border: isSelected ? '2px solid #1a3d2b' : '1px solid',
      borderColor: isSelected ? '#4ade80' : 'divider',
      transition: 'transform 140ms, box-shadow 140ms',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
      display: 'flex', flexDirection: 'column', bgcolor: '#fff',
    }}>
      <Box onClick={onNavigate} sx={{
        cursor: onNavigate ? 'pointer' : 'default',
        position: 'relative', bgcolor: '#f7f7f7',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: { xs: 160, sm: 210 },
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={item.name} loading="lazy"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain' }} />
        ) : (
          <Box sx={{ width: '100%', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.disabled">{item.style}</Typography>
          </Box>
        )}
        {item.tag && (
          <Chip label={item.tag} size="small" color={TAG_COLOR[item.tag] || 'info'}
            sx={{ position: 'absolute', top: 10, left: 10, fontWeight: 700, fontSize: 11 }} />
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
          variant={isSelected ? 'contained' : 'outlined'} size="small" fullWidth
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

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar({ category, setCategory, vendor, setVendor, onClose }) {
  const navBtn = (label, active, onClick) => (
    <Button key={label} onClick={() => { onClick(); onClose?.(); }}
      sx={{
        justifyContent: 'flex-start', textTransform: 'none', fontWeight: active ? 700 : 500,
        fontSize: 13, px: 1.5, py: 0.6, borderRadius: 1.5, minWidth: 0,
        color: active ? GREEN : MUTED,
        bgcolor: active ? 'rgba(74,222,128,0.1)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: '#fff' },
      }}
    >
      {label}
    </Button>
  );

  return (
    <Stack sx={{ height: '100%', bgcolor: SIDEBAR_BG, p: 2.5, overflowY: 'auto',
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
      spacing={0}
    >
      {onClose && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography fontWeight={800} sx={{ color: GREEN, letterSpacing: 1, fontSize: 13 }}>Filters</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: MUTED }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      {/* Category */}
      <Typography variant="overline"
        sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontSize: 9, display: 'block', mb: 0.5, mt: onClose ? 0 : 1 }}>
        Category
      </Typography>
      <Stack spacing={0}>
        {CATEGORIES.map((c) => navBtn(c, category === c, () => { setCategory(c); setVendor(''); }))}
      </Stack>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', my: 2 }} />

      {/* Brands */}
      <Typography variant="overline"
        sx={{ color: 'rgba(255,255,255,0.3)', letterSpacing: 2, fontSize: 9, display: 'block', mb: 0.5 }}>
        Brand
      </Typography>
      <Stack spacing={0}>
        {navBtn('All brands', vendor === '', () => { setVendor(''); setCategory('All'); })}
        {BRANDS.map((b) => navBtn(b, vendor === b, () => { setVendor(b); setCategory('All'); }))}
      </Stack>

      <Box flexGrow={1} />
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.05)', pt: 2, mt: 3 }}>
        <Typography sx={{
          fontFamily: 'ui-monospace,"SF Mono",monospace',
          fontSize: 9, letterSpacing: 3, color: 'rgba(255,255,255,0.12)',
          textTransform: 'uppercase', lineHeight: 2,
        }}>
          JOINT<br />PRINTING
        </Typography>
      </Box>
    </Stack>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Products() {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width:768px)');

  const [category, setCategory] = useState('All');
  const [vendor, setVendor]     = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]     = useState('');
  const [page, setPage]         = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [products, setProducts] = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading]   = useState(true);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteOpen, setQuoteOpen] = useState(false);

  const PER_PAGE = 24;

  // ── session storage ─────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const s = window.sessionStorage.getItem('jpSelectedProducts');
      if (s) { const p = JSON.parse(s); if (Array.isArray(p)) setSelectedProducts(p); }
    } catch (_) {}
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts)); } catch (_) {}
  }, [selectedProducts]);

  // ── debounce search ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 600);
    return () => clearTimeout(t);
  }, [searchInput]);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [category, vendor]);

  // ── fetch products ───────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    const cat = category === 'All' ? '' : category;
    const params = new URLSearchParams({
      page, limit: PER_PAGE, category: cat, search,
      ...(vendor ? { vendor } : {}),
    });
    fetch(`${config.backendUrl}/api/products?${params}`)
      .then((r) => r.json())
      .then((d) => { setProducts(d.products || []); setTotalPages(d.totalPages || 0); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, category, vendor, search]);

  // ── helpers ──────────────────────────────────────────────────────────────────
  const toggleSelected = (item) => {
    setSelectedProducts((cur) => {
      if (cur.some((p) => p.style === item.style)) return cur.filter((p) => p.style !== item.style);
      return [...cur, {
        style: item.style, name: item.name, vendor: item.vendor, tag: item.tag,
        thumbnail: item.productFrontImages?.[0] || '',
      }];
    });
  };

  const activeFilterLabel = vendor || (category !== 'All' ? category : 'All styles');

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', bgcolor: '#f5f5f5' }}>

      {/* DESKTOP SIDEBAR — sticky column */}
      {!isMobile && (
        <Box sx={{
          width: SIDEBAR_W, flexShrink: 0,
          position: 'sticky', top: 0,
          height: '100vh',
          alignSelf: 'flex-start',
        }}>
          <Sidebar category={category} setCategory={setCategory}
            vendor={vendor} setVendor={setVendor} onClose={null} />
        </Box>
      )}

      {/* MOBILE DRAWER */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 260, bgcolor: SIDEBAR_BG } }}>
        <Sidebar category={category} setCategory={setCategory}
          vendor={vendor} setVendor={setVendor} onClose={() => setDrawerOpen(false)} />
      </Drawer>

      {/* MAIN CONTENT */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>

        {/* SEARCH BAR */}
        <Box sx={{
          bgcolor: SIDEBAR_BG, px: { xs: 1.5, sm: 2.5, md: 3 }, py: 1.5,
          position: 'sticky', top: 0, zIndex: 100,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isMobile && (
              <IconButton onClick={() => setDrawerOpen(true)} size="small"
                sx={{ color: GREEN, border: '1px solid rgba(74,222,128,0.35)', borderRadius: 1.5, p: 0.75, flexShrink: 0 }}>
                <FilterListIcon fontSize="small" />
              </IconButton>
            )}
            <TextField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search styles, brands, categories…"
              size="small" fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.09)',
                  borderRadius: 2,
                  color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.22)' },
                  '&:hover fieldset': { borderColor: 'rgba(74,222,128,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: GREEN },
                },
                '& input': { color: '#fff', fontSize: 14 },
                '& input::placeholder': { color: 'rgba(255,255,255,0.4)', opacity: 1 },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.4)' },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
                ...(search ? {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearch(''); setSearchInput(''); }}
                        sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: '#fff' } }}>
                        <CloseIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                } : {}),
              }}
            />
          </Stack>
        </Box>

        {/* PAGE HEADER */}
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 1 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: 3, fontSize: 10 }}>
            STEP 1 · PICK YOUR BLANKS
          </Typography>
          <Stack direction="row" alignItems="baseline" spacing={1.5} mt={0.5} flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 20, sm: 26 } }}>
              {activeFilterLabel}
            </Typography>
            {!loading && products.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {products.length} style{products.length !== 1 ? 's' : ''}
              </Typography>
            )}
          </Stack>
        </Box>

        {/* GRID */}
        <Box sx={{ flex: 1, px: { xs: 2, sm: 3 }, pb: selectedProducts.length > 0 ? { xs: 14, sm: 12 } : 5 }}>

          {loading && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="55vh" gap={2}>
              <CircularProgress size={44} thickness={4} sx={{ color: '#1a3d2b' }} />
              <Typography variant="body2" color="text.secondary">Loading catalog…</Typography>
            </Box>
          )}

          {!loading && products.length === 0 && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="45vh" gap={1.5}>
              <Typography color="text.secondary" textAlign="center">
                No products found{vendor ? ` for ${vendor}` : ''}.
              </Typography>
              <Button size="small" variant="outlined"
                onClick={() => { setCategory('All'); setVendor(''); setSearch(''); setSearchInput(''); }}
                sx={{ textTransform: 'none' }}>
                Clear filters
              </Button>
            </Box>
          )}

          {!loading && products.length > 0 && (
            <>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {products.map((item, idx) => {
                  const isSel = selectedProducts.some((p) => p.style === item.style);
                  return (
                    <Grid item xs={6} sm={4} md={4} lg={3} key={item._id || item.style || idx}>
                      <ProductCard
                        item={item} isSelected={isSel}
                        onToggle={() => toggleSelected(item)}
                        onNavigate={() => navigate('/product?styleCode=' + item.style)}
                      />
                    </Grid>
                  );
                })}
              </Grid>
              {totalPages > 1 && (
                <Stack alignItems="center" sx={{ mt: 4, mb: 2 }}>
                  <Pagination count={totalPages} page={page}
                    onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
                </Stack>
              )}
            </>
          )}
        </Box>
      </Box>

      {/* STICKY QUOTE BAR */}
      {selectedProducts.length > 0 && (
        <Box sx={{
          position: 'fixed', bottom: { xs: 10, sm: 16 }, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'background.paper', boxShadow: 8, borderRadius: 999,
          px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 1.25 },
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          zIndex: 1300, border: '1px solid rgba(26,61,43,0.25)',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedProducts.slice(0, isMobile ? 3 : 5).map((p) => (
              <Tooltip key={p.style} title={`Remove ${p.name || ''}`} arrow placement="top">
                <Box onClick={() => setSelectedProducts((c) => c.filter((x) => x.style !== p.style))}
                  sx={{ position: 'relative', cursor: 'pointer', '&:hover .rx': { opacity: 1 } }}>
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
          <Button variant="contained" size="small"
            sx={{
              textTransform: 'none', borderRadius: 999, whiteSpace: 'nowrap',
              fontSize: { xs: 12, sm: 13 }, bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
            }}
            onClick={() => setQuoteOpen(true)}>
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
