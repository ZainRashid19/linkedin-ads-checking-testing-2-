/** @type {import('next').NextConfig} */
export default {
  // The saved SQL files are read at runtime, so make sure they ship with the server code.
  outputFileTracingIncludes: { "/": ["./queries/**/*"] },
  serverExternalPackages: ["postgres"],
};
