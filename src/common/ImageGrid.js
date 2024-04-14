import React from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

const ImageGrid = ({ images }) => {
    const theme = useTheme();
    const isLargeScreen = useMediaQuery(theme.breakpoints.up('lg')); // greater than 1200px
    const isMediumScreen = useMediaQuery(theme.breakpoints.between('sm', 'lg')); // between 600px and 1200px
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm')); // less than 600px

    const getGridListCols = () => {
        if (isLargeScreen) {
            return 4; // 4 columns in large screens
        } else if (isMediumScreen) {
            return 2; // 2 columns in medium screens
        } else {
            return 1; // 1 column in small screens
        }
    };

    return (
        <Box>
        <Grid container spacing={2}>
            {images.map((img, index) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={index} style={{ maxWidth: '300px', flexBasis: '300px' }}>
                    <img src={img} alt={`img-${index}`} style={{ width: '100%', height: '300px', objectFit: 'cover' }} />
                </Grid>
            ))}
        </Grid>
        </Box>
    );
};

export default ImageGrid;