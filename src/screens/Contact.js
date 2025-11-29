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
  IconButton,
  Typography as MuiTypography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
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
  const [files, setFiles] = React.useState([]);
  const [success, setSuccess] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState([]);

  // Load selected products (if any) from sessionStorage
  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedProducts(parsed);
        }
      }
    } catch (err) {
      console.error('Error reading selected products from storage', err);
    }
  }, []);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    setFiles((prev) => [...prev, ...newFiles]);
    // allow picking the same file again if needed
    e.target.value = '';
  };

  const handleRemoveFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Required fields except "Anything else we should know?"
    if (!name || !companyName || !email || !phone || !quantity || !inHandDate) {
      alert('Please fill out all required fields.');
      return;
    }

    // phone number validation 123-456-7890
    if (!phone.match(/^\d{3}-\d{3}-\d{4}$/)) {
      alert('Please enter a valid phone number in the form of 123-456-7890');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('companyName', companyName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('quantity', quantity);
      formData.append('inHandDate', inHandDate);
      formData.append('notes', notes);
      formData.append('selectedProducts', JSON.stringify(selectedProducts || []));

      files.forEach((file) => {
        formData.append('designFiles', file);
      });

      await axios.post(config.backendUrl + '/api/email/send-contact', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

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
      console.error('Error sending contact request', err?.response || err);
      const msg =
        err?.response?.data?.error ||
        'There was an error sending your message. Please try again later.';
      alert(msg);
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
            <Stack width="100%" spacing={2}>
              <TextField
                id="contact-name"
                value={name}
                label="Name *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                id="contact-company"
                value={companyName}
                label="Company Name *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setCompanyName(e.target.value)}
              />
              <TextField
                id="contact-email"
                type="email"
                value={email}
                label="Email *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                id="contact-phone"
                value={phone}
                label="Phone Number (123-456-7890) *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setPhone(e.target.value)}
              />
              <TextField
                id="contact-quantity"
                value={quantity}
                label="Quantity (for each item) *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setQuantity(e.target.value)}
              />
              <TextField
                id="contact-inhand"
                type="date"
                value={inHandDate}
                label="In-hand date *"
                variant="outlined"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setInHandDate(e.target.value)}
              />

              {/* File upload */}
              <Box>
                <Button
                  variant="outlined"
                  component="label"
                  startIcon={<UploadFileIcon />}
                  sx={{ mb: 1 }}
                >
                  Upload design files
                  <input
                    type="file"
                    hidden
                    multiple
                    onChange={handleFileChange}
                  />
                </Button>
                {files.length > 0 && (
                  <Stack spacing={0.5}>
                    {files.map((file, idx) => (
                      <Stack
                        key={idx}
                        direction="row"
                        alignItems="center"
                        spacing={1}
                      >
                        <MuiTypography variant="body2">
                          {file.name}
                        </MuiTypography>
                        <IconButton
                          size="small"
                          onClick={() => handleRemoveFile(idx)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Stack>
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
                minRows={4}
                onChange={(e) => setNotes(e.target.value)}
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
