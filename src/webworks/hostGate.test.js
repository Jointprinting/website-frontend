// Host classification for connected client domains — the gate that decides
// whether a request renders the Joint Printing app or a client's live site.
import { isAppHost } from './hostGate';

describe('isAppHost', () => {
  it('treats our own hosts as the app', () => {
    expect(isAppHost('jointprinting.com')).toBe(true);
    expect(isAppHost('www.jointprinting.com')).toBe(true);
    expect(isAppHost('JOINTPRINTING.com')).toBe(true);      // case-insensitive
    expect(isAppHost('localhost')).toBe(true);
    expect(isAppHost('localhost:3000')).toBe(true);          // dev port stripped
    expect(isAppHost('127.0.0.1')).toBe(true);
    expect(isAppHost('jointprinting-frontend-abc123.vercel.app')).toBe(true); // preview + prod deploys
    expect(isAppHost('')).toBe(true);                        // no hostname → behave as the app
    expect(isAppHost(null)).toBe(true);
  });

  it('treats anything else as a candidate client domain', () => {
    expect(isAppHost('northpineplumbing.com')).toBe(false);
    expect(isAppHost('www.clearwaterpools.net')).toBe(false);
    expect(isAppHost('shop.example.com')).toBe(false);
    // Lookalikes are NOT the app (suffix match is exact on .vercel.app).
    expect(isAppHost('vercel.app.evil.com')).toBe(false);
    expect(isAppHost('jointprinting.com.evil.com')).toBe(false);
  });
});
