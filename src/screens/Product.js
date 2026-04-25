// src/screens/Product.js
import { React, useEffect, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Button,
  Rating,
  Tooltip,
  useMediaQuery,
  CircularProgress,
  Container,
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import config from '../config.json';

function Product() {
  const mobile = useMediaQuery('(max-width: 800px)');
  const [searchParams] = useSearchParams();
  const id = searchParams.get('styleCode');

  const [productVendor, setProductVendor] = useState('');
  const [productStyle, setProductStyle] = useState('');
  const [productRating, setProductRating] = useState(5);
  const [productTitle, setProductTitle] = useState('');
  const [productPriceRangeBottom, setProductPriceRangeBottom] = useState('10');
  const [productPriceRangeTop, setProductPriceRangeTop] = useState('20');
  const [productSizeRangeBottom, setProductSizeRangeBottom] = useState('S');
  const [productSizeRangeTop, setProductSizeRangeTop] = useState('XXL');
  const [productTag, setProductTag] = useState('Best Seller');
  const [productTagColor, setProductTagColor] = useState('warning');
  const [productColorOptions, setProductColorOptions] = useState([]);
  const [productColorCodes, setProductColorCodes] = useState([]);
  const [productFrontImages, setProductFrontImages] = useState([]);
  const [productBackImages, setProductBackImages] = useState([]);
  const [productDescription, setProductDescription] = useState('');
  const [frontSelected, setFrontSelected] = useState(true);
  const [productColor, setProductColor] = useState('');
  const [productColorCode, setProductColorCode] = useState('');
  const [productIndex, setProductIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedProducts, setSelectedProducts] = useState([]);

  const getTagCode = (tag) => {
    switch (tag) {
      case 'Best Seller':  return 'success';
      case 'New Arrival':  return 'error';
      case 'Our Favorite': return 'warning';
      default:             return 'info';
    }
  };

  const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '');

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
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const response = await fetch(config.backendUrl + '/api/products/style/' + id);
        const data = await response.json();
        setProductVendor(data.vendor);
        setProductStyle(data.style);
        setProductRating(data.rating);
        setProductTitle(data.name);
        setProductPriceRangeBottom(data.priceRangeBottom);
        setProductPriceRangeTop(data.priceRangeTop);
        setProductSizeRangeBottom(data.sizeRangeBottom);
        setProductSizeRangeTop(data.sizeRangeTop);
        setProductTag(data.tag);
        setProductTagColor(getTagCode(data.tag));
        const colors = (data.colors || []).map((c) => capitalize(c));
        setProductColorOptions(colors);
        setProductColorCodes(data.colorCodes || []);
        setProductFrontImages(data.productFrontImages || []);
        setProductBackImages(data.productBackImages || []);
        setProductDescription(data.description);
        setProductColor(colors[0] || '');
        setProductColorCode((data.colorCodes && data.colorCodes[0]) || '');
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.error(err);
      }
    };
    fetchProduct();
  }, [id]);

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

  const selectedCircleStyle = {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: productColorCode,
    border: '1px solid white',
    boxShadow: '0 0 0 1px gray',
    flexShrink: 0,
  };

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
              sx={{
                flex: { md: '0 0 50%' },
                width: { xs: '100%', md: 'auto' },
              }}
            >
              <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
                <Box
                  component="img"
                  src={productFrontImages[productIndex]}
                  alt="product front"
                  onClick={() => setFrontSelected(true)}
                  sx={{
                    width: { xs: 56, sm: 72 },
                    height: 'auto',
                    cursor: 'pointer',
                    border: frontSelected ? '2px solid' : '2px solid transparent',
                    borderColor: frontSelected ? '#1a3d2b' : 'transparent',
                    borderRadius: 1,
                    bgcolor: 'white',
                  }}
                />
                {productBackImages[productIndex] && (
                  <Box
                    component="img"
                    src={productBackImages[productIndex]}
                    alt="product back"
                    onClick={() => setFrontSelected(false)}
                    sx={{
                      width: { xs: 56, sm: 72 },
                      height: 'auto',
                      cursor: 'pointer',
                      border: !frontSelected ? '2px solid' : '2px solid transparent',
                      borderColor: !frontSelected ? '#1a3d2b' : 'transparent',
                      borderRadius: 1,
                      bgcolor: 'white',
                    }}
                  />
                )}
              </Stack>

              <Box
                component="img"
                src={frontSelected ? productFrontImages[productIndex] : productBackImages[productIndex]}
                alt="product"
                sx={{
                  width: '100%',
                  height: 'auto',
                  maxWidth: { xs: '100%', md: 520 },
                  bgcolor: 'white',
                  borderRadius: 2,
                  boxShadow: 1,
                }}
              />
            </Stack>

            {/* DETAILS */}
            <Stack
              spacing={2.5}
              sx={{
                flex: { md: 1 },
                width: '100%',
              }}
            >
              <Stack
                spacing={1}
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                flexWrap="wrap"
                useFlexGap
              >
                <Typography color="black">{productVendor}</Typography>
                <Typography color="gray">Style #{productStyle}</Typography>
                <Chip label={productTag} color={productTagColor} variant="outlined" size="small" />
                <Rating name="read-only" value={productRating} readOnly size="small" />
              </Stack>

              <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 900, color: 'black', lineHeight: 1.25 }}>
                {productTitle}
              </Typography>

              <Stack spacing={{ xs: 2, sm: 7 }} direction={{ xs: 'row', sm: 'row' }}>
                <Stack spacing={0.5}>
                  <Typography color="black">Typically</Typography>
                  <Typography sx={{ fontSize: { xs: 18, sm: 22 } }} color="black">
                    ${productPriceRangeBottom} - ${productPriceRangeTop}
                  </Typography>
                </Stack>
                <Stack spacing={0.5}>
                  <Typography color="black">Comes in</Typography>
                  <Typography sx={{ fontSize: { xs: 18, sm: 22 } }} color="black">
                    {productSizeRangeBottom} - {productSizeRangeTop}
                  </Typography>
                </Stack>
              </Stack>

              <Typography color="gray" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                *The price will depend on your design and your order size.*
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography color="black" fontWeight="bold">
                  Color selected:
                </Typography>
                <Box sx={selectedCircleStyle}></Box>
                <Typography color="charcoal" fontWeight="bold">
                  {productColor}
                </Typography>
              </Stack>

              <Box
                sx={{
                  overflowX: 'auto',
                  width: '100%',
                  py: 1,
                  px: '2px',
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap', width: 'fit-content' }}>
                  {productColorOptions.map((item, index) => (
                    <Tooltip title={item} placement="top" arrow key={index}>
                      <Box
                        onClick={() => {
                          setProductColor(item);
                          setProductColorCode(productColorCodes[index]);
                          setProductIndex(index);
                        }}
                        sx={{
                          cursor: 'pointer',
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: productColorCodes[index],
                          border: item === productColor ? '2px solid white' : 'none',
                          boxShadow: item === productColor ? '0 0 0 2px gray' : 2,
                          flexShrink: 0,
                          marginRight: '8px',
                        }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>

              <Stack spacing={1}>
                <Button
                  variant="contained"
                  size="large"
                  sx={{
                    width: '100%',
                    borderRadius: 2,
                    py: 1.5,
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: { xs: 14, sm: 16 },
                  }}
                  onClick={toggleQuoteForCurrent}
                >
                  {isSelected ? 'Remove from quote / mockup request' : 'Add to quote / mockup request'}
                </Button>
                <Typography fontSize={12}>
                  Free mockup & quote within <b>24 hours.</b>
                </Typography>
              </Stack>

              <Typography color="charcoal" sx={{ fontSize: { xs: 14, sm: 16 } }}>
                {productDescription}
              </Typography>
            </Stack>
          </Stack>
        )}
      </Container>
    </Box>
  );
}

export default Product;
