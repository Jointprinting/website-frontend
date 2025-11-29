// src/screens/Products.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  Rating,
  Pagination,
  ImageList,
  CircularProgress,
  Menu,
  Button,
  MenuItem,
  useMediaQuery,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import config from '../config.json';

function Products() {
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 600px)');
  const tablet = useMediaQuery('(max-width: 860px)');
  const laptop = useMediaQuery('(max-width: 1160px)');
  const columns = mobile ? 1 : tablet ? 2 : laptop ? 3 : 4;

  const [page, setPage] = useState(1);
  const [anchorEl, setAnchorEl] = useState(null);
  const [anchorElType, setAnchorElType] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]);

  const imagesPerPage = 12;

  const open = Boolean(anchorEl);
  const openType = Boolean(anchorElType);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCategoryClose = (category) => {
    setAnchorEl(null);
    setSelectedCategory(category);
    setPage(1);
  };

  const handleClickType = (event) => {
    setAnchorElType(event.currentTarget);
  };

  const handleCloseType = (type) => {
    setAnchorElType(null);
    setSelectedType(type);
    setPage(1);
  };

  const handleChange = (event, value) => {
    setPage(value);
  };

  // Load any existing selected products from sessionStorage on first mount
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedProducts(parsed);
        }
      }
    } catch (e) {
      console.error('Could not load selected products', e);
    }
  }, []);

  // Persist selections whenever they change
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        'jpSelectedProducts',
        JSON.stringify(selectedProducts)
      );
    } catch (e) {
      console.error('Could not save selected products', e);
    }
  }, [selectedProducts]);

  // Load products from backend
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `${config.backendUrl}/api/products?page=${page}&limit=${imagesPerPage}&category=${selectedCategory}&type=${selectedType}`
        );
        const data = await response.json();
        setProducts(data.products);
        setNumPages(data.totalPages);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    fetchProducts();
  }, [page, selectedCategory, selectedType]);

  const getTagCode = (tag) => {
    switch (tag) {
      case 'Best Seller':
        return 'success';
      case 'New Arrival':
        return 'error';
      case 'Our Favorite':
        return 'warning';
      default:
        return 'info';
    }
  };

  const toggleSelected = (item) => {
    setSelectedProducts((current) => {
      const exists = current.some((p) => p.style === item.style);
      if (exists) {
        return current.filter((p) => p.style !== item.style);
      }
      return [
        ...current,
        {
          style: item.style,
          name: item.name,
          vendor: item.vendor,
          tag: item.tag,
        },
      ];
    });
  };

  const handleRequestQuote = () => {
    navigate('/contact');
  };

  return (
    <Stack py={2}>
    {!loading ? (
  <>
    <Stack px="4vw" mb={1.5} spacing={1.5}>
      <Stack
        direction="row"
        alignItems="center"
        spacing="5vw"
      >
        <Typography variant="h4" component="span">
          Filters
        </Typography>

        {/* Category Filter */}
        <Button
          id="category-button"
          aria-controls={open ? 'category-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={handleClick}
        >
          Category
        </Button>
        <Menu
          id="category-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={() => handleCategoryClose(selectedCategory)}
          MenuListProps={{
            'aria-labelledby': 'category-button',
          }}
        >
          <MenuItem onClick={() => handleCategoryClose('Shirts')}>Shirts</MenuItem>
          <MenuItem onClick={() => handleCategoryClose('Pants')}>Pants</MenuItem>
          <MenuItem onClick={() => handleCategoryClose('Hoodies')}>Hoodies</MenuItem>
          <MenuItem onClick={() => handleCategoryClose('Hats')}>Hats</MenuItem>
        </Menu>

        {/* Type Filter */}
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Button
            id="type-button"
            aria-controls={openType ? 'type-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={openType ? 'true' : undefined}
            onClick={handleClickType}
          >
            Type
          </Button>
          <Menu
            id="type-menu"
            anchorEl={anchorElType}
            open={openType}
            onClose={() => handleCloseType(selectedType)}
            MenuListProps={{
              'aria-labelledby': 'type-button',
            }}
          >
            <MenuItem onClick={() => handleCloseType('Unisex')}>Unisex</MenuItem>
            <MenuItem onClick={() => handleCloseType('Male')}>Male</MenuItem>
            <MenuItem onClick={() => handleCloseType('Female')}>Female</MenuItem>
            <MenuItem onClick={() => handleCloseType('Kids')}>Kids</MenuItem>
          </Menu>
          <Box width="12px" />
          {selectedCategory && (
            <Chip
              label={selectedCategory}
              onDelete={() => setSelectedCategory('')}
            />
          )}
          {selectedType && (
            <Chip
              label={selectedType}
              onDelete={() => setSelectedType('')}
            />
          )}
        </Stack>
      </Stack>

      {/* New helper line under filters */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 640 }}
      >
        Pick a few products you’re into — we’ll send options from budget to premium and handle the art.
      </Typography>
    </Stack>

    <Divider />

          <Box
            width="100%"
            display="flex"
            justifyContent="center"
            sx={{ flexGrow: 1 }}
            mt={3}
          >
            <ImageList cols={columns} rowHeight={300} gap={30}>
              {products &&
                products.map((item, index) => {
                  const isSelected = selectedProducts.some(
                    (p) => p.style === item.style
                  );

                  return (
                    <Stack
                      key={item._id || index}
                      p={1}
                      spacing={1}
                      alignItems="center"
                    >
                      <Box
                        onClick={() =>
                          navigate('/product?styleCode=' + item.style)
                        }
                        sx={{
                          position: 'relative',
                          cursor: 'pointer',
                          ':hover': {
                            boxShadow: '0 0 8px 1px lightgray',
                          },
                        }}
                      >
                        <img
                          src={item.productFrontImages[0]}
                          alt={'product_' + index}
                          loading="lazy"
                          style={{ height: '300px', width: '250px' }}
                        />
                        <Chip
                          label={item.tag}
                          color={getTagCode(item.tag)}
                          variant="contained"
                          sx={{
                            position: 'absolute',
                            bottom: 40,
                            right: 8,
                            transform: 'translateY(100%)',
                          }}
                        />
                      </Box>
                      <Typography sx={{ mt: 2 }}>{item.vendor}</Typography>
                      <Typography
                        sx={{ maxWidth: 300 }}
                        fontWeight="bold"
                        textAlign="center"
                        noWrap={true}
                      >
                        {item.name.replace('', '')}
                      </Typography>
                      <Rating
                        name="read-only"
                        value={item.rating}
                        readOnly
                        size="small"
                      />
                      <Button
                        variant={isSelected ? 'contained' : 'outlined'}
                        size="small"
                        sx={{ mt: 1 }}
                        onClick={() => toggleSelected(item)}
                      >
                        {isSelected ? 'Remove from quote' : 'Add to quote'}
                      </Button>
                    </Stack>
                  );
                })}
            </ImageList>
          </Box>
        </>
      ) : (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="76vh"
        >
          <CircularProgress size="30vh" thickness="2.8" />
        </Box>
      )}
      <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
        <Pagination count={numPages} page={page} onChange={handleChange} />
      </Stack>

      {/* Sticky "quote" bar */}
      {selectedProducts.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            boxShadow: 4,
            borderRadius: 999,
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1300,
          }}
        >
          <Typography variant="body2">
            {selectedProducts.length} product
            {selectedProducts.length > 1 ? 's' : ''} selected
          </Typography>
          <Button
            variant="contained"
            size="small"
            onClick={handleRequestQuote}
          >
            Request mockup & quote
          </Button>
        </Box>
      )}
    </Stack>
  );
}

export default Products;
