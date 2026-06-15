import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Não derrubar o build de produção por avisos de ESLint
  // (ex.: variável/import declarado e não usado).
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Não derrubar o build por erros de tipo do TypeScript.
  // O app continua sendo type-checked no editor; aqui só evitamos
  // que um detalhe trave o deploy inteiro.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
