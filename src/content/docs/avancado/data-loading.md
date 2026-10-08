---
title: Universal Data Loading
description: Data fetching isomórfico com cache inteligente
---

O Slash oferece um sistema de **Universal Data Loading** que funciona tanto no servidor quanto no cliente, com cache automático e hidratação de dados.

## O que é Universal Data Loading?

Universal Data Loading (ou Data Fetching Isomórfico) permite que você escreva código de carregamento de dados uma única vez e ele funcione em ambos os ambientes:

- **No servidor (SSR)**: Busca dados durante a renderização inicial
- **No cliente**: Reutiliza dados hidratados ou busca novos dados com cache

### Benefícios

- ✅ **Código Único**: Mesma lógica funciona em servidor e cliente
- ✅ **Cache Inteligente**: Reduz requisições desnecessárias
- ✅ **Hidratação do cache**: dados do servidor entram no cache do cliente com `hydrateLoaderCache`
- ✅ **TTL Configurável**: Controle fino sobre expiração de cache
- ✅ **Invalidação Seletiva**: Limpar cache por chave ou tudo

## `createLoader()`

A função `createLoader()` cria um loader universal com cache automático.

### Sintaxe

```typescript
function createLoader<T>(
  fn: LoaderFunction<T>,
  options: LoaderOptions
): LoaderFunction<T>

type LoaderFunction<T> = (ctx: LoaderContext) => T | Promise<T>

type LoaderContext = {
  params: Record<string, string>
  request?: Request
  isServer: boolean
}

type LoaderOptions = {
  key: string
  ttl?: number
  revalidate?: boolean
}
```

### Parâmetros

- **fn**: Função que busca os dados (síncrona ou assíncrona)
- **options**: Configurações do loader
  - **key**: Identificador único do loader
  - **ttl**: Time-to-live do cache em milissegundos (padrão: 5 minutos)
  - **revalidate**: Se `true`, sempre revalida dados (padrão: `false`)

### Retorno

Retorna uma função loader que pode ser chamada com um contexto.

### Exemplo Básico

```typescript
import { createLoader } from '@_bashell/slash'

// Criar loader
const userLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`/api/users/${params.id}`)
    return res.json()
  },
  { key: 'user', ttl: 60000 } // 1 minuto de cache
)

// Usar loader
const user = await userLoader({
  params: { id: '123' },
  isServer: false
})

console.log(user) // { id: 123, name: 'John', ... }
```

## Como Funciona o Cache

### No Servidor

No servidor, o loader **sempre executa** a função, sem usar cache:

```typescript
const loader = createLoader(
  async () => {
    console.log('Executando no servidor...')
    return { data: 'from server' }
  },
  { key: 'data' }
)

// Servidor: sempre executa
await loader({ params: {}, isServer: true })
// Log: "Executando no servidor..."

await loader({ params: {}, isServer: true })
// Log: "Executando no servidor..." (novamente)
```

### No Cliente

No cliente, o loader usa cache inteligente:

```typescript
const loader = createLoader(
  async () => {
    console.log('Buscando dados...')
    return { data: Date.now() }
  },
  { key: 'data', ttl: 5000 } // 5 segundos
)

// Cliente: primeira chamada
const result1 = await loader({ params: {}, isServer: false })
// Log: "Buscando dados..."

// Cliente: segunda chamada (dentro do TTL)
const result2 = await loader({ params: {}, isServer: false })
// Nenhum log - usou cache

// result1 === result2 (mesmo objeto do cache)
```

### Cache por Parâmetros

O cache é baseado na **chave + parâmetros**:

```typescript
const userLoader = createLoader(
  async ({ params }) => {
    return { id: params.id, name: `User ${params.id}` }
  },
  { key: 'user', ttl: 60000 }
)

// Busca user 1 (cache miss)
await userLoader({ params: { id: '1' }, isServer: false })

// Busca user 2 (cache miss - params diferentes)
await userLoader({ params: { id: '2' }, isServer: false })

// Busca user 1 novamente (cache hit - mesmos params)
await userLoader({ params: { id: '1' }, isServer: false })
```

