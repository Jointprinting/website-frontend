import * as React from 'react';
import axios from 'axios';
import { Box, Stack, TextField, MenuItem, Button, useMediaQuery, FormControl, Select, FormControlLabel, Radio, Menu, Chip } from '@mui/material';
import Typography from '../modules/components/Typography';
import config from '../config.json';

function Admin() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const [name, setName] = React.useState('');
    const [vendor, setVendor] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [sizeRangeBottom, setSizeRangeBottom] = React.useState('');
    const [sizeRangeTop, setSizeRangeTop] = React.useState('');
    const [priceRangeBottom, setPriceRangeBottom] = React.useState('');
    const [priceRangeTop, setPriceRangeTop] = React.useState('');
    const [colors, setColors] = React.useState([]);
    const [colorCodes, setColorCodes] = React.useState([]);
    const [productFrontImages, setProductFrontImages] = React.useState([]);
    const [productBackImages, setProductBackImages] = React.useState([]);
    const [rating, setRating] = React.useState('');
    const [tag, setTag] = React.useState('');
    const [category, setCategory] = React.useState('');
    const [type, setType] = React.useState('');
    const [colorInputValue, setColorInputValue] = React.useState('');
    const [colorHexInputValue, setColorHexInputValue] = React.useState('');
    const [productFrontImagesInputValue, setProductFrontImagesInputValue] = React.useState('');
    const [productBackImagesInputValue, setProductBackImagesInputValue] = React.useState('');

    const handleAddColor = (event) => {
        if (event.key === 'Enter' && colorInputValue.trim() !== '') {
            setColors([...colors, colorInputValue.trim()]);
            setColorInputValue('');
        }
    };

    const handleAddColorHex = (event) => {
        if (event.key === 'Enter' && colorHexInputValue.trim() !== '') {
            if(colors.length - 1 >= colorCodes.length) {
                setColorCodes([...colorCodes, colorHexInputValue.trim()]);
            } else {
                alert('Please add the color first before adding the color code');
            }
            setColorHexInputValue('');
        }
    }

    const handleAddFrontImage = (event) => {
        if (event.key === 'Enter' && productFrontImagesInputValue.trim() !== '') {
            setProductFrontImages([...productFrontImages, productFrontImagesInputValue.trim()]);
            setProductFrontImagesInputValue('');
        }
    }

    const handleAddBackImage = (event) => {
        if (event.key === 'Enter' && productBackImagesInputValue.trim() !== '') {
            setProductBackImages([...productBackImages, productBackImagesInputValue.trim()]);
            setProductBackImagesInputValue('');
        }
    }

    const handleDeleteColor = (colorToDelete) => {
        setColors(colors.filter(color => color !== colorToDelete));
    };

    const handleDeleteColorHex = (colorToDelete) => {
        setColorCodes(colorCodes.filter(color => color !== colorToDelete));
    }

    const handleDeleteFrontImage = (imageToDelete) => {
        setProductFrontImages(productFrontImages.filter(image => image !== imageToDelete));
    }

    const handleDeleteBackImage = (imageToDelete) => {
        setProductBackImages(productBackImages.filter(image => image !== imageToDelete));
    }

    const handleRatingChange = (event) => {
        setRating(event.target.value);
    }

    const handleSizeRangeBottomChange = (event) => {
        setSizeRangeBottom(event.target.value);
    }

    const handleSizeRangeTopChange = (event) => {
        setSizeRangeTop(event.target.value);
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
        if (!name || !vendor || !description || !sizeRangeBottom || !sizeRangeTop || !priceRangeBottom || !priceRangeTop || colors.length === 0 || colorCodes.length === 0 || productFrontImages.length === 0 || productBackImages.length === 0 || !rating || !tag || !category || !type) {
            alert('Please fill out all fields');
            return;
        }
        const product = {
            name,
            vendor,
            description,
            sizeRangeBottom,
            sizeRangeTop,
            priceRangeBottom,
            priceRangeTop,
            colors,
            colorCodes,
            productFrontImages,
            productBackImages,
            rating,
            tag,
            category,
            type
        }
        
        const res = await axios.post(config.backendUrl+'/api/products/add', product);
        if (res.data) {
            alert('Product added successfully');
            //scroll to top of page
            //window.location.reload();
        }
        else
            alert('Product could not be added');
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
                    <Typography variant="h6">Name</Typography>
                    <TextField value={name} onChange={(e)=>setName(e.target.value)} id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Vendor</Typography>
                    <TextField value={vendor} onChange={(e)=>setVendor(e.target.value)} id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Description</Typography>
                    <TextField value={description} onChange={(e)=>setDescription(e.target.value)} id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Size Range</Typography>
                    <Stack direction="row" width="100%" spacing={2} alignItems="center">
                        <FormControl>
                            <Select value={sizeRangeBottom} onChange={handleSizeRangeBottomChange}>
                                <MenuItem value={'S'}>S</MenuItem>
                                <MenuItem value={'M'}>M</MenuItem>
                                <MenuItem value={'L'}>L</MenuItem>
                                <MenuItem value={'XL'}>XL</MenuItem>
                                <MenuItem value={'XLL'}>XLL</MenuItem>
                            </Select>
                        </FormControl>
                        <Typography variant="h6">-</Typography>
                        <FormControl>
                            <Select value={sizeRangeTop} onChange={handleSizeRangeTopChange}>
                                <MenuItem value={'S'}>S</MenuItem>
                                <MenuItem value={'M'}>M</MenuItem>
                                <MenuItem value={'L'}>L</MenuItem>
                                <MenuItem value={'XL'}>XL</MenuItem>
                                <MenuItem value={'XLL'}>XLL</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Price Range ($)</Typography>
                    <Stack direction="row" width="100%" spacing={2} alignItems="center">
                        <TextField value={priceRangeBottom} type="number" onChange={(e)=>setPriceRangeBottom(e.target.value)} id="outlined-basic" variant="outlined" size={mobile ? "small" : "medium"} required />
                        <Typography variant="h6">-</Typography>
                        <TextField value={priceRangeTop} type="number" onChange={(e)=>setPriceRangeTop(e.target.value)} id="outlined-basic" variant="outlined" size={mobile ? "small" : "medium"} required/>
                    </Stack>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Colors</Typography>
                    <TextField
                        value={colorInputValue}
                        onChange={(e) => setColorInputValue(e.target.value)}
                        onKeyPress={handleAddColor}
                        id="outlined-basic"
                        variant="outlined"
                        fullWidth={true}
                        size={mobile ? "small" : "medium"}
                    />
                    <Box>
                        {colors.map((color, index) => (
                            <Chip
                                key={index}
                                label={color}
                                onDelete={() => handleDeleteColor(color)}
                                style={{ margin: '4px' }}
                            />
                        ))}
                    </Box>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Color Codes</Typography>
                    <TextField
                        value={colorHexInputValue}
                        onChange={(e) => setColorHexInputValue(e.target.value)}
                        onKeyPress={handleAddColorHex}
                        id="outlined-basic"
                        variant="outlined"
                        fullWidth={true}
                        size={mobile ? "small" : "medium"}
                    />
                    <Box>
                        {colorCodes.map((color, index) => (
                            <Chip
                                key={index}
                                label={colors[index] + ' - ' +  color}
                                onDelete={() => handleDeleteColorHex(color)}
                                style={{ margin: '4px' }}
                            />
                        ))}
                    </Box>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Product Front Images (URLs)</Typography>
                    <TextField
                        value={productFrontImagesInputValue}
                        onChange={(e) => setProductFrontImagesInputValue(e.target.value)}
                        onKeyPress={handleAddFrontImage}
                        id="outlined-basic"
                        variant="outlined"
                        fullWidth={true}
                        size={mobile ? "small" : "medium"}
                    />
                    <Box>
                        {productFrontImages.map((url, index) => (
                            <Chip
                                key={index}
                                label={url}
                                onDelete={() => handleDeleteFrontImage(url)}
                                style={{ margin: '4px' }}
                            />
                        ))}
                    </Box>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Product Back Images (URLs)</Typography>
                    <TextField
                        value={productBackImagesInputValue}
                        onChange={(e) => setProductBackImagesInputValue(e.target.value)}
                        onKeyPress={handleAddBackImage}
                        id="outlined-basic"
                        variant="outlined"
                        fullWidth={true}
                        size={mobile ? "small" : "medium"}
                    />
                    <Box>
                        {productBackImages.map((url, index) => (
                            <Chip
                                key={index}
                                label={url}
                                onDelete={() => handleDeleteBackImage(url)}
                                style={{ margin: '4px' }}
                            />
                        ))}
                    </Box>
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
                <Button variant="contained" color="primary" fullWidth size={mobile ? "small" : "large"} type="submit">Submit</Button>
            </Stack>
            </form>
        </Box>
    </Box>
  );
}

export default Admin;