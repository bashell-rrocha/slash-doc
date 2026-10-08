---
title: Segurança
description: O Slash é seguro por padrão. Entenda o que é escapado, o que é bloqueado e como usar unsafeHtml e unsafeUrl com responsabilidade.
---

O Slash é **seguro por padrão**: você escreve templates do jeito normal e a biblioteca faz a coisa segura. Esta página explica as regras para quem está começando. A referência completa fica no repositório do core, em `docs/19-security`.

## A regra de ouro

**Uma string é sempre dado, nunca HTML.** Isso vale no cliente (`html`) e no servidor (`htmlString`, `renderToString`, `renderToStream`). Toda string é escapada, inclusive as devolvidas por componentes, por `state.get()` e por reativos. Não existe exceção para "strings que começam com `<`" e não existe helper para escapar: basta interpolar.

```typescript
import { html } from '@_bashell/slash/core'

const comentario = '<img src=x onerror="alert(1)">'

html`<p>${comentario}</p>` // mostra o texto literal; nada executa
```

No servidor é igual:

```typescript
import { htmlString } from '@_bashell/slash/ssr'

String(htmlString`<p>${'<img src=x onerror=alert(1)>'}</p>`)
// <p>&lt;img src=x onerror=alert(1)&gt;</p>
```

Para marcação confiável existe um tipo próprio, o `SafeHtml`. Você o recebe de dois lugares: de um template `htmlString` (por isso templates aninhados, componentes e listas como `items.map(...)` funcionam sem nenhum wrapper) e de `unsafeHtml(...)`.

:::note[`htmlString` devolve `SafeHtml`, não `string`]
Se você precisa de uma `string`, use `String(valor)` ou `renderToString(() => valor).html`. O `.html` do `renderToString` continua sendo uma `string` comum.
:::

## As duas saídas explícitas

Às vezes você realmente tem marcação ou uma URL confiável. Existem exatamente duas formas de dizer isso:

| Função | Quando usar | Retorna |
| --- | --- | --- |
| `unsafeHtml(html)` | marcação **confiável** que você mesmo gerou (um ícone SVG, um Markdown já renderizado **e sanitizado**) | `SafeHtml` |
| `unsafeUrl(url)` | URL **confiável** com um esquema que a política bloqueia (por exemplo `myapp://abrir/42`) | `SafeUrl` |

```typescript
import { html, unsafeHtml, unsafeUrl } from '@_bashell/slash/core'

html`<button>${unsafeHtml('<svg viewBox="0 0 8 8"><circle cx="4" cy="4" r="3"/></svg>')} Salvar</button>`
html`<a href=${unsafeUrl('myapp://abrir/42')}>Abrir no app</a>`
```

:::caution[Elas NÃO sanitizam]
Os nomes são compridos de propósito: aparecem em revisão de código e um `grep unsafe` encontra todos os usos. Elas significam "eu garanto este valor". **Nunca** passe entrada de usuário por elas, nem "limpa" com regex. Se o conteúdo vem de usuários (comentários, Markdown, CMS), passe por um sanitizador de verdade e só depois embrulhe o resultado.
:::

`isSafeHtml(x)` e `isSafeUrl(x)` identificam esses valores. Eles não podem ser forjados por JSON vindo da rede, então dados de uma API nunca viram `SafeHtml`.

## Montando a página no servidor

A casca da página (`<!DOCTYPE>`, `<head>`, scripts) é um **template literal comum**, não um `htmlString`. O conteúdo do Slash entra como `renderToString(...).html` e o estado entra com `serializeStateForScript`:

```typescript
import { htmlString, renderToString, serializeStateForScript } from '@_bashell/slash/ssr'

const App = () => htmlString`<h1>Olá, SSR!</h1>`

const { html, state } = renderToString(App)

const pagina = `<!DOCTYPE html>
<html>
  <body>
    <div id="app">${html}</div>
    <script id="__SLASH_STATE__" type="application/json">${serializeStateForScript(state)}</script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`
```

