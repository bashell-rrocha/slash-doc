---
title: Server-Side Rendering (SSR)
description: Renderização no servidor com Slash para melhor performance e SEO
---

O Slash oferece suporte completo a **Server-Side Rendering (SSR)**, permitindo renderizar suas aplicações no servidor para melhorar a performance inicial, SEO e experiência do usuário.

## O que é SSR?

SSR (Server-Side Rendering) é o processo de renderizar sua aplicação no servidor, gerando HTML completo que é enviado ao navegador. Isso oferece vários benefícios:

- **Performance**: Conteúdo visível mais rápido (FCP - First Contentful Paint)
- **SEO**: Crawlers veem o conteúdo completo imediatamente
- **Acessibilidade**: Funciona mesmo com JavaScript desabilitado
- **Experiência do Usuário**: Reduz o tempo de carregamento percebido

## `renderToString()`

A função `renderToString()` renderiza seu componente para uma string HTML de forma síncrona.

### Sintaxe

```typescript
function renderToString(view: Child | (() => Child)): {
  html: string;
  state: Record<string, unknown>;
}
```

### Parâmetros

- **view**: Componente ou função que retorna um componente a ser renderizado

### Retorno

Retorna um objeto contendo:
- **html**: String HTML renderizada
- **state**: Objeto com os valores de estado rastreados durante a renderização (para hidratação no cliente). Embuta-o na página com `serializeStateForScript(state)`, nunca com `JSON.stringify` cru dentro de `<script>`

### Exemplo Básico

```typescript
import { renderToString, htmlString } from '@_bashell/slash'

const App = () => htmlString`
  <div class="app">
    <h1>Hello, SSR!</h1>
    <p>Renderizado no servidor</p>
  </div>
`

const { html, state } = renderToString(App)

console.log(html)
// <div class="app">
//   <h1>Hello, SSR!</h1>
//   <p>Renderizado no servidor</p>
// </div>

console.log(state)
// {} (sem estados reativos neste exemplo)
```

### Exemplo com Estado Reativo

```typescript
import { renderToString, htmlString, createState } from '@_bashell/slash'

const Counter = () => {
  const count = createState({ value: 0 })
  const { value } = count.get()

  return htmlString`
    <div>
      <h2>Contador: ${value}</h2>
      <p>Renderizado com valor inicial</p>
    </div>
  `
}

const { html, state } = renderToString(Counter)

console.log(html)
// <div>
//   <h2>Contador: <!--reactive-start:s0-->0<!--reactive-end:s0--></h2>
//   <p>Renderizado com valor inicial</p>
// </div>

console.log(state)
// { s0: 0 }
```

Note os **marcadores de reatividade** (`<!--reactive-start:s0-->` e `<!--reactive-end:s0-->`). Eles delimitam regiões que dependem de valor lido durante a renderização. O cliente atual não os usa para reconectar estados: `render()` descarta o HTML do servidor e renderiza de novo (veja [Hydration](/avancado/hydration)).

## `htmlString` - Template Tag para SSR

O `htmlString` é uma versão especial do template tag `html` otimizada para SSR. Ele renderiza diretamente para strings HTML.

### Diferença entre `html` e `htmlString`

| `html` (Cliente)           | `htmlString` (Servidor)      |
|----------------------------|------------------------------|
| Retorna `Node` (DOM)       | Retorna `string` (HTML)      |
| Usa no navegador           | Usa no servidor              |
| Cria elementos reais       | Cria strings HTML            |

### Uso Correto

```typescript
// ❌ ERRADO: Usar html no servidor
import { html } from '@_bashell/slash'
const App = () => html`<div>Não funciona no servidor</div>`

// ✅ CORRETO: Usar htmlString no servidor
import { htmlString } from '@_bashell/slash'
const App = () => htmlString`<div>Funciona no servidor</div>`
```

### Escapando HTML

O `htmlString` escapa valores de texto interpolados, **desde que o texto não comece com `<`** (nesse caso é tratado como HTML pronto, veja a regra de confiança abaixo). Para dado de usuário que possa começar com `<`, prefixe um espaço antes de interpolar (o helper `text()` do exemplo abaixo faz isso):

```typescript
// Espaço inicial se o texto começar com `<`: o htmlString passa a escapá-lo
const text = (value: string): string => (value.startsWith('<') ? ` ${value}` : value)

const userInput = "João <script>alert()</script>"

const App = () => htmlString`
  <div>
    <p>${text(userInput)}</p>
  </div>
