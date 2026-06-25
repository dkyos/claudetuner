/** @type {import('next').NextConfig} */
const nextConfig = {
  // node:sqlite is a Node builtin (no native install). Route handlers run on the
  // Node.js runtime by default, which is what we need for synchronous SQLite.
};

export default nextConfig;