Duas coisas importantes:

- **Nunca use `JSON.stringify` dentro de `<script>`.** Um valor como `"</script><img onerror=...>"` fecha a tag e executa código. `serializeStateForScript` (e `serializeLoaderData`) escapam `<`, `>`, `&`, U+2028 e U+2029, e o `JSON.parse` devolve exatamente o valor original.
- **Um template literal comum não escapa nada.** Se você colocar um dado de usuário nele à mão (um `<title>`, por exemplo), escape você mesmo:

```typescript
const escapeHtml = (valor: string) =>
  valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const titulo = `<title>${escapeHtml(post.title)}</title>`
```

### `<script>` e `<style>` com valores dinâmicos

Dentro de um `htmlString`, o texto **estático** de um `<script>` ou `<style>` é mantido como está, mas strings **dinâmicas** são sempre escapadas (com aviso em dev). Para JSON em outro `<script>`:

```typescript
htmlString`<script type="application/ld+json">${unsafeHtml(serializeStateForScript(dados))}</script>`
```

Uma limitação do htm: um `<` literal dentro de um `<script>` estático (`if (a < b)`) é lido como início de tag. Coloque esse código em `unsafeHtml(...)`.

## Política de URLs

Atributos que carregam URL (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `srcset`, entre outros) só aceitam:

- `http:`, `https:`, `mailto:` e `tel:`;
- URLs relativas: `/x`, `./x`, `../x`, `?q`, `#h` e caminhos sem esquema;
- `data:image/png|jpeg|gif|webp|avif`, **somente** em atributos de imagem (`img src`, `srcset`, `poster`).

Todo o resto (`javascript:`, `vbscript:`, `data:text/html`, `data:image/svg+xml`, `blob:`, `file:`...) vira `about:blank#blocked`, com um aviso em dev. Truques com espaços, tabs ou caracteres de controle (`java\tscript:`) também são bloqueados.

```typescript
html`<a href=${'javascript:alert(1)'}>x</a>` // <a href="about:blank#blocked">
html`<img src=${'data:image/png;base64,iVBOR...'} />` // permitido
```

A URL do `content` de `<meta http-equiv="refresh" content="5;url=...">` segue a mesma regra. Para uma URL confiável fora da política, use `unsafeUrl(...)`; ela só vale em atributos de URL (e nesse `content`).

## Links do roteador

O `Link` aceita **somente caminhos do app**: `/x`, `?q` ou `#h`. Qualquer outra coisa nunca navega: o clique recebe `preventDefault`, o `href` vira `about:blank#blocked` e há um aviso em dev. Isso inclui `./x`, `../x`, `about` (caminho relativo sem barra), `//host`, `javascript:` e `https://...`.

Para um link externo de verdade, diga isso com a prop `external`:

