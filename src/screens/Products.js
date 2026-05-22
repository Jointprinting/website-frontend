import { React, useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, Divider, Rating, Pagination,
  CircularProgress, Button, Tooltip, TextField, InputAdornment,
  useMediaQuery, Grid, Paper, Avatar, IconButton, Drawer,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CloseIcon from '@mui/icons-material/Close';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useSearchParams } from 'react-router-dom';
import config from '../config.json';
import QuoteDialog from '../common/QuoteDialog';

const SIDEBAR_BG  = '#0c1a11';
const GREEN       = '#4ade80';
const MUTED       = 'rgba(255,255,255,0.55)';
const SIDEBAR_W   = 230;
const NAVBAR_H    = 64;

const GARMENT_CATEGORIES = [
  { label: 'All Styles',      value: '' },
  { label: 'T-Shirts',        value: 'T-Shirts' },
  { label: 'Long Sleeve',     value: 'Long Sleeve' },
  { label: 'Hoodies',         value: 'Hoodies' },
  { label: 'Crewnecks',       value: 'Crewnecks' },
  { label: 'Zip-Ups',         value: 'Zip-Ups' },
  { label: 'Tank Tops',       value: 'Tanks' },
  { label: 'Polos',           value: 'Polos' },
  { label: 'Jackets',         value: 'Jackets' },
  { label: 'Pants & Joggers', value: 'Pants' },
  { label: 'Shorts',          value: 'Shorts' },
  { label: 'Hats & Caps',     value: 'Hats' },
];

const GENDER_TYPES = [
  { label: 'All fits',  value: '' },
  { label: "Men's",     value: 'Male' },
  { label: "Women's",   value: 'Female' },
  { label: 'Youth',     value: 'Kids' },
  { label: 'Unisex',    value: 'Unisex' },
];

const TAG_COLOR = { 'Best Seller': 'success', 'New Arrival': 'error', 'Our Favorite': 'warning' };

// Single source of truth for the "Starting at $X" number a card should
// display. Prefers the new priceFrom field; falls back to the legacy
// priceRangeBottom for AlphaBroder / admin-imported products.
function startingPrice(item) {
  const v = Number(item?.priceFrom) || Number(item?.priceRangeBottom) || 0;
  return v > 0 ? v : null;
}

function ProductCard({ item, isSelected, onToggle, onNavigate }) {
  const imgSrc = item.image || item.productFrontImages?.[0];
  const price  = startingPrice(item);
  return (
    <Paper elevation={isSelected ? 5 : 1} onClick={onNavigate} sx={{
      borderRadius: 2.5, overflow: 'hidden', position: 'relative',
      border: isSelected ? '2px solid' : '1px solid',
      borderColor: isSelected ? '#4ade80' : 'divider',
      transition: 'transform 140ms, box-shadow 140ms',
      '&:hover': { transform: 'translateY(-3px)', boxShadow: 5 },
      display: 'flex', flexDirection: 'column', bgcolor: '#fff',
      cursor: onNavigate ? 'pointer' : 'default',
    }}>
      <Box sx={{
        position: 'relative', bgcolor: '#f7f7f7',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: { xs: 150, sm: 200 },
      }}>
        {imgSrc ? (
          <img src={imgSrc} alt={item.name} loading="lazy"
            style={{ maxHeight: 220, width: '100%', objectFit: 'contain' }} />
        ) : (
          <Box sx={{ width: '100%', height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckroomIcon sx={{ fontSize: 52, color: 'rgba(0,0,0,0.1)' }} />
          </Box>
        )}
        {item.tag && (
          <Chip label={item.tag} size="small" color={TAG_COLOR[item.tag] || 'info'}
            sx={{ position: 'absolute', top: 10, left: 10, fontWeight: 700, fontSize: 11 }} />
        )}
        {item.colorCount > 1 && (
          <Chip
            label={`${item.colorCount} colors`}
            size="small" variant="outlined"
            sx={{
              position: 'absolute', top: 10, right: 10, fontSize: 10, height: 20,
              bgcolor: 'rgba(255,255,255,0.88)', borderColor: 'rgba(0,0,0,0.14)',
            }}
          />
        )}
      </Box>

      <Box sx={{ p: { xs: 1.25, sm: 1.75 }, display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
        <Stack direction="row" spacing={0.75} alignItems="baseline" flexWrap="wrap">
          <Typography variant="caption" color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: { xs: 10, sm: 11 } }}>
            {item.vendor}
          </Typography>
          {item.style && (
            <Typography variant="caption" color="text.disabled"
              sx={{ fontSize: { xs: 10, sm: 11 }, fontWeight: 600 }}>
              #{item.style}
            </Typography>
          )}
        </Stack>
        <Typography fontWeight={600} sx={{
          fontSize: { xs: 13, sm: 14 }, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          minHeight: { xs: 34, sm: 38 },
        }}>
          {item.name}
        </Typography>
        <Rating value={item.rating || 4.5} readOnly size="small" precision={0.5} sx={{ mt: 0.25 }} />
        {price && (
          <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 11 } }}>
              Starting at
            </Typography>
            <Typography fontWeight={700} sx={{ fontSize: { xs: 14, sm: 16 } }}>
              ${price}
            </Typography>
          </Stack>
        )}
        {item.sizeRangeBottom && item.sizeRangeTop && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 11 } }}>
            Sizes {item.sizeRangeBottom} – {item.sizeRangeTop}
          </Typography>
        )}
        <Box flexGrow={1} />
        <Button
          variant={isSelected ? 'contained' : 'outlined'} size="small" fullWidth
          sx={{
            mt: 1.25, textTransform: 'none', borderRadius: 999,
            fontSize: { xs: 12, sm: 13 }, fontWeight: 600,
            transition: 'all 140ms ease',
            '&:active': { transform: 'scale(0.96)' },
            ...(isSelected
              ? { bgcolor: '#1a3d2b', borderColor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' } }
              : { borderColor: '#4ade80', borderWidth: 2, color: '#1a3d2b',
                  '&:hover': { bgcolor: 'rgba(74,222,128,0.1)', borderColor: '#22c55e', borderWidth: 2 } }),
          }}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isSelected ? '✓ Added to quote' : '+ Add to quote'}
        </Button>
      </Box>
    </Paper>
  );
}

