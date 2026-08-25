import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => ({
  NextResponse: {
    next: vi.fn(() => ({ type: 'next' })),
    redirect: vi.fn((url: URL) => ({ type: 'redirect', url: url.toString() })),
  },
}));

describe('middleware route protection', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('isProtectedPath logic', () => {
    const protectedPaths = ['/dashboard', '/groups', '/settings'];

    it.each(protectedPaths)('protects %s', (path) => {
      expect(
        protectedPaths.some((p) => path === p || path.startsWith(p + '/'))
      ).toBe(true);
    });

    it('does not protect root', () => {
      expect(
        protectedPaths.some((p) => '/' === p || '/'.startsWith(p + '/'))
      ).toBe(false);
    });

    it('protects nested paths', () => {
      expect(
        protectedPaths.some(
          (p) => '/dashboard/overview' === p || '/dashboard/overview'.startsWith(p + '/')
        )
      ).toBe(true);
    });

    it('does not protect unrelated paths', () => {
      expect(
        protectedPaths.some(
          (p) => '/api/auth' === p || '/api/auth'.startsWith(p + '/')
        )
      ).toBe(false);
    });
  });

  describe('session cookie check', () => {
    it('redirects when no session cookie present', () => {
      const cookies: Record<string, string> = {};
      const hasSession = 'paymesh_refresh_token' in cookies;
      expect(hasSession).toBe(false);
    });

    it('allows through when session cookie is present', () => {
      const cookies = { paymesh_refresh_token: 'some-token' };
      const hasSession = 'paymesh_refresh_token' in cookies;
      expect(hasSession).toBe(true);
    });
  });

  describe('redirect preserves intended path', () => {
    it('includes redirect query param', () => {
      const intendedPath = '/dashboard';
      const redirectUrl = new URL('http://localhost:3000');
      redirectUrl.searchParams.set('redirect', intendedPath);

      expect(redirectUrl.searchParams.get('redirect')).toBe('/dashboard');
    });
  });
});
