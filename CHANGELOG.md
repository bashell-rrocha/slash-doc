# Changelog

Todas as mudanças relevantes deste projeto são registradas aqui, seguindo [Conventional Commits](https://www.conventionalcommits.org/) e [SemVer](https://semver.org/).

## [Não publicado]

- Tema: `starlight-theme-catppuccin` na API v2 (`dark: 'mocha-mauve'`, `light: 'latte-mauve'`); as opções `flavor` e `accent` eram ignoradas.

## [0.0.6] — 2026-10-15

- Testes no CI em todo PR e verificação de fronteira (`bun run boundary`): falha se aparecer um termo proibido, lido do segredo `BOUNDARY_TERMS`; o log mostra só o arquivo e a linha.

## [0.0.5] — 2026-10-08

- Deploy: o workflow cria o projeto `slash-docs` no Cloudflare Pages na primeira execução.

## [0.0.4] — 2026-10-08

- Deploy automático no Cloudflare Pages pelo GitHub Actions a cada release na `main` (`.github/workflows/deploy.yml`); `bun.lock` próprio para instalação reprodutível.

## [0.0.3] — 2026-10-08

- Documentação alinhada ao `@_bashell/slash` 0.0.3: nova página **Segurança**, `htmlString` devolve `SafeHtml`, `unsafeHtml`/`unsafeUrl`, `sanitizeUrl`, política de URLs/CSS, `Link` com `external`, builds de desenvolvimento e produção.
- Revisão de precisão em todo o site: exemplos que não funcionavam como escritos foram corrigidos (reatividade, SSR, roteamento, formulários, referência da API); afirmações de desempenho sem medição foram removidas.
- Guia "Migrando para 0.0.3".

## [0.0.2] — 2026-10-08

- Domínio `slash.bashell.com.br`, com `sitemap-index.xml` e `robots.txt`.

## [0.0.1] — 2026-10-08

Primeira versão pública do `slash-doc`.
