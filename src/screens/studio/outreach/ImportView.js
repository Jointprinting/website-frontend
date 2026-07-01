// src/screens/studio/outreach/ImportView.js
// The lead machine: paste (or upload) a state license-list CSV, map its columns
// once, preview, and import straight into the CRM as 'Cold Outreach' leads —
// through the SAME /api/crm/import endpoint the field-tracker uses (fill-blanks
// merge, dedupe, never clobbers owner edits). Dispensaries are one of the only
// industries where every prospect is on a public government list; this turns
// those lists into enrollable leads in two clicks.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, Link, Alert,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { D, mono, dropInput, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { Eyebrow } from '../crm/_crm';
import { parseCsv, IMPORT_TARGETS, guessTarget, buildImportRows } from './_outreach';

// Free official sources — every dispensary prospect, straight from the regulator.
const LICENSE_SOURCES = [
  { label: 'NJ CRC licensee list', url: 'https://www.nj.gov/cannabis/businesses/recreational/' },
  { label: 'New York OCM', url: 'https://cannabis.ny.gov/dispensary-location-verification' },
  { label: 'Pennsylvania DOH', url: 'https://www.pa.gov/agencies/health/programs/medical-marijuana.html' },
  { label: 'California DCC search', url: 'https://search.cannabis.ca.gov/' },
  { label: 'Colorado MED lookup', url: 'https://med.colorado.gov/licensee-information-and-lookup-tool' },
  { label: 'Missouri (with contacts)', url: 'https://health.mo.gov/safety/cannabis/licensed-facilities.php' },
  { label: 'Washington LCB list', url: 'https://lcb.wa.gov/taxreporting/licensee-list' },
  { label: 'Oregon OLCC reports', url: 'https://www.oregon.gov/olcc/marijuana/pages/recreational-marijuana-licensee-reports.aspx' },
  { label: 'All-states directory', url: 'https://cannabispromotions.com/license-lookup' },
];

