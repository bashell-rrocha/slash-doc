---
title: Performance e Best Practices
description: Otimizações e melhores práticas
---

Slash é projetado para performance, mas seguir certas práticas garante que sua aplicação seja rápida e eficiente.

## Batch Updates

A forma mais simples de otimizar performance é usar `batch()` para agrupar múltiplas atualizações de estado.

### Quando Usar Batch

Use `batch()` sempre que atualizar múltiplos states ou o mesmo state várias vezes:

```typescript
import { createState, batch } from '@_bashell/slash'

const user = createState({ name: '', email: '' })
const isLoading = createState(false)

// ❌ Sem batch: 2 notificações
const loadUser = async (id: number) => {
  isLoading.set(true)
  const data = await fetchUser(id)
  user.set(data)
  isLoading.set(false)
}

// ✅ Com batch: 1 notificação
const loadUser = async (id: number) => {
  isLoading.set(true)
  const data = await fetchUser(id)

  batch(() => {
    user.set(data)
    isLoading.set(false)
  })
}
```

### Efeito do batch

Sem `batch`, cada `set()` notifica os watchers na hora. Com `batch`, cada estado alterado notifica **uma única vez**, com o valor final, no fim do batch mais externo. O ganho depende do custo dos seus watchers e dos componentes que leem o state: meça no seu caso.

**Documentação completa:** [Batch Updates](/fundamentos/batch/)

## Memory Management

### Cleanup de Watchers

Sempre remova watchers quando não precisar mais deles:

```typescript
import { createState } from '@_bashell/slash'

const state = createState(0)

// ❌ Memory leak: se isto estiver no corpo de um componente, cada render cria um watcher novo
// const Component = () => { state.watch(() => console.log('State changed')); ... }

// ✅ Correto: crie o watcher uma vez, fora do componente, e guarde o unwatch
const unwatch = state.watch(() => {
  console.log('State changed')
})

// Quando não precisar mais:
unwatch()
```

### Event Listeners

Remova event listeners quando não forem mais necessários:

```typescript
import { html } from '@_bashell/slash'

const Component = () => {
  const handleClick = () => console.log('clicked')

  // ✅ Event listeners inline são automaticamente gerenciados
  return html`<button onClick=${handleClick}>Click</button>`
}

// Para eventos customizados:
const ComponentWithCustomEvent = () => {
  const element = document.querySelector('#custom')

  const handler = () => console.log('custom event')
  element?.addEventListener('custom', handler)

  // Cleanup
  return () => {
    element?.removeEventListener('custom', handler)
  }
}
```

### Deep Cloning

Slash faz deep clone automático de estados. Para objetos grandes, considere imutabilidade:

```typescript
import { createState } from '@_bashell/slash'

// ❌ Deep clone de array grande a cada update
const bigArray = createState(new Array(10000).fill(0))

bigArray.set([...bigArray.get(), 1]) // Clone de 10k items

// ✅ Use estruturas imutáveis ou atualize apenas o necessário
const items = createState({ data: new Array(10000).fill(0), count: 0 })

items.set({ ...items.get(), count: items.get().count + 1 }) // Clone pequeno
```

## Render Optimization

### Evite Renders Desnecessários

Slash já otimiza automaticamente com deep equality checking:

```typescript
import { createState } from '@_bashell/slash'

const state = createState({ count: 0 })

state.watch(() => {
  console.log('State changed') // Não será chamado
})

state.set({ count: 0 }) // Mesmo valor, não notifica watchers
```

### Lazy Evaluation

Props reativas são avaliadas apenas quando necessário:

```typescript
import { html, createState } from '@_bashell/slash'

const expensiveComputation = () => {
  console.log('Computing...')
  return Math.random()
}

const state = createState(0)

// ❌ Computação a cada render
html`<div>${expensiveComputation()}</div>`

// ✅ Computação apenas quando state mudar
const computed = createState(() => expensiveComputation())
state.watch(() => computed.set(expensiveComputation()))

html`<div>${computed.get()}</div>`
```

### Memoização de Componentes

Componentes puros podem ser memoizados:

```typescript
import { html } from '@_bashell/slash'

const cache = new Map()

const MemoizedComponent = (props: { id: number }) => {
  if (cache.has(props.id)) {
    return cache.get(props.id)
  }

  const result = html`<div>Item ${props.id}</div>`
  cache.set(props.id, result)
  return result
}
```

## List Rendering

### Keys para Lists

Use keys únicas para otimizar reconciliação:

```typescript
import { html } from '@_bashell/slash'

interface Item {
  id: number
  text: string
}

const items: Item[] = [
  { id: 1, text: 'Item 1' },
  { id: 2, text: 'Item 2' },
  { id: 3, text: 'Item 3' }
]

// ❌ Sem keys
html`
  <ul>
    ${items.map(item => html`<li>${item.text}</li>`)}
  </ul>
