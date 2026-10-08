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

Dentro de `html` e `htmlString`, o texto **estático** de um `<script>` ou `<style>` é mantido como está, mas valores **dinâmicos** (strings, números, arrays, componentes, templates aninhados e reativos) são **descartados**, no cliente e no servidor, com aviso em dev. Só passam o texto estático e `unsafeHtml(...)`. Para JSON em outro `<script>`:

```typescript
htmlString`<script type="application/ld+json">${unsafeHtml(serializeStateForScript(dados))}</script>`
```

No cliente, `unsafeHtml` precisa ser filho **direto** do `<script>`/`<style>`; vindo de um componente, de um array ou de uma função, ele também é descartado. As props `text`, `textContent` e `innerText` desses elementos também exigem `unsafeHtml`. Chamadas diretas a `h()`/`hString()` (uso avançado) tratam uma string como texto estático confiável, então nunca passe entrada de usuário a elas.

Uma limitação do htm: um `<` literal dentro de um `<script>` estático (`if (a < b)`) é lido como início de tag. Coloque esse código em `unsafeHtml(...)`.

## Política de URLs

Atributos que carregam URL (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `srcset`, entre outros) só aceitam:

- `http:`, `https:`, `mailto:`, `tel:` e `sms:`;
- URLs relativas: `/x`, `./x`, `../x`, `?q`, `#h` e caminhos sem esquema;
- `data:image/png|jpeg|gif|webp|avif`, **somente** em atributos de imagem (`img src`, `srcset`, `poster`);
- `blob:`, **somente** em `src` de mídia (`img`, `audio`, `video`, `source`, `track`);
- `data:image/svg+xml`, **somente** em `img src`, `img srcset` e em `url()` de CSS (como imagem, o SVG não executa scripts).

Todo o resto (`javascript:`, `vbscript:`, `data:text/html`, `file:`, `ftp:`, `whatsapp:`...) vira `about:blank#blocked`, com um aviso em dev. `blob:` e `data:image/svg+xml` em `href`, `iframe`, `object` ou `embed` também são bloqueados. Para um esquema que a lista não cobre, use `unsafeUrl(...)`. Truques com espaços, tabs ou caracteres de controle (`java\tscript:`) também são bloqueados. Um `srcset` ou `content` de `meta refresh` com mais de 16 KB é bloqueado por inteiro.

```typescript
html`<a href=${'javascript:alert(1)'}>x</a>` // <a href="about:blank#blocked">
html`<img src=${'data:image/png;base64,iVBOR...'} />` // permitido
html`<img src=${URL.createObjectURL(arquivo)} />` // blob: permitido em mídia
```

A URL do `content` de `<meta http-equiv="refresh" content="5;url=...">` segue a mesma regra. Para uma URL confiável fora da política, use `unsafeUrl(...)`; ela só vale em atributos de URL (e nesse `content`).

:::caution[A política é de esquema, não de origem]
`https://atacante.com/x.js` passa, porque `https:` é permitido. Se o valor de `<base href>`, `<script src>`, `<iframe src>` ou `<link href>` vem de entrada de usuário, restringir a origem é responsabilidade do app (compare `new URL(valor).origin` com uma lista sua).
:::

### Validando entrada com `sanitizeUrl`

`sanitizeUrl` e `BLOCKED_URL` expõem a mesma política para URLs que não passam por um atributo do Slash (um redirect no servidor, por exemplo). **`sanitizeUrl` valida o esquema, não o destino:** `//evil.com` e `https://evil.com` passam. Num redirect, confira também a origem:

```typescript
import { sanitizeUrl, BLOCKED_URL } from '@_bashell/slash/core'

const base = new URL('https://app.example.com')

function destinoSeguro(next: string): string {
  if (sanitizeUrl('href', next) === BLOCKED_URL) return '/'
  try {
    const url = new URL(next, base)
    return url.origin === base.origin ? url.pathname + url.search + url.hash : '/'
  } catch {
    return '/'
  }
}

res.redirect(destinoSeguro(req.query.next ?? '/'))
```

## Links do roteador

O `Link` aceita **somente caminhos do app**: `/x`, `?q` ou `#h`. Qualquer outra coisa nunca navega: o clique recebe `preventDefault`, o `href` vira `about:blank#blocked` e há um aviso em dev. Isso inclui `./x`, `../x`, `about` (caminho relativo sem barra), `//host`, `javascript:` e `https://...`.

Para um link externo de verdade, diga isso com a prop `external`:

```typescript
import { html } from '@_bashell/slash/core'
import { Link } from '@_bashell/slash/router'

html`<${Link} to="https://example.com/docs" external router=${router}>Docs<//>`
// <a href="https://example.com/docs" rel="noopener noreferrer">Docs</a>
```

`external` só libera `http(s)`, `mailto:`, `tel:` e `sms:` e adiciona `rel="noopener noreferrer"`. No SSR o `Link` gera o mesmo `<a href>`. `?q` e `#h` são relativos à página atual.

O roteador só intercepta cliques em links `http(s)` da **mesma origem** (respeitando `<base>`). Com ctrl, meta, shift ou alt, botão que não seja o esquerdo, `target` diferente de `_self` ou `download`, o navegador age normalmente. Barras invertidas em `router.push()` viram o caminho da mesma origem (`'/\\evil'` vai para `/evil`). Se o navegador recusar a navegação, a promise rejeita com `Navigation failed: ...` e o estado do roteador continua igual à URL.

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

