---
title: Hydration
description: Reconectando estado reativo no cliente após SSR
---

**Hydration** é o processo de "reanimar" o HTML estático renderizado no servidor, reconectando os estados reativos e event handlers no navegador.

## O que é Hydration?

Quando você usa [SSR](/avancado/ssr), o servidor envia HTML completo para o navegador. Mas esse HTML é "estático" - não tem reatividade nem event handlers funcionando. A hidratação resolve isso:

1. O navegador recebe HTML do servidor
2. O HTML é exibido imediatamente (rápido!)
3. JavaScript carrega e "hidrata" o DOM existente
4. Estados reativos são reconectados
5. Event handlers começam a funcionar
6. A aplicação fica totalmente interativa

### Benefícios da Hydration

- ✅ **Performance**: Conteúdo visível antes do JS carregar
- ✅ **SEO**: Crawlers veem HTML completo
- ✅ **UX Progressiva**: Funciona mesmo com JS desabilitado (conteúdo básico)
- ✅ **Eficiência**: Reutiliza DOM existente (não recria tudo)

## Como Funciona no Slash

O Slash usa **marcadores especiais** no HTML para identificar partes reativas:

### 1. Marcadores de Texto Reativo

```html
<!-- HTML renderizado no servidor -->
<div>
  Contador: <!--reactive-start:s0-->42<!--reactive-end:s0-->
</div>
```

Os comentários `<!--reactive-start:s0-->` e `<!--reactive-end:s0-->` marcam onde o estado reativo `s0` está sendo usado.

### 2. Marcadores de Atributos Reativos

```html
<!-- HTML renderizado no servidor -->
<button class="active" data-reactive-class="s0">Click</button>
<input value="John" data-reactive-value="s1" />
<input type="checkbox" checked data-reactive-checked="s2" />
```

Os atributos `data-reactive-*` indicam que esses atributos devem ser reconectados aos estados reativos.

### 3. Estado Serializado

O servidor injeta o estado inicial no HTML:

```html
<script id="__SLASH_STATE__" type="application/json">
{"s0":42,"s1":"John","s2":true}
</script>
```

## Funções de Hydration

### `hydrateReactiveAttributes()`

Hidrata atributos reativos de um elemento específico.

```typescript
import { hydrateReactiveAttributes, createState } from '@_bashell/slash'

// Recuperar estados serializados
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

// Recriar states a partir dos dados
const reactives = new Map()
reactives.set('s0', createState({ value: stateData.s0 }))

// Hidratar elemento
const button = document.querySelector('button')
hydrateReactiveAttributes(button, reactives)
```

### `hydrateReactiveNodes()`

Hidrata nós de texto reativos (marcados com comentários):

```typescript
import { hydrateReactiveNodes, createState } from '@_bashell/slash'

// Recuperar estados
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

const reactives = new Map()
reactives.set('s0', createState({ value: stateData.s0 }))

// Hidratar todos os nós de texto reativos no container
const container = document.getElementById('app')
hydrateReactiveNodes(container, reactives)
```

### `walkAndHydrateReactiveAttributes()`

Percorre recursivamente a árvore DOM e hidrata todos os atributos reativos:

```typescript
import { walkAndHydrateReactiveAttributes, createState } from '@_bashell/slash'

const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

const reactives = new Map()
reactives.set('s0', createState({ value: stateData.s0 }))

const root = document.getElementById('app')
walkAndHydrateReactiveAttributes(root, reactives)
```

## Exemplo Completo de Hydration

### Servidor (SSR)

```typescript
// server.ts
import { renderToString, htmlString, createState } from '@_bashell/slash'

const Counter = () => {
  const count = createState({ value: 0 })
  const { value } = count.get()

  return htmlString`
    <div id="app">
      <h1>Contador: ${value}</h1>
      <button class="increment">+1</button>
    </div>
  `
}

const { html, state } = renderToString(Counter)

const fullHtml = `
<!DOCTYPE html>
<html>
  <head>
    <title>SSR + Hydration</title>
  </head>
  <body>
    ${html}
    <script id="__SLASH_STATE__" type="application/json">
      ${JSON.stringify(state)}
    </script>
    <script src="/client.js" type="module"></script>
  </body>
</html>
`

// Enviar fullHtml para o navegador
```

### Cliente (Hydration)

```typescript
// client.ts
import {
  createState,
  hydrateReactiveNodes,
  walkAndHydrateReactiveAttributes
} from '@_bashell/slash'

// 1. Recuperar estado serializado
const stateScript = document.getElementById('__SLASH_STATE__')
const stateData = JSON.parse(stateScript?.textContent || '{}')

// 2. Recriar estados reativos
const count = createState({ value: stateData.s0 || 0 })

// 3. Mapear IDs para states
const reactives = new Map()
reactives.set('s0', count)

// 4. Hidratar nós de texto reativos
const app = document.getElementById('app')
if (app) {
  hydrateReactiveNodes(app, reactives)
  walkAndHydrateReactiveAttributes(app, reactives)
}

// 5. Adicionar event handlers (não são serializados no SSR)
const button = document.querySelector('.increment')
button?.addEventListener('click', () => {
  count.set({ value: count.get().value + 1 })
})
```

