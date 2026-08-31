import { webcrypto } from 'node:crypto';

/** Node 18 does not expose Web Crypto on globalThis; @noble/ed25519 needs getRandomValues. */
if (typeof globalThis.crypto?.getRandomValues !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
    writable: true,
  });
}
