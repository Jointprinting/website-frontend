// One render error used to blank the whole site: only the mockup lab had a
// boundary, so all 24 other routes were unprotected — including /approve and
// /lookbook, the two a CLIENT gets sent a link to.
//
// The behaviour that matters: a client never sees a stack trace, the owner
// always does, and navigating away clears the error instead of the fallback
// sticking around and making the next page look broken too.

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AppErrorBoundary from './AppErrorBoundary';

const Boom = () => { throw new Error('kaboom in the render'); };
const Fine = () => <div>all good</div>;

// The boundary logs the component stack on catch — expected, so keep it quiet.
let spy;
beforeEach(() => { spy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => spy.mockRestore());

describe('when nothing is wrong', () => {
  it('renders its children untouched', () => {
    render(<AppErrorBoundary pathname="/studio"><Fine /></AppErrorBoundary>);
    expect(screen.getByText('all good')).toBeTruthy();
  });
});

describe('a CLIENT-facing route', () => {
  it.each(['/approve/abc123', '/lookbook/xyz', '/portal/tok', '/preorder/tok'])(
    'shows an apology and contact details, never the error — %s',
    (pathname) => {
      render(<AppErrorBoundary pathname={pathname}><Boom /></AppErrorBoundary>);
      expect(screen.getByText(/didn't load properly/i)).toBeTruthy();
      expect(screen.getByText(/nate@jointprinting\.com/)).toBeTruthy();
      // The thing a client must never be shown.
      expect(screen.queryByText(/kaboom in the render/)).toBeNull();
    },
  );

  it('offers a reload, because the link itself is still good', () => {
    render(<AppErrorBoundary pathname="/approve/abc"><Boom /></AppErrorBoundary>);
    expect(screen.getByRole('button', { name: /reload the page/i })).toBeTruthy();
  });
});

describe('an OWNER route', () => {
  it('shows the actual error, so a report is a diagnosis', () => {
    render(<AppErrorBoundary pathname="/studio"><Boom /></AppErrorBoundary>);
    expect(screen.getByText(/kaboom in the render/)).toBeTruthy();
  });

  it('reassures that nothing was lost — it is a display error', () => {
    render(<AppErrorBoundary pathname="/studio"><Boom /></AppErrorBoundary>);
    expect(screen.getByText(/nothing was saved or lost/i)).toBeTruthy();
  });

  it('treats the marketing site as owner-side, not client-side', () => {
    // /contact isn't a link sent to a client about their order.
    render(<AppErrorBoundary pathname="/contact"><Boom /></AppErrorBoundary>);
    expect(screen.getByText(/kaboom in the render/)).toBeTruthy();
  });
});

describe('recovering', () => {
  it('clears the error when the route changes', () => {
    // Otherwise the fallback is sticky and the NEXT page looks broken too.
    const { rerender } = render(
      <AppErrorBoundary pathname="/studio"><Boom /></AppErrorBoundary>,
    );
    expect(screen.getByText(/kaboom in the render/)).toBeTruthy();
    rerender(<AppErrorBoundary pathname="/contact"><Fine /></AppErrorBoundary>);
    expect(screen.getByText('all good')).toBeTruthy();
  });

  it('stays in the fallback while the route is unchanged', () => {
    const { rerender } = render(
      <AppErrorBoundary pathname="/studio"><Boom /></AppErrorBoundary>,
    );
    rerender(<AppErrorBoundary pathname="/studio"><Fine /></AppErrorBoundary>);
    expect(screen.queryByText('all good')).toBeNull();
  });

  it('the reload button actually reloads', () => {
    const orig = window.location;
    delete window.location;
    window.location = { ...orig, reload: jest.fn() };
    render(<AppErrorBoundary pathname="/approve/abc"><Boom /></AppErrorBoundary>);
    fireEvent.click(screen.getByRole('button', { name: /reload the page/i }));
    expect(window.location.reload).toHaveBeenCalled();
    window.location = orig;
  });
});
