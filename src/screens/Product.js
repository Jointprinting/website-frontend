import  {React, useEffect, useState} from 'react';
import { Box, Stack, Typography, Chip, Button, Rating, Tooltip, useMediaQuery } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import config from '../config.json';

function Product() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get("styleCode");
    const [productVendor, setProductVendor] = useState("");
    const [productStyle, setProductStyle] = useState("");
    const [productRating, setProductRating] = useState(5);
    const [productTitle, setProductTitle] = useState("");
    const [productPriceRangeBottom, setProductPriceRangeBottom] = useState("10");
    const [productPriceRangeTop, setProductPriceRangeTop] = useState("20");
    const [productSizeRangeBottom, setProductSizeRangeBottom] = useState("S");
    const [productSizeRangeTop, setProductSizeRangeTop] = useState("XXL");
    const [productTag, setProductTag] = useState("Best Seller");
    const [productTagColor, setProductTagColor] = useState("warning");
    const [productColorOptions, setProductColorOptions] = useState([]);
    const [productColorCodes, setProductColorCodes] = useState([]);
    const [productFrontImages, setProductFrontImages] = useState([]);
    const [productBackImages, setProductBackImages] = useState([]);
    const [productDescription, setProductDescription] = useState("");
    const [frontSelected, setFrontSelected] = useState(true);
    const [productColor, setProductColor] = useState("");
    const [productColorCode, setProductColorCode] = useState("");
    const [selectedCircle, setSelectedCircle] = useState({});
    const [productIndex, setProductIndex] = useState(0);

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

    //function to capitalize the first letter of a string
    const capitalize = (str) => {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    //useEffect to get product by id
    useEffect(() => {
        const fetchProduct = async () => {
            try {
                const response = await fetch(config.backendUrl+'/api/products/style/'+id);
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
                const colors = data.colors.map((color) => capitalize(color));
                setProductColorOptions(colors);
                setProductColorCodes(data.colorCodes);
                setProductFrontImages(data.productFrontImages);
                setProductBackImages(data.productBackImages);
                setProductDescription(data.description);
                setProductColor(colors[0]);
                setProductColorCode(data.colorCodes[0]);
                //console.log(data);
            } catch (err) {
                console.error(err);
            }
        }
        fetchProduct();
    }, [id]);

    //useEffect to change the color of the circle when the productColor changes
    useEffect(() => {
        setSelectedCircle(
            {
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: productColorCode,
                border: '1px solid white', // White border
                boxShadow: '0 0 0 1px gray', // Gray outer border
            }
        )
    }
    , [productColorCode]);

  return (
    <Box px="5vw" py="7vh" bgcolor="#f5f5f5">
        <Stack direction={mobile ? "column" : "row"} spacing={'4vw'} alignItems={mobile ? "center" : "top"} sx={{width: '100%'}}>
            {/* Stack for clothing images */}
            <Stack direction={"row"} alignItems="top" spacing={'4vw'}>
                {/* Stack for tiny product images */}
                <Stack spacing={2}>
                    <img src={productFrontImages[productIndex]} alt="product front" onClick={() => setFrontSelected(true)}
                        style={{width: mobile ? '8vw' : '5vw', height: 'auto', cursor: 'pointer', border: frontSelected ? '1px green solid' : 'none'}} 
                    />

                    {productBackImages[productIndex] && <img src={productBackImages[productIndex]} alt="product back" onClick={() => setFrontSelected(false)}
                        style={{width: mobile ? '8vw' : '5vw', height: 'auto', cursor: 'pointer', border: frontSelected ? 'none' : '1px green solid',}} 
                    />}
                </Stack>

                {/* Stack for large product images */}
                <Stack spacing={4}>
                    <img src={frontSelected ? productFrontImages[productIndex] : productBackImages[productIndex]} alt="product" style={{width: mobile ? '40vw' : '33vw', height: 'auto', boxShadow: '0 0 10px 0px lightgray'}} />
                    {/*<img src={productBackImages[0]} alt="product" style={{width: '33vw', height: 'auto'}} />*/}
                </Stack>
            </Stack>


            {/* Stack for product details */}
            <Stack spacing={2.5} pr='5vw' alignItems={mobile ? "center" : 'start'} sx={{ maxWidth: mobile ? '80vw' : '49vw' }}>
                {/* Stack for product vendor, style, and rating */}
                <Stack spacing={1.5} direction="row" alignItems="center">
                    <Typography color='black'>{productVendor}</Typography>
                    <Typography color="gray">Style #{productStyle}</Typography>
                    <Chip label={productTag} color={productTagColor} variant='outlined'/>
                    <Rating name="read-only" value={productRating} readOnly size="small" />
                </Stack>

                {/* Product title */}
                <Typography fontSize={24} fontWeight="900" color='black'>{productTitle}</Typography>

                {/* Stack for product price and size range */}
                <Stack spacing={7} direction="row">
                    <Stack spacing={0.5}>
                        <Typography color='black'>Typically</Typography>
                        <Typography fontSize={24} color='black'>
                            ${productPriceRangeBottom} - ${productPriceRangeTop}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.5}>
                        <Typography color='black'>Comes in</Typography>
                        <Typography fontSize={24} color='black'>
                            {productSizeRangeBottom} - {productSizeRangeTop}
                        </Typography>
                    </Stack>
                </Stack>

                <Typography color='gray' textAlign={mobile ? 'center' : 'none'} fontSize={mobile ? 12 : 16}>
                    *The price will depend on your design and your order size. Customize the product below for a more accurate estimate.*
                </Typography>

                {/* Stack for current color */}
                <Stack direction="row" spacing={1} alignItems="center">
                    <Typography color="black" fontWeight="bold">
                    Color selected:
                    </Typography>
                    <Box
                    sx={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: productColorCode,
                        border: '1px solid white',
                        boxShadow: '0 0 0 1px gray',
                    }}
                    ></Box>
                    <Typography color="charcoal" fontWeight="bold">
                    {productColor}
                    </Typography>
                </Stack>

                {/* Scrollable container for all colors */}
                <Box
                    sx={{
                    overflowX: 'auto', // Enable horizontal scrolling
                    width: '100%', // Full width
                    paddingTop: '8px', // Optional padding
                    paddingBottom: '8px', // Optional padding
                    px: '2px'
                    }}
                >
                    <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        flexWrap: 'nowrap', // Prevent wrapping to new lines
                        width: 'fit-content', // Adjust width to content
                    }}
                    >
                    {productColorOptions.map((item, index) => (
                        <Tooltip title={item} placement="top" arrow={true} key={index}>
                        <Box
                            onClick={() => {
                            setProductColor(item);
                            setProductColorCode(productColorCodes[index]);
                            setProductIndex(index);
                            }}
                            sx={{
                            cursor: 'pointer',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            backgroundColor: productColorCodes[index],
                            border: item === productColor ? '2px solid white' : 'none',
                            boxShadow: item === productColor ? '0 0 0 2px gray' : 2,
                            flexShrink: 0, // Prevent shrinking
                            marginRight: '8px', // Spacing between circles
                            }}
                        />
                        </Tooltip>
                    ))}
                    </Box>
                </Box>

                <Stack spacing={1}>
                    <Button variant="contained" size="large" sx={{width: '100%'}} onClick={()=>navigate(`/customize?styleCode=${id}`)}> Customize </Button>
                    <Typography fontSize={12}>Free mockup by <b>4 AM.</b></Typography>
                </Stack>

                <Typography color='charcoal' textAlign={mobile ? 'center' : 'none'} fontSize={mobile ? 14 : 16}>
                    {productDescription}
                </Typography>

            </Stack>
        </Stack>
    </Box>
  );
}

export default Product;