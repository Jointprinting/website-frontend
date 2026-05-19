// src/common/QuoteDialog.js
// Reusable quick-quote dialog used on both the Products grid and Product detail pages.
import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, TextField, Button, Typography, Box,
  Collapse, Alert, Grid, IconButton, Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import axios from 'axios';
import config from '../config.json';

function isValidPhone(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

export default function QuoteDialog({ open, onClose, products = [] }) {
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState('');
  const [inHandDate, setInHandDate] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setName(''); setCompanyName(''); setEmail(''); setPhone('');
    setQuantity(''); setInHandDate(''); setNotes('');
    setSuccess(false); setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !companyName || !email || !phone || !quantity || !inHandDate) {
      alert('Please fill out all required fields.');
      return;
    }
    if (!isValidPhone(phone)) {
      alert('Please enter a valid phone number (at least 7 digits).');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('companyName', companyName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('quantity', quantity);
      formData.append('inHandDate', inHandDate);
      formData.append('notes', notes);
      formData.append('selectedProducts', JSON.stringify(products));
      formData.append('website', ''); // honeypot

      await axios.post(config.backendUrl + '/api/email/send-contact', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      try { window.sessionStorage.removeItem('jpSelectedProducts'); } catch (_) {}

      setTimeout(() => {
        reset();
        onClose(true); // true signals a successful submission to the parent
      }, 2500);
    } catch (err) {
      setSubmitting(false);
      alert(err?.response?.data?.error || 'There was an error. Please try again.');
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography fontWeight={800} fontSize={20} lineHeight={1.2}>
            Request your free mockup & quote
          </Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            We'll get back to you within 24 hours — no commitment required.
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" sx={{ mt: -0.5, flexShrink: 0 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 1.5 }}>
        {products.length > 0 && (
          <Paper
            elevation={0}
            sx={{ mb: 2.5, bgcolor: '#e5f4ea', borderRadius: 2, p: 2, border: '1px solid #b7e4c7' }}
          >
            <Typography fontWeight={700} fontSize={13} mb={0.75} color="#1a4a2e">
              {products.length === 1 ? 'Product in your quote:' : 'Products in your quote:'}
            </Typography>
            <Stack spacing={0.4}>
              {products.map((p, i) => (
                <Typography key={i} variant="body2" color="text.primary">
                  {p.name || 'Product'}{p.vendor ? ` — ${p.vendor}` : ''}
                  {p.style ? ` (Style #${p.style})` : ''}
                </Typography>
              ))}
            </Stack>
          </Paper>
        )}

        <form id="quick-quote-form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                value={name}
                label="Your name *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setName(e.target.value)}
                disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={companyName}
                label="Company / Organization *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="email"
                value={email}
                label="Email *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting || success}
              />
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
                disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={quantity}
                label="Quantity per item *"
                variant="outlined"
                fullWidth
                size="small"
                onChange={(e) => setQuantity(e.target.value)}
                disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date"
                value={inHandDate}
                label="In-hand date *"
                variant="outlined"
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setInHandDate(e.target.value)}
                disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                value={notes}
                label="Anything else we should know? (optional)"
                variant="outlined"
                fullWidth
                multiline
                minRows={3}
                onChange={(e) => setNotes(e.target.value)}
                disabled={submitting || success}
              />
            </Grid>
          </Grid>
        </form>

        <Collapse in={success} sx={{ mt: 2 }}>
          <Alert severity="success" icon={<CheckCircleOutlineIcon />} sx={{ borderRadius: 2 }}>
            Request sent! We'll get back to you within 24 hours.
          </Alert>
        </Collapse>
      </DialogContent>

      {!success && (
        <DialogActions sx={{ px: 3, pb: 3, pt: 0, gap: 1 }}>
          <Button onClick={handleClose} color="inherit" disabled={submitting} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="quick-quote-form"
            variant="contained"
            disabled={submitting}
            sx={{ flexGrow: 1, borderRadius: 2, py: 1.3, fontWeight: 700, textTransform: 'none', fontSize: 15 }}
          >
            {submitting ? 'Sending…' : 'Send request — get your mockup'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}
