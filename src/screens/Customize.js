import * as React from 'react';
import { Box, Stack, TextField, RadioGroup, Button, useMediaQuery, FormControl, FormControlLabel, Radio } from '@mui/material';
import Typography from '../modules/components/Typography';

function Contact() {
    const mobile = useMediaQuery("(max-width: 800px)");
  return (
    <Box bgcolor="#f5f5f5" pt={6} pb={8} display="flex" justifyContent="center">
        <Box 
            sx={{ 
                width: mobile ? '90vw' : '45vw', p: 4, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center", bgcolor:"white", boxShadow: 2, borderRadius: 1
            }}
        >
            <Typography color="primary" align="center" variant={mobile ? "h3" : "h1"} fontWeight="bold">
                Mockup Request
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} fontWeight={200} mb={1}>
                We'll email you a design in under 24 hours!
            </Typography>
            <Stack display="flex" justifyContent="center" alignItems="center" width={mobile ? '92%' : '40vw'} spacing={2} mt={mobile ? 2 : 4}>
                <Box width="100%">
                    <Typography variant="h6">Name</Typography>
                    <TextField id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Business Name</Typography>
                    <TextField id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Email</Typography>
                    <TextField id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Phone Number</Typography>
                    <TextField id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Approximate Quantity</Typography>
                    <RadioGroup
                        aria-labelledby="demo-radio-buttons-group-label"
                        defaultValue="female"
                        name="radio-buttons-group"
                    >
                        <FormControlLabel value="12-47" control={<Radio />} label="12-47" />
                        <FormControlLabel value="48-71" control={<Radio />} label="48-71" />
                        <FormControlLabel value="72-120" control={<Radio />} label="72-120" />
                        <FormControlLabel value="120+" control={<Radio />} label="120+" />
                    </RadioGroup>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Title</Typography>
                    <TextField id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Logo Upload</Typography>
                    <input type="file" id="myFile" name="filename"/>
                </Box>
                <Box width="100%">
                    <Typography variant="h6">Design Intructions</Typography>
                    <TextField id="outlined-basic" placeholder="Place logo here..." variant="outlined" fullWidth={true} multiline={true} minRows={5}/>
                </Box>
                <Button variant="contained" color="primary" fullWidth size={mobile ? "small" : "large"} >Submit</Button>
            </Stack>
        </Box>
    </Box>
  );
}

export default Contact;