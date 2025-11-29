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
  Typography as MuiTypography,
} from '@mui/material';
import Typography from '../modules/components/Typography';
import axios from 'axios';
import config from '../config.json';

function Contact() {
  const mobile = useMediaQuery('(max-width: 800px)');

  const [name, setName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [inHandDate, setInHandDate] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [files, setFiles] = React.useState([]); // design files

  const [success, setSuccess] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState([]);

  // Load selected products from sessionStorage
  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setSelectedProducts(parsed);
        }
      }
    } catch (err) {
      console.error('Error reading selected products from storage', err);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Required fields
    if (!name || !companyName || !email || !phone || !quantity || !inHandDate) {
      alert(
        'Please fill out Name, Company Name, Email, Phone Number, Quantity, and In-hand date.'
      );
      return;
    }

    if (!phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
      alert('Please enter a valid phone number in the form of 123-456-7890');
      return;
    }

    try {
      const productLines =
        selectedProducts.length > 0
          ? selectedProducts
              .map(
                (p) =>
                  `- ${p.name || 'Product'} (Style ${p.style || 'N/A'})${
                    p.vendor ? ` — ${p.vendor}` : ''
                  }`
              )
              .join('\n')
          : 'No specific products selected.';

      const message = `
Company: ${companyName}

Interested in:
${productLines}

Approximate quantities (per item):
${quantity}

Ideal in-hand date:
${inHandDate}

Anything else we should know:
${notes || 'Not specified'}
`.trim();

      const formData = new FormData();
      formData.append('name', name);
      formData.append('companyName', companyName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('message', message);
      formData.append('quantity', quantity);
      formData.append('inHandDate', inHandDate);
      formData.append('notes', notes);
      formData.append(
        'selectedProducts',
        JSON.stringify(selectedProducts || [])
      );

      // attach all design files
      files.forEach((file) => {
        formData.append('files', file);
      });

      await axios.post(
        config.backendUrl + '/api/email/send-contact',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setSuccess(true);
      setName('');
      setCompanyName('');
      setEmail('');
      setPhone('');
      setQuantity('');
      setInHandDate('');
      setNotes('');
      setFiles([]);
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

  // Auto-hide success alert
  React.useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [success]);

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
    }
  };

  const handleFileChange = (event) => {
    const fileList = Array.from(event.target.files || []);
    setFiles(fileList);
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
          REQUEST A FREE MOCKUP & QUOTE
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
                <MuiTypography key={idx} align="center" variant="body2">
                  {p.name || 'Product'} (Style {p.style || 'N/A'})
                  {p.vendor ? ` — ${p.vendor}` : ''}
                </MuiTypography>
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
            <TextField
              id="contact-name"
              value={name}
              label="Name"
              variant="outlined"
              fullWidth
              size="small"
              required
              onChange={(e) => setName(e.target.value)}
            />
            <TextField
              id="contact-company"
              value={companyName}
              label="Company Name"
              variant="outlined"
              fullWidth
              size="small"
              required
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <TextField
              id="contact-email"
              type="email"
              value={email}
              label="Email"
              variant="outlined"
              fullWidth
              size="small"
              required
              onChange={(e) => setEmail(e.target.value)}
            />
            <TextField
              id="contact-phone"
              value={phone}
              label="Phone Number"
              variant="outlined"
              fullWidth
              size="small"
              required
              onChange={(e) => setPhone(e.target.value)}
              placeholder="123-456-7890"
            />
            <TextField
              id="contact-quantity"
              value={quantity}
              label="Quantity (for each item)"
              variant="outlined"
              fullWidth
              size="small"
              required
              onChange={(e) => setQuantity(e.target.value)}
            />
            <TextField
              id="contact-inhand"
              value={inHandDate}
              label="In-hand date"
              type="date"
              variant="outlined"
              fullWidth
              size="small"
              required
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setInHandDate(e.target.value)}
            />

            {/* Design files upload */}
            <Box width="100%">
              <Button
                variant="outlined"
                component="label"
                fullWidth
                sx={{ justifyContent: 'flex-start' }}
              >
                Upload design file(s)
                <input
                  type="file"
                  hidden
                  multiple
                  onChange={handleFileChange}
                />
              </Button>
              {files.length > 0 && (
                <Stack mt={1} spacing={0.5}>
                  {files.map((file, idx) => (
                    <MuiTypography key={idx} variant="caption">
                      {file.name}
                    </MuiTypography>
                  ))}
                </Stack>
              )}
            </Box>

            <TextField
              id="contact-notes"
              value={notes}
              label="Anything else we should know?"
              variant="outlined"
              fullWidth
              multiline
              minRows={3}
              onChange={(e) => setNotes(e.target.value)}
            />
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
