// src/screens/studio/outreach/ImportView.js
// The lead machine. TWO ways in:
//   1. AUTO-FIND (primary, free): pick a region → the server sweeps OpenStreetMap
//      for every dispensary, scrapes each shop's site for a contact email, and
//      imports the emailable ones as Cold Outreach leads. $0, no API key.
//   2. PASTE a CSV (fallback): a state license list → map columns → import via
//      the SAME /api/crm/import path (fill-blanks merge, dedupe, never clobbers).
// Both land leads you can immediately enroll in a campaign.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, TextField, MenuItem, Link, Alert, CircularProgress,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TravelExploreOutlinedIcon from '@mui/icons-material/TravelExploreOutlined';
import { D, mono, dropInput, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { Eyebrow } from '../crm/_crm';
import { parseCsv, IMPORT_TARGETS, guessTarget, buildImportRows, FINDER_REGIONS, StatPill } from './_outreach';

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

// The free auto-finder: pick a region, the server does discovery + email scrape
// + import. A preview (dry run) reports coverage before writing anything.
function AutoFinder({ onFindLeads, onError, onGoCampaigns }) {
  const [region, setRegion] = React.useState('nj');
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(null);
  const [result, setResult] = React.useState(null);

  const run = async (dryRun) => {
    setBusy(true);
    try {
      const data = await onFindLeads(region, { dryRun });
      if (dryRun) { setPreview(data); setResult(null); }
      else { setResult(data); setPreview(null); }
    } catch (e) {
      onError(e.response?.data?.message || 'Lead finder failed — the discovery service may be busy, try again.');
    } finally {
      setBusy(false);
    }
  };

  const regionLabel = (FINDER_REGIONS.find((r) => r.id === region) || {}).label || region;

  return (
    <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.lineHi}`, borderRadius: 2.5, p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <TravelExploreOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 15 }}>Auto-find dispensaries</Typography>
        <Box sx={{ px: 1, py: 0.2, borderRadius: 999, bgcolor: 'rgba(74,222,128,0.14)', border: `1px solid ${D.line}` }}>
          <Typography sx={{ ...mono, color: D.green, fontSize: 10, fontWeight: 800, letterSpacing: 0.5 }}>FREE</Typography>
        </Box>
      </Stack>
      <Typography sx={{ color: D.muted, fontSize: 12.5, mb: 1.5 }}>
        Sweeps OpenStreetMap for every dispensary in a region, scrapes each shop’s own website for a
        contact email, and imports the reachable ones as Cold Outreach leads — no cost, no API key.
        Start with New Jersey; expand outward once you’ve worked through it.
      </Typography>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <TextField select size="small" value={region} onChange={(e) => setRegion(e.target.value)}
          sx={{ ...dropInput, minWidth: 170 }}>
          {FINDER_REGIONS.map((r) => (
            <MenuItem key={r.id} value={r.id}>{r.label}{r.id === 'nj' ? ' (start here)' : ''}</MenuItem>
          ))}
        </TextField>
        <Button onClick={() => run(true)} disabled={busy}
          sx={{ ...dropGhostBtn, px: 2, py: 0.6, fontSize: 12.5 }}>
          {busy ? 'Working…' : 'Preview coverage'}
        </Button>
        <Button onClick={() => run(false)} disabled={busy}
          startIcon={busy ? <CircularProgress size={14} sx={{ color: D.ink }} /> : <TravelExploreOutlinedIcon sx={{ fontSize: 16 }} />}
          sx={{ ...dropPrimaryBtn, px: 2.5, py: 0.6, fontSize: 12.5 }}>
          {busy ? 'Finding…' : `Find & import ${regionLabel}`}
        </Button>
      </Stack>

      {busy && (
        <Typography sx={{ color: D.faint, fontSize: 11.5, mt: 1 }}>
          Scanning + scraping can take a minute or two for a full region — hang tight.
        </Typography>
      )}

      {preview && !busy && (
        <Alert severity="info" variant="outlined" sx={{ mt: 1.5, borderColor: D.line, color: D.text,
          '& .MuiAlert-icon': { color: D.green } }}>
          {preview.label}: <b>{preview.found}</b> dispensaries found, <b>{preview.withEmail}</b> have a reachable
          email — <b>{preview.willImport}</b> ready to import. Nothing’s been written yet.
        </Alert>
      )}

      {result && !busy && (
        <Box sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={1.25} sx={{ mb: 1.25 }}>
            <StatPill value={result.found} label="Found" tone={D.text} />
            <StatPill value={result.withEmail} label="With email" tone={D.green} />
            <StatPill value={result.created} label="New leads" tone={D.green} />
          </Stack>
          <Alert icon={<CheckCircleOutlineIcon />} severity="success" variant="outlined"
            sx={{ borderColor: D.green, color: D.text, '& .MuiAlert-icon': { color: D.green } }}>
            {result.label}: imported <b>{result.created} new</b> lead{result.created === 1 ? '' : 's'}
            {result.updated ? `, ${result.updated} updated` : ''} ({result.enriched} email
            {result.enriched === 1 ? '' : 's'} pulled from shop websites). They’re tagged
            <Box component="code" sx={{ ...mono, mx: 0.5 }}>dispensary</Box> and sourced Cold Outreach.
            <Stack direction="row" spacing={1} sx={{ mt: 1.25 }}>
              <Button onClick={onGoCampaigns} sx={{ ...dropPrimaryBtn, px: 2, py: 0.5, fontSize: 12.5 }}>
                Enroll them in a campaign →
              </Button>
            </Stack>
          </Alert>
        </Box>
      )}
    </Box>
  );
}

export default function ImportView({ onImport, onFindLeads, onError, onGoCampaigns }) {
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
      {/* Primary path — the free automated finder. */}
      <AutoFinder onFindLeads={onFindLeads} onError={onError} onGoCampaigns={onGoCampaigns} />

      <Box>
        <Eyebrow sx={{ mb: 1 }}>Or paste a state license list — manual fallback</Eyebrow>
        <Typography sx={{ color: D.muted, fontSize: 13, mb: 1 }}>
          For a state the auto-finder hasn’t reached (or to top up its coverage): download a licensee
          spreadsheet, paste it below, map the columns, and it lands in the CRM as filterable
          <b> Cold Outreach</b> leads (deduped, never overwriting your edits).
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
