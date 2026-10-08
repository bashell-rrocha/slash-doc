---
title: Geração Estática (SSG)
description: Sites estáticos com Slash, usando o template slash-ssg - uma página HTML por URL, imagens otimizadas e ilhas interativas
---

O template **slash-ssg** gera, no build, uma página HTML por URL. O resultado vai para `dist/` e funciona em qualquer hospedagem estática. Imagens são otimizadas (AVIF, WebP e JPEG responsivos), o CSS vem de CSS Modules e só as **ilhas** carregam JavaScript no navegador.

## Quando usar SSG, SSR ou SPA

| Cenário | Escolha |
| --- | --- |
| Conteúdo conhecido no build (blog, documentação, site institucional) | **SSG** ([slash-ssg](https://github.com/bashell-rrocha/slash-ssg)) |
| Conteúdo depende de cada requisição (usuário logado, dados em tempo real) | **SSR** ([slash-ssr](https://github.com/bashell-rrocha/slash-ssr), veja [SSR](/avancado/ssr)) |
| Aplicação altamente interativa, sem necessidade de SEO | **SPA** ([slash-spa](https://github.com/bashell-rrocha/slash-spa)) |

## Rotas

As rotas ficam em `src/routes.ts`, uma lista de `Route`:

```typescript
interface Route<P extends Params = Params> {
  path: string;                                      // "/", "/sobre", "/posts/:slug", "/404"
  paths?: () => P[] | Promise<P[]>;                  // obrigatório se path tem ":param"
  head: Head | ((params: P) => Head | Promise<Head>);
  page: (params: P) => string | Promise<string>;     // retorna HTML (htmlString)
}
```

```typescript
import type { Route } from "./lib/types";
import { about } from "./pages/about";
import { notFound } from "./pages/not-found";
import { post } from "./pages/post";
import { posts } from "./data/posts";

export const routes: Route[] = [
  // Rota estática
  { path: "/sobre", head: { title: "Sobre" }, page: about },

  // Rota dinâmica: `paths` lista os parâmetros de cada página gerada
  {
    path: "/posts/:slug",
    paths: () => posts.map((p) => ({ slug: p.slug })),
    head: ({ slug }) => ({ title: posts.find((p) => p.slug === slug)?.title ?? slug }),
    page: ({ slug }) => post({ slug }),
  },

  // Página de erro do host (fora do sitemap)
  { path: "/404", head: { title: "Página não encontrada", noindex: true }, page: notFound },
];
```

Cada rota gera `dist/<path>/index.html` (a rota `/` gera `dist/index.html`) e `/404` gera `dist/404.html`. Uma rota dinâmica sem `paths()` e duas rotas que resultam na mesma URL são erros de build. Valores de parâmetros aceitam apenas letras minúsculas, números e hífen.

As páginas são funções que retornam HTML. Use o `view` de `src/lib/renderer.ts` (`htmlString` no build, `html` no navegador):

```typescript
import { layout } from "../components/layout";
import { view } from "../lib/renderer";

export function about(): string {
  return layout(view`<h1>Sobre</h1><p>Site gerado com Slash.</p>`);
}
```

## Head

O campo `head` de cada rota (objeto ou função dos parâmetros) segue o tipo `Head`:

```typescript
interface Head {
  title: string;
  description?: string;
  image?: string;      // og:image: caminho em src/assets/images/, caminho em public/ ("/og.png") ou URL absoluta
  imageAlt?: string;   // og:image:alt e twitter:image:alt
  canonical?: string;  // default: site.baseUrl + url
  noindex?: boolean;   // default: false; true também remove do sitemap
  jsonLd?: object | object[];
  extra?: string;      // HTML adicional no <head> (escape é do autor)
}
```

O que vai para o `<head>`:

- **title**: recebe o sufixo ` | site.name`.
- **canonical** e `og:url`: calculados a partir de `site.baseUrl` e da URL da página. Páginas `noindex` ficam sem os dois.
- **Open Graph**: quando `image` é uma imagem raster local de `src/assets/images/`, o build gera um JPEG de até 1200px e emite `og:image`, `og:image:width`, `og:image:height` (dimensões reais do arquivo gerado) e `og:image:type` (`image/jpeg`). Com `imageAlt`, emite também `og:image:alt` e `twitter:image:alt`. Imagens de `public/`, URLs absolutas, SVG e GIF só ganham `og:image`.
- **noindex**: marca a página como não indexável e a remove do `sitemap.xml`.
- **jsonLd**: um objeto ou array de objetos, emitido como dados estruturados JSON-LD.

`site.defaultHead` (em `src/site.ts`) define `description` e `image` padrão.

## Ilhas

Páginas são HTML puro. Só o que usa `island()` carrega JavaScript:

```typescript
import { island } from "../lib/island";
import { Counter } from "../islands/counter";

${island("counter", Counter, { start: 3 })}
```

A assinatura é `island(name, Component, props)`. No build, a ilha renderiza o HTML inicial dentro de um `<div data-island data-props>`. As props precisam ser serializáveis em JSON (objetos planos, arrays e primitivos); funções, `undefined`, referências circulares e similares falham o build com o caminho da chave.

Registre o componente em `src/client.ts`:

```typescript
import { Counter } from "./islands/counter";
import { Gallery } from "./islands/gallery";
import { mountIslands } from "./lib/islands-client";

mountIslands({ counter: Counter, gallery: Gallery });
```

### Montagem do zero

No navegador a ilha **não é hidratada**: `mountIslands` limpa o HTML do servidor e renderiza o componente do zero com `render` do `@_bashell/slash/core`. O bundle do client não inclui o renderer de string (`__SERVER__` é `true` só no bundle de prerender). Se uma ilha falhar, o HTML do servidor é restaurado, o erro vai para o console e as demais ilhas continuam.

### Ilhas com estado: `reactiveView`

Crie o estado com `createState` no corpo do componente e coloque a view dentro de `reactiveView`:

```typescript
import { createState } from "@_bashell/slash/core";
import { reactiveView, view } from "../lib/renderer";

export function Counter(props: { start: number }) {
  const count = createState(props.start);
  return reactiveView(
    () =>
      view`<button type="button" onClick=${() => count.set(count.get() + 1)}>Contador: ${count.get()}</button>`,
  );
}
```

Sem o wrapper, o slash reexecuta o corpo do componente a cada mudança de estado e o estado volta ao valor inicial. No build, `reactiveView` apenas chama a função uma vez.

## Imagens

Coloque os arquivos em `src/assets/images/` (jpg, png, webp, avif, svg, gif). Use `image()` para obter um descritor e `Picture()` para renderizá-lo:

```typescript
import { image, Picture } from "../lib/image";

const hero = image("hero.jpg", { alt: "Paisagem" });

Picture(hero, { priority: true, sizes: "100vw" });
```

- `image(path, { alt })` só roda durante o build e devolve um `ImageDescriptor`. Um `path` inexistente ou um `alt` inválido falham o build.
- `Picture(descritor, { sizes, priority, class })` gera `<picture>` com fontes AVIF e WebP e o `<img>` com fallback JPEG/PNG, com `width`, `height`, `srcset` e `decoding="async"`. `sizes` é a dica de largura (padrão `100vw`).
- `priority: true` usa `loading="eager"` e `fetchpriority="high"` (imagem de LCP); sem ele, `loading="lazy"`.
- As variantes ficam em `dist/_img/` e o cache em `.slash-cache/`, então rebuilds não reprocessam imagens inalteradas. SVG e GIF passam sem conversão.
- Larguras e qualidade ficam em `site.images` (`widths`, `quality.avif/webp/jpeg`).

### Descritores em ilhas

O descritor é serializável, então pode ser passado como prop de uma ilha e renderizado lá com `Picture(descritor, { sizes })`:

```typescript
// página (build)
const images = [image("gallery/one.png", { alt: "Primeira" }), image("gallery/two.png", { alt: "Segunda" })];
${island("gallery", Gallery, { images })}

// ilha
import { createState } from "@_bashell/slash/core";
import { Picture } from "../lib/image";
import type { ImageDescriptor } from "../lib/image-core";
import { reactiveView, view } from "../lib/renderer";

export function Gallery(props: { images: ImageDescriptor[] }) {
  const index = createState(0);
  return reactiveView(
    () => view`<div>${Picture(props.images[index.get()] as ImageDescriptor, { sizes: "12rem" })}</div>`,
  );
}
```

## site.ts

```typescript
export const site: SiteConfig = {
  name: "Slash SSG",
  baseUrl: "https://example.com", // canonical, og:url, sitemap.xml e robots.txt
  lang: "pt-BR",                  // <html lang>
  defaultHead: { description: "..." },
  images: { widths: [480, 960, 1440, 1920], quality: { avif: 50, webp: 75, jpeg: 80 } },
};
```

A casca `public/index.html` precisa conter os marcadores `<!--slash:head-->` e `<!--slash:app-->`.

## Fluxo do build

`bun run build` executa, em ordem:

1. Bundle do navegador (`src/client.ts`), com nomes com hash e JS minificado.
2. Bundle de prerender (`src/lib/prerender.ts`) com `target: "bun"`, que também gera o CSS do site.
3. Processamento das imagens (com cache em `.slash-cache/`).
4. Prerender em memória de todas as rotas, incluindo as imagens `og:image` pedidas por `head.image`.
5. Escrita das páginas e cópia de `public/` (exceto a casca `index.html`).
6. Geração de `sitemap.xml` (páginas `noindex` ficam de fora) e de `robots.txt` a partir de `baseUrl`, a menos que exista `public/robots.txt`.

Tudo é escrito em um diretório de staging (`dist.tmp-<pid>`) e só no fim trocado por `dist/`. Se o build falhar, o `dist/` anterior continua intacto. A troca são dois renames seguidos, então por um instante `dist/` não existe; o servidor do `dev` espera até 500 ms por ele antes de responder 404. Restos de builds interrompidos são removidos no início do build seguinte. Sem rota `/404`, o build avisa e o host usa a página de erro padrão.

## Dev server

```bash
bun run dev
```

Faz um build em modo dev e sobe um servidor com **live reload** (via `/__reload`, SSE), observando `src/` e `public/`. Cada rebuild roda em um subprocesso. Se o build falhar, o navegador mostra uma página com a mensagem de erro e recarrega sozinho quando o erro for corrigido.

A porta padrão é 4000; mude com `PORT=4100 bun run dev` (vale também para `preview` e `test:e2e`). `bun run preview` serve o `dist/` já gerado.

## Deploy

- Comando de build: `bun run build`
- Diretório de saída: `dist`
- `public/_headers` (Cloudflare Pages e Netlify) dá cache imutável de um ano a `/_img/*`, `/client-*.js` e `/styles-*.css`, que têm hash no nome.

## Criar um projeto derivado

1. Copie a pasta do template sem `.git/`, `docs/`, `node_modules/`, `dist/` e `.slash-cache/`.
2. No `package.json`, troque `@_bashell/slash` de `workspace:*` para a versão do npm: `"@_bashell/slash": "^0.0.1"`.
3. Remova o alias `paths` (que aponta para `../slash/src`) do `tsconfig.json`.
4. Ajuste `src/site.ts` e `src/routes.ts` e rode `bun install && bun run dev`.
5. Para os testes E2E, instale o navegador do Playwright uma vez: `bunx playwright install chromium`.

## Próximos Passos

- Compare com [Server-Side Rendering](/avancado/ssr) para conteúdo gerado por requisição
- Veja [Hydration](/avancado/hydration) para o modelo de hidratação do SSR
- Explore o [template slash-ssg](https://github.com/bashell-rrocha/slash-ssg)
