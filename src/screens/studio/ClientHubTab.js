// src/screens/studio/ClientHubTab.js
import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, TextField, Button, IconButton, Chip, Paper,
  CircularProgress, Select, MenuItem, FormControl, InputLabel, Dialog,
  DialogTitle, DialogContent, DialogActions, InputAdornment, Tabs, Tab,
  Tooltip, Popover, List, ListItem, ListItemText,
} from '@mui/material';
import ArrowBackIosNewIcon      from '@mui/icons-material/ArrowBackIosNew';
import AddCircleOutlineIcon     from '@mui/icons-material/AddCircleOutline';
import SearchIcon               from '@mui/icons-material/Search';
import PeopleOutlineIcon        from '@mui/icons-material/PeopleOutline';
import ReceiptLongOutlinedIcon  from '@mui/icons-material/ReceiptLongOutlined';
import DesignServicesIcon       from '@mui/icons-material/DesignServices';
import EditOutlinedIcon         from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon        from '@mui/icons-material/DeleteOutline';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import SettingsOutlinedIcon     from '@mui/icons-material/SettingsOutlined';
import SortIcon                 from '@mui/icons-material/Sort';
import AttachFileIcon           from '@mui/icons-material/AttachFile';
import DownloadIcon             from '@mui/icons-material/Download';
import CheckCircleOutlineIcon   from '@mui/icons-material/CheckCircleOutline';
import config from '../../config.json';

const B = {
  bg: '#0c1410', panel: '#162420', panelHi: '#1c2e28',
  border: '#1a3d2b', green: '#4ade80', greenDk: '#1a3d2b',
  white: '#ffffff', muted: 'rgba(255,255,255,0.55)',
  faint: 'rgba(255,255,255,0.06)',
};
const HEADER_H = 56;

const STATUS_META = {
  quoted:        { label: 'Quoted',        color: '#60a5fa', bg: 'rgba(96,165,250,0.14)' },
  approved:      { label: 'Approved',      color: '#a78bfa', bg: 'rgba(167,139,250,0.14)' },
  placed:        { label: 'Placed',        color: '#fbbf24', bg: 'rgba(251,191,36,0.14)' },
  in_production: { label: 'In Production', color: '#f97316', bg: 'rgba(249,115,22,0.14)' },
  shipped:       { label: 'Shipped',       color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)' },
  delivered:     { label: 'Delivered',     color: '#4ade80', bg: 'rgba(74,222,128,0.14)' },
  cancelled:     { label: 'Cancelled',     color: '#9ca3af', bg: 'rgba(156,163,175,0.14)' },
};
const STATUS_OPTIONS = Object.entries(STATUS_META).map(([value, m]) => ({ value, ...m }));

// Label to use next to the date based on order status
const DATE_LABEL = {
  quoted:        'Quoted',
  approved:      'Approved',
  placed:        'Placed',
  in_production: 'Started',
  shipped:       'Shipped',
  delivered:     'Delivered',
  cancelled:     'Date',
};

const darkInput = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.04)', color: B.white,
    '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' },
    '&:hover fieldset': { borderColor: B.green },
    '&.Mui-focused fieldset': { borderColor: B.green },
  },
  '& .MuiInputLabel-root': { color: B.muted },
  '& .MuiInputLabel-root.Mui-focused': { color: B.green },
  '& .MuiInputBase-input': { color: B.white },
  '& .MuiSelect-icon': { color: B.muted },
  input: { color: B.white },
};

