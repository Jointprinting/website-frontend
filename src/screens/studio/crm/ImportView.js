// src/screens/studio/crm/ImportView.js
// Loads the owner's field tracker. The backend's /import accepts raw CSV text
// ({ csv }) and does all the header-mapping + merge itself, so the client just
// reads the picked .csv as text and posts it.
//
// FLOW (the trust fix): we ALWAYS preview first. A dry-run ({ dryRun:true })
// returns "will create N · update M · skip K [J dead] · merge P likely-dupes"
// and writes NOTHING — the owner reviews, then Confirms to commit. An optional
// "Replace my previous import" mode archives the prior pure field-tracker
// records (no orders, no edits) before importing fresh, for a clean re-pull.

import * as React from 'react';
import {
  Box, Stack, Typography, Button, CircularProgress, Alert, Checkbox,
  FormControlLabel, Divider, Chip,
} from '@mui/material';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import MergeTypeOutlinedIcon from '@mui/icons-material/MergeTypeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { D, mono, dropPrimaryBtn, dropGhostBtn } from '../_shared';
import { Eyebrow } from './_crm';

// One number in the result/preview breakdown.
function ResultStat({ value, label, tone }) {
  return (
    <Box sx={{ flex: 1, minWidth: 72, textAlign: 'center', p: 1.5, borderRadius: 2, bgcolor: D.inset, border: `1px solid ${D.line}` }}>
      <Typography sx={{ ...mono, fontSize: 24, fontWeight: 800, color: tone, lineHeight: 1 }}>{value}</Typography>
      <Typography sx={{ color: D.faint, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mt: 0.5 }}>{label}</Typography>
    </Box>
  );
}

