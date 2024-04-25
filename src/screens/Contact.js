import * as React from 'react';
import { Box, Stack, TextField, Link, Button, useMediaQuery } from '@mui/material';
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
                Get in touch
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} my={1}>
            📞 Phone: <Typography component={Link} fontSize={mobile ? 16 : 18} href={`tel:8568997642`}>+1 (856) 899 7642 </Typography>
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} fontWeight={200} mb={1}>
                ✉️ Email: <Typography component={Link} fontSize={mobile ? 16 : 18} href="mailto:nate@jointprinting.com">nate@jointprinting.com</Typography>
            </Typography>
            <Stack display="flex" justifyContent="center" alignItems="center" width={mobile ? '92%' : '40vw'} spacing={2} mt={mobile ? 4 : 6}>
                <Stack direction="row" width="100%" spacing={2} alignItems="start" >
                    <Stack spacing={1.73}>
                        <TextField id="outlined-basic" label="Name" variant="outlined" fullWidth={true} size="small"/>
                        <TextField id="outlined-basic" label={mobile ? "Email" : "Email Address"} variant="outlined" fullWidth={true} size="small"/>
                        <TextField id="outlined-basic" label={mobile ? "Phone" : "Phone Number"} variant="outlined" fullWidth={true} size="small"/>
                    </Stack>
                    <TextField id="outlined-basic" label="Message" variant="outlined" fullWidth={true} multiline={true} minRows={5}/>
                </Stack>
                <Button variant="contained" color="primary" fullWidth >Send Message</Button>
            </Stack>
        </Box>
    </Box>
  );
}

export default Contact;