// src/screens/studio/crm/ImportView.js
// Loads the owner's field tracker. The backend's /import accepts raw CSV text
// ({ csv }) and does all the header-mapping + merge itself, so the client just
// reads the picked .csv as text and posts it — no brittle client-side parsing,
// and the server stays the single source of truth for the import rules.
// After import we show the { created, updated, skipped, total } breakdown and
// fire onImported so the parent refreshes every list.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { D, mono, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { Eyebrow } from './_crm';

// One number in the result breakdown.
function ResultStat({ value, label, tone }) {
  return (
    <Box sx={{ flex: 1, minWidth: 80, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ ...mono, fontSize: 24, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

export default function ImportView({ onImport, onImported }) {
  const inputRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState('');

  const pick = () => inputRef.current?.click();

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    setResult(null);
    setError('');
    setFile(f || null);
    // Allow re-picking the same file later (onChange won't fire otherwise).
    e.target.value = '';
  };

  const runImport = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const csv = await file.text();
      if (!csv.trim()) { setError('That file looks empty.'); setBusy(false); return; }
      const res = await onImport(csv); // → { created, updated, skipped, total }
      setResult(res);
      if (onImported) onImported();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Import failed. Check the file and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
      <Box>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18 }}>Import field tracker / CSV</Typography>
        <Typography sx={{ color: D.muted, fontSize: 13.5, mt: 0.5, lineHeight: 1.55 }}>
          Pick the CSV export of your tracker. We match your column headers
          (Company Name, Owner / Contact, Phone, Area, Status, Next Contact, Notes…),
          merge into existing companies by name, and never overwrite work you&apos;ve
          already done — re-importing the same file is safe.
        </Typography>
      </Box>

      <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} style={{ display: 'none' }} />

      {/* Drop zone / picker */}
      <Box
        onClick={pick}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } }}
        sx={{
          border: `1.5px dashed ${file ? D.lineHi : D.line}`, borderRadius: 3,
          bgcolor: file ? 'rgba(74,222,128,0.04)' : D.inset, p: 4, textAlign: 'center', cursor: 'pointer',
          transition: 'border-color 0.18s ease, background 0.18s ease',
          '&:hover': { borderColor: D.lineHi, bgcolor: 'rgba(74,222,128,0.04)' },
        }}
      >
        <Box sx={{ color: file ? D.green : D.faint, mb: 1, '& svg': { fontSize: 40 } }}>
          {file ? <DescriptionOutlinedIcon /> : <UploadFileOutlinedIcon />}
        </Box>
        {file ? (
          <>
            <Typography sx={{ color: D.text, fontWeight: 700, fontSize: 14, ...mono }}>{file.name}</Typography>
            <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.3 }}>
              {(file.size / 1024).toFixed(1)} KB · tap to choose a different file
            </Typography>
          </>
        ) : (
          <>
            <Typography sx={{ color: D.muted, fontWeight: 700, fontSize: 14 }}>Choose a .csv file</Typography>
            <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.3 }}>Exported straight from your tracker / spreadsheet</Typography>
          </>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {result && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <CheckCircleOutlineIcon sx={{ color: D.green, fontSize: 20 }} />
            <Eyebrow sx={{ color: D.green }}>Import complete</Eyebrow>
          </Stack>
          <Stack direction="row" spacing={1}>
            <ResultStat value={result.created || 0} label="Created" tone={D.green} />
            <ResultStat value={result.updated || 0} label="Updated" tone="#60a5fa" />
            <ResultStat value={result.skipped || 0} label="Skipped" tone={D.muted} />
            <ResultStat value={result.total || 0} label="Total rows" tone={D.text} />
          </Stack>
        </Box>
      )}

      <Stack direction="row" spacing={1.25}>
        <Button onClick={runImport} disabled={!file || busy} sx={dropPrimaryBtn} startIcon={!busy ? <UploadFileOutlinedIcon /> : null}>
          {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Import now'}
        </Button>
        {file && !busy && (
          <Button onClick={() => { setFile(null); setResult(null); setError(''); }} sx={dropGhostBtn}>Clear</Button>
        )}
      </Stack>
    </Stack>
  );
}
