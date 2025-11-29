// src/screens/Products.js
import { React, useState, useEffect } from 'react';
import {
  Box,
  Stack,
  Typography,
  Chip,
  Divider,
  Rating,
  Pagination,
  CircularProgress,
  Menu,
  Button,
  MenuItem,
  useMediaQuery,
  Grid,
  Paper,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import config from '../config.json';

function Products() {
  const navigate = useNavigate();
  const mobile = useMediaQuery('(max-width: 600px)');
  const tablet = useMediaQuery('(max-width: 860px)');
  const laptop = useMediaQuery('(max-width: 1160px)');

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

  const handleClickCategory = (event) => {
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

  const handleClearFilters = () => {
    setSelectedCategory('');
    setSelectedType('');
    setPage(1);
  };

  return (
    <Stack py={mobile ? 3 : 5} px={mobile ? 2 : '4vw'} spacing={3}>
      {/* HEADER / STEP LABEL */}
      <Stack spacing={0.5}>
        <Typography
          variant="overline"
          sx={{
            letterSpacing: 3,
            color: 'text.secondary',
          }}
        >
          STEP 1 · PICK YOUR BLANKS
        </Typography>
        <Stack
          direction={mobile ? 'column' : 'row'}
          alignItems={mobile ? 'flex-start' : 'center'}
          justifyContent="space-between"
          spacing={1}
        >
          <Typography variant="h4" component="h1">
            Build your merch lineup
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 420 }}
          >
            Tap into products you like, add them to your quote tray, and we’ll
            handle the mockups, pricing, and print details.
          </Typography>
        </Stack>
      </Stack>

      {/* FILTERS ROW */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          px: mobile ? 2 : 3,
          py: 1.5,
          bgcolor: 'background.paper',
        }}
      >
        <Stack
          direction={mobile ? 'column' : 'row'}
          alignItems={mobile ? 'flex-start' : 'center'}
          justifyContent="space-between"
          spacing={mobile ? 1.5 : 3}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2" color="text.secondary">
              Filter by:
            </Typography>

            {/* Category Filter */}
            <Button
              id="category-button"
              aria-controls={open ? 'category-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={open ? 'true' : undefined}
              onClick={handleClickCategory}
              size="small"
              variant="outlined"
            >
              {selectedCategory || 'Category'}
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
              <MenuItem onClick={() => handleCategoryClose('')}>All</MenuItem>
              <MenuItem onClick={() => handleCategoryClose('Shirts')}>
                Shirts
              </MenuItem>
              <MenuItem onClick={() => handleCategoryClose('Pants')}>
                Pants
              </MenuItem>
              <MenuItem onClick={() => handleCategoryClose('Hoodies')}>
                Hoodies
              </MenuItem>
              <MenuItem onClick={() => handleCategoryClose('Hats')}>
                Hats
              </MenuItem>
            </Menu>

            {/* Type Filter */}
            <Button
              id="type-button"
              aria-controls={openType ? 'type-menu' : undefined}
              aria-haspopup="true"
              aria-expanded={openType ? 'true' : undefined}
              onClick={handleClickType}
              size="small"
              variant="outlined"
            >
              {selectedType || 'Fit / Type'}
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
              <MenuItem onClick={() => handleCloseType('')}>All</MenuItem>
              <MenuItem onClick={() => handleCloseType('Unisex')}>
                Unisex
              </MenuItem>
              <MenuItem onClick={() => handleCloseType('Male')}>Male</MenuItem>
              <MenuItem onClick={() => handleCloseType('Female')}>
                Female
              </MenuItem>
              <MenuItem onClick={() => handleCloseType('Kids')}>Kids</MenuItem>
            </Menu>
          </Stack>

          {/* Active filters + clear */}
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            {selectedCategory && (
              <Chip
                label={selectedCategory}
                size="small"
                onDelete={() => setSelectedCategory('')}
              />
            )}
            {selectedType && (
              <Chip
                label={selectedType}
                size="small"
                onDelete={() => setSelectedType('')}
              />
            )}
            {(selectedCategory || selectedType) && (
              <Button
                size="small"
                color="inherit"
                onClick={handleClearFilters}
                sx={{ textTransform: 'none' }}
              >
                Clear filters
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Divider />

      {/* GRID OR LOADER */}
      {!loading ? (
        <>
          {products && products.length > 0 ? (
            <Grid
              container
              spacing={mobile ? 2 : 3}
              sx={{ mt: 1 }}
            >
              {products.map((item, index) => {
                const isSelected = selectedProducts.some(
                  (p) => p.style === item.style
                );

                return (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={item._id || index}>
                    <Paper
                      elevation={isSelected ? 6 : 2}
                      sx={{
                        borderRadius: 3,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        border: isSelected
                          ? '2px solid'
                          : '1px solid',
                        borderColor: isSelected
                          ? 'secondary.main'
                          : 'divider',
                        transition:
                          'transform 160ms ease-out, box-shadow 160ms ease-out, border-color 160ms ease-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 6,
                        },
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      {/* Image + tag */}
                      <Box
                        onClick={() =>
                          navigate('/product?styleCode=' + item.style)
                        }
                        sx={{
                          position: 'relative',
                          bgcolor: '#f5f5f5',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: 260,
                        }}
                      >
                        <img
                          src={item.productFrontImages[0]}
                          alt={'product_' + index}
                          loading="lazy"
                          style={{
                            maxHeight: 260,
                            width: '100%',
                            objectFit: 'contain',
                          }}
                        />
                        {item.tag && (
                          <Chip
                            label={item.tag}
                            color={getTagCode(item.tag)}
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 12,
                              left: 12,
                              fontWeight: 600,
                            }}
                          />
                        )}
                      </Box>

                      {/* Content */}
                      <Box
                        sx={{
                          p: 2.2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0.5,
                          flexGrow: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ textTransform: 'uppercase', letterSpacing: 1 }}
                        >
                          {item.vendor}
                        </Typography>

                        <Typography
                          variant="body1"
                          fontWeight={600}
                          sx={{
                            minHeight: 40,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {item.name.replace('', '')}
                        </Typography>

                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent="space-between"
                          sx={{ mt: 0.5 }}
                        >
                          <Rating
                            name="read-only"
                            value={item.rating}
                            readOnly
                            size="small"
                          />
                        </Stack>

                        <Box sx={{ flexGrow: 1 }} />

                        <Button
                          variant={isSelected ? 'contained' : 'outlined'}
                          size="small"
                          sx={{
                            mt: 1.5,
                            textTransform: 'none',
                            borderRadius: 999,
                          }}
                          onClick={() => toggleSelected(item)}
                        >
                          {isSelected ? 'Remove from quote' : 'Add to quote tray'}
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <Box
              height="40vh"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Typography color="text.secondary">
                No products found with these filters.
              </Typography>
            </Box>
          )}
        </>
      ) : (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="60vh"
        >
          <CircularProgress size="30vh" thickness={2.8} />
        </Box>
      )}

      {/* PAGINATION */}
      <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
        <Pagination count={numPages} page={page} onChange={handleChange} />
      </Stack>

      {/* STICKY QUOTE BAR */}
      {selectedProducts.length > 0 && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            bgcolor: 'background.paper',
            boxShadow: 6,
            borderRadius: 999,
            px: 3,
            py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            zIndex: 1300,
            border: '1px solid',
            borderColor: 'secondary.light',
          }}
        >
          <Typography variant="body2">
            {selectedProducts.length} product
            {selectedProducts.length > 1 ? 's' : ''} in your quote tray
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Button
            variant="contained"
            size="small"
            color="secondary"
            sx={{ textTransform: 'none', borderRadius: 999 }}
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
