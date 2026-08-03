import type { Metadata } from 'next';

/**
 * /admin gets its own manifest so it can be installed as a separate Home Screen
 * app that opens straight here.
 *
 * The reason this matters: iOS only delivers web push to an installed app, and an
 * installed app has no address bar. The root manifest starts at /dashboard, so
 * THP could install the portal but had no way to navigate to /admin inside it,
 * which is the only page that can register him for admin notifications. Two
 * separate installs, two separate start URLs, and he can register.
 */
export const metadata: Metadata = {
  manifest: '/manifest-admin.json',
  title: 'THP Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
