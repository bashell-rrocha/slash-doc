# Slash Documentation

Site de documentação oficial do Slash, construído com [Astro Starlight](https://starlight.astro.build/) e tema [Catppuccin Mocha](https://github.com/catppuccin/catppuccin).

## 🚀 Como usar

### Desenvolvimento

```bash
bun run dev
```

Acesse: http://localhost:4321

### Build para produção

```bash
bun run build
```

### Preview do build

```bash
bun run preview
```

## 📁 Estrutura

```
src/content/docs/
├── index.mdx                    # Página inicial
├── intro/
│   ├── conceitos-core.md        # ✅ Introdução e conceitos
│   └── instalacao.md            # ✅ Instalação e setup
├── fundamentos/
│   ├── renderizacao.md          # ✅ Renderização básica
│   ├── estado.md                # ✅ Sistema de estado
│   ├── batch.md                 # ✅ Batch updates
│   └── componentes.md           # 🚧 Em desenvolvimento
├── avancado/
│   ├── router.md                # 🚧 Em desenvolvimento
│   ├── forms.md                 # 🚧 Em desenvolvimento
│   ├── error-handling.md        # 🚧 Em desenvolvimento
│   ├── ssr.md                   # 🚧 Em desenvolvimento
│   ├── ssg.md                   # ✅ Geração estática (SSG)
│   ├── data-loading.md          # 🚧 Em desenvolvimento
│   └── hydration.md             # 🚧 Em desenvolvimento
├── guias/
│   ├── dev-experience.md        # 🚧 Em desenvolvimento
│   ├── performance.md           # 🚧 Em desenvolvimento
│   └── exemplos.md              # 🚧 Em desenvolvimento
└── referencia/
    ├── api.md                   # 🚧 Em desenvolvimento
    ├── comparacoes.md           # 🚧 Em desenvolvimento
    └── migracao.md              # 🚧 Em desenvolvimento
```

## 🎨 Tema Catppuccin

O site usa o tema Catppuccin Mocha com accent color Mauve, configurado em astro.config.mjs.

### Personalizar cores

Edite astro.config.mjs:

```javascript
starlightThemeCatppuccin({
  flavor: 'mocha',    // mocha | macchiato | frappe | latte
  accent: 'mauve'     // rosewater | flamingo | pink | mauve | red | maroon
                      // peach | yellow | green | teal | sky | sapphire | blue | lavender
})
```

## 📝 Adicionar conteúdo

1. Crie um arquivo .md ou .mdx em src/content/docs/
2. Adicione frontmatter:

```markdown
---
title: Título da Página
description: Descrição breve
---

Conteúdo aqui...
```

3. A página aparecerá automaticamente na navegação conforme configurado em astro.config.mjs

## 🔗 Links úteis

- [Documentação do Astro](https://docs.astro.build)
- [Documentação do Starlight](https://starlight.astro.build)
- [Tema Catppuccin](https://github.com/catppuccin/catppuccin)