## Context de Hydration

Para casos mais avançados, você pode usar o **contexto de hidratação**:

### `setHydrateContext()`

Define o contexto de hidratação para reutilizar DOM existente:

```typescript
import { setHydrateContext, render, html } from '@_bashell/slash'

// Definir contexto apontando para o DOM existente
const root = document.getElementById('app')
setHydrateContext({
  cursor: root?.firstChild || null
})

// Renderizar (vai reutilizar DOM existente)
const App = () => html`
  <div>
    <h1>Hidratado!</h1>
  </div>
`

render(App, root)

// Limpar contexto
setHydrateContext(null)
```

### `getHydrateContext()`

Obtém o contexto de hidratação atual:

```typescript
import { getHydrateContext } from '@_bashell/slash'

const context = getHydrateContext()

if (context) {
  console.log('Estamos em modo de hidratação')
  console.log('Cursor atual:', context.cursor)
}
```

## Hydration com `hHydrate()`

A função `hHydrate()` é uma versão especial do `h()` que reutiliza DOM existente:

```typescript
import { hHydrate, setHydrateContext } from '@_bashell/slash'

// Configurar contexto
const root = document.getElementById('app')
setHydrateContext({ cursor: root?.firstChild || null })

// Hidratar elementos
const element = hHydrate('div', { class: 'container' },
  hHydrate('h1', null, 'Título'),
  hHydrate('p', null, 'Parágrafo')
)

// Limpar contexto
setHydrateContext(null)
```

## Hydration Automática com `render()`

Você pode simplificar o processo usando `render()` com hydration automática:

### Servidor

```typescript
import { renderToString, htmlString } from '@_bashell/slash'

const App = () => htmlString`
  <div id="app">
    <h1>My App</h1>
  </div>
`

const { html, state } = renderToString(App)

// Enviar html + state para o navegador
```

### Cliente

```typescript
import { render, html, createState, hydrateReactiveNodes } from '@_bashell/slash'

// Recuperar estado
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

// Criar map de estados
const reactives = new Map()
Object.entries(stateData).forEach(([id, value]) => {
  reactives.set(id, createState({ value }))
})

// Hidratar
const root = document.getElementById('app')
if (root) {
  hydrateReactiveNodes(root, reactives)
}

// Renderizar normalmente (reutiliza DOM)
const App = () => html`<div id="app"><h1>My App</h1></div>`
render(App, root)
```

## Exemplo Avançado: Lista Reativa

### Servidor

```typescript
import { renderToString, htmlString, createState } from '@_bashell/slash'

type Todo = { id: number; text: string; done: boolean }

const todos = createState<Todo[]>({
  value: [
    { id: 1, text: 'Learn SSR', done: true },
    { id: 2, text: 'Learn Hydration', done: false }
  ]
})

const TodoApp = () => {
  const { value: items } = todos.get()

  return htmlString`
    <div id="app">
      <h1>Todo List</h1>
      <ul>
        ${items.map(todo => htmlString`
          <li class=${todo.done ? 'done' : ''}>
            <input type="checkbox" checked=${todo.done} data-id="${todo.id}" />
            <span>${todo.text}</span>
          </li>
        `)}
      </ul>
      <button class="add">Add Todo</button>
    </div>
  `
}

const { html, state } = renderToString(TodoApp)
```

### Cliente

```typescript
import {
  createState,
  hydrateReactiveNodes,
  walkAndHydrateReactiveAttributes
} from '@_bashell/slash'

type Todo = { id: number; text: string; done: boolean }

// Recuperar estado
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

// Recriar state
const todos = createState<Todo[]>({ value: stateData.s0 || [] })

// Map de reactives
const reactives = new Map()
reactives.set('s0', todos)

// Hidratar
const app = document.getElementById('app')
if (app) {
  hydrateReactiveNodes(app, reactives)
  walkAndHydrateReactiveAttributes(app, reactives)
}

// Event handlers
app?.addEventListener('change', (e) => {
  const target = e.target as HTMLInputElement
  if (target.type === 'checkbox') {
    const id = Number(target.dataset.id)
    const current = todos.get().value
    todos.set({
      value: current.map(t =>
        t.id === id ? { ...t, done: target.checked } : t
      )
    })
  }
})

const addBtn = app?.querySelector('.add')
addBtn?.addEventListener('click', () => {
  const current = todos.get().value
  const newTodo: Todo = {
    id: Date.now(),
    text: `Todo ${current.length + 1}`,
    done: false
  }
  todos.set({ value: [...current, newTodo] })
})
```

## Utilitários de Hydration

### `skipReactiveMarkers()`

