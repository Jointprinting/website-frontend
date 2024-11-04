import  {React, useState, useEffect} from 'react';
import { Box, Stack, Typography, Chip, Divider, Rating, Pagination, ImageList, Menu, Button, MenuItem, useMediaQuery } from '@mui/material';
//import Grid from '@mui/material/Unstable_Grid2';
//import ImageGrid from '../common/ImageGrid';
import { useNavigate } from 'react-router-dom';
//import config.json from src root
import config from '../config.json';
//get backendUrl from config.json

function Product() {
    const navigate = useNavigate();
    const mobile = useMediaQuery("(max-width: 600px)");
    const tablet = useMediaQuery("(max-width: 860px)");
    const laptop = useMediaQuery("(max-width: 1160px)");
    const columns = mobile ? 1 : tablet ? 2 : laptop ? 3 : 4;
    const [page, setPage] = useState(1);
    const [anchorEl, setAnchorEl] = useState(null);
    const [anchorElType, setAnchorElType] = useState(null);
    const open = Boolean(anchorEl);
    const openType = Boolean(anchorElType);
    const handleClick = (event) => {
      setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
      setAnchorEl(null);
    };
    const handleClickType = (event) => {
        setAnchorElType(event.currentTarget);
    };
    const handleCloseType = () => {
        setAnchorElType(null);
    };
    const imagesPerPage = 12; // Adjust based on your requirement

    const handleChange = (event, value) => {
        setPage(value);
    };

    //useEffect to load products from db
    const [products, setProducts] = useState([]);
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await fetch(config.backendUrl+'/api/products');
                const data = await response.json();
                setProducts(data);
                //console.log(data)
            } catch (err) {
                console.error(err);
            }
        }
        fetchProducts();
    }, []);

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
    }

    //const paginatedImages = imageUrls.slice((page - 1) * imagesPerPage, page * imagesPerPage);
    //useMediaQuery to adjust cols based on screen size (i.e. mobile should be 1 column, tablet should be 2 columns, desktop should be 4 columns)
    return (
        <Stack py={2}>
            <Stack direction="row" px={'4vw'} mb={1.5} alignItems='center' spacing={'5vw'}>
                <Typography variant="h4" component="span">Filters</Typography>

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
                    onClose={handleClose}
                    MenuListProps={{
                    'aria-labelledby': 'category-button',
                    }}
                >
                    <MenuItem onClick={handleClose}>Shirts</MenuItem>
                    <MenuItem onClick={handleClose}>Pants</MenuItem>
                    <MenuItem onClick={handleClose}>Hoodies</MenuItem>
                    <MenuItem onClick={handleClose}>Hats</MenuItem>
                </Menu>
                
                {/* Type Filter */}
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
                    onClose={handleCloseType}
                    MenuListProps={{
                    'aria-labelledby': 'type-button',
                    }}
                >
                    <MenuItem onClick={handleCloseType}>Unisex</MenuItem>
                    <MenuItem onClick={handleCloseType}>Male</MenuItem>
                    <MenuItem onClick={handleCloseType}>Female</MenuItem>
                    <MenuItem onClick={handleCloseType}>Kids</MenuItem>
                </Menu>
            </Stack>
            <Divider />
            <Box width='100%' display='flex' justifyContent='center'  sx={{ flexGrow: 1 }} mt={3}>
                <ImageList cols={columns} rowHeight={300} gap={30}>
                {products.map((item, index) => (
                    <Stack p={1} spacing={1} alignItems="center" >
                        <Box onClick={() => navigate('/product?styleCode='+item.style)}
                            sx={{position:"relative", cursor:'pointer', ':hover': {boxShadow: '0 0 8px 1px lightgray' }}}
                        >
                            <img
                                src={item.productFrontImages[0]}
                                alt={'product_'+index}
                                loading="lazy"
                                style={{height: '300px', width: '250px'}}
                            />
                            <Chip label={item.tag} color={getTagCode(item.tag)} variant='contained'
                            sx={{
                                position: 'absolute', /* Absolute position to place it on bottom left */
                                bottom: 40, /* Align bottom edge with bottom of the parent Box */
                                right: 8, /* Align left edge with left of the parent Box */
                                transform: 'translateY(100%)' /* Move it down 100% of its height to overlap bottom edge */
                            }}
                            />
                        </Box>
                        <Typography sx={{mt:2}}>{item.vendor}</Typography>
                        <Typography fontWeight='bold'>{item.name}</Typography>
                        <Rating name="read-only" value={item.rating} readOnly size="small" /> {/*Once db is working it should be item.productRating*/}
                    </Stack>
                ))}
                </ImageList>
            </Box>
            <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
                <Pagination count={Math.ceil(products.length / imagesPerPage)} page={page} onChange={handleChange} />
            </Stack>
        </Stack>
    );
}

export default Product;