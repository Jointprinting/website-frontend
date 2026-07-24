// The Studio's address bar. The behaviours that matter to a person: the back
// button closes a full-screen project on a phone, a project survives a refresh,
// and two different owners writing the URL never clobber each other.

import { readStudioUrl, patchStudioUrl, onStudioNavigate } from './_studioUrl';

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
