---
title: Hydration
description: Como o cliente assume a página renderizada no servidor
---

import { Aside } from '@astrojs/starlight/components';

Esta página descreve o que a versão atual do Slash faz de fato na hidratação. Ela é mais simples do que "reconectar o DOM existente": o cliente **recria** a interface por cima do HTML do servidor.

## O fluxo

1. O servidor renderiza com `renderToString()` e envia o HTML mais um `<script id="__SLASH_STATE__" type="application/json">`.
2. O navegador mostra o HTML imediatamente, antes de o JavaScript carregar.
3. No cliente, `render(view, container)` percebe que o container **já tem conteúdo** e que existe o script `__SLASH_STATE__`.
4. Nesse caso `render()` lê o JSON do script, **remove o script**, **limpa o container** e renderiza a view do zero no cliente.

Não há uma função `hydrate()` separada: o mesmo `render()` serve para os dois casos.

```typescript
// client.ts
import { html, render } from '@_bashell/slash'
import { App } from './App'

// Há HTML do servidor em #app e o script __SLASH_STATE__ na página:
// o container é limpo e a view é renderizada no cliente
render(html`<${App} />`, '#app')
```

<Aside type="caution">
O DOM do servidor **não é reaproveitado**: os nós são substituídos por nós novos criados no cliente. O ganho da hidratação aqui é mostrar conteúdo antes de o JS carregar e ter SEO; os event handlers só passam a existir depois de `render()` rodar. Sem o script `__SLASH_STATE__`, ou com o container vazio, `render()` apenas renderiza do zero.
</Aside>

## O estado não é restaurado sozinho

`render()` lê o JSON do estado, mas **não o aplica** aos seus `State`. Os states do cliente começam com o valor inicial que você criar. Para o cliente começar com os mesmos dados do servidor, entregue os dados por um caminho que você controla, por exemplo:

- criar os states do cliente com os mesmos valores iniciais (dados fixos ou vindos de uma API);
- ler o JSON antes de chamar `render()` (que remove o script) e passá-lo aos seus states;
- usar o cache de loaders, descrito em [Data Loading](/avancado/data-loading/).

```typescript
import { html, render, createState } from '@_bashell/slash'

// Ler ANTES de render(), que remove o script
const script = document.getElementById('__SLASH_STATE__')
const initial = script ? JSON.parse(script.textContent || '{}') : {}

const count = createState({ value: (initial.s0 as number) ?? 0 })

const Counter = () => html`
  <button onClick=${() => count.set({ value: count.get().value + 1 })}>
    ${count.get().value}
  </button>
`

render(html`<${Counter} />`, '#app')
```

<Aside type="note">
`initial.s0` é o id gerado no servidor para o valor lido (`s0`, `s1`, ...), na ordem em que a renderização o encontrou. Esse mapeamento é um detalhe de implementação e pode mudar; prefira um formato de dados seu quando precisar de estabilidade.
</Aside>

## O que o servidor emite

Os marcadores abaixo estão no HTML do servidor. Eles identificam regiões que dependem de valor lido durante a renderização, mas **o cliente atual não os usa** para reconectar nada: `render()` descarta esse HTML.

```html
<h2>Contador: <!--reactive-start:s0-->42<!--reactive-end:s0--></h2>
<button class="active" data-reactive-class="s1">Click</button>
<script id="__SLASH_STATE__" type="application/json">{"s0":42,"s1":"active"}</script>
```

Reativos com `get()` + `subscribe()` (como o `Router`) também saem entre `<!--reactive-start:id-->` e `<!--reactive-end:id-->`, mas o valor deles não vai para o JSON. Um `State` não é reativo no SSR: interpole `state.get()`.

## Servidor completo

Use `serializeStateForScript` (de `@_bashell/slash/ssr`) para embutir o estado. Ele escapa `<`, `>`, `&`, U+2028 e U+2029, de modo que nenhum valor consegue fechar a tag `<script>`. Nunca use `JSON.stringify` cru dentro de `<script>`.

```typescript
// server.ts
import { htmlString, renderToString, serializeStateForScript } from '@_bashell/slash/ssr'
import { createState } from '@_bashell/slash/core'

const count = createState({ value: 0 })

const App = () => htmlString`
  <div id="app-root">
    <h1>Contador: ${count.get().value}</h1>
    <button>+1</button>
  </div>
`

const { html, state } = renderToString(App)

const page = `<!DOCTYPE html>
<html>
  <body>
    <div id="app">${html}</div>
    <script id="__SLASH_STATE__" type="application/json">${serializeStateForScript(state)}</script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`
```

<Aside type="caution">
No SSR, toda string é escapada, inclusive o resultado de `${state.get()}`; marcação confiável exige `unsafeHtml(...)`. O JSON do estado vai sempre por `serializeStateForScript`. Um `SafeHtml` guardado em estado reativo perde a marca ao ser serializado e volta como texto. Veja [Segurança](/fundamentos/seguranca/) e [SSR](/avancado/ssr/).
</Aside>

## Router na hidratação

Passe o mesmo `initialPath` no servidor e no cliente para que o roteador resolva a rota de forma síncrona na criação. No cliente, sem `initialPath`, ele usa `window.location`.

```typescript
const router = createRouter({ routes, initialPath: location.pathname })
render(html`<${App} />`, '#app')
```

## O que não existe

Os helpers abaixo existem no código-fonte como internos, mas **não são exportados** pelo pacote e não fazem parte da API pública: `setHydrateContext`, `getHydrateContext`, `hHydrate`, `hydrateChild`, `skipReactiveMarkers`, `hydrateReactiveNodes`, `hydrateReactiveAttributes` e `walkAndHydrateReactiveAttributes`. Em particular, `hHydrate` não está ligado ao `render()`.

## Boas práticas

- Renderize no cliente a mesma view que o servidor renderizou, para a troca de HTML não mudar o layout.
- Garanta que o cliente comece com os mesmos dados do servidor, senão o conteúdo muda no momento do `render()`.
- Embuta o estado sempre com `serializeStateForScript`.
- Mantenha o `container` do cliente com o mesmo seletor usado no servidor.

## Próximos passos

- [SSR](/avancado/ssr/) - Renderização no servidor
- [Data Loading](/avancado/data-loading/) - Loaders e cache entre servidor e cliente
