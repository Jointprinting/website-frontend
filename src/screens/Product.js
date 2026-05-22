// src/screens/Product.js
import { React, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Chip, Button, Tooltip,
  CircularProgress, Container, Avatar, useMediaQuery, Divider, Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import QuoteDialog from '../common/QuoteDialog';
import config from '../config.json';

const getTagCode = (tag) => {
  switch (tag) {
    case 'Best Seller':  return 'success';
    case 'New Arrival':  return 'error';
    case 'Our Favorite': return 'warning';
    default:             return 'info';
  }
};

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');

const sanitizeHTML = (html) => {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
};

const startingPrice = (item) => {
  const v = Number(item?.priceFrom) || Number(item?.priceRangeBottom) || 0;
  return v > 0 ? v : null;
};

function Product() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = searchParams.get('styleCode');
  const isMobile = useMediaQuery('(max-width:768px)');

  const preloadedItem = location.state?.item || null;

  const [productVendor, setProductVendor]               = useState(preloadedItem?.vendor || '');
  const [productStyle, setProductStyle]                 = useState(preloadedItem?.style || id || '');
  const [productTitle, setProductTitle]                 = useState(preloadedItem?.name || '');
  const [productPriceFrom, setProductPriceFrom]         = useState(startingPrice(preloadedItem) || '');
  const [productSizeRangeBottom, setProductSizeRangeBottom] = useState(preloadedItem?.sizeRangeBottom || '');
  const [productSizeRangeTop, setProductSizeRangeTop]       = useState(preloadedItem?.sizeRangeTop || '');
  const [productTag, setProductTag]                     = useState(preloadedItem?.tag || '');
  const [productTagColor, setProductTagColor]           = useState(getTagCode(preloadedItem?.tag));
  const [productColorOptions, setProductColorOptions]   = useState([]);
  const [productColorCodes, setProductColorCodes]       = useState([]);
  const [productColorCount, setProductColorCount]       = useState(preloadedItem?.colorCount || 0);
  const [productFrontImages, setProductFrontImages]     = useState(preloadedItem?.image ? [preloadedItem.image] : []);
  const [productBackImages, setProductBackImages]       = useState([]);
  const [productColorSwatches, setProductColorSwatches] = useState([]);
  const [productStyleImage,    setProductStyleImage]    = useState(preloadedItem?.image || '');
  const [productDescription, setProductDescription]     = useState('');
  const [frontSelected, setFrontSelected]               = useState(true);
  const [productColor, setProductColor]                 = useState('');
  const [productColorCode, setProductColorCode]         = useState('');
  const [productIndex, setProductIndex]                 = useState(0);
  const [loading, setLoading]                           = useState(!preloadedItem);
  const [error, setError]                               = useState(null);
  const [loadingMessage, setLoadingMessage]             = useState('');

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteDialogOpen, setQuoteDialogOpen]   = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setSelectedProducts(parsed);
      }
    } catch (e) { console.error('Could not load selected products', e); }
  }, []);

  useEffect(() => {
    try { window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts)); }
    catch (e) { console.error('Could not save selected products', e); }
  }, [selectedProducts]);

  useEffect(() => {
    if (!id) return;

    const applyProductData = (data) => {
      setProductVendor(data.vendor || '');
      setProductStyle(data.style || id);
      setProductTitle(data.name || '');
      setProductPriceFrom(startingPrice(data) || '');
      setProductSizeRangeBottom(data.sizeRangeBottom || '');
      setProductSizeRangeTop(data.sizeRangeTop || '');
      setProductTag(data.tag || '');
      setProductTagColor(getTagCode(data.tag));
      const colors = (data.colors || []).map((c) => capitalize(c));
      setProductColorOptions(colors);
      setProductColorCodes(data.colorCodes || []);
      if (colors.length > 0) setProductColorCount(colors.length);
      else if (data.colorCount > 0) setProductColorCount(data.colorCount);
      if (Array.isArray(data.productFrontImages) && data.productFrontImages.some(Boolean)) {
        setProductFrontImages(data.productFrontImages);
      }
      setProductBackImages(data.productBackImages || []);
      setProductColorSwatches(Array.isArray(data.colorSwatches) ? data.colorSwatches : []);
      setProductStyleImage(data.styleImage || preloadedItem?.image || '');
      setProductDescription(data.description || '');
      setProductColor(colors[0] || '');
      setProductColorCode((data.colorCodes && data.colorCodes[0]) || '');
    };

    const fetchProduct = async () => {
      // Only one progressive message — backend now does Mongo lookup + /styles/
      // cache lookup, which is fast. No more 10s wait scenarios.
      const t = setTimeout(() => setLoadingMessage('Loading product details…'), 1500);
      try {
        if (!preloadedItem) setLoading(true);
        const encoded = encodeURIComponent(id);
        const res = await fetch(config.backendUrl + '/api/products/style/' + encoded);
        if (res.ok) {
          applyProductData(await res.json());
          setError(null);
          return;
        }
        if (!preloadedItem) {
          setError("We couldn't load the full details for this style. Please try again or browse other items.");
        }
      } catch (err) {
        console.error(err);
        if (!preloadedItem) {
          setError("We couldn't reach the catalog server. Please check your connection and try again.");
        }
      } finally {
        clearTimeout(t);
        setLoading(false);
        setLoadingMessage('');
      }
    };

    fetchProduct();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSelected = selectedProducts.some((p) => p.style === productStyle && productStyle);

  const buildQuoteEntry = () => {
    const sw = productColorSwatches[productIndex] || null;
    return {
      style:     productStyle,
      name:      productTitle,
      vendor:    productVendor,
      tag:       productTag,
      color:     sw?.name || productColor || '',
      colorHex:  sw?.hex  || productColorCode || '',
      // ALWAYS reflect the selected color. The per-color front shot wins.
      // styleImage is only a fallback when there is no swatch data (older
      // Mongo-only products or styles where S&S hasn't populated colors).
      thumbnail: sw?.front || productFrontImages?.[productIndex] || productStyleImage || productFrontImages?.[0] || '',
    };
  };

  const toggleQuoteForCurrent = () => {
    if (!productStyle) return;
    setSelectedProducts((current) => {
      const exists = current.some((p) => p.style === productStyle);
      if (exists) return current.filter((p) => p.style !== productStyle);
      return [...current, buildQuoteEntry()];
    });
  };

  // Prefer the per-color image from S&S (colorSwatches[i].front). Fall
  // back to productFrontImages (legacy AlphaBroder/Mongo data), then to
  // whatever single image we have.
  const selectedSwatch = productColorSwatches[productIndex] || null;
  const currentFrontImg = selectedSwatch?.front
    || productFrontImages[productIndex]
    || productFrontImages[0]
    || null;
  const currentBackImg = selectedSwatch?.back
    || productBackImages[productIndex]
    || null;
  const displayImg      = frontSelected ? currentFrontImg : (currentBackImg || currentFrontImg);
  const hasRealPrice    = Number(productPriceFrom) > 0;
  const hasRealSize     = !!(productSizeRangeBottom && productSizeRangeTop);
  const hasSwatches     = productColorOptions.length > 0;
  // Show the "available in N colors — confirmed at quote" badge when we
  // know the count but don't have per-color swatches (the current S&S
  // path can't get per-color data, so this is the normal case).
  const showColorCountBadge = !hasSwatches && productColorCount > 1;

  if (error) {
    return (
      <Box bgcolor="#e8e9e3" minHeight="100vh">
        <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <CheckroomIcon sx={{ fontSize: 64, color: 'rgba(0,0,0,0.2)' }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">Style not available</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 380 }}>{error}</Typography>
            <Button variant="contained" startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/products')}
              sx={{
                textTransform: 'none', borderRadius: 999, px: 3,
                bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
              }}>
              Back to catalog
            </Button>
          </Stack>
        </Container>
      </Box>
    );
  }

  return (
    <Box bgcolor="#e8e9e3" minHeight="100vh">
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 }, px: { xs: 2, md: 4 } }}>
        {loading ? (
          <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" height="60vh" gap={2}>
            <CircularProgress size={64} thickness={3.5} />
            {loadingMessage && (
              <Typography color="text.secondary" textAlign="center" sx={{ maxWidth: 320, fontSize: 14 }}>
                {loadingMessage}
              </Typography>
            )}
          </Box>
        ) : (
          <>
          <Button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate('/products');
            }}
            startIcon={<Box component="span" sx={{ fontSize: 16, lineHeight: 1 }}>←</Box>}
            sx={{
              alignSelf: 'flex-start', mb: { xs: 2, md: 3 },
              textTransform: 'none', color: '#1a3d2b', fontWeight: 700, fontSize: 13,
              borderRadius: 999, px: 1.5, py: 0.5,
              '&:hover': { bgcolor: 'rgba(74,222,128,0.12)' },
            }}
          >
            Back to catalog
          </Button>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 6 }}
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
          >
            {/* IMAGES */}
            <Stack direction="row" spacing={2} alignItems="flex-start"
              sx={{ flex: { md: '0 0 50%' }, width: { xs: '100%', md: 'auto' } }}>
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <Box onClick={() => setFrontSelected(true)}
                  sx={{
                    width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 },
                    cursor: 'pointer', borderRadius: 1, bgcolor: 'white', overflow: 'hidden',
                    border: frontSelected ? '2px solid #1a3d2b' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {currentFrontImg
                    ? <Box component="img" src={currentFrontImg} alt="front" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <CheckroomIcon sx={{ fontSize: 24, color: 'rgba(0,0,0,0.15)' }} />}
                </Box>
                {currentBackImg && (
                  <Box onClick={() => setFrontSelected(false)}
                    sx={{
                      width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 },
                      cursor: 'pointer', borderRadius: 1, bgcolor: 'white', overflow: 'hidden',
                      border: !frontSelected ? '2px solid #1a3d2b' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                    <Box component="img" src={currentBackImg} alt="back" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                )}
              </Stack>

              <Box sx={{
                flex: 1, bgcolor: 'white', borderRadius: 2, boxShadow: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: { xs: 260, md: 420 }, overflow: 'hidden',
              }}>
                {displayImg ? (
                  <Box component="img" src={displayImg} alt={productTitle || 'product'}
                    sx={{ width: '100%', height: 'auto', maxHeight: 520, objectFit: 'contain', p: 2 }} />
                ) : loading ? (
                  <Box sx={{
                    width: '85%', height: 360,
                    bgcolor: 'rgba(0,0,0,0.04)', borderRadius: 2,
                    animation: 'jpPulse 1.2s ease-in-out infinite',
                    '@keyframes jpPulse': {
                      '0%, 100%': { opacity: 0.55 },
                      '50%':       { opacity: 0.85 },
                    },
                  }} />
                ) : (
                  <CheckroomIcon sx={{ fontSize: 120, color: 'rgba(0,0,0,0.07)' }} />
                )}
              </Box>
            </Stack>

            {/* DETAILS */}
            <Stack spacing={2.5} sx={{ flex: { md: 1 }, width: '100%', minWidth: 0 }}>
              <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }} flexWrap="wrap" useFlexGap>
                {productVendor && <Typography color="black">{productVendor}</Typography>}
                {productStyle && <Typography color="gray">Style #{productStyle}</Typography>}
                {productTag && <Chip label={productTag} color={productTagColor} variant="outlined" size="small" />}
              </Stack>

              {productTitle && (
                <>
                  <Typography sx={{
                    fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif",
                    fontSize: { xs: 28, sm: 38 }, fontWeight: 900,
                    color: '#1a1a1a', lineHeight: 1.1, letterSpacing: -0.5,
                  }}>
                    {productTitle}
                  </Typography>
                  <Box sx={{ height: 2, width: 48, bgcolor: '#4ade80', borderRadius: 1, mt: 1 }} />
                </>
              )}

              {(hasRealPrice || hasRealSize) && (
                <Stack spacing={{ xs: 1.5, sm: 5 }} direction={{ xs: 'column', sm: 'row' }}>
                  {hasRealPrice && (
                    <Stack spacing={0.25}>
                      <Typography color="gray" sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Starting at
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 26, sm: 32 }, fontWeight: 800, lineHeight: 1.1 }} color="black">
                        ${productPriceFrom}
                      </Typography>
                    </Stack>
                  )}
                  {hasRealSize && (
                    <Stack spacing={0.25}>
                      <Typography color="gray" sx={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
                        Comes in
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 700, lineHeight: 1.1 }} color="black">
                        {productSizeRangeBottom === productSizeRangeTop
                          ? productSizeRangeBottom
                          : `${productSizeRangeBottom} – ${productSizeRangeTop}`}
                      </Typography>
                    </Stack>
                  )}
                </Stack>
              )}

              <Typography color="gray" sx={{ fontSize: { xs: 12, sm: 13 } }}>
                Final price depends on quantity, colors, and print placement — request a free quote below.
              </Typography>

              {hasSwatches ? (
                <>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography color="black" fontWeight="bold">Color selected:</Typography>
                    <Box sx={{
                      width: 24, height: 24, borderRadius: '50%',
                      bgcolor: productColorCode || '#ccc',
                      border: '1px solid white', boxShadow: '0 0 0 1px gray', flexShrink: 0,
                    }} />
                    <Typography color="black" fontWeight="bold">{productColor}</Typography>
                  </Stack>
                  <Box sx={{
                    overflowX: 'auto', WebkitOverflowScrolling: 'touch',
                    width: '100%', py: 1, px: '2px',
                  }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', width: 'fit-content' }}>
                      {productColorOptions.map((item, index) => (
                        <Tooltip title={item} placement="top" arrow key={index}>
                          <Box
                            onClick={() => {
                              setProductColor(item);
                              setProductColorCode(productColorCodes[index]);
                              setProductIndex(index);
                              setFrontSelected(true);
                            }}
                            sx={{
                              cursor: 'pointer',
                              width: { xs: 36, sm: 28 }, height: { xs: 36, sm: 28 },
                              borderRadius: '50%',
                              backgroundColor: productColorCodes[index],
                              border: item === productColor ? '2px solid white' : 'none',
                              boxShadow: item === productColor ? '0 0 0 2px #1a3d2b' : 2,
                              flexShrink: 0, mr: { xs: '10px', sm: '8px' },
                              transition: 'box-shadow 120ms',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                </>
              ) : showColorCountBadge ? (
                <Alert severity="info" icon={false} sx={{
                  fontSize: 13, py: 1.25,
                  bgcolor: 'rgba(74,222,128,0.08)',
                  color: '#1a3d2b',
                  border: '1px solid rgba(74,222,128,0.35)',
                  '& .MuiAlert-message': { py: 0.25, fontWeight: 500 },
                }}>
                  <strong>Available in {productColorCount} colors.</strong> All color options
                  are confirmed in your free mockup — request a quote below and we'll send
                  one within 24 hours.
                </Alert>
              ) : null}

              <Stack spacing={1.5}>
                <Button
                  variant={isSelected ? 'contained' : 'outlined'}
                  size="large"
                  sx={{
                    width: '100%', borderRadius: 2, py: 1.5,
                    fontWeight: 700, textTransform: 'none', fontSize: { xs: 14, sm: 16 },
                    transition: 'all 150ms ease',
                    '&:active': { transform: 'scale(0.98)' },
                    ...(isSelected
                      ? { bgcolor: '#1a3d2b', borderColor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' } }
                      : { borderColor: '#4ade80', borderWidth: 2, color: '#1a3d2b',
                          '&:hover': { bgcolor: 'rgba(74,222,128,0.08)', borderColor: '#22c55e', borderWidth: 2 } }),
                  }}
                  onClick={toggleQuoteForCurrent}>
                  {isSelected ? '✓ Added to quote tray' : '+ Add to quote tray'}
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    width: '100%', borderRadius: 2, py: 1.5,
                    fontWeight: 700, textTransform: 'none', fontSize: { xs: 14, sm: 16 },
                    bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
                    transition: 'all 150ms ease', '&:active': { transform: 'scale(0.98)' },
                  }}
                  onClick={() => setQuoteDialogOpen(true)}>
                  Request quote now →
                </Button>
                <Typography fontSize={12} color="text.secondary">
                  Free mockup &amp; quote within <b>24 hours.</b> No commitment required.
                </Typography>
              </Stack>

              <QuoteDialog
                open={quoteDialogOpen}
                onClose={(submitted) => {
                  setQuoteDialogOpen(false);
                  if (submitted) setSelectedProducts([]);
                }}
                products={
                  selectedProducts.some((p) => p.style === productStyle)
                    ? selectedProducts
                    : [...selectedProducts, buildQuoteEntry()]
                }
              />

              {productDescription && (
                <Box
                  sx={{
                    color: 'text.secondary',
                    fontSize: { xs: 14, sm: 16 },
                    lineHeight: 1.6,
                    overflowWrap: 'break-word', wordBreak: 'break-word',
                    '& ul, & ol': { pl: 2.5, my: 1 },
                    '& li': { mb: 0.5 },
                    '& p': { my: 1 },
                    '& a': { color: '#1a3d2b', textDecoration: 'underline' },
                    '& strong, & b': { color: 'text.primary' },
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(productDescription) }}
                />
              )}
            </Stack>
          </Stack>
                  </>
        )}
      </Container>

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
            onClick={() => setQuoteDialogOpen(true)}>
            {isMobile ? 'Get quote' : 'Request mockup & quote'}
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default Product;
