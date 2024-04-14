import * as React from 'react';
import { Box, Stack, TextField, Link, Button } from '@mui/material';
import Typography from '../modules/components/Typography';

function Contact() {
  return (
    <Box bgcolor="#f5f5f5" pt={6} pb={8} display="flex" justifyContent="center">
        <Box 
            sx={{ 
                width: '45vw', p: 4, display:"flex", justifyContent:"center", flexDirection:"column", alignItems:"center", bgcolor:"white", boxShadow: 2, borderRadius: 1
            }}
        >
            <Typography color="primary" align="center" variant="h1" fontWeight="bold">
                Get in touch
            </Typography>
            <Typography color="inherit" align="center" variant="h5" my={1}>
            📞 Phone: <Typography component={Link} fontSize={18} href={`tel:8568997642`}>+1 (856) 899 7642 </Typography>
            </Typography>
            <Typography color="inherit" align="center" variant="h5" mb={1}>
                ✉️ Email: <Typography component={Link} fontSize={18} href="mailto:hello@jointprinting.com">hello@jointprinting.com</Typography>
            </Typography>
            <Stack display="flex" justifyContent="center" alignItems="center" width='40vw' spacing={2} mt={6}>
                <Stack direction="row" width="100%" spacing={2} alignItems="start" >
                    <Stack spacing={1.73}>
                        <TextField id="outlined-basic" label="Name" variant="outlined" fullWidth={true} size="small"/>
                        <TextField id="outlined-basic" label="Email Address" variant="outlined" fullWidth={true} size="small"/>
                        <TextField id="outlined-basic" label="Phone Number" variant="outlined" fullWidth={true} size="small"/>
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