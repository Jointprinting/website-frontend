// The Studio's address bar. The behaviours that matter to a person: the back
// button closes a full-screen project on a phone, a project survives a refresh,
// and two different owners writing the URL never clobber each other.

import { readStudioUrl, patchStudioUrl, onStudioNavigate, closeStudioOverlay, clearStudioRecord } from './_studioUrl';

const setUrl = (search) => {
  window.history.replaceState({}, '', `/studio${search}`);
};

beforeEach(() => setUrl(''));

describe('readStudioUrl', () => {
  it('reads an empty address bar as empty, not undefined', () => {
    expect(readStudioUrl()).toEqual({ view: '', projectNumber: '', tab: '', companyKey: '' });
  });

  it('reads every key', () => {
    setUrl('?v=clients&p=150&t=approval&c=happyleaf');
    expect(readStudioUrl()).toEqual({
      view: 'clients', projectNumber: '150', tab: 'approval', companyKey: 'happyleaf',
    });
  });

  it('keeps a sibling project number intact', () => {
    setUrl('?p=22-2');
    expect(readStudioUrl().projectNumber).toBe('22-2');
  });
});

describe('patchStudioUrl', () => {
  it('MERGES rather than replaces — the shell owns v, the tracker owns p', () => {
    setUrl('?v=clients');
    patchStudioUrl({ projectNumber: '150' });
    expect(readStudioUrl()).toMatchObject({ view: 'clients', projectNumber: '150' });
    // Now the shell writes its key back; the tracker's must survive.
    patchStudioUrl({ view: 'clients' });
    expect(readStudioUrl().projectNumber).toBe('150');
  });

  it('deletes a key on empty or null', () => {
    setUrl('?v=clients&p=150&t=files');
    patchStudioUrl({ projectNumber: '', tab: null });
    expect(readStudioUrl()).toMatchObject({ view: 'clients', projectNumber: '', tab: '' });
  });

  it('leaves untouched keys alone', () => {
    setUrl('?v=clients&p=150');
    patchStudioUrl({ tab: 'approval' });
    expect(readStudioUrl()).toEqual({
      view: 'clients', projectNumber: '150', tab: 'approval', companyKey: '',
    });
  });

  it('does not stack an identical entry', () => {
    // Otherwise a re-running effect makes the back button need two presses to
    // do one thing.
    setUrl('?v=clients');
    const before = window.history.length;
    patchStudioUrl({ view: 'clients' }, { push: true });
    patchStudioUrl({ view: 'clients' }, { push: true });
    expect(window.history.length).toBe(before);
  });

  it('pushes a real entry when the state actually changes', () => {
    setUrl('');
    const before = window.history.length;
    patchStudioUrl({ view: 'clients' }, { push: true });
    expect(window.history.length).toBeGreaterThan(before);
    expect(readStudioUrl().view).toBe('clients');
  });

  it('drops the "?" entirely when nothing is left', () => {
    setUrl('?v=clients');
    patchStudioUrl({ view: '' });
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/studio');
  });

  it('never changes the path — /studio stays one route', () => {
    setUrl('?v=clients');
    patchStudioUrl({ view: 'finances', projectNumber: '9' });
    expect(window.location.pathname).toBe('/studio');
  });
});

describe('onStudioNavigate', () => {
  it('reports the state the URL now describes on back/forward', () => {
    const seen = [];
    const off = onStudioNavigate((s) => seen.push(s));
    setUrl('?v=clients&p=150');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ view: 'clients', projectNumber: '150' });
    off();
  });

  it('unsubscribes cleanly', () => {
    const seen = [];
    const off = onStudioNavigate((s) => seen.push(s));
    off();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen).toHaveLength(0);
  });

  it('an empty projectNumber is the signal to close the project', () => {
    const seen = [];
    const off = onStudioNavigate((s) => seen.push(s));
    setUrl('?v=clients');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen[0].projectNumber).toBe('');
    off();
  });
});

describe('clearStudioRecord', () => {
  it('drops the record deep-link but keeps the tool', () => {
    // Tapping Orders from the hub must not re-open whatever project happened to
    // be in the URL from an earlier visit.
    setUrl('?v=clients&p=153&t=approval');
    clearStudioRecord();
    expect(readStudioUrl()).toMatchObject({ view: 'clients', projectNumber: '', tab: '' });
  });

  it('is safe when there is nothing to clear', () => {
    setUrl('?v=finances');
    clearStudioRecord();
    expect(readStudioUrl().view).toBe('finances');
  });
});

describe('closeStudioOverlay', () => {
  it('steps BACK when we pushed the entry that opened the project', () => {
    setUrl('?v=clients');
    patchStudioUrl({ projectNumber: '153' }, { push: true, overlay: true });
    expect(window.history.state.overlay).toBe(true);
    const spy = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    closeStudioOverlay({ projectNumber: '', tab: '' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('does NOT step back for a project opened straight from the URL', () => {
    // A shared link or a refresh with ?p= already present pushed no entry, so
    // back would leave the tool entirely — from a project you'd land on the hub
    // instead of the orders board.
    setUrl('?v=clients&p=153');
    window.history.replaceState({ studio: true, overlay: false }, '', window.location.href);
    const spy = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    closeStudioOverlay({ projectNumber: '', tab: '' });
    expect(spy).not.toHaveBeenCalled();
    expect(readStudioUrl()).toMatchObject({ view: 'clients', projectNumber: '' });
    spy.mockRestore();
  });

  it('a plain studio entry is not treated as an overlay', () => {
    // The old check tested "is this a studio entry", which every studio URL
    // write sets — so closing always went back, and always overshot.
    setUrl('?v=clients&p=153');
    window.history.replaceState({ studio: true }, '', window.location.href);
    const spy = jest.spyOn(window.history, 'back').mockImplementation(() => {});
    closeStudioOverlay({ projectNumber: '', tab: '' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('switching panels keeps the overlay marker alive', () => {
    // Panel switches replace the URL; dropping the flag there would stop the X
    // from closing the project properly.
    setUrl('?v=clients');
    patchStudioUrl({ projectNumber: '153' }, { push: true, overlay: true });
    patchStudioUrl({ tab: 'approval' });
    expect(window.history.state.overlay).toBe(true);
  });
});
