/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    // Assuming Webpack 5 is used by default in newer Next.js versions
    if (!isServer) {
      // Provide fallbacks for node modules used by MongoDB or other packages
      config.resolve.fallback = {
        fs: false,
        path: false,
        // Add other modules that may cause issues in client-side code
        ...config.resolve.fallback,
      };
    }

    // Add node-loader for handling .node files
    config.module.rules.push({
      test: /\.node$/,
      loader: 'node-loader',
      // Optional: Specify include path if you want to limit this rule to specific directories
    });

    return config;
  },
};

module.exports = nextConfig;