export default function ImportView({ onImport, onError, onGoCampaigns }) {
  const [csvText, setCsvText] = React.useState('');
  const [rows, setRows] = React.useState(null);        // parsed array-of-arrays
  const [mapping, setMapping] = React.useState([]);    // per-column target ids
  const [preview, setPreview] = React.useState(null);  // dry-run response
  const [result, setResult] = React.useState(null);    // live-run response
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef(null);

  const loadCsv = (text) => {
    const parsed = parseCsv(text);
    if (!parsed.length) { onError('Could not read any rows from that CSV.'); return; }
    setCsvText(text);
    setRows(parsed);
    setMapping((parsed[0] || []).map((h) => guessTarget(h)));
    setPreview(null);
    setResult(null);
  };

  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => loadCsv(String(reader.result || ''));
    reader.readAsText(f);
    e.target.value = '';
  };

  const importRows = React.useMemo(
    () => (rows ? buildImportRows(rows, 0, mapping) : []),
    [rows, mapping],
  );
  const hasCompany = mapping.includes('company');
  const emailCount = importRows.filter((r) => r.email).length;

  const dryRun = async () => {
    setBusy(true);
    try {
      setPreview(await onImport(importRows, { dryRun: true }));
    } catch (e) {
      onError(e.response?.data?.message || 'Preview failed');
    } finally {
      setBusy(false);
    }
  };

  const runLive = async () => {
    setBusy(true);
    try {
      setResult(await onImport(importRows, { dryRun: false }));
      setPreview(null);
    } catch (e) {
      onError(e.response?.data?.message || 'Import failed');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => { setCsvText(''); setRows(null); setMapping([]); setPreview(null); setResult(null); };

  return (
    <Stack spacing={2.5}>
      <Box>
        <Eyebrow sx={{ mb: 1 }}>Free lead lists — every dispensary is on a public register</Eyebrow>
        <Typography sx={{ color: D.muted, fontSize: 13, mb: 1 }}>
          Download the licensee spreadsheet for a state on your route, paste it below, map the columns,
          and it lands in the CRM as filterable <b>Cold Outreach</b> leads (deduped, never overwriting
          your edits). Where a list has no email, the shop’s website almost always has an info@.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {LICENSE_SOURCES.map((s) => (
            <Link key={s.url} href={s.url} target="_blank" rel="noreferrer"
              sx={{ ...mono, fontSize: 11.5, color: D.green, textDecorationColor: 'rgba(74,222,128,0.4)',
                '&:hover': { color: '#5cec8e' } }}>
              {s.label} ↗
            </Link>
          ))}
        </Stack>
      </Box>

      {result ? (
        <Alert icon={<CheckCircleOutlineIcon />} severity="success" variant="outlined"
          sx={{ borderColor: D.green, color: D.text, '& .MuiAlert-icon': { color: D.green } }}>
          Imported — <b>{result.created} new</b> lead{result.created === 1 ? '' : 's'}, {result.updated} updated
          {result.skippedTotal ? `, ${result.skippedTotal} skipped` : ''}.
          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            <Button onClick={onGoCampaigns} sx={{ ...dropPrimaryBtn, px: 2, py: 0.5, fontSize: 12.5 }}>
              Enroll them in a campaign →
            </Button>
            <Button onClick={reset} sx={{ ...dropGhostBtn, px: 2, py: 0.5, fontSize: 12.5 }}>
              Import another list
            </Button>
          </Stack>
        </Alert>
      ) : !rows ? (
        <Box>
          <Eyebrow sx={{ mb: 1 }}>Paste CSV (or upload the file)</Eyebrow>
          <TextField
            multiline minRows={7} fullWidth value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={'Business Name,Email,Phone,Street,City,State,Zip\nGreen Leaf Dispensary,hello@greenleaf.com,(609) 555-0142,12 High St,Trenton,NJ,08601'}
            sx={{ ...dropInput, '& textarea': { ...mono, fontSize: 12 } }}
          />
          <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
            <Button onClick={() => csvText.trim() && loadCsv(csvText)} disabled={!csvText.trim()}
              sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
              Read columns
            </Button>
            <Button onClick={() => fileRef.current && fileRef.current.click()}
              startIcon={<UploadFileOutlinedIcon sx={{ fontSize: 16 }} />}
              sx={{ ...dropGhostBtn, px: 2, py: 0.6, fontSize: 12.5 }}>
              Upload .csv
            </Button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
          </Stack>
        </Box>
      ) : (
        <Box>
          <Eyebrow sx={{ mb: 1 }}>Map the columns — auto-guessed, fix anything that’s off</Eyebrow>
          <Stack spacing={0.75}>
            {(rows[0] || []).map((header, i) => (
              <Stack key={i} direction="row" spacing={1.25} alignItems="center"
                sx={{ px: 1.5, py: 0.75, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
                <Typography sx={{ ...mono, color: D.text, fontSize: 12, fontWeight: 700, width: '38%', minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {header || `(column ${i + 1})`}
                </Typography>
                <Typography sx={{ color: D.faint, fontSize: 11, flexGrow: 1, minWidth: 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  e.g. “{String((rows[1] || [])[i] || '').slice(0, 40)}”
                </Typography>
                <TextField select size="small" value={mapping[i] || 'ignore'}
                  onChange={(e) => setMapping((prev) => prev.map((m, j) => (j === i ? e.target.value : m)))}
                  sx={{ ...dropInput, width: 170, flexShrink: 0 }}>
                  {IMPORT_TARGETS.map((t) => (
                    <MenuItem key={t.id} value={t.id}>{t.label}</MenuItem>
                  ))}
                </TextField>
              </Stack>
            ))}
          </Stack>

          {!hasCompany && (
            <Alert severity="warning" variant="outlined" sx={{ mt: 1.5, borderColor: D.amber, color: D.text,
              '& .MuiAlert-icon': { color: D.amber } }}>
              Map one column to <b>Company name</b> — it’s the only required field.
            </Alert>
          )}

          {preview && (
            <Alert severity="info" variant="outlined" sx={{ mt: 1.5, borderColor: D.line, color: D.text,
              '& .MuiAlert-icon': { color: D.green } }}>
              Preview: <b>{preview.willCreate} new</b>, {preview.willUpdate} will update existing records
              {preview.willSkip ? `, ${(preview.willSkip.dead || 0) + (preview.willSkip.noCompany || 0)} skipped` : ''}.
              Nothing is written until you confirm.
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
            {!preview ? (
              <Button onClick={dryRun} disabled={busy || !hasCompany || importRows.length === 0}
                sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
                {busy ? 'Checking…' : `Preview ${importRows.length} lead${importRows.length === 1 ? '' : 's'}`}
              </Button>
            ) : (
              <Button onClick={runLive} disabled={busy}
                sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
                {busy ? 'Importing…' : `Import ${importRows.length} lead${importRows.length === 1 ? '' : 's'}`}
              </Button>
            )}
            <Button onClick={reset} sx={{ ...dropGhostBtn, px: 2, py: 0.6, fontSize: 12.5 }}>
              Start over
            </Button>
            <Typography sx={{ color: D.faint, fontSize: 11.5 }}>
              {emailCount}/{importRows.length} rows carry an email (only those can be enrolled in campaigns).
            </Typography>
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