const scrollbar = {
  '&::-webkit-scrollbar': { width: 5, bgcolor: 'transparent' },
  '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.10)', borderRadius: 3 },
};

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function emptyOrder(companyName = '', clientName = '') {
  return {
    orderNumber: '', clientName, companyName,
    status: 'placed', totalValue: '', cogs: '',
    printerName: '', notes: '', mockupNumbers: [],
    items: [], orderDate: '', shipDate: '', deliveredDate: '',
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientHubTab({ token, onBack }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const base = `${config.backendUrl}/api`;

  const [clients, setClients]               = React.useState([]);
  const [clientsLoading, setClientsLoading] = React.useState(true);
  const [search, setSearch]                 = React.useState('');
  const [sortMode, setSortMode]             = React.useState('recent');
  const [selectedKey, setSelectedKey]       = React.useState(null);

  const [orders, setOrders]                 = React.useState([]);
  const [ordersLoading, setOrdersLoading]   = React.useState(false);
  const [quotes, setQuotes]                 = React.useState([]);
  const [quotesLoading, setQuotesLoading]   = React.useState(false);
  const [mockups, setMockups]               = React.useState([]);
  const [mockupsLoading, setMockupsLoading] = React.useState(false);
  const [activeTab, setActiveTab]           = React.useState(0);

  const [orderDialogOpen, setOrderDialogOpen] = React.useState(false);
  const [editingOrder, setEditingOrder]       = React.useState(null);
  const [orderSaving, setOrderSaving]         = React.useState(false);

  const [settingsAnchor, setSettingsAnchor] = React.useState(null);
  const [dedupeOpen, setDedupeOpen]         = React.useState(false);
  const [convertingId, setConvertingId]     = React.useState(null);

  const selectedClient = clients.find(c => c._id === selectedKey);

  // ── Derived: split orders into real (placed+) vs quoted ───────────────────
  const realOrders  = React.useMemo(() => orders.filter(o => o.status !== 'quoted'), [orders]);
  const quotedOrders = React.useMemo(() => orders.filter(o => o.status === 'quoted'), [orders]);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadClients = React.useCallback(async () => {
    setClientsLoading(true);
    try {
      const r = await axios.get(`${base}/orders/clients`, authHdr);
      setClients(r.data?.clients || []);
    } catch (_) { setClients([]); }
    finally { setClientsLoading(false); }
  }, [authHdr, base]);

  React.useEffect(() => { loadClients(); }, [loadClients]);

  const loadClientData = React.useCallback(async (client) => {
    if (!client) return;
    const name = client.companyName || client.clientName || '';
    setOrdersLoading(true); setQuotesLoading(true); setMockupsLoading(true);

    try {
      const r = await axios.get(`${base}/orders/company/${encodeURIComponent(name)}`, authHdr);
      setOrders(r.data?.orders || []);
    } catch (_) { setOrders([]); }
    finally { setOrdersLoading(false); }

    try {
      const r = await axios.get(`${base}/quoter/quotes?search=${encodeURIComponent(name)}`, authHdr);
      setQuotes(Array.isArray(r.data) ? r.data : (r.data?.quotes || []));
    } catch (_) { setQuotes([]); }
    finally { setQuotesLoading(false); }

    try {
      const r = await axios.get(`${base}/studio/library/mockups`, authHdr);
      const all = r.data || [];
      const companyN = (client.companyName || '').toLowerCase();
      const clientN  = (client.clientName  || '').toLowerCase();
      setMockups(all.filter(m => {
        const mc = (m.client || '').toLowerCase();
        const mn = (m.name   || '').toLowerCase();
        return (companyN && (mc.includes(companyN) || mn.includes(companyN))) ||
               (clientN  && (mc.includes(clientN)  || mn.includes(clientN)));
      }));
    } catch (_) { setMockups([]); }
    finally { setMockupsLoading(false); }
  }, [authHdr, base]);

  React.useEffect(() => {
    if (selectedClient) loadClientData(selectedClient);
  }, [selectedClient, loadClientData]);

  const handleSelectClient = (id) => {
    if (id === selectedKey) return;
    setSelectedKey(id); setActiveTab(0);
    setOrders([]); setQuotes([]); setMockups([]);
  };

  // ── Order actions ──────────────────────────────────────────────────────────
  const openNewOrder = async (asQuote = false) => {
    const name = selectedClient?.companyName || selectedClient?.clientName || '';
    let nextNum = '';
    if (!asQuote) {
      try {
        const r = await axios.get(`${base}/orders/next-number`, authHdr);
        nextNum = r.data?.next || '';
      } catch (_) {}
    }
    const base_ = emptyOrder(name, selectedClient?.clientName || '');
    setEditingOrder({ ...base_, status: asQuote ? 'quoted' : 'placed', orderNumber: nextNum });
    setOrderDialogOpen(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder({
      ...order,
      orderDate:     order.orderDate     ? order.orderDate.slice(0, 10)     : '',
      shipDate:      order.shipDate      ? order.shipDate.slice(0, 10)      : '',
      deliveredDate: order.deliveredDate ? order.deliveredDate.slice(0, 10) : '',
      totalValue:    order.totalValue ?? '',
      cogs:          order.cogs ?? '',
      mockupNumbers: order.mockupNumbers || [],
    });
    setOrderDialogOpen(true);
  };

  const saveOrder = async () => {
    if (!editingOrder) return;
    setOrderSaving(true);
    try {
      const payload = {
        ...editingOrder,
        totalValue:    Number(editingOrder.totalValue) || 0,
        cogs:          Number(editingOrder.cogs)       || 0,
        orderDate:     editingOrder.orderDate     || null,
        shipDate:      editingOrder.shipDate      || null,
        deliveredDate: editingOrder.deliveredDate || null,
        mockupNumbers: typeof editingOrder.mockupNumbers === 'string'
          ? editingOrder.mockupNumbers.split(',').map(s => s.trim()).filter(Boolean)
          : editingOrder.mockupNumbers || [],
      };
      if (payload._id) {
        await axios.put(`${base}/orders/${payload._id}`, payload, authHdr);
      } else {
        await axios.post(`${base}/orders`, payload, authHdr);
      }
      setOrderDialogOpen(false); setEditingOrder(null);
      await loadClients();
      if (selectedClient) await loadClientData(selectedClient);
    } catch (e) {
      alert(e?.response?.data?.message || 'Save failed');
    } finally { setOrderSaving(false); }
  };

  const deleteOrderById = async (id) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await axios.delete(`${base}/orders/${id}`, authHdr);
      setOrders(prev => prev.filter(o => o._id !== id));
      await loadClients();
    } catch (e) { alert(e?.response?.data?.message || 'Delete failed'); }
  };

  const updateOrderStatus = async (id, status) => {
    try {
      const updated = await axios.put(`${base}/orders/${id}`, { status }, authHdr);
      setOrders(prev => prev.map(o => o._id === id ? updated.data : o));
      await loadClients();
    } catch (e) { alert(e?.response?.data?.message || 'Update failed'); }
  };

  // ── Convert quoted order → placed ─────────────────────────────────────────
  const convertToOrder = async (order) => {
    setConvertingId(order._id);
    try {
      let nextNum = order.orderNumber || '';
      if (!nextNum) {
        const r = await axios.get(`${base}/orders/next-number`, authHdr);
        nextNum = r.data?.next || '';
      }
      await axios.put(`${base}/orders/${order._id}`, {
        status: 'placed',
        orderNumber: nextNum,
        orderDate: order.orderDate || new Date().toISOString().slice(0, 10),
      }, authHdr);
      await loadClients();
      if (selectedClient) await loadClientData(selectedClient);
    } catch (e) {
      alert(e?.response?.data?.message || 'Convert failed');
    } finally { setConvertingId(null); }
  };

  // ── Filtered + sorted client list ─────────────────────────────────────────
  const filteredClients = React.useMemo(() => {
    const t = search.trim().toLowerCase();
    let list = t
      ? clients.filter(c =>
          (c.companyName || '').toLowerCase().includes(t) ||
          (c.clientName  || '').toLowerCase().includes(t))
      : [...clients];
    if (sortMode === 'alpha') {
      list.sort((a, b) => {
        const na = (a.companyName || a.clientName || '').toLowerCase();
        const nb = (b.companyName || b.clientName || '').toLowerCase();
        return na.localeCompare(nb);
      });
    }
    return list;
  }, [clients, search, sortMode]);

  // Key by mockup number (#000028D from pageState.mockupNum) first, then name as fallback
  const mockupThumbnailMap = React.useMemo(() => {
    const map = {};
    mockups.forEach(m => {
      if (!m.thumbnail) return;
      const num = m.pageState?.mockupNum;
      if (num) map[num] = m.thumbnail;
      if (m.name) map[m.name] = m.thumbnail;
    });
    return map;
  }, [mockups]);

  const openMockupInStudio = (num) => {
    window.open(`/jpstudio/?t=${token}&filter=${encodeURIComponent(num)}`, '_blank');
  };

  return (
    <Box sx={{ position: 'fixed', inset: 0, bgcolor: B.bg, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, height: HEADER_H, zIndex: 10,
        bgcolor: '#0a1612', borderBottom: `1px solid ${B.border}`,
        display: 'flex', alignItems: 'center', px: { xs: 1.5, md: 2 }, gap: 1,
      }}>
        <IconButton onClick={onBack} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
          <ArrowBackIosNewIcon fontSize="small" />
        </IconButton>
        <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 16, letterSpacing: 0.5 }}>
          ORDER TRACKER
        </Typography>
        <TextField
          size="small" placeholder="Search clients…" value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ ...darkInput, width: { xs: 150, sm: 220 }, ml: 'auto' }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: B.muted, fontSize: 18 }} /></InputAdornment>,
          }}
        />
        <Tooltip title={sortMode === 'recent' ? 'Sort: Recent first' : 'Sort: A–Z'}>
          <IconButton
            size="small"
            onClick={() => setSortMode(m => m === 'recent' ? 'alpha' : 'recent')}
            sx={{ color: sortMode === 'alpha' ? B.green : B.muted, '&:hover': { color: B.green } }}
          >
            <SortIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Settings">
          <IconButton
            size="small"
            onClick={e => setSettingsAnchor(e.currentTarget)}
            sx={{ color: B.muted, '&:hover': { color: B.green } }}
          >
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Popover
          open={Boolean(settingsAnchor)}
          anchorEl={settingsAnchor}
          onClose={() => setSettingsAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 1.5, minWidth: 200 } }}
        >
          <List dense disablePadding>
            <ListItem
              button
              onClick={() => { setSettingsAnchor(null); setDedupeOpen(true); }}
              sx={{ px: 2, py: 1, '&:hover': { bgcolor: B.faint } }}
            >
              <ListItemText
                primary="Review duplicates"
                primaryTypographyProps={{ sx: { color: B.white, fontSize: 13 } }}
                secondary="Merge or rename company names"
                secondaryTypographyProps={{ sx: { color: B.muted, fontSize: 11 } }}
              />
            </ListItem>
          </List>
        </Popover>
      </Box>

      {/* Body */}
      <Box sx={{ position: 'absolute', inset: 0, top: HEADER_H, display: 'flex' }}>
        {/* Left panel — client list */}
        <Box sx={{
          width: { xs: 220, sm: 270, md: 300 }, flexShrink: 0,
          borderRight: `1px solid ${B.border}`, overflowY: 'auto',
          ...scrollbar,
        }}>
          {clientsLoading ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <CircularProgress size={24} sx={{ color: B.green }} />
            </Box>
          ) : filteredClients.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, color: B.muted, px: 2 }}>
              <PeopleOutlineIcon sx={{ fontSize: 36, opacity: 0.3, mb: 1 }} />
              <Typography sx={{ fontSize: 13 }}>
                {search ? 'No matches.' : 'No clients yet.'}
              </Typography>
            </Box>
          ) : (
            filteredClients.map(c => (
              <ClientListItem
                key={c._id}
                client={c}
                selected={c._id === selectedKey}
                onClick={() => handleSelectClient(c._id)}
              />
            ))
          )}
        </Box>

        {/* Right panel — detail */}
        <Box sx={{ flex: 1, overflowY: 'auto', ...scrollbar }}>
          {!selectedClient ? (
            <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: B.muted, flexDirection: 'column', gap: 1 }}>
              <PeopleOutlineIcon sx={{ fontSize: 48, opacity: 0.2 }} />
              <Typography sx={{ fontSize: 14 }}>Select a client</Typography>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
              {/* Client header */}
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2.5} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 24 }}>
                    {selectedClient.companyName || selectedClient.clientName}
                  </Typography>
                  {selectedClient.companyName && selectedClient.clientName && (
                    <Typography sx={{ color: B.muted, fontSize: 14, mt: 0.25 }}>{selectedClient.clientName}</Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <StatBadge label="Orders" value={selectedClient.allOrderCount || selectedClient.orderCount || 0} />
                  <StatBadge label="Revenue" value={fmt(selectedClient.totalRevenue)} />
                  {selectedClient.lastOrderDate && (
                    <StatBadge label="Last Order" value={fmtDate(selectedClient.lastOrderDate)} />
                  )}
                </Stack>
              </Stack>

              {/* Tabs */}
              <Tabs
                value={activeTab} onChange={(_, v) => setActiveTab(v)}
                sx={{
                  mb: 2,
                  '& .MuiTab-root': { color: B.muted, fontWeight: 700, fontSize: 13, minWidth: 0, px: 2 },
                  '& .Mui-selected': { color: B.green },
                  '& .MuiTabs-indicator': { bgcolor: B.green },
                }}
              >
                <Tab label={`Orders (${realOrders.length})`} icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label={`Quotes (${quotedOrders.length + quotes.length})`} icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label={`Mockups (${mockups.length})`} icon={<DesignServicesIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
              </Tabs>

              {activeTab === 0 && (
                <OrdersTab
                  orders={realOrders} loading={ordersLoading}
                  mockupThumbnailMap={mockupThumbnailMap}
                  onNew={openNewOrder} onEdit={openEditOrder}
                  onDelete={deleteOrderById} onStatusChange={updateOrderStatus}
                  onMockupClick={openMockupInStudio}
                  token={token} base={base} authHdr={authHdr}
                />
              )}
              {activeTab === 1 && (
                <QuotesTab
                  quotedOrders={quotedOrders} quotes={quotes}
                  loading={quotesLoading || ordersLoading}
                  mockupThumbnailMap={mockupThumbnailMap}
                  onConvert={convertToOrder} convertingId={convertingId}
                  onEdit={openEditOrder} onDelete={deleteOrderById}
                  onStatusChange={updateOrderStatus} onMockupClick={openMockupInStudio}
                  onNewQuote={() => openNewOrder(true)}
                  token={token} base={base} authHdr={authHdr}
                />
              )}
              {activeTab === 2 && (
                <MockupsTab
                  mockups={mockups} loading={mockupsLoading}
                  onMockupClick={openMockupInStudio}
                />
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Dedupe Dialog */}
      <DedupeDialog
        open={dedupeOpen}
        onClose={() => setDedupeOpen(false)}
        clients={clients}
        base={base}
        authHdr={authHdr}
        onDone={() => { setDedupeOpen(false); loadClients(); if (selectedClient) loadClientData(selectedClient); }}
      />

      {/* Order Dialog */}
      <OrderDialog
        open={orderDialogOpen}
        order={editingOrder}
        saving={orderSaving}
        onChange={patch => setEditingOrder(prev => ({ ...prev, ...patch }))}
        onSave={saveOrder}
        onClose={() => { setOrderDialogOpen(false); setEditingOrder(null); }}
        mockups={mockups}
        token={token}
        base={base}
        authHdr={authHdr}
      />
    </Box>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }) {
  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 1.5, px: 1.5, py: 0.8, textAlign: 'center', minWidth: 80 }}>
      <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Typography>
      <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>{value}</Typography>
    </Paper>
  );
}

