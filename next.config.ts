
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  // Leaflet's MapContainer cannot survive React 18 StrictMode's dev-only double-mount
  // ("Map container is already initialized"). StrictMode only double-invokes in development;
  // production builds are unaffected.
  reactStrictMode: false,
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
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
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