`

const { html } = renderToString(App)
// <div>
//   <p>João &lt;script&gt;alert()&lt;/script&gt;</p>
// </div>
```

:::caution[Regra de confiança: string que começa com `<` é HTML pronto]
No SSR, uma string (filho comum ou retornada por um reativo ou componente) que **começa com `<`** é tratada como HTML já renderizado e emitida **sem escape**. É assim que o resultado de um `htmlString` aninhado entra no pai, mas vale para qualquer string, **inclusive o resultado de `${state.get()}`**:

```typescript
const comment = createState('<img src=x onerror=alert(1)>') // dado de usuário

htmlString`<p>${comment.get()}</p>`
// <p><img src=x onerror=alert(1)></p>   <- NÃO foi escapado
```

Nunca interpole dado de usuário que possa começar com `<` sem escapá-lo antes (a saída de `htmlString` é segura).

Nuance: o que é lido como **primitivo** de `state.get()` (como acima, onde o state guarda uma string) sai cru se começar com `<`. Já uma string lida de uma **propriedade de objeto** (`user.get().bio`) é escapada e recebe marcadores `<!--reactive-start:id-->`, então não vira HTML. Não dependa dessa diferença: continue escapando dado de usuário antes de interpolar.
:::

### Estado no SSR

Um `State` **não é reativo** no SSR: interpolar o próprio state (`${count}`) não gera marcador nem entra no `state` retornado. Pior: o objeto `State` vira o texto `[Object]` no HTML (`<p>[Object]</p>`) e o Slash escreve um aviso no console ("Unexpected object in child position"). Interpole o valor com `count.get()` dentro do componente.

Já os reativos com `get()` + `subscribe()` (como o `Router`) são renderizados entre marcadores `<!--reactive-start:id-->`, como filhos comuns, e o valor deles **não** é gravado em `state`.

### Embutindo o estado na página

Use `serializeStateForScript` (exportado de `@_bashell/slash/ssr`): ele faz `JSON.stringify` e escapa `<`, `>`, `&`, U+2028 e U+2029, para que um valor não consiga fechar a tag `<script>`.

```typescript
import { htmlString, renderToString, serializeStateForScript } from '@_bashell/slash/ssr'

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

### Router no SSR

`Router({ router })` funciona dentro de `htmlString`/`renderToString`. Passe `initialPath` ao `createRouter` para resolver a rota no servidor:

```typescript
import { createRouter, Router } from '@_bashell/slash/router'
import { htmlString, renderToString } from '@_bashell/slash/ssr'

const router = createRouter({
  routes: [{ path: '/', component: () => htmlString`<h1>Home</h1>` }],
  initialPath: '/',
})

const { html } = renderToString(
  () => htmlString`<main>${Router({ router })}</main>`,
)
// <main><!--reactive-start:s0--><h1>Home</h1><!--reactive-end:s0--></main>
```

O HTML da rota é emitido de verdade (não escapado) e não vai para `state`. A regra de confiança acima vale também para os componentes das rotas.

## `renderToStream()`

Para aplicações maiores, `renderToStream()` oferece **streaming SSR**, enviando HTML em chunks incrementais.

### Sintaxe

```typescript
async function* renderToStream(
  view: Child | (() => Child)
): AsyncGenerator<string, void, unknown>
```

### O que o streaming faz (e não faz)

`renderToStream()` renderiza **toda** a árvore para uma string antes de emitir o primeiro chunk e só então a divide em pedaços de 16 KB. Portanto ele **não** reduz o tempo até o primeiro byte nem renderiza progressivamente no servidor; o que ele oferece é enviar a resposta em partes (sem montar uma string final de resposta) e anexar o script de estado no final. Para páginas pequenas, `renderToString()` é mais simples e equivalente.

### Exemplo com Bun

```typescript
import { renderToStream, htmlString } from '@_bashell/slash'

// Só o conteúdo da aplicação é renderizado pelo Slash
const App = () => htmlString`
  <div>
    <h1>Conteúdo grande...</h1>
    ${Array.from({ length: 100 }).map((_, i) =>
      htmlString`<p>Parágrafo ${i}</p>`
    )}
  </div>
`

// O shell do documento é texto comum (não use htmlString com <!DOCTYPE>)
const head = `<!DOCTYPE html>
<html>
  <head>
    <title>Streaming SSR</title>
  </head>
  <body>
    <div id="app">`
// renderToStream emite o script __SLASH_STATE__ logo depois do HTML da app,
// por isso fechamos o #app no `tail`
const tail = `</div>
    <script type="module" src="/client.js"></script>
  </body>
</html>`