function ClientListItem({ client, selected, onClick }) {
  const name      = client.companyName || client.clientName;
  const sub       = client.companyName && client.clientName ? client.clientName : null;
  const totalOrds = client.allOrderCount || client.orderCount || 0;
  return (
    <Tooltip title={name} placement="right" disableHoverListener={name.length < 28}>
      <Box
        onClick={onClick}
        sx={{
          px: 2, py: 1.4, cursor: 'pointer', borderBottom: `1px solid ${B.faint}`,
          bgcolor: selected ? 'rgba(74,222,128,0.08)' : 'transparent',
          borderLeft: selected ? `3px solid ${B.green}` : '3px solid transparent',
          '&:hover': { bgcolor: selected ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)' },
          transition: 'all 0.12s',
        }}
      >
        <Typography sx={{
          color: B.white, fontWeight: selected ? 700 : 500, fontSize: 13.5,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </Typography>
        {sub && <Typography sx={{ color: B.muted, fontSize: 11.5, mt: 0.2 }}>{sub}</Typography>}
        <Stack direction="row" spacing={1} mt={0.3} alignItems="center">
          {totalOrds > 0 && (
            <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>
              {totalOrds} order{totalOrds !== 1 ? 's' : ''}
            </Typography>
          )}
          {client.lastOrderDate && (
            <Typography sx={{ color: B.muted, fontSize: 11 }}>· {fmtDate(client.lastOrderDate)}</Typography>
          )}
        </Stack>
      </Box>
    </Tooltip>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab({ orders, loading, mockupThumbnailMap, onNew, onEdit, onDelete, onStatusChange, onMockupClick, token, base, authHdr }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;
  return (
    <Stack spacing={1.5}>
      <Box>
        <Button onClick={onNew} startIcon={<AddCircleOutlineIcon />} size="small" variant="outlined"
          sx={{ borderColor: B.border, color: B.green, fontWeight: 700, '&:hover': { borderColor: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}>
          New Order
        </Button>
      </Box>
      {orders.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
          <ReceiptLongOutlinedIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ fontSize: 13 }}>No orders yet.</Typography>
        </Box>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order._id}
            order={order}
            mockupThumbnailMap={mockupThumbnailMap}
            onEdit={() => onEdit(order)}
            onDelete={() => onDelete(order._id)}
            onStatusChange={status => onStatusChange(order._id, status)}
            onMockupClick={onMockupClick}
            token={token} base={base} authHdr={authHdr}
          />
        ))
      )}
    </Stack>
  );
}

