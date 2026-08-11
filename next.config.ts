
import type {NextConfig} from 'next';

const publicBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
if (process.env.NODE_ENV === 'production') {
  if (!publicBackendUrl) {
    throw new Error('NEXT_PUBLIC_BACKEND_URL is required for a production build.');
  }

  const parsedBackendUrl = new URL(publicBackendUrl);
  const forbiddenHost =
    parsedBackendUrl.hostname === 'localhost'
    || parsedBackendUrl.hostname === '127.0.0.1'
    || parsedBackendUrl.hostname.endsWith('.devtunnels.ms');
  if (parsedBackendUrl.protocol !== 'https:' || forbiddenHost) {
    throw new Error(
      'NEXT_PUBLIC_BACKEND_URL must be a production HTTPS endpoint, not localhost or a development tunnel.',
    );
  }
}

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  /* config options here */
  // Leaflet's MapContainer cannot survive React 18 StrictMode's dev-only double-mount
  // ("Map container is already initialized"). StrictMode only double-invokes in development;
  // production builds are unaffected.
  reactStrictMode: false,
  // Next 15 dev blocks its /_next dev assets + HMR when the browser origin isn't the local host —
  // e.g. when the app is opened through a VS Code / dev tunnel. Without this the page shell loads but
  // assets never do, so it spins forever. List the tunnel host (and a wildcard for future tunnels).
  allowedDevOrigins: ['0v191nb2-3006.asse.devtunnels.ms', '*.devtunnels.ms'],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'localhost:3006',
        '0v191nb2-3006.asse.devtunnels.ms',
        '*.devtunnels.ms',
        '*.gatepass.om',
      ],
    },
  },  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
