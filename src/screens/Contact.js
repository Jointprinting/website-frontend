// src/screens/Contact.js
import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box, Stack, TextField, Link, Button,
  Collapse, Alert, IconButton, Typography as MuiTypography,
  Avatar, Paper, Container, Grid,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AvatarGroup from '@mui/material/AvatarGroup';
import Typography from '../modules/components/Typography';
import axios from 'axios';
import config from '../config.json';

const steps = [
  { icon: '📋', title: 'Fill out the form', body: 'Tell us your products, quantity, and in-hand date. Attach any art you have.' },
  { icon: '🎨', title: 'Get your free mockup', body: "We'll send back a mockup and quote — usually within 24 hours." },
  { icon: '✅', title: 'Approve & go', body: 'Love it? Approve the mockup and we handle everything from there.' },
];

const trustPoints = [
  'No account or login required',
  'Free mockups, zero commitment',
  'Response within 24 hours',
  '30,000+ units delivered',
];

// Permissive phone check: any 7-15 digit string regardless of formatting.
function isValidPhone(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

function Contact() {
  const [searchParams] = useSearchParams();
  const isReferralContext = searchParams.get('topic') === 'referral';

  const [name, setName] = React.useState('');
  const [companyName, setCompanyName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [quantity, setQuantity] = React.useState('');
  const [inHandDate, setInHandDate] = React.useState('');
  const [notes, setNotes] = React.useState(
    isReferralContext
      ? "I'd like to refer someone (or learn more about your referral program). Details:\n\n"
      : ''
  );
  const [files, setFiles] = React.useState([]);
  const [success, setSuccess] = React.useState(false);
  const [selectedProducts, setSelectedProducts] = React.useState([]);

  React.useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem('jpSelectedProducts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedProducts(parsed);
      }
    } catch (err) { console.error('Error reading selected products', err); }
  }, []);

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;
    setFiles((prev) => [...prev, ...newFiles]);
    e.target.value = '';
  };

  const handleRemoveFile = (index) => setFiles((prev) => prev.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !companyName || !email || !phone || !quantity || !inHandDate) {
      alert('Please fill out all required fields.');
      return;
    }
    if (!isValidPhone(phone)) {
      alert('Please enter a valid phone number with at least 7 digits.');
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
      formData.append('website', ''); // Honeypot — bots fill this, real users don't
      files.forEach((file) => { formData.append('files', file); });

      await axios.post(config.backendUrl + '/api/email/send-contact', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      setName(''); setCompanyName(''); setEmail(''); setPhone('');
      setQuantity(''); setInHandDate(''); setNotes(''); setFiles([]);
      setSelectedProducts([]);
      try { window.sessionStorage.removeItem('jpSelectedProducts'); } catch (err) {}
    } catch (err) {
      console.error('Error sending contact request', err?.response || err);
      alert(err?.response?.data?.error || 'There was an error sending your message. Please try again later.');
    }
  };

  React.useEffect(() => {
    if (success) {
      const timeout = setTimeout(() => setSuccess(false), 5000);
      return () => clearTimeout(timeout);
    }
  }, [success]);

  const handleKeyPress = (event) => { if (event.key === 'Enter') event.preventDefault(); };

  return (
    <Box sx={{ bgcolor: '#f5f5f5', minHeight: '100vh' }}>

      {/* HERO */}
      <Box sx={{ bgcolor: '#111816', py: { xs: 7, md: 9 }, textAlign: 'center' }}>
        <Container maxWidth="md">
          <MuiTypography variant="overline" sx={{ letterSpacing: 4, color: '#4ade80', display: 'block', mb: 2, fontSize: 12 }}>
            {isReferralContext ? 'REFER & EARN' : 'REQUEST A FREE MOCKUP'}
          </MuiTypography>
          <Typography variant="h3" component="h1" sx={{ color: 'white', fontWeight: 800, mb: 2, lineHeight: 1.15 }}>
            {isReferralContext ? "Send us a referral" : 'Request a free mockup & quote'}
          </Typography>
          <MuiTypography variant="h6" sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 300, maxWidth: 500, mx: 'auto', lineHeight: 1.7 }}>
            {isReferralContext
              ? "Drop the details in the form below — we'll take it from there and credit your account when they order."
              : "Fill out the form and we'll get back to you with a mockup and clear pricing — usually within 24 hours."}
          </MuiTypography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} justifyContent="center" sx={{ mt: 3 }}>
            <MuiTypography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
              📞 <Link href="tel:8568997642" sx={{ color: 'rgba(255,255,255,0.75)', textDecorationColor: 'rgba(255,255,255,0.3)' }}>(856) 899-7642</Link>
            </MuiTypography>
            <MuiTypography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>
              ✉️ <Link href="mailto:nate@jointprinting.com" sx={{ color: 'rgba(255,255,255,0.75)', textDecorationColor: 'rgba(255,255,255,0.3)' }}>nate@jointprinting.com</Link>
            </MuiTypography>
          </Stack>
        </Container>
      </Box>

      {/* MAIN */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={6} alignItems="flex-start">

          {/* FORM */}
          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: { xs: 3, sm: 5 }, borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
              {selectedProducts.length > 0 && (
                <Paper elevation={0} sx={{ mb: 4, bgcolor: '#e5f4ea', borderRadius: 3, p: 2.5, border: '1px solid #b7e4c7' }}>
                  <MuiTypography fontWeight={700} mb={1} fontSize={15}>Selected products:</MuiTypography>
                  <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                    <AvatarGroup max={4} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: 12 } }}>
                      {selectedProducts.map((p) => (
                        <Avatar key={p.style} src={p.thumbnail || undefined}>{p.name ? p.name.charAt(0) : '?'}</Avatar>
                      ))}
                    </AvatarGroup>
                    <Stack spacing={0.3}>
                      {selectedProducts.map((p, idx) => (
                        <MuiTypography key={idx} variant="body2">
                          {p.name || 'Product'} (Style {p.style || 'N/A'}){p.vendor ? ` — ${p.vendor}` : ''}
                        </MuiTypography>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>
              )}

              <form onSubmit={handleSubmit} onKeyPress={handleKeyPress}>
                <Stack spacing={2.5}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField value={name} label="Name *" variant="outlined" fullWidth size="small" onChange={(e) => setName(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField value={companyName} label="Company Name *" variant="outlined" fullWidth size="small" onChange={(e) => setCompanyName(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField type="email" value={email} label="Email *" variant="outlined" fullWidth size="small" onChange={(e) => setEmail(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        value={phone}
                        label="Phone *"
                        placeholder="(856) 555-1234"
                        variant="outlined"
                        fullWidth
                        size="small"
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField value={quantity} label="Quantity per item *" variant="outlined" fullWidth size="small" onChange={(e) => setQuantity(e.target.value)} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField type="date" value={inHandDate} label="In-hand date *" variant="outlined" fullWidth size="small" InputLabelProps={{ shrink: true }} onChange={(e) => setInHandDate(e.target.value)} />
                    </Grid>
                  </Grid>

                  <Box>
                    <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
                      Upload design files (optional)
                      <input type="file" hidden multiple onChange={handleFileChange} />
                    </Button>
                    {files.length > 0 && (
                      <Stack spacing={0.5} mt={1}>
                        {files.map((file, idx) => (
                          <Stack key={idx} direction="row" alignItems="center" spacing={1}>
                            <MuiTypography variant="body2" color="text.secondary">{file.name}</MuiTypography>
                            <IconButton size="small" onClick={() => handleRemoveFile(idx)}><DeleteIcon fontSize="small" /></IconButton>
                          </Stack>
                        ))}
                      </Stack>
                    )}
                  </Box>

                  <TextField value={notes} label="Anything else we should know?" variant="outlined" fullWidth multiline minRows={4} onChange={(e) => setNotes(e.target.value)} />

                  <Button variant="contained" color="primary" fullWidth type="submit" size="large"
                    sx={{ borderRadius: 2, py: 1.6, fontSize: 16, fontWeight: 700, textTransform: 'none' }}>
                    Send request — get your mockup
                  </Button>

                  <Collapse in={success}>
                    <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ borderRadius: 2 }}>
                      Request sent! We'll get back to you within 24 hours.
                    </Alert>
                  </Collapse>
                </Stack>
              </form>
            </Paper>
          </Grid>

          {/* TRUST PANEL */}
          <Grid item xs={12} md={5}>
            <Stack spacing={4}>
              <Box>
                <MuiTypography variant="overline" sx={{ letterSpacing: 3, color: 'text.secondary', display: 'block', mb: 2, fontSize: 11 }}>
                  WHAT HAPPENS NEXT
                </MuiTypography>
                <Stack spacing={2}>
                  {steps.map((step, idx) => (
                    <Paper key={idx} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid', borderColor: 'divider', display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                      <Box sx={{ fontSize: 24, lineHeight: 1.3, flexShrink: 0 }}>{step.icon}</Box>
                      <Box>
                        <MuiTypography fontWeight={700} fontSize={15} mb={0.5}>{step.title}</MuiTypography>
                        <MuiTypography variant="body2" color="text.secondary" lineHeight={1.65}>{step.body}</MuiTypography>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              </Box>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#111816', border: '1px solid #1a3d2b' }}>
                <MuiTypography fontWeight={800} fontSize={15} sx={{ color: 'white', mb: 2 }}>Why Joint Printing</MuiTypography>
                <Stack spacing={1.5}>
                  {trustPoints.map((point) => (
                    <Stack key={point} direction="row" spacing={1.5} alignItems="center">
                      <CheckCircleOutlineIcon sx={{ color: '#4ade80', fontSize: 18, flexShrink: 0 }} />
                      <MuiTypography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{point}</MuiTypography>
                    </Stack>
                  ))}
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 3, borderRadius: 3, bgcolor: '#f9fdf9', border: '1px solid #b7e4c7', textAlign: 'center' }}>
                <MuiTypography fontWeight={700} fontSize={15} mb={1}>Prefer to talk it through?</MuiTypography>
                <MuiTypography variant="body2" color="text.secondary" mb={2} lineHeight={1.65}>
                  Book a free 15-min call and we'll figure out the right products and approach together.
                </MuiTypography>
                <Button component="a" href="https://calendly.com/nate-jointprinting/30min" target="_blank" rel="noopener noreferrer"
                  variant="outlined" fullWidth
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, borderColor: '#1a3d2b', color: '#1a3d2b', '&:hover': { bgcolor: '#1a3d2b', color: 'white' } }}>
                  Book a free call
                </Button>
              </Paper>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

export default Contact;