## TTL (Time-To-Live)

O TTL controla por quanto tempo os dados ficam no cache.

### TTL Padrão

O TTL padrão é **5 minutos (300.000ms)**:

```typescript
const loader = createLoader(
  async () => getData(),
  { key: 'data' } // TTL padrão: 5 minutos
)
```

### TTL Customizado

```typescript
const shortCacheLoader = createLoader(
  async () => getLiveData(),
  { key: 'live', ttl: 10000 } // 10 segundos
)

const longCacheLoader = createLoader(
  async () => getStaticData(),
  { key: 'static', ttl: 3600000 } // 1 hora
)

const noCacheLoader = createLoader(
  async () => getAlwaysFresh(),
  { key: 'fresh', ttl: 0 } // Sem cache
)
```

### TTL Expirado

Quando o cache expira, o loader executa novamente:

```typescript
const loader = createLoader(
  async () => ({ timestamp: Date.now() }),
  { key: 'time', ttl: 1000 } // 1 segundo
)

const result1 = await loader({ params: {}, isServer: false })
console.log(result1.timestamp) // 1234567890000

// Esperar TTL expirar
await new Promise(resolve => setTimeout(resolve, 1100))

const result2 = await loader({ params: {}, isServer: false })
console.log(result2.timestamp) // 1234567891100 (novo timestamp)
```

## `invalidateLoader()`

Remove dados do cache de forma seletiva ou total.

### Sintaxe

```typescript
function invalidateLoader(key?: string): void
```

### Parâmetros

- **key** (opcional): Chave do loader a ser invalidado. Se omitido, limpa todo o cache.

### Invalidar Loader Específico

```typescript
const userLoader = createLoader(
  async ({ params }) => ({ id: params.id }),
  { key: 'user', ttl: 60000 }
)

// Carregar dados
await userLoader({ params: { id: '1' }, isServer: false })
await userLoader({ params: { id: '2' }, isServer: false })

// Invalidar apenas user
invalidateLoader('user')

// Próxima chamada vai buscar novamente
await userLoader({ params: { id: '1' }, isServer: false })
```

### Invalidar Todo o Cache

```typescript
import { invalidateLoader } from '@_bashell/slash'

// Limpar todo o cache
invalidateLoader()

// Todos os loaders vão buscar dados novamente
```

### Exemplo Prático: Invalidação após Mutação

```typescript
import { createLoader, invalidateLoader } from '@_bashell/slash'

const todosLoader = createLoader(
  async () => {
    const res = await fetch('/api/todos')
    return res.json()
  },
  { key: 'todos', ttl: 60000 }
)

async function addTodo(text: string) {
  await fetch('/api/todos', {
    method: 'POST',
    body: JSON.stringify({ text })
  })

  // Invalidar cache após mutação
  invalidateLoader('todos')
}

async function deleteTodo(id: string) {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' })

  // Invalidar cache
  invalidateLoader('todos')
}
```

## Hidratação de Dados

### `serializeLoaderData()`

Serializa dados de loaders para enviar ao cliente:

```typescript
function serializeLoaderData(data: Record<string, unknown>): string
```

```typescript
import { serializeLoaderData } from '@_bashell/slash'

const loaderData = {
  'user:{"id":"123"}': { id: 123, name: 'John' },
  'posts:{}': [{ id: 1, title: 'Post 1' }]
}

const serialized = serializeLoaderData(loaderData)
// '{"user:{\"id\":\"123\"}":{"id":123,"name":"John"},"posts:{}":[{"id":1,"title":"Post 1"}]}'
```

