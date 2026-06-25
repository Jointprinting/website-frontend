// src/screens/studio/crm/useCompanyMatch.js
// Dedup-on-entry: as the owner types a NEW company name, ask the backend which
// EXISTING companies most likely already are that one (/api/crm/match) so a
// duplicate card is never created by accident. This is the data half; the
// presentational "Did you mean …?" surface is <CompanyMatchHint>.
//
// Contract (matches controllers/crm.js matchCandidates): it only ever SUGGESTS.
// The caller stays free to ignore every candidate and create a genuinely new,
// distinct company — nothing here merges, blocks, or mutates. We debounce, drop
// stale responses, and stay silent under 2 chars so it can run on every key.

import * as React from 'react';
import axios from 'axios';
import config from '../../../config.json';

const base = `${config.backendUrl}/api/crm`;

// useCompanyMatch(name, { token, excludeKey, enabled }) → { candidates, loading }.
//   • name       the in-progress company name (typed by the owner)
//   • token      admin bearer (the endpoint is admin-gated)
//   • excludeKey companyKey to drop from results (so editing a record never
//                flags itself)
//   • enabled    set false to pause lookups (e.g. dialog closed)
export default function useCompanyMatch(name, { token, excludeKey, enabled = true } = {}) {
  const [candidates, setCandidates] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const reqId = React.useRef(0);

  const trimmed = (name || '').trim();

  React.useEffect(() => {
    // Quiet under 2 chars / when paused: clear and don't call.
    if (!enabled || !token || trimmed.length < 2) {
      setCandidates([]);
      setLoading(false);
      return undefined;
    }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`${base}/match`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { name: trimmed, ...(excludeKey ? { excludeKey } : {}) },
          timeout: 10000,
        });
        // Drop a stale response (a newer keystroke already fired).
        if (id !== reqId.current) return;
        setCandidates(res.data?.candidates || []);
      } catch (_) {
        if (id !== reqId.current) return;
        setCandidates([]); // a lookup hiccup must never block creating a company
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 260);
    return () => clearTimeout(t);
  }, [trimmed, token, excludeKey, enabled]);

  return { candidates, loading };
}
