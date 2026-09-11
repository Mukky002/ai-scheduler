import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
 /* config options here */
 images: {
  remotePatterns: [
   {
    protocol: 'https',
    hostname: 'img.clerk.com',
   },
  ],
 },
 allowedDevOrigins: ['primate-stable-terribly.ngrok-free.app'],
};

export default nextConfig;
