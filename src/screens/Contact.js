// src/screens/Contact.js
import * as React from 'react';
import {
  Box,
  Stack,
  TextField,
  Link,
  Button,
  useMediaQuery,
  Collapse,
  Alert,
} from '@mui/material';
import Typography from '../modules/components/Typography';
import axios from 'axios';
import config from '../config.json';

function Contact() {
  const mobile = useMediaQuery('(max-width: 800px)');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [success, setSuccess] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState([]);

  // Load selected products (if any) from sessionStorage and prefill message
  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedProducts(parsed);

          // Only prefill if the user hasn't started typing
          if (!message) {
            const summaryLines = parsed
              .map(
                (p) =>
                  `- ${p.name || 'Product'} (Style ${p.style || 'N/A'})${
                    p.vendor ? ` — ${p.vendor}` : ''
                  }`
              )
              .join('\n');

            setMessage(
              `Interested in:\n${summaryLines}\n\n` +
                `Approximate quantities (per item):\n\n` +
                `Ideal in-hand date:\n\n` +
                `Anything else we should know:\n`
            );
          }
        }
      }
    } catch (err) {
      console.error('Error reading selected products from storage', err);
    }
    // run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!name || !email || !phone || !message) {
        alert('Please fill out all fields');
        return;
      }
      // phone number validation 123-456-7890
      if (!phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
        alert('Please enter a valid phone number in the form of 123-456-7890');
        return;
      }

      await axios.post(config.backendUrl + '/api/email/send-contact', {
        name,
        email,
        phone,
        message,
        selectedProducts,
      });

      setSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setSelectedProducts([]);
      try {
        window.sessionStorage.removeItem('jpSelectedProducts');
      } catch (err) {
        console.error('Error clearing selected products', err);
      }
    } catch (err) {
      console.error(err);
      alert('There was an error sending your message. Please try again later.');
    }
  };

  // useEffect for success alert auto-hide
  React.useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => {
        setSuccess(false);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [success]);

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  };

  return (
    <Box bgcolor="#f5f5f5" pt={6} pb={8} display="flex" justifyContent="center">
      <Box
        sx={{
          width: mobile ? '90vw' : '45vw',
          p: 4,
          display: 'flex',
          justifyContent: 'center',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: 'white',
          boxShadow: 2,
          borderRadius: 1,
        }}
      >
        <Typography
          color="primary"
          align="center"
          variant={mobile ? 'h3' : 'h1'}
          fontWeight="bold"
        >
          Request a free mockup & quote
        </Typography>

        <Typography
          color="inherit"
          align="center"
          variant={mobile ? 'h7' : 'h5'}
          my={1}
        >
          📞 Phone:{' '}
          <Typography
            component={Link}
            fontSize={mobile ? 16 : 18}
            href={`tel:8568997642`}
          >
            +1 (856) 899 7642
          </Typography>
        </Typography>
        <Typography
          color="inherit"
          align="center"
          variant={mobile ? 'h7' : 'h5'}
          fontWeight={200}
          mb={1}
        >
          ✉️ Email:{' '}
          <Typography
            component={Link}
            fontSize={mobile ? 16 : 18}
            href="mailto:nate@jointprinting.com"
          >
            nate@jointprinting.com
          </Typography>
        </Typography>

        {selectedProducts.length > 0 && (
          <Box mt={2} width="100%">
            <Typography
              align="center"
              variant={mobile ? 'h6' : 'h5'}
              fontWeight={500}
              mb={1}
            >
              You selected:
            </Typography>
            <Stack spacing={0.5}>
              {selectedProducts.map((p, idx) => (
                <Typography key={idx} align="center" variant="body2">
                  {p.name || 'Product'} (Style {p.style || 'N/A'})
                  {p.vendor ? ` — ${p.vendor}` : ''}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        <form onSubmit={handleSubmit} onKeyPress={handleKeyPress}>
          <Stack
            display="flex"
            justifyContent="center"
            alignItems="center"
            width={mobile ? '92%' : '40vw'}
            spacing={2}
            mt={mobile ? 4 : 6}
          >
            <Stack direction="row" width="100%" spacing={2} alignItems="start">
              <Stack spacing={1.73}>
                <TextField
                  id="contact-name"
                  value={name}
                  label="Name"
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  id="contact-email"
                  type="email"
                  value={email}
                  label={mobile ? 'Email' : 'Email Address'}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setEmail(e.target.value)}
                />
                <TextField
                  id="contact-phone"
                  value={phone}
                  label={mobile ? 'Phone' : 'Phone Number (123-456-7890)'}
                  variant="outlined"
                  fullWidth
                  size="small"
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Stack>
              <TextField
                id="contact-message"
                value={message}
                label="Project details"
                variant="outlined"
                fullWidth
                multiline
                minRows={5}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Stack>
            <Button variant="contained" color="primary" fullWidth type="submit">
              Send request
            </Button>
            <Collapse in={success}>
              <Alert severity="success">Request sent successfully!</Alert>
            </Collapse>
          </Stack>
        </form>
      </Box>
    </Box>
  );
}

export default Contact;
