// src/screens/Products.js
import { React, useState, useEffect, useCallback } from 'react';
import {
  Box, Stack, Typography, Chip, Divider, Rating, Pagination,
  CircularProgress, Menu, Button, MenuItem, Tooltip, ToggleButton,
  ToggleButtonGroup, TextField, InputAdornment, Select, FormControl,
  InputLabel, useMediaQuery, Grid, Paper, Avatar,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import CloseIcon from '@mui/icons-material/Close';
import config from '../config.json';
import QuoteDialog from '../common/QuoteDialog';

const TAG_COLOR = { 'Best Seller': 'success', 'New Arrival': 'error', 'Our Favorite': 'warning' };

const SS_BRANDS = [
  'Bella + Canvas', 'Gildan', 'Port & Company', 'Port Authority',
  'Sport-Tek', 'Next Level', 'Alternative Apparel', 'Hanes',
  'District', 'Carhartt', 'Jerzees', 'Champion',
  'Independent Trading Co.', 'Comfort Colors', 'LAT Apparel',
];

function ProductCard({ item, isSelected, onToggle, onNavigate, isBrowse }) {
  return (
    <Paper
      elevation={isSelected ? 6 : 2}
      sx={{
        borderRadius: 3, overflow: 'hidden', cursor: 'pointer', position: 'relative',
        border: isSelected ? '2px solid' : '1px solid',
        borderColor: isSelected ? 'secondary.main' : 'divider',
        transition: 'transform 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out',
        '&:hover': { transform: 'translateY(-4px)', boxShadow: 6 },
        display: 'flex', flexDirection: 'column', bgcolor: 'background.paper',
      }}
    >
      <Box
        onClick={onNavigate}
        sx={{
          position: 'relative', bgcolor: '#f5f5f5', display: 'flex',
          justifyContent: 'center', alignItems: 'center',
          minHeight: { xs: 180, sm: 220, md: 260 },
        }}
      >
        {item.image || (item.productFrontImages && item.productFrontImages[0]) ? (
          <img
            src={item.image || item.productFrontImages[0]}
            alt={item.name}
            loading="lazy"
            style={{ maxHeight: 260, width: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Box sx={{ width: '100%', height: 220, bgcolor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="caption" color="text.secondary">{item.style}</Typography>
          </Box>
        )}
        {item.tag && (
          <Chip
            label={item.tag}
            color={TAG_COLOR[item.tag] || 'info'}
            size="small"
            sx={{ position: 'absolute', top: 12, left: 12, fontWeight: 600 }}
          />
        )}
      </Box>

      <Box sx={{ p: { xs: 1.5, sm: 2.2 }, display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1, fontSize: { xs: 10, sm: 12 } }}>
          {item.vendor}
        </Typography>
        <Typography variant="body1" fontWeight={600} sx={{
          minHeight: { xs: 32, sm: 40 }, fontSize: { xs: 13, sm: 16 },
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {item.name}
        </Typography>
        <Stack direction="row" alignItems="center" sx={{ mt: 0.5 }}>
          <Rating value={item.rating || 4.5} readOnly size="small" precision={0.5} />
        </Stack>
        {(item.priceRangeBottom || item.priceRangeTop) && (
          <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mt: 0.75 }}>
            <Typography variant="body2" fontWeight={700} sx={{ fontSize: { xs: 13, sm: 15 }, color: 'text.primary' }}>
              ${item.priceRangeBottom} – ${item.priceRangeTop}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: { xs: 10, sm: 11 } }}>est.</Typography>
          </Stack>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          variant={isSelected ? 'contained' : 'outlined'}
          size="small"
          sx={{ mt: 1.5, textTransform: 'none', borderRadius: 999, fontSize: { xs: 12, sm: 14 } }}
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {isSelected ? '✓ Added' : '+ Add to quote'}
        </Button>
      </Box>
    </Paper>
  );
}

function Products() {
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 600px)');

  // ── Mode: 'curated' = our DB products | 'browse' = live S&S ──
  const [mode, setMode] = useState('curated');

  // Curated state
  const [page, setPage] = useState(1);
  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorElType, setAnchorElType] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [products, setProducts] = useState([]);

  // Browse S&S state
  const [browseBrand, setBrowseBrand] = useState(SS_BRANDS[0]);
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseSearchInput, setBrowseSearchInput] = useState('');
  const [browsePage, setBrowsePage] = useState(1);
  const [browseProducts, setBrowseProducts] = useState([]);
  const [browseTotal, setBrowseTotal] = useState(0);
  const [browseTotalPages, setBrowseTotalPages] = useState(0);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState('');

  // Quote tray
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  const imagesPerPage = 24;

  const open = Boolean(anchorEl);
  const openType = Boolean(anchorElType);

  // Load from sessionStorage
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) { const p = JSON.parse(stored); if (Array.isArray(p)) setSelectedProducts(p); }
    } catch (e) {}
  }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts)); } catch (e) {}
  }, [selectedProducts]);

  // ── Curated product fetch ──
  useEffect(() => {
    if (mode !== 'curated') return;
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const url = `${config.backendUrl}/api/products?page=${page}&limit=${imagesPerPage}&category=${selectedCategory}&type=${selectedType}&search=${encodeURIComponent(search)}`;
        const res = await fetch(url);
        const data = await res.json();
        setProducts(data.products || []);
        setNumPages(data.totalPages || 0);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchProducts();
  }, [page, selectedCategory, selectedType, search, mode]);

  // ── Browse S&S fetch ──
  const fetchBrowse = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError('');
    try {
      const url = `${config.backendUrl}/api/products/ss/browse?brand=${encodeURIComponent(browseBrand)}&page=${browsePage}&limit=${imagesPerPage}&search=${encodeURIComponent(browseSearch)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setBrowseProducts(data.products || []);
      setBrowseTotal(data.total || 0);
      setBrowseTotalPages(data.totalPages || 0);
    } catch (err) {
      setBrowseError(err.message || 'Could not load S&S catalog. Please try again.');
    } finally {
      setBrowseLoading(false);
    }
  }, [browseBrand, browsePage, browseSearch]);

  useEffect(() => {
    if (mode === 'browse') fetchBrowse();
  }, [mode, fetchBrowse]);

  const toggleSelected = (item) => {
    setSelectedProducts((cur) => {
      const exists = cur.some((p) => p.style === item.style);
      if (exists) return cur.filter((p) => p.style !== item.style);
      return [...cur, {
        style: item.style, name: item.name, vendor: item.vendor, tag: item.tag,
        thumbnail: item.image || (item.productFrontImages?.[0]) || '',
      }];
    });
  };

  const getTagCode = (tag) => TAG_COLOR[tag] || 'info';

  const handleClearFilters = () => {
    setSelectedCategory(''); setSelectedType(''); setSearch(''); setSearchInput(''); setPage(1);
  };

  // Search on Enter or after 600ms debounce
  useEffect(() => {
    const timer = setTimeout(() => { setSearch(searchInput); setPage(1); }, 600);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => { setBrowseSearch(browseSearchInput); setBrowsePage(1); }, 600);
    return () => clearTimeout(timer);
  }, [browseSearchInput]);

  const handleModeChange = (_, newMode) => {
    if (newMode) setMode(newMode);
  };

  return (
    <Box bgcolor="#f5f5f5" minHeight="100vh">
      <Stack
        py={mobile ? 3 : 5}
        px={mobile ? 2 : '4vw'}
        pb={selectedProducts.length > 0 ? (mobile ? 14 : 10) : (mobile ? 3 : 5)}
        spacing={3}
        maxWidth={1240}
        mx="auto"
      >
        {/* HEADER */}
        <Stack spacing={0.5}>
          <Typography variant="overline" sx={{ letterSpacing: 3, color: 'text.secondary' }}>
            STEP 1 · PICK YOUR BLANKS
          </Typography>
          <Stack direction={mobile ? 'column' : 'row'} alignItems={mobile ? 'flex-start' : 'center'} justifyContent="space-between" spacing={1}>
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 26, sm: 34 } }}>
              Build your merch lineup
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
              Choose the pieces you like, drop them in your quote tray, and we'll handle mockups, pricing, and print details.
            </Typography>
          </Stack>
        </Stack>

        {/* MODE TOGGLE */}
        <ToggleButtonGroup value={mode} exclusive onChange={handleModeChange} size="small" sx={{ alignSelf: 'flex-start' }}>
          <ToggleButton value="curated" sx={{ textTransform: 'none', px: 2.5 }}>Our Products</ToggleButton>
          <ToggleButton value="browse" sx={{ textTransform: 'none', px: 2.5 }}>Browse All S&S Brands</ToggleButton>
        </ToggleButtonGroup>

        {/* ── CURATED MODE ── */}
        {mode === 'curated' && (
          <>
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', px: mobile ? 2 : 3, py: 1.5, bgcolor: 'background.paper' }}>
              <Stack direction={mobile ? 'column' : 'row'} alignItems={mobile ? 'stretch' : 'center'} justifyContent="space-between" spacing={mobile ? 1.5 : 2}>
                {/* Search */}
                <TextField
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search products…"
                  size="small"
                  sx={{ minWidth: 200, flex: 1, maxWidth: 320 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                />

                <Stack direction="row" spacing={mobile ? 1 : 2} alignItems="center" flexWrap="wrap" useFlexGap>
                  {!mobile && <Typography variant="subtitle2" color="text.secondary">Filter:</Typography>}

                  <Button id="category-button" onClick={(e) => setAnchorEl(e.currentTarget)} size="small" variant="outlined" sx={{ flexGrow: { xs: 1, sm: 0 } }}>
                    {selectedCategory || 'Category'}
                  </Button>
                  <Menu anchorEl={anchorEl} open={open} onClose={() => setAnchorEl(null)} MenuListProps={{ 'aria-labelledby': 'category-button' }}>
                    {['', 'Shirts', 'Pants', 'Hoodies', 'Hats'].map((c) => (
                      <MenuItem key={c} onClick={() => { setAnchorEl(null); setSelectedCategory(c); setPage(1); }}>{c || 'All'}</MenuItem>
                    ))}
                  </Menu>

                  <Button id="type-button" onClick={(e) => setAnchorElType(e.currentTarget)} size="small" variant="outlined" sx={{ flexGrow: { xs: 1, sm: 0 } }}>
                    {selectedType || 'Fit / Type'}
                  </Button>
                  <Menu anchorEl={anchorElType} open={openType} onClose={() => setAnchorElType(null)} MenuListProps={{ 'aria-labelledby': 'type-button' }}>
                    {['', 'Unisex', 'Male', 'Female', 'Kids'].map((t) => (
                      <MenuItem key={t} onClick={() => { setAnchorElType(null); setSelectedType(t); setPage(1); }}>{t || 'All'}</MenuItem>
                    ))}
                  </Menu>
                </Stack>

                {/* Active chips + clear */}
                {(selectedCategory || selectedType || search) && (
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {selectedCategory && <Chip label={selectedCategory} size="small" onDelete={() => setSelectedCategory('')} />}
                    {selectedType && <Chip label={selectedType} size="small" onDelete={() => setSelectedType('')} />}
                    {search && <Chip label={`"${search}"`} size="small" onDelete={() => { setSearch(''); setSearchInput(''); }} />}
                    <Button size="small" color="inherit" onClick={handleClearFilters} sx={{ textTransform: 'none' }}>Clear</Button>
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Divider />

            {loading ? (
              <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="60vh" gap={2}>
                <CircularProgress size={48} thickness={4} />
                <Typography variant="body2" color="text.secondary">Loading your merch lineup…</Typography>
              </Box>
            ) : products.length > 0 ? (
              <Grid container spacing={mobile ? 2 : 3} sx={{ mt: 1 }}>
                {products.map((item, index) => {
                  const isSelected = selectedProducts.some((p) => p.style === item.style);
                  return (
                    <Grid item xs={6} sm={6} md={4} lg={3} key={item._id || index}>
                      <ProductCard
                        item={item}
                        isSelected={isSelected}
                        onToggle={() => toggleSelected(item)}
                        onNavigate={() => navigate('/product?styleCode=' + item.style)}
                        isBrowse={false}
                      />
                    </Grid>
                  );
                })}
              </Grid>
            ) : (
              <Box height="40vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={1.5}>
                <Typography color="text.secondary">No products found.</Typography>
                {(selectedCategory || selectedType || search) && (
                  <Button size="small" onClick={handleClearFilters} variant="outlined" sx={{ textTransform: 'none' }}>Clear filters</Button>
                )}
                <Typography variant="caption" color="text.secondary">
                  Want to see more? Switch to "Browse All S&S Brands" above.
                </Typography>
              </Box>
            )}

            <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
              <Pagination count={numPages} page={page} onChange={(_, v) => setPage(v)} size={mobile ? 'small' : 'medium'} />
            </Stack>
          </>
        )}

        {/* ── BROWSE S&S MODE ── */}
        {mode === 'browse' && (
          <>
            <Paper elevation={0} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', px: mobile ? 2 : 3, py: 1.5, bgcolor: 'background.paper' }}>
              <Stack direction={mobile ? 'column' : 'row'} spacing={2} alignItems={mobile ? 'stretch' : 'center'}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Brand</InputLabel>
                  <Select value={browseBrand} label="Brand" onChange={(e) => { setBrowseBrand(e.target.value); setBrowsePage(1); }}>
                    {SS_BRANDS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField
                  value={browseSearchInput}
                  onChange={(e) => setBrowseSearchInput(e.target.value)}
                  placeholder="Search styles…"
                  size="small"
                  sx={{ flex: 1, maxWidth: 300 }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment> }}
                />
                {browseTotal > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {browseTotal} style{browseTotal !== 1 ? 's' : ''}
                  </Typography>
                )}
              </Stack>
            </Paper>

            {browseLoading && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh" gap={2}>
                <CircularProgress size={48} thickness={4} />
                <Typography variant="body2" color="text.secondary">Loading {browseBrand} catalog…</Typography>
              </Box>
            )}

            {browseError && !browseLoading && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="40vh" gap={2}>
                <Typography color="error.main">{browseError}</Typography>
                <Button variant="outlined" onClick={fetchBrowse} sx={{ textTransform: 'none' }}>Retry</Button>
              </Box>
            )}

            {!browseLoading && !browseError && browseProducts.length > 0 && (
              <>
                <Grid container spacing={mobile ? 2 : 3} sx={{ mt: 1 }}>
                  {browseProducts.map((item, idx) => {
                    const isSelected = selectedProducts.some((p) => p.style === item.style);
                    return (
                      <Grid item xs={6} sm={6} md={4} lg={3} key={item.style || idx}>
                        <ProductCard
                          item={item}
                          isSelected={isSelected}
                          onToggle={() => toggleSelected(item)}
                          onNavigate={() => {}}
                          isBrowse={true}
                        />
                      </Grid>
                    );
                  })}
                </Grid>
                <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
                  <Pagination count={browseTotalPages} page={browsePage} onChange={(_, v) => setBrowsePage(v)} size={mobile ? 'small' : 'medium'} />
                </Stack>
              </>
            )}

            {!browseLoading && !browseError && browseProducts.length === 0 && (
              <Box height="40vh" display="flex" alignItems="center" justifyContent="center">
                <Typography color="text.secondary">No styles found for this brand/search.</Typography>
              </Box>
            )}
          </>
        )}
      </Stack>

      {/* STICKY QUOTE BAR */}
      {selectedProducts.length > 0 && (
        <Box sx={{
          position: 'fixed', bottom: { xs: 12, sm: 16 }, left: '50%', transform: 'translateX(-50%)',
          bgcolor: 'background.paper', boxShadow: 6, borderRadius: 999,
          px: { xs: 1.5, sm: 3 }, py: { xs: 1, sm: 1.5 },
          display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 },
          zIndex: 1300, border: '1px solid', borderColor: 'secondary.light',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {selectedProducts.slice(0, mobile ? 3 : 4).map((p) => (
              <Tooltip key={p.style} title={`Remove ${p.name || 'product'}`} arrow placement="top">
                <Box
                  onClick={() => setSelectedProducts((cur) => cur.filter((x) => x.style !== p.style))}
                  sx={{ position: 'relative', cursor: 'pointer', borderRadius: '50%', '&:hover .remove-x': { opacity: 1 } }}
                >
                  <Avatar src={p.thumbnail || undefined} sx={{ width: mobile ? 26 : 30, height: mobile ? 26 : 30, fontSize: 12 }}>
                    {p.name ? p.name.charAt(0) : '?'}
                  </Avatar>
                  <Box className="remove-x" sx={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    bgcolor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    opacity: 0, transition: 'opacity 150ms',
                  }}>
                    <CloseIcon sx={{ color: 'white', fontSize: 14 }} />
                  </Box>
                </Box>
              </Tooltip>
            ))}
            {selectedProducts.length > (mobile ? 3 : 4) && (
              <Avatar sx={{ width: mobile ? 26 : 30, height: mobile ? 26 : 30, fontSize: 11, bgcolor: 'grey.400' }}>
                +{selectedProducts.length - (mobile ? 3 : 4)}
              </Avatar>
            )}
          </Stack>
          <Typography variant="body2" sx={{ fontSize: { xs: 12, sm: 14 }, whiteSpace: 'nowrap' }}>
            {mobile ? `${selectedProducts.length} item${selectedProducts.length > 1 ? 's' : ''}` : `${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''} in tray`}
          </Typography>
          {!mobile && <Divider orientation="vertical" flexItem />}
          <Button variant="contained" size="small" color="secondary"
            sx={{ textTransform: 'none', borderRadius: 999, fontSize: { xs: 12, sm: 14 }, whiteSpace: 'nowrap' }}
            onClick={() => setQuoteDialogOpen(true)}>
            {mobile ? 'Get quote' : 'Request mockup & quote'}
          </Button>
        </Box>
      )}

      <QuoteDialog
        open={quoteDialogOpen}
        onClose={(submitted) => { setQuoteDialogOpen(false); if (submitted) setSelectedProducts([]); }}
        products={selectedProducts}
      />
    </Box>
  );
}

export default Products;