`

// ✅ Com keys
html`
  <ul>
    ${items.map(item => html`<li key=${item.id}>${item.text}</li>`)}
  </ul>
`
```

### Virtualização para Listas Grandes

Para listas muito grandes (>1000 items), use virtualização:

```typescript
import { html, createState } from '@_bashell/slash'

const ITEM_HEIGHT = 50
const VISIBLE_ITEMS = 20

const allItems = new Array(10000).fill(0).map((_, i) => ({
  id: i,
  text: `Item ${i}`
}))

const scrollTop = createState(0)

const VirtualList = () => {
  const scroll = scrollTop.get()
  const startIndex = Math.floor(scroll / ITEM_HEIGHT)
  const endIndex = startIndex + VISIBLE_ITEMS

  const visibleItems = allItems.slice(startIndex, endIndex)
  const offsetY = startIndex * ITEM_HEIGHT

  return html`
    <div
      style=${{
        height: '1000px',
        overflow: 'auto'
      }}
      onScroll=${(e: Event) => {
        scrollTop.set((e.target as HTMLElement).scrollTop)
      }}
    >
      <div style=${{ height: `${allItems.length * ITEM_HEIGHT}px` }}>
        <div style=${{ transform: `translateY(${offsetY}px)` }}>
          ${visibleItems.map(item => html`
            <div key=${item.id} style=${{ height: `${ITEM_HEIGHT}px` }}>
              ${item.text}
            </div>
          `)}
        </div>
      </div>
    </div>
  `
}
```

## DOM Operations

### Minimize DOM Mutations

Agrupe operações DOM:

```typescript
import { html } from '@_bashell/slash'

// ❌ Múltiplas mutações
const items = [1, 2, 3]
const container = document.querySelector('#list')

items.forEach(item => {
  const li = document.createElement('li')
  li.textContent = String(item)
  container?.appendChild(li) // 3 mutações
})

// ✅ Uma mutação usando fragment
const fragment = document.createDocumentFragment()
items.forEach(item => {
  const li = document.createElement('li')
  li.textContent = String(item)
  fragment.appendChild(li)
})
container?.appendChild(fragment) // 1 mutação

// ✅✅ Melhor ainda: use html template
html`
  <ul>
    ${items.map(item => html`<li>${item}</li>`)}
  </ul>
`
```

### requestAnimationFrame para Animações

```typescript
import { createState } from '@_bashell/slash'

const position = createState({ x: 0, y: 0 })

// ❌ Atualizar a cada frame sem throttle
document.addEventListener('mousemove', (e) => {
  position.set({ x: e.clientX, y: e.clientY })
})

// ✅ Throttle com requestAnimationFrame
let ticking = false

document.addEventListener('mousemove', (e) => {
  if (!ticking) {
    requestAnimationFrame(() => {
      position.set({ x: e.clientX, y: e.clientY })
      ticking = false
    })
    ticking = true
  }
})
```

## Bundle Size Optimization

### Tree Shaking

Importe apenas o que você usa:

```typescript
// ❌ Import tudo
import * as Slash from '@_bashell/slash'

// ✅ Import apenas o necessário
import { createState, html, render } from '@_bashell/slash'
```

### Code Splitting

Divida código em chunks menores:

```typescript
// routes.ts
export const routes = [
  {
    path: '/',
    component: () => import('./pages/Home') // Lazy loading
  },
  {
    path: '/about',
    component: () => import('./pages/About')
  }
]
```

### Dynamic Imports

```typescript
import { html, createState } from '@_bashell/slash'

const showModal = createState(false)
let ModalComponent: any = null

const loadModal = async () => {
  if (!ModalComponent) {
    ModalComponent = (await import('./Modal')).default
  }
  showModal.set(true)
}

const App = () => html`
  <div>
    <button onClick=${loadModal}>Open Modal</button>
    ${showModal.get() && ModalComponent ? ModalComponent() : null}
  </div>
`
```

## Network Optimization

### Debounce de Requests

```typescript
import { createState } from '@_bashell/slash'

const searchQuery = createState('')
const results = createState<any[]>([])

let debounceTimer: number

searchQuery.watch((query) => {
  clearTimeout(debounceTimer)

  debounceTimer = setTimeout(async () => {
    if (query) {
      const data = await fetch(`/api/search?q=${query}`)
      results.set(await data.json())
    }
  }, 300) // 300ms debounce
})
```

### Request Deduplication

```typescript
const requestCache = new Map<string, Promise<any>>()

const fetchWithCache = async (url: string) => {
  if (requestCache.has(url)) {
    return requestCache.get(url)
  }

  const promise = fetch(url).then(r => r.json())
  requestCache.set(url, promise)

  try {
    const data = await promise
    return data
  } finally {
    // Limpar cache após 5 segundos
    setTimeout(() => requestCache.delete(url), 5000)
  }
}
```

