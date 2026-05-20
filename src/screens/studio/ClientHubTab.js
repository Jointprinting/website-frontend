// src/screens/studio/ClientHubTab.js
import * as React from 'react';
import axios from 'axios';
import {
  Box, Stack, Typography, TextField, Button, IconButton, Chip, Paper,
  CircularProgress, Select, MenuItem, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  InputAdornment, Tabs, Tab, Tooltip,
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

const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

function emptyOrder(companyName = '', clientName = '') {
  return {
    orderNumber: '', clientName, companyName,
    status: 'quoted', totalValue: '', cogs: '',
    printerName: '', notes: '', mockupNumbers: [],
    items: [], orderDate: '', shipDate: '', deliveredDate: '',
  };
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function ClientHubTab({ token, onBack }) {
  const authHdr = React.useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const base = `${config.backendUrl}/api`;

  const [clients, setClients]             = React.useState([]);
  const [clientsLoading, setClientsLoading] = React.useState(true);
  const [search, setSearch]               = React.useState('');
  const [selectedKey, setSelectedKey]     = React.useState(null);

  const [orders, setOrders]               = React.useState([]);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [quotes, setQuotes]               = React.useState([]);
  const [quotesLoading, setQuotesLoading] = React.useState(false);
  const [mockups, setMockups]             = React.useState([]);
  const [mockupsLoading, setMockupsLoading] = React.useState(false);
  const [activeTab, setActiveTab]         = React.useState(0);

  const [orderDialogOpen, setOrderDialogOpen] = React.useState(false);
  const [editingOrder, setEditingOrder]       = React.useState(null);
  const [orderSaving, setOrderSaving]         = React.useState(false);

  const selectedClient = clients.find(c => c._id === selectedKey);

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

    setOrdersLoading(true);
    setQuotesLoading(true);
    setMockupsLoading(true);

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
      const needle = name.toLowerCase();
      setMockups(all.filter(m =>
        (m.client || '').toLowerCase().includes(needle) ||
        (m.name || '').toLowerCase().includes(needle.slice(0, 7))
      ));
    } catch (_) { setMockups([]); }
    finally { setMockupsLoading(false); }
  }, [authHdr, base]);

  React.useEffect(() => {
    if (selectedClient) loadClientData(selectedClient);
  }, [selectedClient, loadClientData]);

  const handleSelectClient = (id) => {
    setSelectedKey(id);
    setActiveTab(0);
    setOrders([]); setQuotes([]); setMockups([]);
  };

  const openNewOrder = () => {
    const name = selectedClient?.companyName || selectedClient?.clientName || '';
    setEditingOrder(emptyOrder(name, selectedClient?.clientName || ''));
    setOrderDialogOpen(true);
  };

  const openEditOrder = (order) => {
    setEditingOrder({
      ...order,
      orderDate:    order.orderDate ? order.orderDate.slice(0, 10) : '',
      shipDate:     order.shipDate ? order.shipDate.slice(0, 10) : '',
      deliveredDate: order.deliveredDate ? order.deliveredDate.slice(0, 10) : '',
      totalValue:   order.totalValue ?? '',
      cogs:         order.cogs ?? '',
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
        totalValue: Number(editingOrder.totalValue) || 0,
        cogs:       Number(editingOrder.cogs) || 0,
        orderDate:    editingOrder.orderDate || null,
        shipDate:     editingOrder.shipDate || null,
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
      setOrderDialogOpen(false);
      setEditingOrder(null);
      await loadClients();
      if (selectedClient) await loadClientData(selectedClient);
    } catch (e) {
      alert(e?.response?.data?.message || 'Save failed');
    } finally { setOrderSaving(false); }
  };

  const deleteOrder = async (id) => {
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
    } catch (e) { alert(e?.response?.data?.message || 'Update failed'); }
  };

  const filteredClients = React.useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return clients;
    return clients.filter(c =>
      (c.companyName || '').toLowerCase().includes(t) ||
      (c.clientName || '').toLowerCase().includes(t)
    );
  }, [clients, search]);

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
          CLIENTS
        </Typography>
        <TextField
          size="small" placeholder="Search clients…" value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ ...darkInput, width: { xs: 150, sm: 220 }, ml: 'auto' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: B.muted, fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Body */}
      <Box sx={{ position: 'absolute', inset: 0, top: HEADER_H, display: 'flex' }}>
        {/* Left panel — client list */}
        <Box sx={{
          width: { xs: 200, sm: 260, md: 280 }, flexShrink: 0,
          borderRight: `1px solid ${B.border}`, overflowY: 'auto',
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
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {!selectedClient ? (
            <Box sx={{
              height: '100%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: B.muted, flexDirection: 'column', gap: 1,
            }}>
              <PeopleOutlineIcon sx={{ fontSize: 48, opacity: 0.2 }} />
              <Typography sx={{ fontSize: 14 }}>Select a client</Typography>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: 'auto' }}>
              {/* Client header */}
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" mb={2} flexWrap="wrap" gap={1}>
                <Box>
                  <Typography sx={{ color: B.white, fontWeight: 800, fontSize: 22 }}>
                    {selectedClient.companyName || selectedClient.clientName}
                  </Typography>
                  {selectedClient.companyName && selectedClient.clientName && (
                    <Typography sx={{ color: B.muted, fontSize: 14 }}>
                      {selectedClient.clientName}
                    </Typography>
                  )}
                </Box>
                <Stack direction="row" spacing={2}>
                  <StatBadge label="Orders" value={selectedClient.orderCount || 0} />
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
                <Tab label={`Orders (${orders.length})`} icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label={`Quotes (${quotes.length})`} icon={<RequestQuoteOutlinedIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
                <Tab label={`Mockups (${mockups.length})`} icon={<DesignServicesIcon sx={{ fontSize: 16 }} />} iconPosition="start" />
              </Tabs>

              {activeTab === 0 && (
                <OrdersTab
                  orders={orders} loading={ordersLoading}
                  onNew={openNewOrder} onEdit={openEditOrder}
                  onDelete={deleteOrder} onStatusChange={updateOrderStatus}
                />
              )}
              {activeTab === 1 && (
                <QuotesTab quotes={quotes} loading={quotesLoading} />
              )}
              {activeTab === 2 && (
                <MockupsTab mockups={mockups} loading={mockupsLoading} />
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Order Dialog */}
      <OrderDialog
        open={orderDialogOpen}
        order={editingOrder}
        saving={orderSaving}
        onChange={patch => setEditingOrder(prev => ({ ...prev, ...patch }))}
        onSave={saveOrder}
        onClose={() => { setOrderDialogOpen(false); setEditingOrder(null); }}
      />
    </Box>
  );
}

function StatBadge({ label, value }) {
  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 1.5, px: 1.5, py: 0.8, textAlign: 'center', minWidth: 80 }}>
      <Typography sx={{ color: B.muted, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ color: B.white, fontWeight: 700, fontSize: 14, fontFamily: 'monospace' }}>
        {value}
      </Typography>
    </Paper>
  );
}

