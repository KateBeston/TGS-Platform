/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Server actions cap request bodies at 1 MB by default, which is
      // fine for a form and wrong for a file upload — the storage buckets
      // accept 20 to 25 MB, so without this a scanned agreement would be
      // rejected by the framework before it reached Supabase, with an
      // error that does not explain itself.
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