// ─── Quotes Tab ───────────────────────────────────────────────────────────────
function QuotesTab({ quotedOrders, quotes, loading, mockupThumbnailMap, onConvert, convertingId, onEdit, onDelete, onStatusChange, onMockupClick, onNewQuote, token, base, authHdr }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;

  return (
    <Stack spacing={1.5}>
      <Box>
        <Button onClick={onNewQuote} startIcon={<AddCircleOutlineIcon />} size="small" variant="outlined"
          sx={{ borderColor: B.border, color: '#60a5fa', fontWeight: 700, '&:hover': { borderColor: '#60a5fa', bgcolor: 'rgba(96,165,250,0.06)' } }}>
          New Quote
        </Button>
      </Box>

      {quotedOrders.length === 0 && quotes.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
          <RequestQuoteOutlinedIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
          <Typography sx={{ fontSize: 13 }}>No quotes yet.</Typography>
        </Box>
      )}

      {/* Quoted orders from DB — shown first with convert button */}
      {quotedOrders.map(order => (
        <OrderCard
          key={order._id}
          order={order}
          mockupThumbnailMap={mockupThumbnailMap}
          onEdit={() => onEdit(order)}
          onDelete={() => onDelete(order._id)}
          onStatusChange={status => onStatusChange(order._id, status)}
          onMockupClick={onMockupClick}
          onConvert={() => onConvert(order)}
          converting={convertingId === order._id}
          token={token} base={base} authHdr={authHdr}
        />
      ))}

      {/* Studio Quoter quotes — read-only */}
      {quotes.length > 0 && (
        <>
          {quotedOrders.length > 0 && (
            <Typography sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, pt: 1 }}>
              Studio Quoter
            </Typography>
          )}
          {quotes.map(q => {
            const garments = (q.garmentGroups || []).map(g => g.garmentType).filter(Boolean).join(', ');
            return (
              <Paper key={q._id} sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 1.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                  <Box>
                    <Typography sx={{ color: B.white, fontWeight: 600, fontSize: 14 }}>
                      {q.companyName || q.clientName || 'Unnamed'}
                    </Typography>
                    <Typography sx={{ color: B.muted, fontSize: 12 }}>
                      {garments || 'No garments'} · {fmtDate(q.date)}
                    </Typography>
                  </Box>
                  <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>{q._id?.slice(-6)}</Typography>
                </Stack>
              </Paper>
            );
          })}
        </>
      )}
    </Stack>
  );
}