// Servidor Bun
Bun.serve({
  port: 3000,
  async fetch(req) {
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(head))
        for await (const chunk of renderToStream(App)) {
          controller.enqueue(encoder.encode(chunk))
        }
        controller.enqueue(encoder.encode(tail))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })
  }
})
```

### Exemplo com Node.js

```typescript
import { renderToStream, htmlString } from '@_bashell/slash'
import { createServer } from 'http'

const App = () => htmlString`
  <div>
    <h1>Streaming SSR com Node.js</h1>
  </div>
`

createServer(async (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })

  for await (const chunk of renderToStream(App)) {
    res.write(chunk)
  }

  res.end()
}).listen(3000)
```

### Estado Serializado no Stream

O `renderToStream()` **automaticamente inclui** um script com o estado serializado no final:

```html
<div>...</div>
<script id="__SLASH_STATE__" type="application/json">
{"s0":42,"s1":"active"}
</script>
```

O conteúdo é gerado com `serializeStateForScript`, então `<`, `>` e `&` já saem escapados.

## Atributos Reativos

Quando um valor lido de um state é usado em atributos, o Slash adiciona marcadores `data-reactive-*` ao HTML do servidor:

```typescript
const isActive = createState({ value: true })

const Button = () => {
  const { value } = isActive.get()
  return htmlString`<button class=${value ? 'active' : ''}>Click</button>`
}

const { html } = renderToString(Button)
// <button class="active" data-reactive-class="s0">Click</button>
```

### Atributos Suportados

| Atributo   | Marcador               | Descrição                |
|------------|------------------------|--------------------------|
| `class`    | `data-reactive-class`  | Classes dinâmicas        |
| `value`    | `data-reactive-value`  | Valor de inputs          |
| `checked`  | `data-reactive-checked`| Checkbox/radio checked   |
| Outros     | `data-reactive-*`      | Atributos customizados   |

## Event Handlers

Event handlers (`onClick`, `onInput`, etc.) são **ignorados** durante SSR, pois só funcionam no cliente:

```typescript
const Button = () => htmlString`
  <button onClick=${() => alert('click')}>
    Click me
  </button>
`

const { html } = renderToString(Button)
// <button>Click me</button>
// (onClick foi removido)
```

Os event handlers só existem depois que o cliente renderiza: `render()` no cliente limpa o container e renderiza de novo, com os handlers (veja [Hydration](/avancado/hydration)).

## Void Elements

O Slash trata corretamente **void elements** (elementos auto-fechados):

```typescript
const Form = () => htmlString`
  <form>
    <input type="text" />
    <br />
    <img src="logo.png" />
  </form>
`

const { html } = renderToString(Form)
// <form>
//   <input type="text">
//   <br>
//   <img src="logo.png">
// </form>
```

Lista de void elements: `area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`

## Componentes Complexos

### Renderizando Listas

```typescript
type Todo = { id: number; text: string; done: boolean }

const todos = createState<Todo[]>({
  value: [
    { id: 1, text: 'Aprender SSR', done: true },
    { id: 2, text: 'Fazer hydration', done: false }
  ]
})

const TodoList = () => {
  const { value: items } = todos.get()

  return htmlString`
    <ul class="todos">
      ${items.map(todo => htmlString`
        <li class=${todo.done ? 'done' : ''}>
          <input type="checkbox" checked=${todo.done} />
          <span>${todo.text}</span>
        </li>
      `)}
    </ul>
  `
}

const { html, state } = renderToString(TodoList)
```

### Componentes Aninhados

```typescript
const Header = ({ title }: { title: string }) => htmlString`
  <header>
    <h1>${title}</h1>
  </header>
`

const Footer = () => htmlString`
  <footer>
    <p>&copy; 2026 My App</p>
  </footer>
`

const Layout = ({ children }: { children: string }) => htmlString`
  <div class="layout">
    <${Header} title="Minha App" />
    <main>${children}</main>
    <${Footer} />
  </div>
`

const Page = () => Layout({
  children: htmlString`<p>Conteúdo da página</p>`
})

const { html } = renderToString(Page)
```

## Classes Dinâmicas

O Slash suporta múltiplos formatos para classes:

### String

```typescript
const className = 'btn btn-primary'
const Button = () => htmlString`<button class=${className}>Click</button>`
```

### Array

```typescript
const classes = ['btn', 'btn-primary', 'active']
const Button = () => htmlString`<button class=${classes}>Click</button>`
// <button class="btn btn-primary active">Click</button>
```

### Objeto

```typescript
const classes = {
  btn: true,
  'btn-primary': true,
  active: false
}
const Button = () => htmlString`<button class=${classes}>Click</button>`
// <button class="btn btn-primary">Click</button>
```

## Style Objects

Estilos inline podem ser objetos:

```typescript
const styles = {
  color: 'red',
  fontSize: '16px',
  backgroundColor: '#f0f0f0'
}

