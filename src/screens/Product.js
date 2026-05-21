// src/screens/Product.js
import { React, useEffect, useState } from 'react';
import {
  Box, Stack, Typography, Chip, Button, Rating, Tooltip,
  CircularProgress, Container, Avatar, useMediaQuery, Divider,
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

function Product() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const id = searchParams.get('styleCode');
  const isMobile = useMediaQuery('(max-width:768px)');

  // Catalog passes the item via navigation state so the page can paint
  // instantly without waiting on (or being blocked by) the backend fetch.
  const preloadedItem = location.state?.item || null;

  const [productVendor, setProductVendor]                     = useState(preloadedItem?.vendor || '');
  const [productStyle, setProductStyle]                       = useState(preloadedItem?.style || id || '');
  const [productRating, setProductRating]                     = useState(preloadedItem?.rating || 0);
  const [productTitle, setProductTitle]                       = useState(preloadedItem?.name || '');
  const [productPriceRangeBottom, setProductPriceRangeBottom] = useState(preloadedItem?.priceRangeBottom || '');
  const [productPriceRangeTop, setProductPriceRangeTop]       = useState(preloadedItem?.priceRangeTop || '');
  const [productSizeRangeBottom, setProductSizeRangeBottom]   = useState(preloadedItem?.sizeRangeBottom || 'S');
  const [productSizeRangeTop, setProductSizeRangeTop]         = useState(preloadedItem?.sizeRangeTop || 'XL');
  const [productTag, setProductTag]                           = useState(preloadedItem?.tag || '');
  const [productTagColor, setProductTagColor]                 = useState(getTagCode(preloadedItem?.tag));
  const [productColorOptions, setProductColorOptions]         = useState([]);
  const [productColorCodes, setProductColorCodes]             = useState([]);
  const [productFrontImages, setProductFrontImages]           = useState(preloadedItem?.image ? [preloadedItem.image] : []);
  const [productBackImages, setProductBackImages]             = useState([]);
  const [productDescription, setProductDescription]           = useState('');
  const [frontSelected, setFrontSelected]                     = useState(true);
  const [productColor, setProductColor]                       = useState('');
  const [productColorCode, setProductColorCode]               = useState('');
  const [productIndex, setProductIndex]                       = useState(0);
  // Only show the full-page spinner when we have nothing to display yet.
  const [loading, setLoading]                                 = useState(!preloadedItem);
  const [error, setError]                                     = useState(null);

  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quoteDialogOpen, setQuoteDialogOpen]   = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setSelectedProducts(parsed);
      }
    } catch (e) {
      console.error('Could not load selected products', e);
    }
  }, []);

  useEffect(() => {
    try {
      window.sessionStorage.setItem('jpSelectedProducts', JSON.stringify(selectedProducts));
    } catch (e) {
      console.error('Could not save selected products', e);
    }
  }, [selectedProducts]);

  useEffect(() => {
    if (!id) return;

    const applyProductData = (data) => {
      setProductVendor(data.vendor || '');
      setProductStyle(data.style || id);
      setProductRating(data.rating || 5);
      setProductTitle(data.name || '');
      setProductPriceRangeBottom(data.priceRangeBottom || '');
      setProductPriceRangeTop(data.priceRangeTop || '');
      setProductSizeRangeBottom(data.sizeRangeBottom || 'S');
      setProductSizeRangeTop(data.sizeRangeTop || 'XL');
      setProductTag(data.tag || '');
      setProductTagColor(getTagCode(data.tag));
      const colors = (data.colors || []).map((c) => capitalize(c));
      setProductColorOptions(colors);
      setProductColorCodes(data.colorCodes || []);
      if (Array.isArray(data.productFrontImages) && data.productFrontImages.some(Boolean)) {
        setProductFrontImages(data.productFrontImages);
      }
      setProductBackImages(data.productBackImages || []);
      setProductDescription(data.description || '');
      setProductColor(colors[0] || '');
      setProductColorCode((data.colorCodes && data.colorCodes[0]) || '');
    };

    const fetchProduct = async () => {
      try {
        if (!preloadedItem) setLoading(true);
        const encoded = encodeURIComponent(id);
        const res = await fetch(config.backendUrl + '/api/products/style/' + encoded);
        if (res.ok) {
          applyProductData(await res.json());
          setError(null);
          return;
        }
        if (res.status === 404) {
          const ssRes = await fetch(config.backendUrl + '/api/products/ss/style/' + encoded);
          if (ssRes.ok) {
            applyProductData(await ssRes.json());
            setError(null);
            return;
          }
        }
        // Both endpoints failed. If we have preloaded info we still
        // show that; otherwise surface a real error instead of a blank page.
        if (!preloadedItem) {
          setError("We couldn't load the full details for this style. Please try again or browse other items.");
        }
      } catch (err) {
        console.error(err);
        if (!preloadedItem) {
          setError("We couldn't reach the catalog server. Please check your connection and try again.");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSelected = selectedProducts.some((p) => p.style === productStyle && productStyle);

  const toggleQuoteForCurrent = () => {
    if (!productStyle) return;
    setSelectedProducts((current) => {
      const exists = current.some((p) => p.style === productStyle);
      if (exists) return current.filter((p) => p.style !== productStyle);
      return [
        ...current,
        {
          style: productStyle,
          name: productTitle,
          vendor: productVendor,
          tag: productTag,
          thumbnail: productFrontImages?.[productIndex] || '',
        },
      ];
    });
  };

  const currentFrontImg = productFrontImages[productIndex] || null;
  const currentBackImg  = productBackImages[productIndex]  || null;
  const displayImg      = frontSelected ? currentFrontImg : (currentBackImg || currentFrontImg);

  // Error state — only shown when we have nothing to display.
  if (error) {
    return (
      <Box bgcolor="#f5f5f5" minHeight="100vh">
        <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 } }}>
          <Stack spacing={3} alignItems="center" textAlign="center">
            <CheckroomIcon sx={{ fontSize: 64, color: 'rgba(0,0,0,0.2)' }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              Style not available
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 380 }}>
              {error}
            </Typography>
            <Button
              variant="contained"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/products')}
              sx={{
                textTransform: 'none', borderRadius: 999, px: 3,
                bgcolor: '#1a3d2b', '&:hover': { bgcolor: '#14301f' },
              }}
            >
              Back to catalog
            </Button>
          </Stack>
        </Container>
      </Box>
    );
  }

  return (
    <Box bgcolor="#f5f5f5" minHeight="100vh">
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 7 }, px: { xs: 2, md: 4 } }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
            <CircularProgress size={64} thickness={3.5} />
          </Box>
        ) : (
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 6 }}
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
          >
            {/* IMAGES */}
            <Stack
              direction="row"
              spacing={2}
              alignItems="flex-start"
              sx={{ flex: { md: '0 0 50%' }, width: { xs: '100%', md: 'auto' } }}
            >
              {/* Thumbnails column */}
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <Box
                  onClick={() => setFrontSelected(true)}
                  sx={{
                    width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 },
                    cursor: 'pointer', borderRadius: 1, bgcolor: 'white', overflow: 'hidden',
                    border: frontSelected ? '2px solid #1a3d2b' : '2px solid transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {currentFrontImg
                    ? <Box component="img" src={currentFrontImg} alt="front" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <CheckroomIcon sx={{ fontSize: 24, color: 'rgba(0,0,0,0.15)' }} />}
                </Box>
                {currentBackImg && (
                  <Box
                    onClick={() => setFrontSelected(false)}
                    sx={{
                      width: { xs: 56, sm: 72 }, height: { xs: 56, sm: 72 },
                      cursor: 'pointer', borderRadius: 1, bgcolor: 'white', overflow: 'hidden',
                      border: !frontSelected ? '2px solid #1a3d2b' : '2px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Box component="img" src={currentBackImg} alt="back" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </Box>
                )}
              </Stack>

              {/* Main image */}
              <Box sx={{
                flex: 1, bgcolor: 'white', borderRadius: 2, boxShadow: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: { xs: 260, md: 420 }, overflow: 'hidden',
              }}>
                {displayImg
                  ? <Box component="img" src={displayImg} alt={productTitle || 'product'}
                      sx={{ width: '100%', height: 'auto', maxHeight: 520, objectFit: 'contain', p: 2 }} />
                  : <CheckroomIcon sx={{ fontSize: 120, color: 'rgba(0,0,0,0.07)' }} />}
              </Box>
            </Stack>

            {/* DETAILS */}
            <Stack spacing={2.5} sx={{ flex: { md: 1 }, width: '100%', minWidth: 0 }}>
              <Stack spacing={1} direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }} flexWrap="wrap" useFlexGap>
                {productVendor && <Typography color="black">{productVendor}</Typography>}
                {productStyle && <Typography color="gray">Style #{productStyle}</Typography>}
                {productTag && <Chip label={productTag} color={productTagColor} variant="outlined" size="small" />}
                {productRating > 0 && <Rating name="read-only" value={productRating} readOnly size="small" />}
              </Stack>

              {productTitle && (
                <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 900, color: 'black', lineHeight: 1.25 }}>
                  {productTitle}
                </Typography>
              )}

              {(productPriceRangeBottom || productPriceRangeTop) && (
                <Stack spacing={{ xs: 2, sm: 7 }} direction="row">
                  <Stack spacing={0.5}>
                    <Typography color="black">Typically</Typography>
                    <Typography sx={{ fontSize: { xs: 18, sm: 22 } }} color="black">
                      ${productPriceRangeBottom} – ${productPriceRangeTop}
                    </Typography>
                  </Stack>
                  <Stack spacing={0.5}>
                    <Typography color="black">Comes in</Typography>
                    <Typography sx={{ fontSize: { xs: 18, sm: 22 } }} color="black">
                      {productSizeRangeBottom} – {productSizeRangeTop}
                    </Typography>
                  </Stack>
                </Stack>
              )}

              <Typography color="gray" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                *The price will depend on your design and your order size.*
              </Typography>

              {productColorOptions.length > 0 && (
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

                  <Box sx={{ overflowX: 'auto', width: '100%', py: 1, px: '2px' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', width: 'fit-content' }}>
                      {productColorOptions.map((item, index) => (
                        <Tooltip title={item} placement="top" arrow key={index}>
                          <Box
                            onClick={() => { setProductColor(item); setProductColorCode(productColorCodes[index]); setProductIndex(index); }}
                            sx={{
                              cursor: 'pointer', width: 28, height: 28, borderRadius: '50%',
                              backgroundColor: productColorCodes[index],
                              border: item === productColor ? '2px solid white' : 'none',
                              boxShadow: item === productColor ? '0 0 0 2px #1a3d2b' : 2,
                              flexShrink: 0, mr: '8px',
                              transition: 'box-shadow 120ms',
                            }}
                          />
                        </Tooltip>
                      ))}
                    </Box>
                  </Box>
                </>
              )}

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
                  onClick={toggleQuoteForCurrent}
                >
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
                  onClick={() => setQuoteDialogOpen(true)}
                >
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
                    : [...selectedProducts, { style: productStyle, name: productTitle, vendor: productVendor, thumbnail: currentFrontImg || '' }]
                }
              />

              {productDescription && (
                <Typography color="text.secondary" sx={{ fontSize: { xs: 14, sm: 16 }, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                  {productDescription}
                </Typography>
              )}
            </Stack>
          </Stack>
        )}
      </Container>

      {/* FLOATING QUOTE BAR — mirrors Products.js so tray is visible on the detail page */}
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
                <Box
                  onClick={() => setSelectedProducts((c) => c.filter((x) => x.style !== p.style))}
                  sx={{ position: 'relative', cursor: 'pointer', '&:hover .rx': { opacity: 1 } }}
                >
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
