import * as React from 'react';
import axios from 'axios';
import { Box, Stack, TextField, MenuItem, Button, useMediaQuery, FormControl, Select, FormControlLabel, Radio, Menu, Chip } from '@mui/material';
import Typography from '../modules/components/Typography';
import config from '../config.json';

function Admin() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const [styleCode, setStyleCode] = React.useState('');
    const [priceRangeBottom, setPriceRangeBottom] = React.useState('');
    const [priceRangeTop, setPriceRangeTop] = React.useState('');
    const [rating, setRating] = React.useState(5);
    const [tag, setTag] = React.useState('Best Seller');
    const [category, setCategory] = React.useState('');
    const [type, setType] = React.useState('');
    const [loading, setLoading] = React.useState(false);
   
    const handleRatingChange = (event) => {
        setRating(event.target.value);
    }

    const handleTagChange = (event) => {
        setTag(event.target.value);
    }

    const handleCategoryChange = (event) => {
        setCategory(event.target.value);
    };

    const handleTypeChange = (event) => {
        setType(event.target.value);
    };

    //useEffect to scroll to top of page on load
    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!styleCode || !priceRangeBottom || !priceRangeTop || !rating || !tag || !category || !type) {
            alert('Please fill out all fields');
            return;
        }
        const product = {
            styleCode,
            priceRangeBottom,
            priceRangeTop,
            rating,
            tag,
            category,
            type
        }
        try {
            setLoading(true)
            const res = await axios.post(config.backendUrl+'/api/products/add', product);
            if (res.data) {
                alert('Product added successfully');
                //scroll to top of page
                //window.location.reload();
            }
            else {
                alert('Product could not be added');
            }
            setLoading(false)
        } catch (err) {
            console.error(err);
            console.log(err?.response?.data?.message)
            alert(`Product could not be added:\n${err?.response?.data?.message}`);
            setLoading(false)
        } finally {
            setLoading(false)
        }
        
    }

    const handleKeyPress = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
        }
    }



  return (
    <Box bgcolor="#f5f5f5" pt={6} pb={8} display="flex" justifyContent="center">
        <Box 
            sx={{ 
                width: mobile ? '90vw' : '45vw', p: 4, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center", bgcolor:"white", boxShadow: 2, borderRadius: 1
            }}
        >
        <form onSubmit={handleSubmit} onKeyPress={handleKeyPress}>

            <Typography color="primary" align="center" variant={mobile ? "h3" : "h1"} fontWeight="bold">
                Add New Product
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} fontWeight={200} mb={1}>
                Admin page to add to products to catalog
            </Typography>
            <Stack display="flex" justifyContent="center" alignItems="center" width={mobile ? '92%' : '40vw'} spacing={2} mt={mobile ? 2 : 4}>
                <Box width="100%">
                    <Typography variant="h6">Style Code</Typography>
                    <TextField value={styleCode} onChange={(e)=>setStyleCode(e.target.value)} id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                
                <Box width="100%">
                    <Typography variant="h6">Price Range ($)</Typography>
                    <Stack direction="row" width="100%" spacing={2} alignItems="center">
                        <TextField value={priceRangeBottom} type="number" onChange={(e)=>setPriceRangeBottom(e.target.value)} id="outlined-basic" variant="outlined" size={mobile ? "small" : "medium"} required />
                        <Typography variant="h6">-</Typography>
                        <TextField value={priceRangeTop} type="number" onChange={(e)=>setPriceRangeTop(e.target.value)} id="outlined-basic" variant="outlined" size={mobile ? "small" : "medium"} required/>
                    </Stack>
                </Box>
                <Stack direction="row" width="100%" spacing={2} alignItems="center">
                    <Box>
                        <Typography variant="h6">Rating</Typography>
                        <FormControl>
                            <Select value={rating} onChange={handleRatingChange}>
                                <MenuItem value={5}>5</MenuItem>
                                <MenuItem value={4}>4</MenuItem>
                                <MenuItem value={3}>3</MenuItem>
                                <MenuItem value={2}>2</MenuItem>
                                <MenuItem value={1}>1</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Tag</Typography>
                        <FormControl fullWidth>
                            <Select value={tag} onChange={handleTagChange}>
                                <MenuItem value={'Best Seller'}>Best Seller</MenuItem>
                                <MenuItem value={'New Arrival'}>New Arrival</MenuItem>
                                <MenuItem value={'Clearance'}>Clearance</MenuItem>
                                <MenuItem value={'Our Favorite'}>Our Favorite</MenuItem>
                                <MenuItem value={'Exclusive'}>Exclusive</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Stack>
                <Stack direction="row" width="100%" spacing={2} alignItems="center">
                <Box width="100%">
                        <Typography variant="h6">Category</Typography>
                        <FormControl fullWidth>
                            <Select value={category} onChange={handleCategoryChange}>
                                <MenuItem value={'Shirts'}>Shirts</MenuItem>
                                <MenuItem value={'Pants'}>Pants</MenuItem>
                                <MenuItem value={'Hoodies'}>Hoodies</MenuItem>
                                <MenuItem value={'Hats'}>Hats</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Type</Typography>
                        <FormControl fullWidth>
                            <Select value={type} onChange={handleTypeChange}>
                                <MenuItem value={'Unisex'}>Unisex</MenuItem>
                                <MenuItem value={'Male'}>Male</MenuItem>
                                <MenuItem value={'Female'}>Female</MenuItem>
                                <MenuItem value={'Kids'}>Kids</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Stack>
                <Button variant="contained" color="primary" fullWidth disabled={loading}
                size={mobile ? "small" : "large"} type="submit">
                    Submit
                </Button>
            </Stack>
            </form>
        </Box>
    </Box>
  );
}

export default Admin;