const Box = () => htmlString`<div style=${styles}>Styled box</div>`

const { html } = renderToString(Box)
// <div style="color: red; font-size: 16px; background-color: #f0f0f0">Styled box</div>
```

## Melhorias de Performance

### Batching no Servidor

Embora `batch()` seja mais útil no cliente, você pode usá-lo no servidor para agrupar operações:

```typescript
import { batch, createState, renderToString, htmlString } from '@_bashell/slash'

const data = createState({ count: 0, name: '' })

batch(() => {
  data.set({ count: 10, name: 'John' })
})

const App = () => {
  const { count, name } = data.get()
  return htmlString`<div>${name}: ${count}</div>`
}

const { html } = renderToString(App)
```

### Chunks Otimizados

O `renderToStream()` divide o HTML em chunks de **16KB**, otimizados para a maioria dos cenários:

```typescript
// HTML grande é dividido automaticamente
const largeContent = 'x'.repeat(50000)
const App = () => htmlString`<div>${largeContent}</div>`

for await (const chunk of renderToStream(App)) {
  console.log(`Chunk size: ${chunk.length} bytes`)
  // Chunk size: 16384 bytes
  // Chunk size: 16384 bytes
  // ...
}
```

## Integração com Frameworks

### Bun + Hono

```typescript
import { Hono } from 'hono'
import { renderToString, htmlString, serializeStateForScript } from '@_bashell/slash/ssr'

const app = new Hono()

app.get('/', (c) => {
  const App = () => htmlString`
    <h1>Hello from Hono + Slash SSR!</h1>
  `

  const { html, state } = renderToString(App)

  // O documento é um template literal comum; o app entra em #app
  return c.html(`<!DOCTYPE html>
<html>
  <body>
    <div id="app">${html}</div>
    <script id="__SLASH_STATE__" type="application/json">${serializeStateForScript(state)}</script>
    <script type="module" src="/client.js"></script>
  </body>
</html>`)
})

export default app
```

### Express.js

```typescript
import express from 'express'
import { renderToString, htmlString, serializeStateForScript } from '@_bashell/slash/ssr'

const app = express()

app.get('/', (req, res) => {
  const App = () => htmlString`
    <div>
      <h1>Hello from Express + Slash SSR!</h1>
    </div>
  `

  const { html, state } = renderToString(App)

  res.send(`
    <!DOCTYPE html>
    <html>
      <body>
        ${html}
        <script id="__SLASH_STATE__" type="application/json">${serializeStateForScript(state)}</script>
        <script src="/client.js"></script>
      </body>
    </html>
  `)
})

app.listen(3000)
```

## Checklist SSR

- ✅ Use `htmlString` (não `html`) nos componentes do servidor
- ✅ Use `renderToString()` para SSR síncrono
- ✅ Use `renderToStream()` se quiser enviar a resposta em partes (a renderização em si continua completa antes do primeiro chunk)
- ✅ Monte o documento (`<!DOCTYPE html>`, `<head>`, scripts) com template literal comum, nunca com `htmlString`
- ✅ Serialize o estado com `serializeStateForScript` (nunca `JSON.stringify` cru dentro de `<script>`) e injete no HTML
- ✅ `State` não é reativo no SSR: interpole `state.get()`
- ✅ `Router` funciona no SSR (use `initialPath`)
- ✅ No cliente, `render()` substitui o HTML do servidor por uma renderização nova (veja [Hydration](/avancado/hydration))
- ✅ Event handlers são ignorados no servidor (existem depois que o cliente renderiza)
- ✅ Atributos reativos recebem marcadores `data-reactive-*`
- ✅ Texto interpolado é escapado, **exceto** strings que começam com `<` (tratadas como HTML pronto, inclusive `${state.get()}`): escape dado de usuário antes

## Próximos Passos

- Aprenda sobre [Hydration](/avancado/hydration) para entender o que o cliente faz com o HTML do servidor
- Explore [Universal Data Loading](/avancado/data-loading) para data fetching isomórfico
- Veja exemplos práticos no [template slash-ssr](https://github.com/bashell-rrocha/slash-ssr)
- Para sites cujo conteúdo é conhecido no build, veja [Geração Estática (SSG)](/avancado/ssg)
