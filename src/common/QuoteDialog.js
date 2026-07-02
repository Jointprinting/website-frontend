// src/common/QuoteDialog.js
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Stack, TextField, Button, Typography, Box,
  Collapse, Alert, Grid, IconButton, Paper, Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteIcon from '@mui/icons-material/Delete';
import axios from 'axios';
import config from '../config.json';

function isValidPhone(s) {
  const digits = String(s || '').replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

// Submit-time validation order — also determines which invalid field gets focus.
const REQUIRED_FIELDS = ['name', 'companyName', 'email', 'phone', 'shipToState', 'quantity', 'inHandDate'];

export default function QuoteDialog({ open, onClose, products = [] }) {
  const [localProducts, setLocalProducts] = useState([]);
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shipToState, setShipToState] = useState('');
  const [quantity, setQuantity] = useState('');
  const [inHandDate, setInHandDate] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState([]);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const fieldRefs = useRef({});

  const clearError = (field) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // Sync product list from parent whenever the dialog opens
  useEffect(() => {
    if (open) setLocalProducts(products);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeProduct = (style) =>
    setLocalProducts((prev) => prev.filter((p) => p.style !== style));

  const handleFileChange = (e) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length) setFiles((prev) => [...prev, ...incoming]);
    e.target.value = '';
  };

  const handleRemoveFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const reset = () => {
    setName(''); setCompanyName(''); setEmail(''); setPhone('');
    setShipToState(''); setQuantity(''); setInHandDate(''); setNotes(''); setFiles([]);
    setSuccess(false); setSubmitting(false); setErrors({});
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const values = { name, companyName, email, phone, shipToState, quantity, inHandDate };
    const nextErrors = {};
    REQUIRED_FIELDS.forEach((field) => { if (!values[field]) nextErrors[field] = 'Required'; });
    if (phone && !isValidPhone(phone)) nextErrors.phone = 'Enter 7–15 digits';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalid = fieldRefs.current[REQUIRED_FIELDS.find((f) => nextErrors[f])];
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus({ preventScroll: true });
      }
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('companyName', companyName);
      formData.append('email', email);
      formData.append('phone', phone);
      formData.append('shipToState', shipToState);
      formData.append('quantity', quantity);
      formData.append('inHandDate', inHandDate);
      formData.append('notes', notes);
      formData.append('selectedProducts', JSON.stringify(localProducts));
      formData.append('website', ''); // honeypot
      files.forEach((file) => formData.append('files', file));

      await axios.post(config.backendUrl + '/api/email/send-contact', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSuccess(true);
      try { window.sessionStorage.removeItem('jpSelectedProducts'); } catch (_) {}

      setTimeout(() => {
        reset();
        onClose(true);
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
        {/* ── Product list with remove buttons ── */}
        {localProducts.length > 0 && (
          <Paper
            elevation={0}
            sx={{ mb: 2.5, bgcolor: '#e5f4ea', borderRadius: 2, p: 2, border: '1px solid #b7e4c7' }}
          >
            <Typography fontWeight={700} fontSize={13} mb={1} color="#1a4a2e">
              {localProducts.length === 1 ? 'Product in your quote:' : 'Products in your quote:'}
            </Typography>
            <Stack spacing={0.75}>
              {localProducts.map((p) => (
                <Stack key={p.style} direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0, flex: 1 }}>
                    {p.thumbnail ? (
                      <Box component="img" src={p.thumbnail} alt={p.name || ''}
                        sx={{ width: 32, height: 32, objectFit: 'contain', bgcolor: '#fff', borderRadius: 1, border: '1px solid rgba(0,0,0,0.08)', flexShrink: 0 }} />
                    ) : null}
                    <Stack sx={{ minWidth: 0 }}>
                      <Typography variant="body2" color="text.primary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name || 'Product'}{p.vendor ? ` — ${p.vendor}` : ''}
                        {p.style ? ` (Style #${p.style})` : ''}
                      </Typography>
                      {p.color && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.25 }}>
                          {p.colorHex && (
                            <Box sx={{ width: 10, height: 10, bgcolor: p.colorHex, borderRadius: '50%', border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                          )}
                          <Typography variant="caption" color="text.secondary">{p.color}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => removeProduct(p.style)}
                    disabled={submitting || success}
                    sx={{ ml: 1, color: 'text.secondary', flexShrink: 0, '&:hover': { color: 'error.main' } }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Paper>
        )}

        <form id="quick-quote-form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                value={name} label="Your name *" variant="outlined" fullWidth size="small"
                error={!!errors.name} helperText={errors.name}
                inputRef={(el) => { fieldRefs.current.name = el; }}
                onChange={(e) => { setName(e.target.value); clearError('name'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={companyName} label="Company / Organization *" variant="outlined" fullWidth size="small"
                error={!!errors.companyName} helperText={errors.companyName}
                inputRef={(el) => { fieldRefs.current.companyName = el; }}
                onChange={(e) => { setCompanyName(e.target.value); clearError('companyName'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="email" value={email} label="Email *" variant="outlined" fullWidth size="small"
                error={!!errors.email} helperText={errors.email}
                inputRef={(el) => { fieldRefs.current.email = el; }}
                onChange={(e) => { setEmail(e.target.value); clearError('email'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={phone} label="Phone *" placeholder="(856) 555-1234" variant="outlined" fullWidth size="small"
                error={!!errors.phone} helperText={errors.phone}
                inputRef={(el) => { fieldRefs.current.phone = el; }}
                onChange={(e) => { setPhone(e.target.value); clearError('phone'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={shipToState} label="Ship-to state *" variant="outlined" fullWidth size="small"
                error={!!errors.shipToState} helperText={errors.shipToState}
                inputRef={(el) => { fieldRefs.current.shipToState = el; }}
                onChange={(e) => { setShipToState(e.target.value); clearError('shipToState'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                value={quantity} label="Quantity per item *" variant="outlined" fullWidth size="small"
                error={!!errors.quantity} helperText={errors.quantity}
                inputRef={(el) => { fieldRefs.current.quantity = el; }}
                onChange={(e) => { setQuantity(e.target.value); clearError('quantity'); }} disabled={submitting || success}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                type="date" value={inHandDate} label="In-hand date *" variant="outlined" fullWidth size="small"
                InputLabelProps={{ shrink: true }}
                error={!!errors.inHandDate} helperText={errors.inHandDate}
                inputRef={(el) => { fieldRefs.current.inHandDate = el; }}
                onChange={(e) => { setInHandDate(e.target.value); clearError('inHandDate'); }} disabled={submitting || success}
              />
            </Grid>

            {/* ── File upload ── */}
            <Grid item xs={12}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadFileIcon />}
                disabled={submitting || success}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
              >
                Attach design files (optional)
                <input type="file" hidden multiple onChange={handleFileChange} />
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Any file type accepted · 25 MB max per file
              </Typography>
              {files.length > 0 && (
                <Stack spacing={0.5} mt={1}>
                  {files.map((file, idx) => (
                    <Stack key={idx} direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={file.name}
                        size="small"
                        variant="outlined"
                        onDelete={() => handleRemoveFile(idx)}
                        deleteIcon={<DeleteIcon />}
                        sx={{ maxWidth: 280, fontSize: 12 }}
                      />
                    </Stack>
                  ))}
                </Stack>
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                value={notes} label="Anything else we should know? (optional)"
                variant="outlined" fullWidth multiline minRows={3}
                onChange={(e) => setNotes(e.target.value)} disabled={submitting || success}
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
