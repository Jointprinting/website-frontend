// src/LabTestHarness.js
//
// Verification harness for the native Mockup Lab — mounts NativeMockupLab with
// REAL legacy-shaped library docs (the exact on-disk shapes the 145-mockup
// backlog uses) inside the real webpack bundle, so a crash that would white-
// screen in production reproduces here headlessly. Reached ONLY via
// ?__labtest=1 (see index.js); renders synthetic data, touches no API, no auth.

import React from 'react';
import NativeMockupLab from './screens/studio/mockup/NativeMockupLab';
import MockupCanvas from './screens/studio/mockup/MockupCanvas';
import { mockupFromLibraryItem } from './screens/studio/mockup/mockupModel';

// Remount/army-drill for the canvas: cycles key + art props fast — the exact
// surface of the "removeChild: not a child" fabric-vs-React crash. Passing this
// proves the host-div DOM-ownership fix under churn.
function CanvasStress({ tiny }) {
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (tick >= 8) return undefined;
    const t = setTimeout(() => setTick(tick + 1), 90);
    return () => clearTimeout(t);
  }, [tick]);
  return (
    <MockupCanvas
      key={tick % 4}                              // forced remounts
      width={620} height={500} displayScale={tick % 2 ? 0.6 : 1}
      blankSrc={tick % 3 ? tiny : null}           // in-place art swaps
      logoSrc={tick % 2 ? tiny : null}
      pos={{ x: 100 + tick * 5, y: 100, w: 0.3, h: 0.3, angle: tick * 10 }}
      area={tick % 2 ? { left: 120, top: 90, width: 300, height: 280, ppi: 20, maxWIn: 12, maxHIn: 16, method: 'screen print', presets: [] } : null}
      onChange={() => {}}
    />
  );
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAABAAAAAQCAYAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='.replace('ABAAAAAQ', 'AAAAAQAAAAEB');
// A guaranteed-valid 1×1 PNG:
const TINY = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

// The legacy doc shapes to prove against — mirror real backlog variants.
const CASES = [
  ['classic single-page (synced: composite-only, R2-style url)', {
    store: 'mockups', name: 'LIS Boatworks Merch', client: 'Long Island Sound Custom Boatworks',
    thumbnail: TINY, data: TINY, remoteId: 'srv-abc123',
    pageState: {
      mockupNum: '#000145B', title: 'LIS Boatworks Merch', subtitle: 'Bella Canvas 3001, Silver',
      client: 'Long Island Sound Custom Boatworks', projectNumber: '145', projectId: 'proj1',
      template: 1, printCategory: 'tshirt',
      printFront: { type: 'Screen Printing', dims: '4.00"w x 2.72"h', loc: 'Front' },
      printBack: { type: 'Screen Printing', dims: '11.76"w x 12.00"h', loc: 'Full Back' },
      frontLogoPosSize: { x: 231, y: 187, w: 0.42, h: 0.42, angle: 0 },
      backLogoPosSize: { x: null, y: null, w: null, h: null, angle: 0 },
      frontColors: ['#ffffff', { hex: '#4a90d9', name: 'Marine Blue' }], backColors: [],
      pdfName: '000145B.pdf',
    },
    pages: null, extraViews: [], extraBackViews: [],
  }],
  ['multi-page with extraViews + "" back placeholder', {
    store: 'mockups', name: 'Two Pager', client: 'Acme', thumbnail: TINY, data: '',
    remoteId: 'srv-multi', extraViews: [TINY], extraBackViews: [''],
    pageState: { mockupNum: '#000150A', template: 1, printFront: {}, printBack: {} },
    pages: [
      { mockupNum: '#000150A', template: 1, printFront: {}, printBack: {} },
      { mockupNum: '#000150A', template: 2, printFront: { type: 'DTG' }, printBack: {} },
    ],
  }],
  ['promo upload (template 2, external, inline base64)', {
    store: 'mockups', name: 'Plastic Grinder', client: 'Bleu Leaf', thumbnail: TINY,
    remoteId: 'promo-xyz',
    pageState: {
      mockupNum: '#000133C', projectNumber: '133', client: 'Bleu Leaf', title: 'Plastic Grinder',
      external: true, template: 2, frontBlankBase64: TINY, frontCompositeBase64: TINY,
      printFront: { type: '', dims: '', loc: '' }, printBack: { type: '', dims: '', loc: '' },
    },
    pages: null,
  }],
  ['degenerate: pages [null], sparse pageState, no pos fields', {
    store: 'mockups', name: '', client: '', thumbnail: '', data: '',
    remoteId: 'srv-degenerate', pageState: { mockupNum: '#000090A' }, pages: [null],
    extraViews: null, extraBackViews: null,
  }],
  ['new-mode (no mockup at all)', null],
  ['canvas remount stress (fabric DOM ownership)', 'STRESS'],
];

class CaseBoundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { this.props.onErr(err); }
  render() {
    if (this.state.err) return <div style={{ color: '#f87171' }}>CRASH: {String(this.state.err && this.state.err.message)}</div>;
    return this.props.children;
  }
}

export default function LabTestHarness() {
  const [idx, setIdx] = React.useState(0);
  const [results, setResults] = React.useState([]);
  const errRef = React.useRef(null);

  // Uncaught window errors (e.g. DOM removals React can't route to a boundary)
  // also fail the current case — nothing escapes the harness unrecorded.
  React.useEffect(() => {
    const onErr = (e) => { errRef.current = e.error || new Error(e.message || 'window error'); };
    window.addEventListener('error', onErr);
    return () => window.removeEventListener('error', onErr);
  }, []);

  const [label, doc] = CASES[idx] || [];
  const isStress = doc === 'STRESS';
  const model = React.useMemo(() => (doc && !isStress ? mockupFromLibraryItem(doc) : null), [doc, isStress]);

  // Advance through the cases automatically: mount each for a beat, record
  // crash-or-ok, move on. Results land on window.__labtest for the headless run.
  React.useEffect(() => {
    if (idx >= CASES.length) return undefined;
    errRef.current = null;
    const t = setTimeout(() => {
      const r = [...results, { label, ok: !errRef.current, err: errRef.current ? String(errRef.current.message) : '' }];
      setResults(r);
      if (idx + 1 >= CASES.length) {
        window.__labtest = { done: true, results: r };
        document.title = r.every((x) => x.ok) ? 'LABTEST-PASS' : 'LABTEST-FAIL';
      }
      setIdx(idx + 1);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  return (
    <div style={{ background: '#0b1410', minHeight: '100vh', color: '#7ee0a3', fontFamily: 'monospace' }}>
      <div style={{ padding: 10, fontSize: 13, borderBottom: '1px solid #274036' }}>
        LAB TEST · case {Math.min(idx + 1, CASES.length)}/{CASES.length}
        {results.map((r, i) => (
          <div key={i} style={{ color: r.ok ? '#7ee0a3' : '#f87171', fontSize: 12 }}>
            {r.ok ? 'OK ' : 'CRASH '} · {r.label}{r.err ? ` — ${r.err}` : ''}
          </div>
        ))}
      </div>
      {idx < CASES.length && (
        <CaseBoundary key={idx} onErr={(e) => { errRef.current = e; }}>
          {isStress ? (
            <CanvasStress tiny={TINY} />
          ) : (
            <NativeMockupLab
              token="labtest-token"
              mode={model ? 'edit' : 'new'}
              mockup={model}
              item={doc}
              project={{ id: '', projectNumber: model ? model.projectNumber : '', client: model ? model.client : '' }}
              onBack={() => {}}
              onSaved={() => {}}
            />
          )}
        </CaseBoundary>
      )}
      {idx >= CASES.length && <div style={{ padding: 10 }}>DONE — {results.every((r) => r.ok) ? 'ALL PASS' : 'FAILURES ABOVE'}</div>}
    </div>
  );
}

// keep the accidental first constant from tripping lint
void PNG;
