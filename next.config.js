/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: { '/api/trailers': ['./node_modules/ffmpeg-static/ffmpeg*'] },
  poweredByHeader: false,
  async headers() {
    const security=[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'X-Frame-Options',value:'DENY'},
      {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:"base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'"},
    ];
    if(process.env.NODE_ENV==='production'&&process.env.SITE_URL?.startsWith('https://'))
      security.push({key:'Strict-Transport-Security',value:'max-age=31536000'});
    return [
      {source:'/:path*',headers:security},
      {source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'}]},
    ];
  },
};
module.exports = async () => {
  // A hotspot may assign a different LAN address after reconnecting. Allow
  // this computer's current IPv4 addresses, never arbitrary external origins.
  // Next applies this list only to development assets and HMR endpoints.
  const { networkInterfaces } = await import('node:os');
  const { isIP } = await import('node:net');
  let addresses = [];
  try {
    addresses = Object.values(networkInterfaces())
      .flatMap(entries => entries || [])
      .filter(entry => entry.family === 'IPv4')
      .map(entry => entry.address);
  } catch {
    // Some restricted hosts cannot enumerate interfaces. This must not stop
    // builds or production; a specific dev host can be configured below.
  }
  const explicitAddresses = (process.env.DEV_ALLOWED_ORIGINS || '')
    .split(',').map(value => value.trim()).filter(value => isIP(value) === 4);
  return {
    ...nextConfig,
    allowedDevOrigins: [...new Set(['localhost', '127.0.0.1', ...addresses, ...explicitAddresses])],
  };
};
