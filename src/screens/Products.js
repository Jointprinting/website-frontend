import  {React, useEffect, useState} from 'react';
import { Box, Stack, Typography, Chip, Divider, Rating, Pagination, ImageList, Menu, Button, MenuItem } from '@mui/material';
//import Grid from '@mui/material/Unstable_Grid2';
//import ImageGrid from '../common/ImageGrid';
import { useNavigate } from 'react-router-dom';

function Product() {
    const navigate = useNavigate();
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
    const imageUrls = [
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/White_F_cdcaf2f4-9cb4-42fc-9a49-47b07c97df5c.jpg?v=1711658788',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Black_F_8295c8ff-499d-4372-aa51-5765a45d7eeb.jpg?v=1711658790',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Crimson_F_79d746ba-d33c-4074-8a26-3941f2eb0e6d.jpg?v=1711658788',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/DelicateBlue_F.jpg?v=1711658787',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Concrete_F.jpg?v=1711658794',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/White_F_cdcaf2f4-9cb4-42fc-9a49-47b07c97df5c.jpg?v=1711658788',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Black_F_8295c8ff-499d-4372-aa51-5765a45d7eeb.jpg?v=1711658790',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Crimson_F_79d746ba-d33c-4074-8a26-3941f2eb0e6d.jpg?v=1711658788',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/DelicateBlue_F.jpg?v=1711658787',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Concrete_F.jpg?v=1711658794',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/White_F_cdcaf2f4-9cb4-42fc-9a49-47b07c97df5c.jpg?v=1711658788',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Black_F_8295c8ff-499d-4372-aa51-5765a45d7eeb.jpg?v=1711658790',
    ];

    const handleChange = (event, value) => {
        setPage(value);
    };

    const paginatedImages = imageUrls.slice((page - 1) * imagesPerPage, page * imagesPerPage);
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
                <ImageList cols={4} rowHeight={300} gap={30}>
                {imageUrls.map((item, index) => (
                    <Stack p={1} spacing={1} alignItems="center" >
                        <Box onClick={() => navigate('/product/')}
                            sx={{position:"relative", cursor:'pointer', ':hover': {boxShadow: '0 0 8px 1px lightgray' }}}
                        >
                            <img
                                src={item}
                                alt={'product_'+index}
                                loading="lazy"
                                height='auto'
                                width='250px'
                            />
                            <Chip label={'Best Seller'} color={'success'} variant='contained'
                            sx={{
                                position: 'absolute', /* Absolute position to place it on bottom left */
                                bottom: 40, /* Align bottom edge with bottom of the parent Box */
                                right: 8, /* Align left edge with left of the parent Box */
                                transform: 'translateY(100%)' /* Move it down 100% of its height to overlap bottom edge */
                            }}
                            />
                            {/*Once db is working it should be item.productTag*/}
                        </Box>
                        <Typography sx={{mt:2}}>Vendor</Typography>
                        <Typography fontWeight='bold'>Product Name</Typography>
                        <Rating name="read-only" value={5} readOnly size="small" /> {/*Once db is working it should be item.productRating*/}
                    </Stack>
                ))}
                </ImageList>
            </Box>
            <Stack spacing={2} alignItems="center" sx={{ margin: '20px 0' }}>
                <Pagination count={Math.ceil(imageUrls.length / imagesPerPage)} page={page} onChange={handleChange} />
            </Stack>
        </Stack>
    );
}

export default Product;