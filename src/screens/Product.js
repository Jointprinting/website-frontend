import  {React, useEffect, useState} from 'react';
import { Box, Stack, Typography, Chip, Button, Rating, Tooltip, useMediaQuery } from '@mui/material';

function Product() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const productVendor = "Vendor";
    const productStyle = "12345";
    const productRating = 5;
    //const productRatings = new Array(productRating).fill('https://fp.freshprints.com/assets/icons/yellow_star.svg');
    const productTitle = "Garment Dyed Short Sleeve T-Shirt";
    const productPriceRangeBttom = "10";
    const productPriceRangeTop = "20";
    const productSizeRangeBttom = "S";
    const productSizeRangeTop = "XXL";
    const productTag = "Best Seller";
    let productTagColor = "warning";
    if (productTag === "Best Seller") {
        productTagColor = "success";
    }
    const productColorOptions = ["White", "Black", "Red", "Blue", "Gray"];
    const productColorCodes = ["#FFFFFF", "#000000", "#FF0000", "#0000FF", "#808080"];
    //const productColor = "White";
    //const productColorCode = "#FFFFFF";

    const productFrontImages = [
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/White_F_cdcaf2f4-9cb4-42fc-9a49-47b07c97df5c.jpg?v=1711658788/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Black_F_8295c8ff-499d-4372-aa51-5765a45d7eeb.jpg?v=1711658790/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Crimson_F_79d746ba-d33c-4074-8a26-3941f2eb0e6d.jpg?v=1711658788/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/DelicateBlue_F.jpg?v=1711658787/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Concrete_F.jpg?v=1711658794/func=resize&h=640'
    ]
    const productBackImages = [
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/White_B_44bca3d5-2126-41d3-9f85-7d2782fd2dd4.jpg?v=1711658792/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Black_B_caf98d4f-5784-4e34-9fe3-ccbe3ab0dfb6.jpg?v=1711658788/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Crimson_B_25913a2e-24dc-4ade-9300-c299d2550ec7.jpg?v=1711658787/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/DelicateBlue_B.jpg?v=1711658790/func=resize&h=640',
        'https://alofmzptzp.cloudimg.io/v7/https://cdn.shopify.com/s/files/1/1544/1909/files/Concrete_B.jpg?v=1711658791/func=resize&h=640'
    ]

    const productDescription = "This is a description of the product. It is a very good product. You should buy it.";

    const [frontSelected, setFrontSelected] = useState(true);
    const [productColor, setProductColor] = useState("White");
    const [productColorCode, setProductColorCode] = useState("#FFFFFF");
    const [selectedCircle, setSelectedCircle] = useState({});
    const [productIndex, setProductIndex] = useState(0);

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
        <Stack direction={mobile ? "column" : "row"} spacing={'4vw'} alignItems={mobile ? "center" : "top"}>
            {/* Stack for clothing images */}
            <Stack direction={"row"} alignItems="top" spacing={'4vw'}>
                {/* Stack for tiny product images */}
                <Stack spacing={2}>
                    <img src={productFrontImages[productIndex]} alt="product" onClick={() => setFrontSelected(true)}
                        style={{width: '5vw', height: 'auto', cursor: 'pointer', border: frontSelected ? '1px green solid' : 'none'}} 
                    />
                    <img src={productBackImages[productIndex]} alt="product" onClick={() => setFrontSelected(false)}
                        style={{width: '5vw', height: 'auto', cursor: 'pointer', border: frontSelected ? 'none' : '1px green solid',}} 
                    />
                </Stack>

                {/* Stack for large product images */}
                <Stack spacing={4}>
                    <img src={frontSelected ? productFrontImages[productIndex] : productBackImages[productIndex]} alt="product" style={{width: '33vw', height: 'auto', boxShadow: '0 0 10px 0px lightgray'}} />
                    {/*<img src={productBackImages[0]} alt="product" style={{width: '33vw', height: 'auto'}} />*/}
                </Stack>
            </Stack>


            {/* Stack for product details */}
            <Stack spacing={2.5} pr='5vw' alignItems={mobile ? "center" : 'start'}>
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
                            ${productPriceRangeBttom} - ${productPriceRangeTop}
                        </Typography>
                    </Stack>
                    <Stack spacing={0.5}>
                        <Typography color='black'>Comes in</Typography>
                        <Typography fontSize={24} color='black'>
                            {productSizeRangeBttom} - {productSizeRangeTop}
                        </Typography>
                    </Stack>
                </Stack>

                <Typography color='gray' textAlign={mobile ? 'center' : 'none'} fontSize={mobile ? 12 : 16}>
                    *The price will depend on your design and your order size. Customize the product below for a more accurate estimate.*
                </Typography>

                {/* Stack for current color */}
                <Stack direction='row' spacing={1} alignItems='center'>
                    <Typography color='black' fontWeight='bold'>Color selected:</Typography>
                    <div style={selectedCircle}></div>
                    <Typography color='charcoal' fontWeight='bold'>{productColor}</Typography>
                </Stack>

                 {/* Stack for all colors */}
                 <Stack direction='row' spacing={1} alignItems='center'>
                    {productColorOptions.map((item, index) => ( // Loop through each item in the array
                        <Tooltip title={item} placement="top" arrow={true}>
                            <Box 
                                onClick={() => {setProductColor(item); setProductColorCode(productColorCodes[index]); setProductIndex(index)}} // Set the product color to the item
                                sx={
                                    {
                                        cursor: 'pointer',
                                        width: '28px',
                                        height: '28px',
                                        borderRadius: '50%',
                                        backgroundColor: productColorCodes[index],
                                        border: item === productColor ? '2px solid white' : 'none', // White border
                                        boxShadow: item === productColor ? '0 0 0 2px gray' : 2, // Gray outer border
                                    }
                                }
                            />
                        </Tooltip>

                    ))}
                </Stack>

                <Stack spacing={1}>
                    <Button variant="contained" size="large" sx={{width: '100%'}}> Customize </Button>
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