:::tip[Seguro para `<script>`]
`serializeLoaderData` faz `JSON.stringify` e escapa `<`, `>`, `&`, U+2028 e U+2029 (o mesmo que `serializeStateForScript`), então o resultado pode ir dentro de `<script type="application/json">` sem fechar a tag. Um valor de nível superior que não seja JSON (por exemplo `undefined`) vira `"null"`. Use sempre `type="application/json"` na tag: o conteúdo é lido por `textContent` e `deserializeLoaderData`, nunca executado.
:::

### `deserializeLoaderData()`

Deserializa dados no cliente:

```typescript
function deserializeLoaderData(serialized: string): Record<string, unknown>
```

```typescript
import { deserializeLoaderData } from '@_bashell/slash'

const serialized = document.getElementById('__LOADER_DATA__')?.textContent || '{}'
const data = deserializeLoaderData(serialized)

console.log(data)
// {
//   'user:{"id":"123"}': { id: 123, name: 'John' },
//   'posts:{}': [...]
// }
```

### `hydrateLoaderCache()`

Injeta dados pré-carregados no cache do cliente:

```typescript
function hydrateLoaderCache(data: Record<string, unknown>): void
```

```typescript
import { hydrateLoaderCache, deserializeLoaderData } from '@_bashell/slash'

// Recuperar dados serializados
const serialized = document.getElementById('__LOADER_DATA__')?.textContent || '{}'
const data = deserializeLoaderData(serialized)

// Hidratar cache
hydrateLoaderCache(data)

// Agora os loaders vão usar os dados hidratados
```

## Fluxo Completo SSR + Data Loading

### Servidor

```typescript
// server.ts
import {
  renderToString,
  htmlString,
  createLoader,
  serializeStateForScript
} from '@_bashell/slash'

// Criar loader
const userLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`https://api.example.com/users/${params.id}`)
    return res.json()
  },
  { key: 'user', ttl: 60000 }
)

// Renderizar página
async function renderPage(userId: string) {
  // Buscar dados no servidor
  const user = await userLoader({
    params: { id: userId },
    isServer: true
  })

  // Renderizar componente
  const App = () => htmlString`
    <div id="app">
      <h1>${user.name}</h1>
      <p>Email: ${user.email}</p>
    </div>
  `

  const { html } = renderToString(App)

  // Serializar dados do loader (com escape seguro para <script>)
  const loaderData = serializeStateForScript({
    [`user:${JSON.stringify({ id: userId })}`]: user
  })

  // HTML completo
  return `
    <!DOCTYPE html>
    <html>
      <body>
        ${html}
        <script id="__LOADER_DATA__" type="application/json">${loaderData}</script>
        <script src="/client.js" type="module"></script>
      </body>
    </html>
  `
}
```

### Cliente

```typescript
// client.ts
import {
  createLoader,
  hydrateLoaderCache,
  deserializeLoaderData
} from '@_bashell/slash'

// Hidratar cache com dados do servidor
const serialized = document.getElementById('__LOADER_DATA__')?.textContent || '{}'
const loaderData = deserializeLoaderData(serialized)
hydrateLoaderCache(loaderData)

// Criar o mesmo loader
const userLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`/api/users/${params.id}`)
    return res.json()
  },
  { key: 'user', ttl: 60000 }
)

// Usar loader (vai usar dados hidratados do servidor!)
const user = await userLoader({
  params: { id: '123' },
  isServer: false
})

console.log(user) // Dados do servidor, sem nova requisição
```

## `isServer()`

Detecta se o código está rodando no servidor ou cliente.

### Sintaxe

```typescript
function isServer(): boolean
```

### Uso

```typescript
import { isServer } from '@_bashell/slash'

if (isServer()) {
  console.log('Executando no servidor')
  // Usar APIs do Node.js, acessar filesystem, etc.
} else {
  console.log('Executando no cliente')
  // Usar APIs do navegador, window, localStorage, etc.
}
```

### Exemplo Prático

```typescript
import { createLoader, isServer } from '@_bashell/slash'