Nomes de atributo inválidos (com espaço ou `>`, por exemplo) são descartados, e nomes de tag inválidos lançam erro: são erros de programação. A gramática de nome de atributo é a mesma no cliente e no servidor e só aceita ASCII (`@click` e `[x]` são descartados). Uma prop com nome de método do DOM (`click`, `focus`...) vira atributo e nunca sobrescreve o método; `constructor` e props de protótipo são bloqueadas.

## Estilos (`style`)

`style` aceita string ou objeto, e cada declaração passa por uma política de CSS estrita no cliente e no servidor. Uma declaração insegura é descartada (com aviso em dev) e as demais são mantidas:

```typescript
html`<div style="color:red;background:url(javascript:alert(1))">x</div>`
// <div style="color:red">x</div>
```

Uma declaração é descartada quando:

- contém `/*` em qualquer lugar: comentários não são permitidos em `style` inline;
- tem uma barra invertida (`\`) **fora de aspas**; dentro de aspas os escapes continuam funcionando (`content:"\2022"`);
- tem uma string com quebra de linha crua, CR, FF ou NUL, com barra invertida seguida de quebra de linha, ou sem fechamento;
- tem um `url(` **sem aspas** com caracteres fora de `[A-Za-z0-9-._~:/?#@!$&+,;=%]`; qualquer outro caractere exige aspas (`url("a b.png")` passa, `url(a b.png)` não);
- usa `-moz-binding`, `behavior` ou `behaviour` como propriedade (`scroll-behavior` é permitido).

Além disso:

- `url()`, com ou sem aspas, segue a mesma lista de permissão de `href`/`src`; `image-set()`, `image()`, `cross-fade()`, `element()`, `paint()`, `src()` e `expression()` são fiscalizadas;
- o valor não pode conter `{`, `}`, `<`, `@import`, `javascript:` nem `vbscript:`;
- quebras de linha **entre** declarações são válidas, então um template literal em várias linhas funciona;
- um `style` com mais de **8 KB** é descartado por inteiro, e um `style` que fica vazio é omitido.

## Dados sem protótipo

`formToObject()` e o `query` do roteador devolvem objetos sem protótipo (`Object.create(null)`). Nomes como `__proto__` ou `constructor` viram chaves comuns e não afetam nada. Em troca, `obj.hasOwnProperty(...)` não existe; use `Object.hasOwn(obj, 'campo')` ou `'campo' in obj`. O clone interno do estado lança `State is circular or nested deeper than 1000 levels` para estado circular ou muito profundo.

## Guards do cliente são UX

Guards do roteador, botões escondidos e rotas "protegidas" no navegador melhoram a experiência, mas qualquer pessoa com o DevTools passa por cima. **O servidor autoriza cada requisição.** No SSR os guards não rodam.

## Diferenças conhecidas entre cliente e SSR

O Slash testa as mesmas entradas nos dois lados e o resultado é igual, com estas exceções:

1. `innerHTML=...`, `outerHTML=...` e `insertAdjacentHTML=...`: o cliente bloqueia a prop; o SSR emite um atributo comum com o valor escapado (inerte).
2. Atributos `data-reactive-*` são reservados e removidos só no SSR (marcadores de hidratação).
3. `style` em objeto: o cliente serializa pelo CSSOM (formatação diferente), com a mesma política de valores.
4. Em `<script>`/`<style>`, o cliente é mais estrito: `unsafeHtml` que chega por componente, array ou função é descartado no cliente.
5. `SafeHtml` e `SafeUrl` guardados em **estado reativo** perdem a marca ao serializar para hidratação e passam a falhar fechado: o HTML vira texto e a URL é sanitizada. Reembrulhe com `unsafeHtml`/`unsafeUrl` no cliente se precisar.

## Avisos de desenvolvimento

Cada bloqueio emite um aviso (uma vez por tipo) com a correção sugerida, sempre em inglês. O pacote tem dois builds: Vite em dev e webpack em `mode: "development"` escolhem sozinhos o build **com** avisos; o build de produção não os traz, mas mantém `console.error` para erros reais. Para forçar os avisos fora de um bundler, rode com `--conditions=development` (`node --conditions=development app.mjs`).

## Checklist rápido

- Interpole strings direto: o Slash escapa.
- Marcação confiável: `unsafeHtml(...)`, e só depois de sanitizar.
- Script de estado: sempre `<script id="__SLASH_STATE__" type="application/json">`.
- Casca da página: template literal comum, `renderToString(...).html` e `serializeStateForScript(state)`.
- Links externos: `Link` com `external`.
- Entrada de usuário em URL: `sanitizeUrl`, e restrinja a origem você mesmo.
- Handlers: sempre funções (`onClick=${fn}`).
- Autorização: no servidor, sempre.

## Próximos passos

- [Server-Side Rendering](/avancado/ssr/)
- [Roteamento](/roteamento/conceitos/)
- [Migrando para 0.0.3](/referencia/migracao/#migrando-para-003)
- [API Reference](/referencia/api/)