### Parallel Requests

```typescript
import { batch, createState } from '@_bashell/slash'

const user = createState(null)
const posts = createState([])
const comments = createState([])

const loadData = async (userId: number) => {
  // ❌ Sequencial: ~3 segundos
  const userData = await fetch(`/api/users/${userId}`)
  const postsData = await fetch(`/api/posts?user=${userId}`)
  const commentsData = await fetch(`/api/comments?user=${userId}`)

  // ✅ Paralelo: ~1 segundo
  const [userData, postsData, commentsData] = await Promise.all([
    fetch(`/api/users/${userId}`).then(r => r.json()),
    fetch(`/api/posts?user=${userId}`).then(r => r.json()),
    fetch(`/api/comments?user=${userId}`).then(r => r.json())
  ])

  batch(() => {
    user.set(userData)
    posts.set(postsData)
    comments.set(commentsData)
  })
}
```

## SSR Performance

### Streaming SSR

Use `renderToStream()` em vez de `renderToString()` para melhor TTFB:

```typescript
import { renderToString, renderToStream } from '@_bashell/slash/ssr'

// ❌ Espera renderização completa (devolve { html, state })
const { html } = renderToString(App)
response.send(html)

// ✅ Chunks progressivos: renderToStream é um async generator de strings
for await (const chunk of renderToStream(App)) {
  response.write(chunk)
}
response.end()
```

### Primeira renderização no cliente

O cliente renderiza a view de novo por cima do HTML do servidor (veja [Hydration](/avancado/hydration/)); minimize o trabalho dessa primeira execução:

```typescript
import { html, isServer } from '@_bashell/slash'

const App = () => {
  // ❌ Executa lógica pesada na primeira renderização
  const data = isServer() ? serverData : expensiveClientComputation()

  // ✅ Use dados pré-computados do servidor
  const data = isServer() ? serverData : window.__INITIAL_DATA__

  return html`<div>${JSON.stringify(data)}</div>`
}
```

## Profiling e Monitoring

### Chrome DevTools

Use Performance tab para profile renders:

```typescript
import { html, createState } from '@_bashell/slash'

const Component = () => {
  performance.mark('render-start')

  const result = html`<div>Component</div>`

  performance.mark('render-end')
  performance.measure('render', 'render-start', 'render-end')

  return result
}

// Ver medições
const measures = performance.getEntriesByType('measure')
console.table(measures)
```

### User Timing API

```typescript
// Marcar pontos importantes
performance.mark('app-init-start')
// ... inicialização
performance.mark('app-init-end')

performance.measure('app-init', 'app-init-start', 'app-init-end')

// Enviar para analytics
const measures = performance.getEntriesByName('app-init')
measures.forEach(measure => {
  analytics.track('performance', {
    metric: measure.name,
    duration: measure.duration
  })
})
```

### Real User Monitoring (RUM)

```typescript
import { createState } from '@_bashell/slash'

const metrics = {
  FCP: 0, // First Contentful Paint
  LCP: 0, // Largest Contentful Paint
  FID: 0, // First Input Delay
  CLS: 0  // Cumulative Layout Shift
}

// Capturar Web Vitals
new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.name === 'first-contentful-paint') {
      metrics.FCP = entry.startTime
    }
  }
}).observe({ entryTypes: ['paint'] })

// Enviar para analytics
window.addEventListener('load', () => {
  setTimeout(() => {
    analytics.track('web-vitals', metrics)
  }, 0)
})
```

## Best Practices Summary

### ✅ DO

- Use `batch()` para múltiplos updates
- Remova watchers e event listeners
- Use keys em listas
- Virtualize listas grandes (>1000 items)
- Debounce inputs e requests
- Paraleliza requests independentes
- Use streaming SSR
- Profile com DevTools

### ❌ DON'T

- Mutação direta de state
- Deep clone desnecessário
- Renders excessivos sem batch
- Memory leaks (watchers não removidos)
- Listas sem keys
- Requests sequenciais desnecessários
- Lógica pesada em renders

## Medições

Não há benchmarks comparativos com outras bibliotecas no repositório, então esta página não traz tabelas deles. O que existe é a medição de tamanho: `bun test scripts/bundle-size.test.ts` no pacote core. Para um app mínimo (`createState` + `html` + `render`, minificado), a versão atual mediu **≈ 8,3 KB gzip**. Use o profiling do navegador para medir o seu caso.

## Próximos Passos

- [Developer Experience](/guias/dev-experience/) - Ferramentas de debug
- [Batch Updates](/fundamentos/batch/) - Documentação completa
- [API Reference](/referencia/api/) - Referência completa da API