const dataLoader = createLoader(
  async () => {
    if (isServer()) {
      // No servidor: ler do filesystem
      const fs = await import('fs/promises')
      const data = await fs.readFile('./data.json', 'utf-8')
      return JSON.parse(data)
    } else {
      // No cliente: fazer fetch
      const res = await fetch('/api/data')
      return res.json()
    }
  },
  { key: 'data', ttl: 60000 }
)
```

## Padrões Avançados

### Loader com Autenticação

```typescript
const authenticatedLoader = createLoader(
  async ({ request, params }) => {
    const token = request?.headers.get('Authorization')

    const res = await fetch(`/api/protected/${params.id}`, {
      headers: token ? { Authorization: token } : {}
    })

    if (!res.ok) throw new Error('Unauthorized')

    return res.json()
  },
  { key: 'protected', ttl: 30000 }
)
```

### Loader com Retry

```typescript
const retryLoader = createLoader(
  async ({ params }) => {
    let attempts = 0
    const maxAttempts = 3

    while (attempts < maxAttempts) {
      try {
        const res = await fetch(`/api/data/${params.id}`)
        if (res.ok) return res.json()
        attempts++
      } catch (error) {
        attempts++
        if (attempts >= maxAttempts) throw error
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts))
      }
    }

    throw new Error('Max retries exceeded')
  },
  { key: 'retry', ttl: 60000 }
)
```

### Loader com Debounce

```typescript
let debounceTimer: NodeJS.Timeout | null = null

const searchLoader = createLoader(
  async ({ params }) => {
    // Debounce de 300ms
    await new Promise(resolve => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(resolve, 300)
    })

    const res = await fetch(`/api/search?q=${params.query}`)
    return res.json()
  },
  { key: 'search', ttl: 10000 }
)
```

### Loader com Dependências

```typescript
const userLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`/api/users/${params.userId}`)
    return res.json()
  },
  { key: 'user', ttl: 60000 }
)

const postsLoader = createLoader(
  async ({ params }) => {
    // Carregar user primeiro
    const user = await userLoader({
      params: { userId: params.userId },
      isServer: params.isServer
    })

    // Depois carregar posts do user
    const res = await fetch(`/api/users/${user.id}/posts`)
    return res.json()
  },
  { key: 'posts', ttl: 30000 }
)
```

## Exemplo Completo: Blog SSR

### Servidor

```typescript
import {
  renderToString,
  htmlString,
  createLoader,
  serializeLoaderData
} from '@_bashell/slash'

type Post = { id: string; title: string; content: string }

// Escapa texto vindo de usuário antes de colocá-lo em HTML montado à mão
const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const postsLoader = createLoader(
  async () => {
    const res = await fetch('https://api.example.com/posts')
    return res.json() as Promise<Post[]>
  },
  { key: 'posts', ttl: 300000 } // 5 minutos
)

const postLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`https://api.example.com/posts/${params.id}`)
    return res.json() as Promise<Post>
  },
  { key: 'post', ttl: 600000 } // 10 minutos
)

async function renderBlogPage(postId: string) {
  // Carregar dados
  const post = await postLoader({
    params: { id: postId },
    isServer: true
  })

  // Renderizar
  const App = () => htmlString`
    <article>
      <h1>${post.title}</h1>
      <div>${post.content /* HTML já sanitizado: ver aviso abaixo */}</div>
    </article>
  `

  const { html } = renderToString(App)

  // Serializar dados (já escapado para uso dentro de <script>)
  const loaderData = serializeLoaderData({
    [`post:${JSON.stringify({ id: postId })}`]: post
  })

  // O documento é montado com template literal comum (não com htmlString)
  return `<!DOCTYPE html>
<html>
  <head>
    <title>${escapeHtml(post.title)}</title>
  </head>
  <body>
    <div id="app">${html}</div>
    <script id="__LOADER_DATA__" type="application/json">${loaderData}</script>
    <script src="/client.js" type="module"></script>
  </body>
</html>`
}
```

:::caution[Texto de usuário no SSR]
No SSR, uma string que começa com `<` é tratada como HTML pronto e sai sem escape. Por isso `post.content` só pode ser interpolado se for HTML que você já sanitizou; texto cru de usuário que comece com `<` seria injetado como marcação. Já `post.title` é escapado normalmente pelo `htmlString`, e no `<title>` montado à mão usamos `escapeHtml`.
:::

### Cliente

```typescript
import {
  createLoader,
  hydrateLoaderCache,
  deserializeLoaderData,
  invalidateLoader
} from '@_bashell/slash'