export default function ImportView({ onPreview, onCommit, onImported }) {
  const inputRef = React.useRef(null);
  const [file, setFile] = React.useState(null);
  const [csv, setCsv] = React.useState('');
  const [replaceMode, setReplaceMode] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [preview, setPreview] = React.useState(null); // dry-run result (awaiting confirm)
  const [result, setResult] = React.useState(null);   // committed result
  const [error, setError] = React.useState('');

  const pick = () => inputRef.current?.click();

  const reset = () => { setFile(null); setCsv(''); setPreview(null); setResult(null); setError(''); };

  const onFileChange = async (e) => {
    const f = e.target.files?.[0];
    setPreview(null); setResult(null); setError('');
    setFile(f || null);
    setCsv(f ? await f.text() : '');
    e.target.value = ''; // allow re-picking the same file
  };

  // Step 1 — preview (writes nothing).
  const runPreview = async () => {
    if (!csv.trim()) { setError('That file looks empty.'); return; }
    setBusy(true); setError(''); setResult(null);
    try {
      const res = await onPreview(csv, { mode: replaceMode ? 'replace' : 'merge' });
      setPreview(res);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Could not preview that file.');
    } finally { setBusy(false); }
  };

  // Step 2 — commit (writes for real).
  const runCommit = async () => {
    setBusy(true); setError('');
    try {
      const res = await onCommit(csv, { mode: replaceMode ? 'replace' : 'merge' });
      setResult(res);
      setPreview(null);
      if (onImported) onImported();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Import failed. Check the file and try again.');
    } finally { setBusy(false); }
  };

  const skipDead = preview?.willSkip?.dead || 0;
  const skipNoCo = preview?.willSkip?.noCompany || 0;
  const mergeCount = (preview?.proposedMerges || []).length;
  const ambiguous = (preview?.ambiguousDates || []).length;

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 580 }}>
      <Box>
        <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 18 }}>Import field tracker / CSV</Typography>
        <Typography sx={{ color: D.muted, fontSize: 13.5, mt: 0.5, lineHeight: 1.55 }}>
          Pick the CSV export of your tracker. We match your column headers
          (Company Name, Owner / Contact, Phone, Area, Status, Next Contact, Notes…)
          and merge into existing companies. You&apos;ll always see a preview
          before anything is written, and re-importing only fills blanks — it
          never overwrites your reschedules, notes, or stage changes.
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

      {/* Replace-my-previous-import option */}
      <FormControlLabel
        control={(
          <Checkbox
            checked={replaceMode}
            onChange={(e) => { setReplaceMode(e.target.checked); setPreview(null); }}
            sx={{ color: D.faint, '&.Mui-checked': { color: D.green } }}
          />
        )}
        label={(
          <Box>
            <Typography sx={{ color: D.text, fontSize: 13.5, fontWeight: 700 }}>Replace my previous import</Typography>
            <Typography sx={{ color: D.faint, fontSize: 11.5, lineHeight: 1.4 }}>
              Archives leftover field-tracker leads that have no orders and no edits, then re-imports fresh. Anything with real activity is kept. Nothing is deleted — archived records are recoverable.
            </Typography>
          </Box>
        )}
        sx={{ alignItems: 'flex-start', m: 0, '& .MuiFormControlLabel-label': { mt: 0.75 } }}
      />

      {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

      {/* ── PREVIEW (dry-run) — review then confirm ── */}
      {preview && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.lineHi}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <VisibilityOutlinedIcon sx={{ color: D.green, fontSize: 20 }} />
            <Eyebrow sx={{ color: D.green }}>Preview — nothing saved yet</Eyebrow>
          </Stack>
          <Stack direction="row" spacing={1}>
            <ResultStat value={preview.willCreate || 0} label="Will create" tone={D.green} />
            <ResultStat value={preview.willUpdate || 0} label="Will update" tone="#60a5fa" />
            <ResultStat value={skipDead + skipNoCo} label="Will skip" tone={D.muted} />
            <ResultStat value={mergeCount} label="Likely dupes" tone={D.amber} />
          </Stack>

          <Stack spacing={0.75} sx={{ mt: 1.5 }}>
            {skipDead > 0 && (
              <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
                <b style={{ color: D.muted }}>{skipDead}</b> skipped as dead / not-interested / no-answer (no future follow-up).
              </Typography>
            )}
            {skipNoCo > 0 && (
              <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
                <b style={{ color: D.muted }}>{skipNoCo}</b> skipped with no usable company name.
              </Typography>
            )}
            {mergeCount > 0 && (
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <MergeTypeOutlinedIcon sx={{ color: D.amber, fontSize: 16, mt: 0.2 }} />
                <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
                  <b style={{ color: D.amber }}>{mergeCount}</b> {mergeCount === 1 ? 'group looks' : 'groups look'} like the same company under different names. Import is safe; clean them up afterward in <b style={{ color: D.muted }}>Clean up</b>.
                </Typography>
              </Stack>
            )}
            {ambiguous > 0 && (
              <Stack direction="row" spacing={0.75} alignItems="flex-start">
                <WarningAmberOutlinedIcon sx={{ color: D.amber, fontSize: 16, mt: 0.2 }} />
                <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
                  <b style={{ color: D.amber }}>{ambiguous}</b> date {ambiguous === 1 ? 'cell' : 'cells'} couldn&apos;t be read (e.g. &quot;next week&quot;) — those rows import without a follow-up date so you can set it by hand.
                </Typography>
              </Stack>
            )}
            {replaceMode && (preview.willReplaceArchive || 0) > 0 && (
              <Typography sx={{ color: D.faint, fontSize: 12.5 }}>
                Replace mode: <b style={{ color: D.muted }}>{preview.willReplaceArchive}</b> stale import-only {preview.willReplaceArchive === 1 ? 'record' : 'records'} will be archived first.
              </Typography>
            )}
          </Stack>

          <Divider sx={{ borderColor: D.line, my: 1.5 }} />
          <Stack direction="row" spacing={1.25}>
            <Button onClick={runCommit} disabled={busy} sx={dropPrimaryBtn} startIcon={!busy ? <CheckCircleOutlineIcon /> : null}>
              {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : `Confirm import (${(preview.willCreate || 0) + (preview.willUpdate || 0)})`}
            </Button>
            <Button onClick={() => setPreview(null)} disabled={busy} sx={dropGhostBtn}>Cancel</Button>
          </Stack>
        </Box>
      )}

      {/* ── COMMITTED RESULT ── */}
      {result && (
        <Box sx={{ bgcolor: D.panel, border: `1px solid ${D.line}`, borderRadius: 2.5, p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
            <CheckCircleOutlineIcon sx={{ color: D.green, fontSize: 20 }} />
            <Eyebrow sx={{ color: D.green }}>Import complete</Eyebrow>
          </Stack>
          <Stack direction="row" spacing={1}>
            <ResultStat value={result.created || 0} label="Created" tone={D.green} />
            <ResultStat value={result.updated || 0} label="Updated" tone="#60a5fa" />
            <ResultStat value={result.skippedTotal != null ? result.skippedTotal : 0} label="Skipped" tone={D.muted} />
            <ResultStat value={result.total || 0} label="Total rows" tone={D.text} />
          </Stack>
          {(result.skipped?.dead || 0) > 0 && (
            <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 1.25 }}>
              <b style={{ color: D.muted }}>{result.skipped.dead}</b> dead / not-interested rows were skipped.
            </Typography>
          )}
          {(result.replacedArchived || 0) > 0 && (
            <Typography sx={{ color: D.faint, fontSize: 12.5, mt: 0.5 }}>
              <b style={{ color: D.muted }}>{result.replacedArchived}</b> stale import-only records were archived (replace mode).
            </Typography>
          )}
          {(result.proposedMerges || []).length > 0 && (
            <Chip
              size="small" icon={<MergeTypeOutlinedIcon />}
              label={`${result.proposedMerges.length} likely-duplicate ${result.proposedMerges.length === 1 ? 'group' : 'groups'} — clean up in Clean up`}
              sx={{ mt: 1.25, bgcolor: 'rgba(251,191,36,0.12)', color: D.amber, fontWeight: 700, fontSize: 11.5, '& .MuiChip-icon': { color: D.amber } }}
            />
          )}
        </Box>
      )}

      {/* Primary action row */}
      {!preview && !result && (
        <Stack direction="row" spacing={1.25}>
          <Button onClick={runPreview} disabled={!file || busy} sx={dropPrimaryBtn} startIcon={!busy ? <VisibilityOutlinedIcon /> : null}>
            {busy ? <CircularProgress size={18} sx={{ color: D.ink }} /> : 'Preview import'}
          </Button>
          {file && !busy && <Button onClick={reset} sx={dropGhostBtn}>Clear</Button>}
        </Stack>
      )}
      {result && <Button onClick={reset} sx={dropGhostBtn}>Import another file</Button>}
    </Stack>
  );
}
