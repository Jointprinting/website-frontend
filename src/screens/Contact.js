import * as React from 'react';
import { Box, Stack, TextField, Link, Button, useMediaQuery, Collapse, Alert } from '@mui/material';
import Typography from '../modules/components/Typography';
import axios from 'axios';

function Contact() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [success, setSuccess] = React.useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!name || !email || !phone || !message) {
                alert("Please fill out all fields");
                return;
            }
            //raise error if phone number not in the form of 123-456-7890
            if (!phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
                alert("Please enter a valid phone number in the form of 123-456-7890");
                return;
            }
            await axios.post('http://localhost:8080/api/email/send-contact', {name, email, phone, message});
            setSuccess(true);
            setName('');
            setEmail('');
            setPhone('');
            setMessage('');
        } catch (err) {
            console.error(err);
            alert("There was an error sending your message. Please try again later.");
        }
        
    }

    //useEffect for success alert
    React.useEffect(() => {
        if (success) {
            setTimeout(() => {
                setSuccess(false);
            }, 5000);
        }
    }
    , [success]);

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
            <Typography color="primary" align="center" variant={mobile ? "h3" : "h1"} fontWeight="bold">
                Get in touch
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} my={1}>
            📞 Phone: <Typography component={Link} fontSize={mobile ? 16 : 18} href={`tel:8568997642`}>+1 (856) 899 7642 </Typography>
            </Typography>
            <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} fontWeight={200} mb={1}>
                ✉️ Email: <Typography component={Link} fontSize={mobile ? 16 : 18} href="mailto:nate@jointprinting.com">nate@jointprinting.com</Typography>
            </Typography>
            <form onSubmit={handleSubmit} onKeyPress={handleKeyPress}>
                <Stack display="flex" justifyContent="center" alignItems="center" width={mobile ? '92%' : '40vw'} spacing={2} mt={mobile ? 4 : 6}>
                    <Stack direction="row" width="100%" spacing={2} alignItems="start" >
                        <Stack spacing={1.73}>
                            <TextField id="outlined-basic" value={name} label="Name" variant="outlined" fullWidth={true} size="small" onChange={(e)=>setName(e.target.value)}/>
                            <TextField id="outlined-basic" type="email" value={email} label={mobile ? "Email" : "Email Address"} variant="outlined" fullWidth={true} size="small" onChange={(e)=>setEmail(e.target.value)}/>
                            <TextField id="outlined-basic" value={phone} label={mobile ? "Phone" : "Phone Number"} variant="outlined" fullWidth={true} size="small" onChange={(e)=>setPhone(e.target.value)}/>
                        </Stack>
                        <TextField id="outlined-basic" value={message} label="Message" variant="outlined" fullWidth={true} multiline={true} minRows={5} onChange={(e)=>setMessage(e.target.value)}/>
                    </Stack>
                    <Button variant="contained" color="primary" fullWidth type="submit">Send Message</Button>
                    <Collapse in={success}>
                        <Alert severity="success">Message sent successfully!</Alert>
                    </Collapse>
                </Stack>
            </form>
        </Box>
    </Box>
  );
}

export default Contact;