function ClientListItem({ client, selected, onClick }) {
  const name = client.companyName || client.clientName;
  const sub = client.companyName && client.clientName ? client.clientName : null;
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 2, py: 1.5, cursor: 'pointer', borderBottom: `1px solid ${B.faint}`,
        bgcolor: selected ? 'rgba(74,222,128,0.08)' : 'transparent',
        borderLeft: selected ? `3px solid ${B.green}` : '3px solid transparent',
        '&:hover': { bgcolor: selected ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.03)' },
        transition: 'all 0.12s',
      }}
    >
      <Typography sx={{ color: B.white, fontWeight: selected ? 700 : 500, fontSize: 13.5, lineHeight: 1.3 }}>
        {name}
      </Typography>
      {sub && (
        <Typography sx={{ color: B.muted, fontSize: 11.5 }}>{sub}</Typography>
      )}
      <Stack direction="row" spacing={1} mt={0.3} alignItems="center">
        {client.orderCount > 0 && (
          <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>
            {client.orderCount} order{client.orderCount !== 1 ? 's' : ''}
          </Typography>
        )}
        {client.lastOrderDate && (
          <Typography sx={{ color: B.muted, fontSize: 11 }}>
            · {fmtDate(client.lastOrderDate)}
          </Typography>
        )}
      </Stack>
    </Box>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────