function OrderCard({ order, mockupThumbnailMap, onEdit, onDelete, onStatusChange, onMockupClick, onConvert, converting, base, authHdr }) {
  const [statusOpen, setStatusOpen]   = React.useState(false);
  const [filesOpen, setFilesOpen]     = React.useState(false);
  const [uploading, setUploading]     = React.useState(false);
  const [files, setFiles]             = React.useState(order.files || []);
  const fileInputRef                  = React.useRef();

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${base}/orders/${order._id}/files`, fd, {
        headers: { ...authHdr.headers, 'Content-Type': 'multipart/form-data' },
      });
      setFiles(prev => [...prev, r.data]);
    } catch (e) { alert(e?.response?.data?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const handleFileDelete = async (filename) => {
    if (!window.confirm('Remove this file?')) return;
    try {
      await axios.delete(`${base}/orders/${order._id}/files/${filename}`, authHdr);
      setFiles(prev => prev.filter(f => f.filename !== filename));
    } catch (e) { alert('Delete failed'); }
  };

  const fileIcon = (mimetype = '') => {
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('image')) return '🖼';
    return '📎';
  };

  const sm = STATUS_META[order.status] || STATUS_META.quoted;
  const dateLabel = DATE_LABEL[order.status] || 'Date';
  // Hide files section for drive-imported quotes that have no files attached
  const showFiles = files.length > 0 || order.importedFrom !== 'gdrive_quoter';

  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {order.orderNumber && (
            <Typography sx={{ color: B.muted, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
              #{order.orderNumber}
            </Typography>
          )}
          <FormControl size="small">
            <Select
              value={order.status || 'quoted'}
              onChange={e => onStatusChange(e.target.value)}
              open={statusOpen} onOpen={() => setStatusOpen(true)} onClose={() => setStatusOpen(false)}
              renderValue={val => {
                const m = STATUS_META[val] || STATUS_META.quoted;
                return <Chip label={m.label} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: m.bg, color: m.color, cursor: 'pointer' }} />;
              }}
              sx={{ '& .MuiOutlinedInput-notchedOutline': { border: 'none' }, '& .MuiSelect-select': { p: 0 }, '& .MuiSelect-icon': { color: B.muted, fontSize: 16, right: -2 } }}
            >
              {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>{s.label}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {order.totalValue > 0 && (
            <Typography sx={{ color: sm.color === '#4ade80' ? B.green : sm.color, fontWeight: 700, fontFamily: 'monospace', fontSize: 14, mr: 1 }}>
              {fmt(order.totalValue)}
            </Typography>
          )}
          {onConvert && (
            <Tooltip title="Convert to order">
              <Button
                size="small"
                onClick={onConvert}
                disabled={converting}
                startIcon={converting ? <CircularProgress size={12} sx={{ color: B.greenDk }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />}
                variant="contained"
                sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700, fontSize: 11, px: 1, py: 0.4, minWidth: 0, mr: 0.5 }}
              >
                {converting ? '' : 'Convert'}
              </Button>
            </Tooltip>
          )}
          <Tooltip title="Edit"><IconButton size="small" onClick={onEdit} sx={{ color: B.muted, '&:hover': { color: B.green } }}><EditOutlinedIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
          <Tooltip title="Delete"><IconButton size="small" onClick={onDelete} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}><DeleteOutlineIcon sx={{ fontSize: 16 }} /></IconButton></Tooltip>
        </Stack>
      </Stack>

      {/* Meta row */}
      <Stack direction="row" spacing={2} mt={0.8} flexWrap="wrap" useFlexGap>
        {order.printerName && <MetaItem label="Printer" value={order.printerName} />}
        {order.orderDate    && <MetaItem label={dateLabel}  value={fmtDate(order.orderDate)} />}
        {order.shipDate     && <MetaItem label="Ship"        value={fmtDate(order.shipDate)} />}
        {order.deliveredDate && <MetaItem label="Delivered"  value={fmtDate(order.deliveredDate)} />}
      </Stack>

      {/* Items */}
      {order.items?.length > 0 && (
        <Box mt={0.8}>
          {order.items.map((it, i) => (
            <Typography key={i} sx={{ color: B.muted, fontSize: 12, fontFamily: 'monospace' }}>
              {it.qty ? `${it.qty}× ` : ''}{it.description}{it.unitPrice ? ` @ ${fmt(it.unitPrice)}` : ''}
            </Typography>
          ))}
        </Box>
      )}

      {/* Mockup thumbnails + labels */}
      {order.mockupNumbers?.length > 0 && (
        <Stack direction="row" spacing={1} mt={1.2} flexWrap="wrap" useFlexGap>
          {order.mockupNumbers.map((n, i) => {
            const thumb = mockupThumbnailMap?.[n];
            return (
              <Tooltip key={i} title={`Open ${n} in Mockup Studio`}>
                <Box
                  onClick={() => onMockupClick(n)}
                  sx={{
                    cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                    border: `1px solid ${B.border}`, width: thumb ? 72 : 'auto',
                    '&:hover': { borderColor: B.green },
                    transition: 'border-color 0.12s',
                  }}
                >
                  {thumb ? (
                    <>
                      <Box component="img" src={thumb} alt={n}
                        sx={{ width: 72, height: 72, objectFit: 'cover', display: 'block' }} />
                      <Box sx={{ px: 0.6, py: 0.4, bgcolor: B.panelHi }}>
                        <Typography sx={{ color: B.muted, fontSize: 9, fontFamily: 'monospace', fontWeight: 700, textAlign: 'center' }}>{n}</Typography>
                      </Box>
                    </>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.8, py: 0.4, bgcolor: B.panelHi }}>
                      <Typography sx={{ color: B.muted, fontSize: 10, fontFamily: 'monospace', fontWeight: 600 }}>{n}</Typography>
                    </Box>
                  )}
                </Box>
              </Tooltip>
            );
          })}
        </Stack>
      )}

      {order.notes && <Typography sx={{ color: B.muted, fontSize: 12, mt: 0.8, fontStyle: 'italic' }}>{order.notes}</Typography>}

      {/* Files section — hidden for drive imports with no files */}
      {showFiles && (
        <Box mt={1}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              startIcon={<AttachFileIcon sx={{ fontSize: 14 }} />}
              onClick={() => setFilesOpen(f => !f)}
              sx={{ color: B.muted, fontSize: 11, textTransform: 'none', fontWeight: 600, px: 0.5, minWidth: 0, '&:hover': { color: B.green } }}
            >
              Files {files.length > 0 ? `(${files.length})` : ''}
            </Button>
            <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
            {filesOpen && (
              <Button
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                startIcon={uploading ? <CircularProgress size={12} /> : <AddCircleOutlineIcon sx={{ fontSize: 14 }} />}
                sx={{ color: B.green, fontSize: 11, textTransform: 'none', fontWeight: 600, px: 0.5, minWidth: 0 }}
              >
                Upload
              </Button>
            )}
          </Stack>
          {filesOpen && files.length > 0 && (
            <Stack spacing={0.5} mt={0.5} pl={0.5}>
              {files.map((f, i) => (
                <Stack key={i} direction="row" alignItems="center" spacing={0.5}>
                  <Typography sx={{ fontSize: 11, color: B.muted }}>{fileIcon(f.mimetype)}</Typography>
                  <Typography sx={{ fontSize: 11, color: B.white, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {f.originalName}
                  </Typography>
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      component="a"
                      href={`${base}/orders/${order._id}/files/${f.filename}`}
                      target="_blank"
                      sx={{ color: B.muted, '&:hover': { color: B.green }, p: 0.3 }}
                    >
                      <DownloadIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton size="small" onClick={() => handleFileDelete(f.filename)} sx={{ color: B.muted, '&:hover': { color: '#f87171' }, p: 0.3 }}>
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Paper>
  );
}

function MetaItem({ label, value }) {
  return (
    <Box>
      <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label} </Typography>
      <Typography component="span" sx={{ color: B.white, fontSize: 12 }}>{value}</Typography>
    </Box>
  );
}

// ─── Mockups Tab ─────────────────────────────────────────────────────────────
function MockupsTab({ mockups, loading, onMockupClick }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;
  if (mockups.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
        <DesignServicesIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
        <Typography sx={{ fontSize: 13 }}>No mockups linked to this client.</Typography>
        <Typography sx={{ fontSize: 11, mt: 0.5 }}>Tag a mockup with this client name in Mockup Studio to see it here.</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
      {mockups.map(m => (
        <Paper
          key={m._id}
          onClick={() => onMockupClick(m.name)}
          sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden', cursor: 'pointer', '&:hover': { borderColor: B.green } }}
        >
          {m.thumbnail ? (
            <Box component="img" src={m.thumbnail} alt={m.name} sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
          ) : (
            <Box sx={{ aspectRatio: '1', bgcolor: B.panelHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DesignServicesIcon sx={{ color: B.muted, fontSize: 32, opacity: 0.4 }} />
            </Box>
          )}
          <Box sx={{ p: 1 }}>
            <Typography sx={{ color: B.white, fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {m.name || 'Untitled'}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

// ─── Dedupe Dialog ────────────────────────────────────────────────────────────
function DedupeDialog({ open, onClose, clients, base, authHdr, onDone }) {
  const [selected, setSelected]   = React.useState('');
  const [renameTo, setRenameTo]   = React.useState('');
  const [working, setWorking]     = React.useState(false);

  React.useEffect(() => { if (!open) { setSelected(''); setRenameTo(''); } }, [open]);

  const allNames = React.useMemo(
    () => [...new Set(clients.map(c => c.companyName || c.clientName).filter(Boolean))].sort(),
    [clients]
  );

  const handleMerge = async () => {
    if (!selected || !renameTo.trim()) return;
    setWorking(true);
    try {
      await axios.post(`${base}/orders/rename-company`, { from: selected, to: renameTo.trim() }, authHdr);
      onDone();
    } catch (e) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setWorking(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete ALL orders for "${selected}"? This cannot be undone.`)) return;
    setWorking(true);
    try {
      await axios.delete(`${base}/orders/by-company/${encodeURIComponent(selected)}`, authHdr);
      onDone();
    } catch (e) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setWorking(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
      <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 16, pb: 1 }}>
        Review Duplicates
      </DialogTitle>
      <DialogContent>
        <Typography sx={{ color: B.muted, fontSize: 13, mb: 2 }}>
          Select a company to rename it or merge it into another.
        </Typography>
        <FormControl size="small" fullWidth sx={{ mb: 2 }}>
          <InputLabel sx={{ color: B.muted }}>Company to change</InputLabel>
          <Select
            label="Company to change"
            value={selected}
            onChange={e => { setSelected(e.target.value); setRenameTo(''); }}
            sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: B.white, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-icon': { color: B.muted } }}
          >
            {allNames.map(n => <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>)}
          </Select>
        </FormControl>

        {selected && (
          <>
            <TextField
              size="small" fullWidth label="Rename / merge into"
              value={renameTo}
              onChange={e => setRenameTo(e.target.value)}
              placeholder="Type new or existing name"
              sx={{ ...darkInput, mb: 1.5 }}
            />
            <Typography sx={{ color: B.muted, fontSize: 11, mb: 0.75 }}>Or click an existing name:</Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {allNames.filter(n => n !== selected).map(n => (
                <Chip
                  key={n} label={n} size="small" onClick={() => setRenameTo(n)}
                  sx={{
                    height: 22, fontSize: 11, cursor: 'pointer',
                    bgcolor: renameTo === n ? 'rgba(74,222,128,0.15)' : B.panelHi,
                    color: renameTo === n ? B.green : B.muted,
                    border: `1px solid ${renameTo === n ? B.green : B.border}`,
                  }}
                />
              ))}
            </Stack>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2, gap: 1 }}>
        <Button onClick={onClose} sx={{ color: B.muted }}>Close</Button>
        {selected && (
          <Button onClick={handleDelete} disabled={working}
            sx={{ color: '#f87171', '&:hover': { bgcolor: 'rgba(248,113,113,0.08)' } }}>
            Delete all orders
          </Button>
        )}
        <Button
          onClick={handleMerge}
          disabled={working || !renameTo.trim() || !selected}
          variant="contained"
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}
        >
          {working ? <CircularProgress size={16} sx={{ color: B.greenDk }} /> : 'Merge / Rename'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── Order Dialog ─────────────────────────────────────────────────────────────
function OrderDialog({ open, order, saving, onChange, onSave, onClose, mockups }) {
  const [mockupPickerOpen, setMockupPickerOpen] = React.useState(false);
  if (!order) return null;

  const field = (label, key, props = {}) => (
    <TextField label={label} size="small" value={order[key] ?? ''} fullWidth
      onChange={e => onChange({ [key]: e.target.value })} sx={darkInput} {...props} />
  );

  const currentMockupNums = Array.isArray(order.mockupNumbers) ? order.mockupNumbers : [];

  const toggleMockup = (name) => {
    const nums = currentMockupNums.includes(name)
      ? currentMockupNums.filter(n => n !== name)
      : [...currentMockupNums, name];
    onChange({ mockupNumbers: nums });
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
        PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 16, pb: 1 }}>
          {order._id ? 'Edit Order' : 'New Order'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={1.5}>
              {field('Order #', 'orderNumber', { sx: { ...darkInput, maxWidth: 160 } })}
              <FormControl size="small" fullWidth>
                <InputLabel sx={{ color: B.muted }}>Status</InputLabel>
                <Select label="Status" value={order.status || 'placed'} onChange={e => onChange({ status: e.target.value })}
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: B.white, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-icon': { color: B.muted } }}>
                  {STATUS_OPTIONS.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction="row" spacing={1.5}>
              {field('Total Value ($)', 'totalValue', { type: 'number' })}
              {field('COGS ($)', 'cogs', { type: 'number' })}
            </Stack>

            {field('Printer', 'printerName')}

            <Stack direction="row" spacing={1.5}>
              {field('Order Date', 'orderDate', { type: 'date', InputLabelProps: { shrink: true } })}
              {field('Ship Date',  'shipDate',  { type: 'date', InputLabelProps: { shrink: true } })}
              {field('Delivered',  'deliveredDate', { type: 'date', InputLabelProps: { shrink: true } })}
            </Stack>

            {/* Mockup numbers: typed + picker */}
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" mb={0.5}>
                <Typography sx={{ color: B.muted, fontSize: 12, fontWeight: 700 }}>Mockup Numbers</Typography>
                {mockups.length > 0 && (
                  <Button size="small" onClick={() => setMockupPickerOpen(true)}
                    sx={{ color: B.green, fontSize: 11, textTransform: 'none', py: 0.3 }}>
                    Browse mockups
                  </Button>
                )}
              </Stack>
              <TextField size="small" fullWidth
                value={currentMockupNums.join(', ')}
                onChange={e => onChange({ mockupNumbers: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                sx={darkInput} placeholder="#000028D, #000028E" />
              {currentMockupNums.length > 0 && (
                <Stack direction="row" spacing={0.5} mt={0.8} flexWrap="wrap" useFlexGap>
                  {currentMockupNums.map((n, i) => (
                    <Chip key={i} label={n} size="small" onDelete={() => toggleMockup(n)}
                      sx={{ height: 20, fontSize: 10, bgcolor: B.panelHi, color: B.muted }} />
                  ))}
                </Stack>
              )}
            </Box>

            {field('Notes', 'notes', { multiline: true, minRows: 2 })}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={onClose} sx={{ color: B.muted }}>Cancel</Button>
          <Button onClick={onSave} disabled={saving} variant="contained"
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}>
            {saving ? <CircularProgress size={16} sx={{ color: B.greenDk }} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Mockup picker dialog */}
      <Dialog open={mockupPickerOpen} onClose={() => setMockupPickerOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 } }}>
        <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 15, pb: 1 }}>Browse Mockups</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 1 }}>
            {mockups.map(m => {
              const sel = currentMockupNums.includes(m.name);
              return (
                <Box key={m._id} onClick={() => toggleMockup(m.name)} sx={{
                  cursor: 'pointer', borderRadius: 1.5, overflow: 'hidden',
                  border: `2px solid ${sel ? B.green : B.border}`,
                  opacity: sel ? 1 : 0.7, transition: 'all 0.12s',
                  '&:hover': { opacity: 1, borderColor: B.green },
                }}>
                  {m.thumbnail ? (
                    <Box component="img" src={m.thumbnail} alt={m.name} sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                  ) : (
                    <Box sx={{ aspectRatio: '1', bgcolor: B.panelHi, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <DesignServicesIcon sx={{ color: B.muted, fontSize: 28, opacity: 0.4 }} />
                    </Box>
                  )}
                  <Box sx={{ p: 0.8, bgcolor: sel ? 'rgba(74,222,128,0.1)' : 'transparent' }}>
                    <Typography sx={{ color: sel ? B.green : B.white, fontSize: 10, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.name || 'Untitled'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setMockupPickerOpen(false)} variant="contained"
            sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}>Done</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
