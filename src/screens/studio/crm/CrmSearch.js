// src/screens/studio/crm/CrmSearch.js
// The Notion-style global search the owner asked for: "search for a specific
// person at any stage even calendar." A single command-palette dialog that hits
// /api/crm?q= (the backend's global search — name + client + email + phone +
// tags + CONTACTS at ANY stage; stage/tag filters are ignored when q is present)
// and jumps to the chosen company. Debounced, keyboard-driven, reachable from
// every view via the header search affordance.
//
// Presentational + self-contained transport-wise it is NOT: the parent (CrmTab)
// owns the axios call and passes `onSearch(q) -> Promise<clients[]>` so auth/
// caching stay in one place. The dialog just orchestrates the input → results →
// pick flow.

import * as React from 'react';
import {
  Box, Stack, Typography, TextField, Dialog, InputAdornment,
  CircularProgress, IconButton,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PersonSearchOutlinedIcon from '@mui/icons-material/PersonSearchOutlined';
import { D, mono, dropInput } from '../_shared';
import {
  StageChip, TagChips, followUpStatus, primaryPhone,
} from './_crm';

// One result row. Shows the company, its stage, a compact context line, and any
// matching contact people (so a person-search visibly resolves to the contact).
function ResultRow({ c, active, onPick, onHover, bindCompany }) {
  const name = c.companyName || c.clientName || c.companyKey;
  const fu = followUpStatus(c.nextFollowUp);
  const phone = primaryPhone(c);
  const contactNames = (c.contacts || [])
    .map((x) => x && (x.name || x.email || x.phone))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Box
      onMouseEnter={onHover}
      onClick={onPick}
      {...(bindCompany ? bindCompany(c) : {})}
      role="button" tabIndex={-1}
      sx={{
        position: 'relative', overflow: 'hidden', cursor: 'pointer',
        bgcolor: active ? D.panelHi : D.panel, border: `1px solid ${active ? D.lineHi : D.line}`,
        borderRadius: 2, p: 1.25, transition: 'background 0.12s ease, border-color 0.12s ease',
        '&::before': {
          content: '""', position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          bgcolor: active ? D.green : 'transparent',
        },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.2 }}>
            <Typography sx={{ color: D.text, fontWeight: 800, fontSize: 14, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {name}
            </Typography>
            <StageChip stage={c.stage} glow />
          </Stack>
          <Typography sx={{ color: D.muted, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {[
              contactNames.length ? contactNames.join(', ') : null,
              c.address || c.area || null,
              phone || null,
            ].filter(Boolean).join(' · ') || 'No details yet'}
          </Typography>
          <TagChips tags={c.tags} size="tiny" max={4} sx={{ mt: 0.4 }} />
        </Box>
        {c.nextFollowUp && (
          <Typography sx={{ ...mono, color: fu.tone, fontSize: 11, fontWeight: 700, flexShrink: 0,
            display: { xs: 'none', sm: 'block' } }}>
            {fu.label}
          </Typography>
        )}
        <ChevronRightIcon sx={{ color: D.faint, fontSize: 20, flexShrink: 0 }} />
      </Stack>
    </Box>
  );
}

export default function CrmSearch({ open, onClose, onSearch, onOpen, bindCompany }) {
  const [q, setQ] = React.useState('');
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  // Guards a stale in-flight response from overwriting a newer query's results.
  const reqRef = React.useRef(0);

  // Fresh slate each open.
  React.useEffect(() => {
    if (open) { setQ(''); setResults([]); setActive(0); setLoading(false); }
  }, [open]);

  // Debounced search. <2 chars clears (avoids a giant unfiltered dump).
  React.useEffect(() => {
    if (!open) return undefined;
    const term = q.trim();
    if (term.length < 2) {
      // Bump the request id so any in-flight response can't repopulate results.
      reqRef.current += 1;
      setResults([]); setLoading(false);
      return undefined;
    }
    setLoading(true);
    const myReq = ++reqRef.current;
    const id = setTimeout(async () => {
      try {
        const rows = await onSearch(term);
        if (reqRef.current !== myReq) return; // a newer query already fired
        setResults(rows || []);
        setActive(0);
      } catch (_) {
        if (reqRef.current === myReq) setResults([]);
      } finally {
        if (reqRef.current === myReq) setLoading(false);
      }
    }, 240);
    return () => clearTimeout(id);
  }, [q, open, onSearch]);

  const pick = (c) => { if (c) { onOpen(c.companyKey); onClose(); } };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
  };

  const term = q.trim();

  return (
    <Dialog
      open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: {
        bgcolor: D.panel, color: D.text, borderRadius: 3, border: `1px solid ${D.line}`,
        backgroundImage: 'none', position: 'fixed', top: { xs: 16, sm: 64 }, m: 0,
        width: { xs: 'calc(100% - 24px)', sm: 600 }, maxHeight: '78vh',
      } }}
      // Anchor near the top like a command palette.
      sx={{ '& .MuiDialog-container': { alignItems: 'flex-start' } }}
    >
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <TextField
          value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKeyDown}
          autoFocus fullWidth placeholder="Search people & companies — any stage…" sx={dropInput}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon sx={{ color: D.green, fontSize: 22 }} /></InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                {loading
                  ? <CircularProgress size={16} sx={{ color: D.green }} />
                  : (
                    <IconButton onClick={onClose} size="small" sx={{ color: D.faint, '&:hover': { color: D.text } }}>
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
              </InputAdornment>
            ),
          }}
        />

        <Box sx={{ mt: 1.5, maxHeight: '58vh', overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 3 } }}>
          {term.length < 2 ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <PersonSearchOutlinedIcon sx={{ fontSize: 44, color: 'rgba(255,255,255,0.15)' }} />
              <Typography sx={{ color: D.muted, fontWeight: 700, fontSize: 13.5, mt: 1 }}>
                Find anyone, at any stage
              </Typography>
              <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.5 }}>
                Type a company, person, email, phone, or tag.
              </Typography>
            </Box>
          ) : (!loading && results.length === 0) ? (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ color: D.muted, fontWeight: 700, fontSize: 13.5 }}>No matches for “{term}”</Typography>
              <Typography sx={{ color: D.faint, fontSize: 12, mt: 0.5 }}>Try a different spelling or a contact’s name.</Typography>
            </Box>
          ) : (
            <Stack spacing={0.75}>
              {results.map((c, i) => (
                <ResultRow
                  key={c.companyKey}
                  c={c}
                  active={i === active}
                  onHover={() => setActive(i)}
                  onPick={() => pick(c)}
                  bindCompany={bindCompany}
                />
              ))}
            </Stack>
          )}
        </Box>

        {results.length > 0 && (
          <Typography sx={{ color: D.faint, fontSize: 10.5, mt: 1, textAlign: 'center', ...mono }}>
            ↑↓ to navigate · ↵ to open · esc to close
          </Typography>
        )}
      </Box>
    </Dialog>
  );
}