// Hidratar cache
const loaderData = deserializeLoaderData(
  document.getElementById('__LOADER_DATA__')?.textContent || '{}'
)
hydrateLoaderCache(loaderData)

// Recriar loaders
const postLoader = createLoader(
  async ({ params }) => {
    const res = await fetch(`/api/posts/${params.id}`)
    return res.json()
  },
  { key: 'post', ttl: 600000 }
)

// Usar loader (vai usar dados hidratados!)
const post = await postLoader({
  params: { id: '123' },
  isServer: false
})

// Adicionar interatividade
document.querySelector('.refresh-btn')?.addEventListener('click', () => {
  invalidateLoader('post')
  // Recarregar post
  postLoader({ params: { id: '123' }, isServer: false })
})
```

## Boas Práticas

### ✅ Use TTL Apropriado

```typescript
// Dados estáticos: TTL longo
const staticLoader = createLoader(fn, { key: 'static', ttl: 3600000 }) // 1 hora

// Dados dinâmicos: TTL curto
const liveLoader = createLoader(fn, { key: 'live', ttl: 5000 }) // 5 segundos

// Dados em tempo real: sem cache
const realtimeLoader = createLoader(fn, { key: 'realtime', ttl: 0 })
```

### ✅ Invalide Cache Após Mutações

```typescript
async function updateUser(id: string, data: any) {
  await fetch(`/api/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })

  // Invalidar cache
  invalidateLoader('user')
}
```

### ✅ Compartilhe Loaders Entre Componentes

```typescript
// loaders.ts
export const userLoader = createLoader(...)
export const postsLoader = createLoader(...)

// component-a.ts
import { userLoader } from './loaders'
const user = await userLoader(...)

// component-b.ts
import { userLoader } from './loaders' // Mesmo loader, compartilha cache!
const user = await userLoader(...)
```

### ✅ Trate Erros Adequadamente

```typescript
const safeLoader = createLoader(
  async ({ params }) => {
    try {
      const res = await fetch(`/api/data/${params.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    } catch (error) {
      console.error('Loader error:', error)
      return null // Ou valor padrão
    }
  },
  { key: 'safe', ttl: 60000 }
)
```

### ❌ Evite Loaders sem Chave Única

```typescript
// ❌ ERRADO: Mesma chave para dados diferentes
const loader1 = createLoader(fn1, { key: 'data' })
const loader2 = createLoader(fn2, { key: 'data' }) // Conflito!

// ✅ CORRETO: Chaves únicas
const userLoader = createLoader(fn1, { key: 'user' })
const postLoader = createLoader(fn2, { key: 'post' })
```

## Debugging

### Ver Estado do Cache

```typescript
// Adicionar log ao loader
const loader = createLoader(
  async (ctx) => {
    console.log('Loader executou:', ctx)
    const data = await fetchData()
    console.log('Dados carregados:', data)
    return data
  },
  { key: 'debug', ttl: 60000 }
)
```

### Verificar Dados Hidratados

```typescript
const serialized = document.getElementById('__LOADER_DATA__')?.textContent
console.log('Dados hidratados:', serialized)

const data = deserializeLoaderData(serialized || '{}')
console.log('Parsed:', data)
```

## Próximos Passos

- Veja [SSR](/avancado/ssr) para renderização no servidor
- Explore [Hydration](/avancado/hydration) para ver o que o cliente faz com o HTML do servidor
- Confira exemplos no [template slash-ssr](https://github.com/bashell-rrocha/slash-ssr)
