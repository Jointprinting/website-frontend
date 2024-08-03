import * as React from 'react';
import { Box, Stack, TextField, RadioGroup, Button, useMediaQuery, FormControlLabel, Radio } from '@mui/material';
import Typography from '../modules/components/Typography';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import config from '../config.json';

function Customize() {
    const mobile = useMediaQuery("(max-width: 800px)");
    const [searchParams] = useSearchParams();
    const id = searchParams.get("styleCode");
    const [success, setSuccess] = React.useState(false);
    const [name, setName] = React.useState('');
    const [businessName, setBusinessName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [phone, setPhone] = React.useState('');
    const [quantity, setQuantity] = React.useState('');
    const [title, setTitle] = React.useState('');
    const [instructions, setInstructions] = React.useState('');
    const [logo, setLogo] = React.useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (!phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
                alert("Please enter a valid phone number in the form of 123-456-7890");
                return;
            }

            const formData = new FormData();
            formData.append('name', name);
            formData.append('businessName', businessName);
            formData.append('email', email);
            formData.append('phone', phone);
            formData.append('quantity', quantity);
            formData.append('title', title);
            formData.append('instructions', instructions);
            formData.append('styleCode', id);
            if (logo) {
                formData.append('logo', logo);
            }

            await axios.post(config.backendUrl+'/api/email/send-mockup-request', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            setSuccess(true);
            setName('');
            setBusinessName('');
            setEmail('');
            setPhone('');
            setQuantity('');
            setTitle('');
            setInstructions('');
            setLogo(null);
            alert("Your mockup request has been sent. We will email you a design in under 24 hours!");
        } catch (err) {
            console.error(err);
            alert("There was an error sending your mockup request. Please try again later.");
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
                    Mockup Request
                </Typography>
                <Typography color="inherit" align="center" variant={mobile ? "h7" : "h5"} fontWeight={200} mb={1}>
                    We'll email you a design in under 24 hours!
                </Typography>
                <form onSubmit={handleSubmit}>
                <Stack display="flex" justifyContent="center" alignItems="center" width={mobile ? '92%' : '40vw'} spacing={2} mt={mobile ? 2 : 4}>
                    <Box width="100%">
                        <Typography variant="h6">Name</Typography>
                        <TextField value={name} onChange={(e)=>setName(e.target.value)}
                        id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Business Name</Typography>
                        <TextField value={businessName} onChange={(e)=>setBusinessName(e.target.value)}
                        id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Email</Typography>
                        <TextField value={email} onChange={(e)=>setEmail(e.target.value)}
                        type="email" id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Phone Number</Typography>
                        <TextField value={phone} onChange={(e)=>setPhone(e.target.value)}
                        id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Approximate Quantity</Typography>
                        <RadioGroup
                            aria-labelledby="demo-radio-buttons-group-label"
                            name="radio-buttons-group"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        >
                            <FormControlLabel value="12-47" control={<Radio />} label="12-47" />
                            <FormControlLabel value="48-71" control={<Radio />} label="48-71" />
                            <FormControlLabel value="72-120" control={<Radio />} label="72-120" />
                            <FormControlLabel value="120+" control={<Radio />} label="120+" />
                        </RadioGroup>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Title</Typography>
                        <TextField value={title} onChange={(e)=>setTitle(e.target.value)}
                        id="outlined-basic" variant="outlined" fullWidth={true} size={mobile ? "small" : "medium"} required/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Logo Upload</Typography>
                        <input type="file" id="myFile" name="filename" onChange={(e) => setLogo(e.target.files[0])}/>
                    </Box>
                    <Box width="100%">
                        <Typography variant="h6">Design Instructions</Typography>
                        <TextField value={instructions} onChange={(e)=>setInstructions(e.target.value)} required
                        id="outlined-basic" placeholder="Place logo here..." variant="outlined" fullWidth={true} multiline={true} minRows={5}/>
                    </Box>
                    <Button variant="contained" color="primary" fullWidth size={mobile ? "small" : "large"} type="submit">Submit</Button>
                </Stack>
                </form>
            </Box>
        </Box>
    );
}

export default Customize;
