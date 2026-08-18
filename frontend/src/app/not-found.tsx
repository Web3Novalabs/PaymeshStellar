import Link from 'next/link';
export default function NotFound(){return <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center"><p className="text-sm font-semibold text-blue-600">404</p><h1 className="mt-2 text-2xl font-bold">Page not found</h1><Link href="/" className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white">Return home</Link></main>;}