function Sidebar({ category, setCategory, genderType, setGenderType, onClose }) {
  const navBtn = (label, active, onClick) => (
    <Button key={label} onClick={() => { onClick(); onClose?.(); }}
      sx={{
        justifyContent: 'flex-start', textTransform: 'none', fontWeight: active ? 700 : 500,
        fontSize: 13, px: 1.5, py: 0.6, borderRadius: 1.5, minWidth: 0,
        color: active ? GREEN : MUTED,
        bgcolor: active ? 'rgba(74,222,128,0.1)' : 'transparent',
        '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', color: '#fff' },
      }}>
      {label}
    </Button>
  );

  return (
    <Stack sx={{
      height: '100%', bgcolor: SIDEBAR_BG, p: 2.5, overflowY: 'auto',
      scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
    }} spacing={0}>
      {onClose && (
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography fontWeight={800} sx={{ color: GREEN, letterSpacing: 1, fontSize: 13 }}>Filters</Typography>
          <IconButton onClick={onClose} size="small" sx={{ color: MUTED }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
      <Typography variant="overline"
        sx={{ color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontSize: 9, display: 'block', mb: 0.5, mt: onClose ? 0 : 1 }}>
        Garment Type
      </Typography>
      <Stack spacing={0}>
        {GARMENT_CATEGORIES.map(({ label, value }) =>
          navBtn(label, category === value, () => setCategory(value))
        )}
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.07)', my: 2 }} />
      <Typography variant="overline"
        sx={{ color: 'rgba(255,255,255,0.35)', letterSpacing: 2, fontSize: 9, display: 'block', mb: 0.5 }}>
        Gender / Fit
      </Typography>
      <Stack spacing={0}>
        {GENDER_TYPES.map(({ label, value }) =>
          navBtn(label, genderType === value, () => setGenderType(value))
        )}
      </Stack>
      <Box flexGrow={1} />
      <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', pt: 2, mt: 3 }}>
        <Typography sx={{
          fontFamily: 'ui-monospace,"SF Mono",monospace',
          fontSize: 10, letterSpacing: 3, color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase', lineHeight: 2,
        }}>JOINT<br />PRINTING</Typography>
      </Box>
    </Stack>
  );
}

export default function Products() {
  const navigate  = useNavigate();
  const isMobile  = useMediaQuery('(max-width:768px)');

  const [urlParams, setUrlParams] = useSearchParams();
  const category   = urlParams.get('category') || '';
  const genderType = urlParams.get('type') || '';
  const search     = urlParams.get('q') || '';
  const page       = Math.max(1, parseInt(urlParams.get('page'), 10) || 1);

  const [searchInput, setSearchInput] = useState(search);
  const [drawerOpen,  setDrawerOpen]  = useState(false);

  const [products,   setProducts]   = useState([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [fetchKey,   setFetchKey]   = useState(0);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteOpen,         setQuoteOpen]        = useState(false);

  const PER_PAGE = 24;

  const updateUrl = (mutator) => {
    const next = new URLSearchParams(urlParams);
    mutator(next);
    setUrlParams(next, { replace: false });
  };
  const setCategory = (v) => updateUrl((p) => {
    if (v) p.set('category', v); else p.delete('category');
    p.delete('page');
  });
  const setGenderType = (v) => updateUrl((p) => {
    if (v) p.set('type', v); else p.delete('type');
    p.delete('page');
  });
  const setPage = (n) => updateUrl((p) => {
    if (n > 1) p.set('page', String(n)); else p.delete('page');
  });

  useEffect(() => {
    try {
      const s = window.sessionStorage.getItem('jpSelectedProducts');
      if (s) { const p = JSON.parse(s); if (Array.isArray(p)) setSelectedProducts(p); }
    } catch (_) {}
  }, []);
  useEffect(() => {
    try { window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts)); } catch (_) {}
  }, [selectedProducts]);

  useEffect(() => { setSearchInput(search); }, [search]);

  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      updateUrl((p) => {
        if (searchInput) p.set('q', searchInput); else p.delete('q');
        p.delete('page');
      });
    }, 600);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Single fetch — backend's browseSS already merges Mongo data, so we don't
  // need a separate /ss/details lazy follow-up. /ss/images fallback kept only
  // for catalog rows missing an image URL (rare).
  const doFetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page, limit: PER_PAGE });
    if (category)   params.set('category', category);
    if (genderType) params.set('type', genderType);
    if (search)     params.set('search', search);

    fetch(`${config.backendUrl}/api/products/ss/browse?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.message && !d.products) { setError(d.message); return; }
        const prods = d.products || [];
        setProducts(prods);
        setTotalPages(d.totalPages || 0);
        setTotalItems(d.total || 0);

        const needsImage = prods.filter((p) => !p.image).map((p) => p.style);
        if (needsImage.length > 0) {
          fetch(`${config.backendUrl}/api/products/ss/images?styles=${needsImage.join(',')}`)
            .then((r) => r.json())
            .then(({ images }) => {
              if (!images || !Object.keys(images).length) return;
              setProducts((prev) => prev.map((p) => (images[p.style] ? { ...p, image: images[p.style] } : p)));
            })
            .catch(() => {});
        }
      })
      .catch(() => setError('Could not reach the catalog server. Check your connection and try again.'))
      .finally(() => setLoading(false));
  }, [page, category, genderType, search, fetchKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { doFetch(); }, [doFetch]);

  const toggleSelected = (item) => {
    setSelectedProducts((cur) => {
      if (cur.some((p) => p.style === item.style)) return cur.filter((p) => p.style !== item.style);
      return [...cur, {
        style: item.style, name: item.name, vendor: item.vendor, tag: item.tag,
        thumbnail: item.image || item.productFrontImages?.[0] || '',
      }];
    });
  };

  const hasActiveFilters = category !== '' || genderType !== '' || search !== '';
  const activeLabel = GARMENT_CATEGORIES.find((c) => c.value === category)?.label || 'All Styles';
  const genderLabel = GENDER_TYPES.find((g) => g.value === genderType)?.label;

  const clearFilters = () => {
    setUrlParams(new URLSearchParams(), { replace: false });
    setSearchInput('');
    setFetchKey((k) => k + 1);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {!isMobile && (
        <Box sx={{
          width: SIDEBAR_W, flexShrink: 0,
          position: 'sticky', top: NAVBAR_H, height: `calc(100vh - ${NAVBAR_H}px)`,
          alignSelf: 'flex-start',
        }}>
          <Sidebar category={category} setCategory={setCategory}
            genderType={genderType} setGenderType={setGenderType} onClose={null} />
        </Box>
      )}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: 270, bgcolor: SIDEBAR_BG } }}>
        <Sidebar category={category} setCategory={setCategory}
          genderType={genderType} setGenderType={setGenderType} onClose={() => setDrawerOpen(false)} />
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{
          bgcolor: SIDEBAR_BG, px: { xs: 1.5, sm: 2.5, md: 3 }, py: { xs: 1, sm: 1.5 },
          position: 'sticky', top: { xs: 0, sm: NAVBAR_H }, zIndex: 100,
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            {isMobile && (
              <IconButton onClick={() => setDrawerOpen(true)} size="small"
                sx={{ color: GREEN, border: '1px solid rgba(74,222,128,0.4)', borderRadius: 1.5, p: 0.75, flexShrink: 0 }}>
                <FilterListIcon fontSize="small" />
              </IconButton>
            )}
            <TextField
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search garments, styles…"
              size="small" fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 2, color: '#fff',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.38)' },
                  '&:hover fieldset': { borderColor: 'rgba(74,222,128,0.65)' },
                  '&.Mui-focused fieldset': { borderColor: GREEN, borderWidth: 2 },
                },
                '& input': { color: '#fff', fontSize: 14 },
                '& input::placeholder': { color: 'rgba(255,255,255,0.62)', opacity: 1 },
                '& .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.6)' },
              }}
              InputProps={{
                startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ fontSize: 18 }} /></InputAdornment>),
                ...(searchInput ? {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => { setSearchInput(''); }}
                        sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>
                        <CloseIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </InputAdornment>
                  ),
                } : {}),
              }}
            />
          </Stack>
        </Box>

        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3, pb: 1 }}>
          <Stack direction="row" alignItems="baseline" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight={800} sx={{ fontSize: { xs: 20, sm: 26 } }}>
              {activeLabel}
            </Typography>
            {!loading && !error && totalItems > 0 && (
              <Typography variant="body2" color="text.secondary">
                {totalItems.toLocaleString()} style{totalItems !== 1 ? 's' : ''}
              </Typography>
            )}
          </Stack>
          {genderType && (
            <Chip label={genderLabel} size="small" onDelete={() => setGenderType('')}
              sx={{ mt: 0.75, fontSize: 11, height: 22 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, px: { xs: 1.5, sm: 3 }, pb: selectedProducts.length > 0 ? { xs: 14, sm: 12 } : 5 }}>
          {loading && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="55vh" gap={2}>
              <CircularProgress size={44} thickness={4} sx={{ color: '#1a3d2b' }} />
              <Typography variant="body2" color="text.secondary" textAlign="center">Loading catalog…</Typography>
            </Box>
          )}
          {!loading && error && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="45vh" gap={2}>
              <Typography color="error" textAlign="center" sx={{ maxWidth: 380 }}>{error}</Typography>
              <Button variant="outlined" size="small" startIcon={<RefreshIcon />}
                onClick={() => setFetchKey((k) => k + 1)} sx={{ textTransform: 'none' }}>
                Try again
              </Button>
            </Box>
          )}
          {!loading && !error && products.length === 0 && (
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="45vh" gap={1.5}>
              <Typography color="text.secondary" textAlign="center">
                {hasActiveFilters ? `No styles found${category ? ` in ${activeLabel}` : ''}.` : 'No styles found.'}
              </Typography>
              <Button size="small" variant="outlined"
                startIcon={hasActiveFilters ? null : <RefreshIcon />}
                onClick={clearFilters} sx={{ textTransform: 'none' }}>
                {hasActiveFilters ? 'Clear filters' : 'Try again'}
              </Button>
            </Box>
          )}
          {!loading && !error && products.length > 0 && (
            <>
              <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: 0.5 }}>
                {products.map((item, idx) => {
                  const isSel = selectedProducts.some((p) => p.style === item.style);
                  return (
                    <Grid item xs={6} sm={4} md={4} lg={3} key={item._id || item.style || idx}>
                      <ProductCard
                        item={item} isSelected={isSel}
                        onToggle={() => toggleSelected(item)}
                        onNavigate={() => navigate(
                          '/product?styleCode=' + encodeURIComponent(item.style),
                          { state: { item } },
                        )}
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

      {selectedProducts.length > 0 && (
        <Box sx={{
          position: 'fixed', bottom: { xs: 12, sm: 20 }, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'background.paper', boxShadow: 8, borderRadius: 999,
          px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 1.25 },
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          zIndex: 1300, border: '1px solid rgba(26,61,43,0.25)',
          maxWidth: { xs: 'calc(100vw - 24px)', sm: 600 },
        }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedProducts.slice(0, isMobile ? 3 : 5).map((p) => (
              <Tooltip key={p.style} title={`Remove ${p.name || ''}`} arrow placement="top">
                <Box onClick={() => setSelectedProducts((c) => c.filter((x) => x.style !== p.style))}
                  sx={{ position: 'relative', cursor: 'pointer', '&:hover .rx': { opacity: 1 } }}>
                  <Avatar src={p.thumbnail || undefined} variant="rounded"
                    sx={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, fontSize: 12, bgcolor: '#e8f5e9',
                      '& img': { objectFit: 'contain', p: '2px' } }}>
                    {!p.thumbnail && (p.name?.[0] || '?')}
                  </Avatar>
                  <Box className="rx" sx={{
                    position: 'absolute', inset: 0, borderRadius: 1,
                    bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 150ms',
                  }}>
                    <CloseIcon sx={{ color: '#fff', fontSize: 13 }} />
                  </Box>
                </Box>
              </Tooltip>
            ))}
            {selectedProducts.length > (isMobile ? 3 : 5) && (
              <Avatar sx={{ width: isMobile ? 28 : 32, height: isMobile ? 28 : 32, fontSize: 11, bgcolor: 'grey.300' }}>
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
              fontSize: { xs: 12, sm: 13 }, px: { xs: 1.5, sm: 2.5 },
              bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
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