Pula marcadores reativos durante o percorrimento do DOM:

```typescript
import { skipReactiveMarkers, getHydrateContext } from '@_bashell/slash'

// Durante a hidratação, pula comentários reactive-start/end
const context = getHydrateContext()
if (context?.cursor?.nodeType === Node.COMMENT_NODE) {
  skipReactiveMarkers()
}
```

### `hydrateChild()`

Hidrata um child individual durante o processo:

```typescript
import { hydrateChild } from '@_bashell/slash'

// Hidratar um child específico
hydrateChild(someChildNode)
```

## Fluxo Completo SSR + Hydration

### 1. Servidor Renderiza

```typescript
const { html, state } = renderToString(App)
// html: HTML estático com marcadores
// state: { s0: valor0, s1: valor1, ... }
```

### 2. HTML é Enviado ao Navegador

```html
<div id="app">
  Contador: <!--reactive-start:s0-->42<!--reactive-end:s0-->
  <button class="btn" data-reactive-class="s1">Click</button>
</div>
<script id="__SLASH_STATE__" type="application/json">
{"s0":42,"s1":"active"}
</script>
```

### 3. Navegador Exibe HTML Imediatamente

O usuário vê o conteúdo antes do JavaScript carregar.

### 4. JavaScript Carrega e Hidrata

```typescript
// Recuperar estado
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)

// Recriar states
const count = createState({ value: stateData.s0 })
const btnClass = createState({ value: stateData.s1 })

const reactives = new Map([
  ['s0', count],
  ['s1', btnClass]
])

// Hidratar
const app = document.getElementById('app')
hydrateReactiveNodes(app, reactives)
walkAndHydrateReactiveAttributes(app, reactives)

// Reconectar event handlers
const btn = app?.querySelector('.btn')
btn?.addEventListener('click', () => {
  count.set({ value: count.get().value + 1 })
})
```

### 5. Aplicação Totalmente Interativa

Agora os estados reativos estão funcionando e a aplicação responde a eventos.

## Boas Práticas

### ✅ Serializar Estado Corretamente

```typescript
// Servidor: incluir estado no HTML
const { html, state } = renderToString(App)

const fullHtml = `
  ${html}
  <script id="__SLASH_STATE__" type="application/json">
  ${JSON.stringify(state)}
  </script>
`
```

### ✅ Manter Estrutura DOM Idêntica

O HTML renderizado no cliente deve ter a **mesma estrutura** do servidor:

```typescript
// ❌ ERRADO: Estruturas diferentes
// Servidor: htmlString`<div><h1>Title</h1></div>`
// Cliente:  html`<div><p>Title</p></div>`

// ✅ CORRETO: Mesma estrutura
// Servidor: htmlString`<div><h1>Title</h1></div>`
// Cliente:  html`<div><h1>Title</h1></div>`
```

### ✅ Hidratar Antes de Adicionar Event Handlers

```typescript
// 1. Hidratar primeiro
hydrateReactiveNodes(app, reactives)
walkAndHydrateReactiveAttributes(app, reactives)

// 2. Depois adicionar event handlers
button.addEventListener('click', handleClick)
```

### ✅ Limpar Script de Estado

```typescript
// Remover script após hidratar (opcional, para limpeza)
const stateScript = document.getElementById('__SLASH_STATE__')
stateScript?.remove()
```

### ❌ Evitar Renderizar do Zero

```typescript
// ❌ ERRADO: Recria todo o DOM
const root = document.getElementById('app')
root.innerHTML = '' // Joga fora o DOM do servidor!
render(App, root)

// ✅ CORRETO: Reutiliza DOM existente
hydrateReactiveNodes(root, reactives)
```

## Debugging Hydration

### Ver Marcadores Reativos

Abra DevTools e inspecione o HTML:

```html
<div>
  Count: <!--reactive-start:s0-->42<!--reactive-end:s0-->
</div>
```

### Verificar Estado Serializado

```typescript
const stateData = JSON.parse(
  document.getElementById('__SLASH_STATE__')?.textContent || '{}'
)
console.log('Estado do servidor:', stateData)
```

### Verificar Atributos Reativos

```typescript
const elements = document.querySelectorAll('[data-reactive-class]')
console.log('Elementos com classes reativas:', elements)
```

## Limitações

1. **Event Handlers não são serializados**: Você precisa reconectá-los manualmente no cliente
2. **Estrutura DOM deve ser idêntica**: Diferenças entre servidor/cliente causam problemas
3. **Funções não podem ser serializadas**: Apenas dados primitivos e objetos simples

## Próximos Passos

- Veja [Universal Data Loading](/avancado/data-loading) para data fetching isomórfico
- Explore [SSR](/avancado/ssr) para entender a renderização no servidor
- Confira exemplos práticos no [template slash-ssr](https://github.com/bashell-rrocha/slash-ssr)
- Para sites estáticos com ilhas, veja [Geração Estática (SSG)](/avancado/ssg)