```typescript
import { html } from '@_bashell/slash/core'
import { Link } from '@_bashell/slash/router'

html`<${Link} to="https://example.com/docs" external router=${router}>Docs<//>`
// <a href="https://example.com/docs" rel="noopener noreferrer">Docs</a>
```

`external` só libera `http(s)`, `mailto:` e `tel:` e adiciona `rel="noopener noreferrer"`. No SSR o `Link` gera o mesmo `<a href>`.

## Eventos

Toda prop cujo nome começa com `on` (em qualquer caixa) é um evento. Só são anexados: uma **função**, um objeto com `handleEvent` ou uma tupla `[fn, opções]`. Qualquer outro valor (string, booleano, objeto) é descartado com aviso em dev, no cliente e no servidor:

```typescript
html`<button onClick=${() => salvar()}>Salvar</button>` // ok
html`<button onclick="alert(1)">Salvar</button>`        // onclick descartado
```

Se você precisa de um atributo comum que começa com "on" (`online`, `one-time`), use o prefixo `data-`: `data-online`.

## `innerHTML`, `outerHTML` e `srcdoc`

As props `innerHTML`, `outerHTML` e `insertAdjacentHTML` são bloqueadas (no servidor saem apenas como atributo inerte, com o valor escapado). Para inserir marcação confiável, use `unsafeHtml` como **filho**:

```typescript
html`<div>${unsafeHtml(htmlConfiavel)}</div>`
```

`srcdoc` só aceita `SafeHtml`:

```typescript
html`<iframe srcdoc=${unsafeHtml('<p>oi</p>')}></iframe>` // ok
html`<iframe srcdoc=${'<p>oi</p>'}></iframe>`              // atributo removido
```

Nomes de atributo inválidos (com espaço ou `>`, por exemplo) são descartados, e nomes de tag inválidos lançam erro: são erros de programação.

## Estilos (`style`)

`style` aceita string ou objeto, e cada declaração passa por uma política de CSS no cliente e no servidor. Uma declaração insegura é descartada e as demais são mantidas:

```typescript
html`<div style="color:red;background:url(javascript:alert(1))">x</div>`
// <div style="color:red">x</div>
```

Em resumo:

- `url()` segue a mesma lista de permissão de `href`/`src`; `image-set()`, `image()`, `cross-fade()`, `element()`, `paint()`, `src()` e `expression()` são fiscalizadas;
- o valor não pode conter `{`, `}`, `<`, `@import`, `javascript:`, `vbscript:`, `-moz-binding` nem `behavior:`;
- uma barra invertida (`\`) **fora de aspas** descarta a declaração; dentro de aspas os escapes continuam funcionando (`content:"\2022"`);
- um `style` que fica vazio é omitido.

## Dados sem protótipo

`formToObject()` e o `query` do roteador devolvem objetos sem protótipo (`Object.create(null)`). Nomes como `__proto__` ou `constructor` viram chaves comuns e não afetam nada. Em troca, `obj.hasOwnProperty(...)` não existe; use `Object.hasOwn(obj, 'campo')` ou `'campo' in obj`.

## Guards do cliente são UX

Guards do roteador, botões escondidos e rotas "protegidas" no navegador melhoram a experiência, mas qualquer pessoa com o DevTools passa por cima. **O servidor autoriza cada requisição.** No SSR os guards não rodam.

## Diferenças conhecidas entre cliente e SSR

O Slash testa as mesmas entradas nos dois lados e o resultado é igual, com estas exceções:

1. `innerHTML=...`, `outerHTML=...` e `insertAdjacentHTML=...`: o cliente bloqueia a prop; o SSR emite um atributo comum com o valor escapado (inerte).
2. Atributos `data-reactive-*` são reservados e removidos só no SSR (marcadores de hidratação).
3. `style` em objeto: o cliente serializa pelo CSSOM (formatação diferente), com a mesma política de valores.
4. `SafeHtml` e `SafeUrl` guardados em **estado reativo** perdem a marca ao serializar para hidratação e passam a falhar fechado: o HTML vira texto e a URL é sanitizada. Reembrulhe com `unsafeHtml`/`unsafeUrl` no cliente se precisar.

## Avisos de desenvolvimento

Cada bloqueio emite um aviso (uma vez por tipo) com a correção sugerida. Os avisos são removidos do build de produção.

## Checklist rápido

- Interpole strings direto: o Slash escapa.
- Marcação confiável: `unsafeHtml(...)`, e só depois de sanitizar.
- Casca da página: template literal comum, `renderToString(...).html` e `serializeStateForScript(state)`.
- Links externos: `Link` com `external`.
- Handlers: sempre funções (`onClick=${fn}`).
- Autorização: no servidor, sempre.

## Próximos passos

- [Server-Side Rendering](/avancado/ssr/)
- [Roteamento](/roteamento/conceitos/)
- [Migrando para 0.0.3](/referencia/migracao/#migrando-para-003)
- [API Reference](/referencia/api/)
