// src/screens/studio/mockup/NativeMockupLabHost.js
//
// Loader shell for the native Mockup Lab: for an EDIT deep-link (editMockup =
// remoteId) it fetches the full library doc and models it; for a NEW one
// (editProject / editFresh) it goes straight in. Keeps NativeMockupLab pure.

import React from 'react';
import axios from 'axios';
import { Box, CircularProgress } from '@mui/material';
import config from '../../../config.json';
import { D } from '../_shared';
import { mockupFromLibraryItem } from './mockupModel';
import NativeMockupLab from './NativeMockupLab';

const base = `${config.backendUrl}/api`;

export default function NativeMockupLabHost({ token, entry, onBack, onSaved }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [state, setState] = React.useState({ loading: !!(entry && entry.editMockup), mockup: null, item: null });

  React.useEffect(() => {
    if (!entry || !entry.editMockup) return undefined;
    let live = true;
    (async () => {
      try {
        const r = await axios.get(`${base}/studio/library/mockups/full`, { ...authHdr, params: { ids: entry.editMockup } });
        const full = Array.isArray(r.data) && r.data[0] ? r.data[0] : null;
        if (live) setState({ loading: false, mockup: full ? mockupFromLibraryItem(full) : null, item: full });
      } catch (e) {
        if (live) setState({ loading: false, mockup: null, item: null });
      }
    })();
    return () => { live = false; };
  }, [entry, authHdr]);

  if (state.loading) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: D.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress sx={{ color: D.green }} />
      </Box>
    );
  }

  const project = {
    id: (entry && entry.editProject) || (state.item && state.item.pageState && state.item.pageState.projectId) || '',
    projectNumber: (entry && entry.projectNumber) || (state.mockup && state.mockup.projectNumber) || '',
    client: (entry && entry.client) || (state.mockup && state.mockup.client) || '',
  };

  return (
    <NativeMockupLab
      token={token}
      mode={state.mockup ? 'edit' : 'new'}
      mockup={state.mockup}
      item={state.item}
      project={project}
      onBack={onBack}
      onSaved={onSaved}
    />
  );
}