function OrdersTab({ orders, loading, onNew, onEdit, onDelete, onStatusChange }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;

  return (
    <Stack spacing={1.5}>
      <Box>
        <Button
          onClick={onNew} startIcon={<AddCircleOutlineIcon />} size="small"
          variant="outlined"
          sx={{ borderColor: B.border, color: B.green, fontWeight: 700, '&:hover': { borderColor: B.green, bgcolor: 'rgba(74,222,128,0.06)' } }}
        >
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
            onEdit={() => onEdit(order)}
            onDelete={() => onDelete(order._id)}
            onStatusChange={status => onStatusChange(order._id, status)}
          />
        ))
      )}
    </Stack>
  );
}

function OrderCard({ order, onEdit, onDelete, onStatusChange }) {
  const [statusOpen, setStatusOpen] = React.useState(false);

  return (
    <Paper sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, p: 2 }}>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          {order.orderNumber && (
            <Typography sx={{ color: B.muted, fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
              #{order.orderNumber}
            </Typography>
          )}
          {/* Status chip — click to change */}
          <FormControl size="small">
            <Select
              value={order.status || 'quoted'}
              onChange={e => onStatusChange(e.target.value)}
              open={statusOpen}
              onOpen={() => setStatusOpen(true)}
              onClose={() => setStatusOpen(false)}
              renderValue={val => {
                const m = STATUS_META[val] || STATUS_META.quoted;
                return (
                  <Chip
                    label={m.label} size="small"
                    sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: m.bg, color: m.color, cursor: 'pointer' }}
                  />
                );
              }}
              sx={{
                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                '& .MuiSelect-select': { p: 0 },
                '& .MuiSelect-icon': { color: B.muted, fontSize: 16, right: -2 },
              }}
            >
              {STATUS_OPTIONS.map(s => (
                <MenuItem key={s.value} value={s.value} sx={{ fontSize: 13 }}>{s.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Stack direction="row" spacing={0.5} alignItems="center">
          {order.totalValue > 0 && (
            <Typography sx={{ color: B.green, fontWeight: 700, fontFamily: 'monospace', fontSize: 14, mr: 1 }}>
              {fmt(order.totalValue)}
            </Typography>
          )}
          <Tooltip title="Edit">
            <IconButton size="small" onClick={onEdit} sx={{ color: B.muted, '&:hover': { color: B.green } }}>
              <EditOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" onClick={onDelete} sx={{ color: B.muted, '&:hover': { color: '#f87171' } }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* Meta row */}
      <Stack direction="row" spacing={2} mt={0.8} flexWrap="wrap" useFlexGap>
        {order.printerName && (
          <MetaItem label="Printer" value={order.printerName} />
        )}
        {order.orderDate && (
          <MetaItem label="Ordered" value={fmtDate(order.orderDate)} />
        )}
        {order.shipDate && (
          <MetaItem label="Ship" value={fmtDate(order.shipDate)} />
        )}
        {order.deliveredDate && (
          <MetaItem label="Delivered" value={fmtDate(order.deliveredDate)} />
        )}
      </Stack>

      {/* Items summary */}
      {order.items?.length > 0 && (
        <Box mt={0.8}>
          {order.items.map((it, i) => (
            <Typography key={i} sx={{ color: B.muted, fontSize: 12, fontFamily: 'monospace' }}>
              {it.qty ? `${it.qty}× ` : ''}{it.description}{it.unitPrice ? ` @ ${fmt(it.unitPrice)}` : ''}
            </Typography>
          ))}
        </Box>
      )}

      {/* Mockup numbers */}
      {order.mockupNumbers?.length > 0 && (
        <Stack direction="row" spacing={0.5} mt={0.8} flexWrap="wrap" useFlexGap>
          {order.mockupNumbers.map((n, i) => (
            <Chip key={i} label={n} size="small" sx={{ height: 18, fontSize: 10, bgcolor: B.panelHi, color: B.muted }} />
          ))}
        </Stack>
      )}

      {/* Notes */}
      {order.notes && (
        <Typography sx={{ color: B.muted, fontSize: 12, mt: 0.8, fontStyle: 'italic' }}>
          {order.notes}
        </Typography>
      )}
    </Paper>
  );
}

function MetaItem({ label, value }) {
  return (
    <Box>
      <Typography component="span" sx={{ color: B.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 }}>
        {label}{' '}
      </Typography>
      <Typography component="span" sx={{ color: B.white, fontSize: 12 }}>
        {value}
      </Typography>
    </Box>
  );
}

// ─── Quotes Tab ───────────────────────────────────────────────────────────────
function QuotesTab({ quotes, loading }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;
  if (quotes.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
        <RequestQuoteOutlinedIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
        <Typography sx={{ fontSize: 13 }}>No quotes found for this client.</Typography>
      </Box>
    );
  }
  return (
    <Stack spacing={1}>
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
              <Typography sx={{ color: B.muted, fontSize: 11, fontFamily: 'monospace' }}>
                {q._id?.slice(-6)}
              </Typography>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// ─── Mockups Tab ─────────────────────────────────────────────────────────────
function MockupsTab({ mockups, loading }) {
  if (loading) return <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: B.green }} /></Box>;
  if (mockups.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6, color: B.muted }}>
        <DesignServicesIcon sx={{ fontSize: 40, opacity: 0.3, mb: 1 }} />
        <Typography sx={{ fontSize: 13 }}>No mockups linked to this client.</Typography>
        <Typography sx={{ fontSize: 11, mt: 0.5 }}>Mockups are matched by client name set in Mockup Studio.</Typography>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
      {mockups.map(m => (
        <Paper key={m._id} sx={{ bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2, overflow: 'hidden' }}>
          {m.thumbnail ? (
            <Box
              component="img" src={m.thumbnail} alt={m.name}
              sx={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }}
            />
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

// ─── Order Dialog ─────────────────────────────────────────────────────────────
function OrderDialog({ open, order, saving, onChange, onSave, onClose }) {
  if (!order) return null;

  const field = (label, key, props = {}) => (
    <TextField
      label={label} size="small" value={order[key] ?? ''} fullWidth
      onChange={e => onChange({ [key]: e.target.value })}
      sx={darkInput} {...props}
    />
  );

  return (
    <Dialog
      open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { bgcolor: B.panel, border: `1px solid ${B.border}`, borderRadius: 2 } }}
    >
      <DialogTitle sx={{ color: B.white, fontWeight: 700, fontSize: 16, pb: 1 }}>
        {order._id ? 'Edit Order' : 'New Order'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1.5}>
            {field('Order #', 'orderNumber', { sx: { ...darkInput, maxWidth: 160 } })}
            <FormControl size="small" fullWidth>
              <InputLabel sx={{ color: B.muted }}>Status</InputLabel>
              <Select
                label="Status" value={order.status || 'quoted'}
                onChange={e => onChange({ status: e.target.value })}
                sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: B.white, '& fieldset': { borderColor: 'rgba(255,255,255,0.12)' }, '& .MuiSelect-icon': { color: B.muted } }}
              >
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
            {field('Ship Date', 'shipDate', { type: 'date', InputLabelProps: { shrink: true } })}
            {field('Delivered', 'deliveredDate', { type: 'date', InputLabelProps: { shrink: true } })}
          </Stack>

          <TextField
            label="Mockup Numbers (comma-separated)" size="small" fullWidth
            value={Array.isArray(order.mockupNumbers)
              ? order.mockupNumbers.join(', ')
              : (order.mockupNumbers || '')}
            onChange={e => onChange({ mockupNumbers: e.target.value })}
            sx={darkInput}
            placeholder="#000032A, #000032B"
          />

          {field('Notes', 'notes', { multiline: true, minRows: 2 })}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2.5, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: B.muted }}>Cancel</Button>
        <Button
          onClick={onSave} disabled={saving} variant="contained"
          sx={{ bgcolor: B.green, color: B.greenDk, fontWeight: 700 }}
        >
          {saving ? <CircularProgress size={16} sx={{ color: B.greenDk }} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
