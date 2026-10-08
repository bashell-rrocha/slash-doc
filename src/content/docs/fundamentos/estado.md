---
title: Sistema de Estado
description: State management reativo baseado em Observer Pattern
---


## `createState()` - Criação de Estado Reativo

A função `createState()` cria um container de estado reativo que notifica automaticamente componentes quando o valor muda.

### Arquitetura de Reatividade

O Slash utiliza `createState()` que retorna objetos do tipo `State<T>`:

```typescript
// Interface pública para states
type State<T> = {
  get(): T;
  set(value: T): void;
  watch(callback: (value: T) => void): () => void;
}

// Interface genérica para objetos reativos (duck typing)
type Reactive<T> = {
  get(): T;
  subscribe(fn: (v: T) => void): () => void;
}
```

**Nota:** `State<T>` usa `watch()`, enquanto a interface genérica `Reactive<T>` usa `subscribe()`. O sistema detecta qualquer objeto com `get()` e `subscribe()` como reativo via duck typing. Estados criados com `createState` são compatíveis pois internamente adaptam `watch()` para o padrão `subscribe()` quando necessário.

**Características principais:**

- **FCIS Pattern**: Lógica pura em `state-core.ts` (deepClone, deepEqual, computeStateUpdate), side effects em `state.ts`
- **Imutabilidade**: `get()` retorna deep clone, `set()` recebe deep clone
- **Auto-tracking**: Durante renderização, `state.get()` notifica o sistema via `globalThis.__SLASH_TRACK_STATE__`
- **Batching**: Múltiplas atualizações em `batch()` notificam apenas uma vez
- **Reatividade granular**: Apenas elementos DOM dependentes são atualizados (usando comentários `<!--reactive-start:id-->` e `<!--reactive-end:id-->`)

✅ 100% síncrono (sem microtasks)
✅ Zero overhead de VDOM
✅ Comportamento previsível e debugável
✅ Facilmente testável (functional core com lógica pura)

### Assinatura

```typescript
function createState<T>(
  initialValue: T,
  options?: StateOptions
): State<T>

interface StateOptions {
  enableHistory?: boolean     // Habilita time-travel debugging
  historyMaxSize?: number     // Tamanho máximo do histórico (padrão: 100)
}

interface State<T> {
  get(): T
  set(value: T): void
  watch(callback: (value: T) => void): () => void
  // Opcionais (apenas se enableHistory: true)
  getHistory?(): Readonly<StateHistory<T>>
  clearHistory?(): void
}
```

### Uso Básico

```typescript
import { createState } from '@_bashell/slash'

// Estado simples
const count = createState(0)

console.log(count.get()) // 0
count.set(5)
console.log(count.get()) // 5
```

### Estado com Objetos

```typescript
interface User {
  name: string
  age: number
}

const user = createState<User>({
  name: 'Alice',
  age: 30
})

// Atualizar objeto completo
user.set({ name: 'Bob', age: 25 })

// Atualizar parcialmente (spread)
user.set({ ...user.get(), age: 31 })
```

### Estado com Arrays

```typescript
const todos = createState<string[]>([
  'Buy milk',
  'Walk dog'
])

// Adicionar item
todos.set([...todos.get(), 'Learn Slash'])

// Remover item
todos.set(todos.get().filter(todo => todo !== 'Buy milk'))

// Atualizar item
todos.set(
  todos.get().map((todo, i) =>
    i === 0 ? 'Buy bread' : todo
  )
)
```

**Implementação:** [src/state.ts](../../src/state.ts:1)

## Métodos: `get()`, `set()`, `watch()`

### `get()` - Obter Valor Atual

Retorna um **clone profundo** do estado atual:

```typescript
const state = createState({ count: 0 })

const value1 = state.get()
const value2 = state.get()

console.log(value1 === value2) // false (diferentes clones)
console.log(value1.count === value2.count) // true (valores iguais)
```

**Por que clone?**
- Previne mutações acidentais
- Garante imutabilidade
- Facilita debugging e time-travel

#### SSR Tracking com Proxy

Em modo SSR (`globalThis.__SLASH_SSR__` ativo), `get()` retorna um **Proxy** que intercepta acessos a propriedades do estado. Isso permite rastrear quais propriedades são realmente usadas durante a renderização, otimizando a serialização de dados.

```typescript
const user = createState({
  name: 'Alice',
  email: 'alice@example.com',
  avatar: 'large-image-data...'
})

// Em SSR, quando você acessa:
const name = user.get().name

// O Proxy registra via globalThis.__SLASH_TRACK_ACCESS__:
// - state: user
// - property: 'name'
// - value: 'Alice'

// Benefício: apenas 'name' é serializado, 'avatar' é ignorado
```

**Funcionalidades do Proxy SSR:**

1. **Tracking de Propriedades**: Registra cada acesso via `__SLASH_TRACK_ACCESS__`
2. **Tracking de Arrays**: Intercepta métodos como `.map()`, `.filter()`, `.slice()`
3. **Serialização Otimizada**: Apenas propriedades acessadas são incluídas no HTML

**Implementação:** [src/state.ts:105-150](../../src/state.ts:105-150)

**Exemplo completo:**

```typescript
// Server-side
const products = createState([
  { id: 1, name: 'Product 1', description: 'Long text...', reviews: [...] },
  { id: 2, name: 'Product 2', description: 'Long text...', reviews: [...] }
])

// Template acessa apenas 'id' e 'name'
const html = `
  <ul>
    ${products.get().map(p => `<li>${p.id}: ${p.name}</li>`).join('')}
  </ul>
`

// Sistema registra: products[].id, products[].name
// 'description' e 'reviews' não são serializados → economia de banda
```

### `set()` - Atualizar Valor

Atualiza o estado e notifica watchers automaticamente:

```typescript
const count = createState(0)

count.set(5)        // Atualiza para 5
count.set(10)       // Atualiza para 10
count.set(count.get() + 1) // Incrementa
```

**Comportamento:**
1. **Deep Clone**: Novo valor é clonado profundamente
2. **Comparação**: Compara com valor anterior (deep equal)
3. **Notificação**: Watchers são notificados apenas se o valor mudou
4. **Batching**: Se dentro de `batch()`, notificações são agrupadas

**Nota:** `set()` sempre substitui o valor completo. Para atualizações parciais, use spread:

```typescript
const user = createState({ name: 'Alice', age: 30 })

// ❌ Errado - sobrescreve objeto
user.set({ age: 31 })

// ✅ Correto - preserva outras props
user.set({ ...user.get(), age: 31 })
```

### `watch()` - Observar Mudanças

Registra callback para ser notificado quando o estado muda:

```typescript
const count = createState(0)

const unwatch = count.watch((newValue) => {
  console.log('Count changed to:', newValue)
})

count.set(5) // Log: "Count changed to: 5"
count.set(10) // Log: "Count changed to: 10"

// Parar de observar
unwatch()

count.set(15) // Sem log (unwatched)
```

**Assinatura:**
```typescript
watch(callback: (newValue: T) => void): () => void
```

**Retorno:** Função `unwatch` para remover o callback

**Características:**
- Callback recebe **clone** do novo valor
- Múltiplos watchers podem ser registrados
- Watchers são notificados na ordem de registro
- Não há notificação se valor não mudou (deep equal)

## Duck Typing e Interface Reactive<T>

Slash utiliza **duck typing** para detectar objetos reativos. Qualquer objeto que implemente a interface `Reactive<T>` é tratado como reativo pelo sistema de renderização:

```typescript
type Reactive<T> = {
  get(): T;
  subscribe(fn: (v: T) => void): () => void;
}
```

### Diferença entre State<T> e Reactive<T>

- **`State<T>`**: Interface específica retornada por `createState()`, usa o método `watch()`
- **`Reactive<T>`**: Interface genérica para qualquer objeto reativo, usa `subscribe()`

```typescript
// State<T> - API específica do Slash
const count = createState(0)
count.watch((value) => console.log(value))  // método watch()

// Reactive<T> - Interface genérica compatível
const customReactive: Reactive<number> = {
  get: () => 42,
  subscribe: (fn) => {
    // lógica de subscription
    return () => {} // cleanup
  }
}
```

### Compatibilidade via Adaptador

Estados criados com `createState` são compatíveis com `Reactive<T>` através de um adaptador interno. Durante a renderização, o sistema detecta objetos reativos e os trata apropriadamente:

```typescript
// Internamente, quando um State<T> é usado em templates
// o sistema adapta watch() para subscribe() automaticamente
const element = html`<p>${count}</p>`
// count.watch() é chamado internamente para observar mudanças
```

**Implementação:** [src/types.ts:7-10](../../src/types.ts:7-10) define a interface `Reactive<T>`

## Reatividade Automática

Estados são **automaticamente reativos** em componentes. Quando você usa um state em um componente, o componente se inscreve automaticamente para re-render quando o state muda.

### Auto-tracking em Templates

Em templates HTML, estados passados diretamente são rastreados automaticamente:

```typescript
import { html, createState, render } from '@_bashell/slash'

const count = createState(0)

const Counter = () => html`
  <div>
    <p>Count: ${count}</p>
    <button onclick=${() => count.set(count.get() + 1)}>
      Increment
    </button>
  </div>
`

render(Counter(), '#app')
```

**O que acontece:**
1. Durante a renderização, `${count}` acessa `count.get()`
2. O sistema de renderização detecta o objeto reativo e registra um watcher
3. Quando `count.set()` é chamado, apenas o nó de texto dentro de `<p>` é atualizado
4. **Sem re-render completo do componente** - apenas o nó afetado

**Implementação:** Marcadores `<!--reactive-start:id-->` e `<!--reactive-end:id-->` delimitam regiões reativas no DOM

### Auto-tracking em Componentes com `renderComponent`

Para componentes que precisam de **re-renderização completa** quando qualquer estado muda, use `renderComponent()`:

```typescript
import { createState } from '@_bashell/slash'
import { renderComponent } from '@_bashell/slash/rendering/component-watch'

const firstName = createState('Alice')
const lastName = createState('Smith')

const UserProfile = () => {
  // Acessar estados durante renderização os rastreia automaticamente
  const first = firstName.get()
  const last = lastName.get()

  return html`
    <div>
      <h1>${first} ${last}</h1>
      <p>Full name has ${(first + ' ' + last).length} characters</p>
    </div>
  `
}

// renderComponent rastreia TODOS os estados acessados
const container = renderComponent(UserProfile, document.body)

// Quando QUALQUER estado muda, componente re-renderiza completamente
firstName.set('Bob')  // Re-renderiza UserProfile
lastName.set('Jones') // Re-renderiza UserProfile
```

**Como funciona `renderComponent`:**

1. **Context de Rastreamento**: Cria um contexto que monitora todos os `state.get()` chamados
2. **Primeira Renderização**: Executa o componente e registra quais estados foram acessados
3. **Watchers Automáticos**: Adiciona `watch()` em todos os estados acessados
4. **Re-renderização**: Quando qualquer estado muda, limpa o DOM anterior e re-executa o componente
5. **Cleanup**: Remove watchers quando o componente é destruído

**Implementação:** [src/rendering/component-watch.ts:27-108](../../src/rendering/component-watch.ts:27-108)

**Quando usar:**
- ✅ Componentes com lógica computacional que depende de múltiplos estados
- ✅ Componentes onde é difícil isolar partes reativas específicas
- ❌ Templates simples (use `html` diretamente para melhor performance)

### Tracking de Estados

Slash rastreia quais states um componente usa durante a renderização:

```typescript
const name = createState('Alice')
const age = createState(30)

const Profile = () => html`
  <div>
    <h1>${name}</h1>
    <p>Age: ${age}</p>
  </div>
`
```

- `name.set('Bob')` → Atualiza apenas o `<h1>`
- `age.set(31)` → Atualiza apenas o `<p>`

**Implementação:** [src/rendering/element-core.ts](../../src/rendering/element-core.ts:1)

### Reactive em Props

States também são reativos quando usados em props:

```typescript
const isActive = createState(false)

const Button = () => html`
  <button class=${isActive.get() ? 'active' : 'inactive'}>
    Toggle
  </button>
`

// Quando isActive muda, class é atualizada automaticamente
isActive.set(true)
```

### Reactive em Arrays

```typescript
const items = createState([1, 2, 3])

const List = () => html`
  <ul>
    ${items.get().map(item => html`<li>${item}</li>`)}
  </ul>
`

// Quando items muda, lista é re-renderizada
items.set([...items.get(), 4])
```

**Nota:** Para listas longas, considere técnicas de virtualização ou memoização.

## Deep Cloning e Imutabilidade

### Por que Imutabilidade?

Slash adota **imutabilidade** para:
1. **Previsibilidade**: Estado nunca muda "por baixo dos panos"
2. **Debugging**: Fácil rastrear mudanças
3. **Time-travel**: Histórico de estados é possível
4. **Performance**: Comparações por referência são rápidas

### Deep Clone Automático

`createState()` clona profundamente valores em:
- `set()`: Valor passado é clonado antes de armazenar
- `get()`: Valor retornado é um clone (não o original)

```typescript
const state = createState({ user: { name: 'Alice' } })

const obj1 = state.get()
obj1.user.name = 'Bob' // Mutação local (não afeta state)

console.log(state.get().user.name) // 'Alice' (state não mudou)
```

### Implementação do Deep Clone

**Functional Core:** [src/state-core.ts](../../src/state-core.ts:1)

```typescript
// Simplified version
function deepClone<T>(value: T): T {
  // Primitives
  if (value === null || typeof value !== 'object') {
    return value
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map(deepClone) as unknown as T
  }

  // Objects
  const cloned = {} as T
  for (const key in value) {
    if (value.hasOwnProperty(key)) {
      cloned[key] = deepClone(value[key])
    }
  }
  return cloned
}
```

**Otimizações:**
- WeakMap cache para evitar clonagens duplicadas
- Skip de propriedades não-enumeráveis
- Tratamento especial para Date, RegExp, Map, Set

### Deep Equality

Slash compara valores profundamente para decidir se deve notificar watchers:

```typescript
const state = createState({ count: 0 })

state.watch(() => console.log('Changed!'))

state.set({ count: 0 }) // Sem log (valor igual ao anterior)
state.set({ count: 1 }) // Log: "Changed!" (valor diferente)
```

**Implementação:** [src/state-core.ts](../../src/state-core.ts:1)

```typescript
// Simplified version
function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object') return false
  if (a === null || b === null) return false

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  return keysA.every(key =>
    deepEqual((a as any)[key], (b as any)[key])
  )
}
```

## State Options (History/Time-Travel Debugging)

### Habilitando Histórico

```typescript
const count = createState(0, { enableHistory: true })

count.set(1)
count.set(2)
count.set(3)

const history = count.getHistory!()
console.log(history.entries.length) // 3
```

### `getHistory()` - Obter Histórico

Retorna histórico de comandos e estados resultantes:

```typescript
interface StateHistory<T> {
  entries: ReadonlyArray<HistoryEntry<T>>
  maxSize: number
}

interface HistoryEntry<T> {
  timestamp: number
  command: StateCommand<T>
  resultingState: T
}
```

**Exemplo:**

```typescript
const count = createState(0, { enableHistory: true })

count.set(5)
count.set(10)

const history = count.getHistory!()

for (const entry of history.entries) {
  console.log({
    time: new Date(entry.timestamp),
    command: entry.command,
    result: entry.resultingState
  })
}
```

**Output:**
```
{
  time: 2026-02-03T10:30:45.123Z,
  command: { type: 'replace', value: 5 },
  result: 5
}
{
  time: 2026-02-03T10:30:46.456Z,
  command: { type: 'replace', value: 10 },
  result: 10
}
```

### `clearHistory()` - Limpar Histórico

Remove todos os entries do histórico:

```typescript
const state = createState(0, { enableHistory: true })

state.set(1)
state.set(2)
state.set(3)

console.log(state.getHistory!().entries.length) // 3

state.clearHistory!()

console.log(state.getHistory!().entries.length) // 0
```

### Configurando Tamanho Máximo

Limite o número de entries mantidos no histórico:

```typescript
const state = createState(0, {
  enableHistory: true,
  historyMaxSize: 50 // Mantém apenas últimos 50 comandos
})

// Após 100 comandos, apenas últimos 50 são mantidos
for (let i = 0; i < 100; i++) {
  state.set(i)
}

console.log(state.getHistory!().entries.length) // 50
```

**Comportamento:** FIFO (First-In-First-Out) - comandos mais antigos são removidos primeiro.

### Use Cases para Time-Travel

1. **Debugging**: Inspecionar sequência de mudanças
2. **Undo/Redo**: Implementar funcionalidade de desfazer
3. **Auditoria**: Rastrear alterações em dados críticos
4. **Replay**: Reproduzir sequência de ações

**Exemplo - Undo/Redo:**

```typescript
const editor = createState('', { enableHistory: true })

const undo = () => {
  const history = editor.getHistory!()
  const entries = history.entries

  if (entries.length > 1) {
    const previous = entries[entries.length - 2]
    editor.set(previous.resultingState)
  }
}

editor.set('Hello')
editor.set('Hello World')
editor.set('Hello World!')

console.log(editor.get()) // 'Hello World!'
undo()
console.log(editor.get()) // 'Hello World'
```

**Implementação:** [src/state-history.ts](../../src/state-history.ts:1)

### Performance Considerations

Time-travel tem overhead de memória. Use apenas quando necessário:

- **Desenvolvimento**: Habilite para debugging
- **Produção**: Desabilite para apps com muitos states
- **Seletivo**: Habilite apenas em states críticos

```typescript
// Dev mode
const isDevMode = process.env.NODE_ENV !== 'production'

const state = createState(initialValue, {
  enableHistory: isDevMode
})
```

## Exemplos Práticos

### Exemplo 1: Counter com Watch

```typescript
import { createState, html, render } from '@_bashell/slash'

const count = createState(0)

// Log todas as mudanças
count.watch((newValue) => {
  console.log(`Count changed to: ${newValue}`)
})

const Counter = () => html`
  <div>
    <p>Count: ${count}</p>
    <button onclick=${() => count.set(count.get() + 1)}>+</button>
    <button onclick=${() => count.set(count.get() - 1)}>-</button>
    <button onclick=${() => count.set(0)}>Reset</button>
  </div>
`

render(Counter(), '#app')
```

### Exemplo 2: Todo List com Estado Complexo

```typescript
import { createState, html, render } from '@_bashell/slash'

interface Todo {
  id: number
  text: string
  completed: boolean
}

const todos = createState<Todo[]>([])
const input = createState('')

const addTodo = () => {
  const text = input.get().trim()
  if (!text) return

  const newTodo: Todo = {
    id: Date.now(),
    text,
    completed: false
  }

  todos.set([...todos.get(), newTodo])
  input.set('')
}

const toggleTodo = (id: number) => {
  todos.set(
    todos.get().map(todo =>
      todo.id === id
        ? { ...todo, completed: !todo.completed }
        : todo
    )
  )
}

const TodoApp = () => html`
  <div>
    <h1>Todos</h1>
    <input
      type="text"
      value=${input}
      oninput=${(e: Event) => input.set((e.target as HTMLInputElement).value)}
      onkeypress=${(e: KeyboardEvent) => e.key === 'Enter' && addTodo()}
    />
    <button onclick=${addTodo}>Add</button>
    <ul>
      ${todos.get().map(todo => html`
        <li
          style=${{ textDecoration: todo.completed ? 'line-through' : 'none' }}
          onclick=${() => toggleTodo(todo.id)}
        >
          ${todo.text}
        </li>
      `)}
    </ul>
  </div>
`

render(TodoApp(), '#app')
```

### Exemplo 3: Form com Validação

```typescript
import { createState, html, render } from '@_bashell/slash'

interface FormData {
  email: string
  password: string
}

interface FormErrors {
  email?: string
  password?: string
}

const form = createState<FormData>({ email: '', password: '' })
const errors = createState<FormErrors>({})

const validate = (): boolean => {
  const data = form.get()
  const newErrors: FormErrors = {}

  if (!data.email.includes('@')) {
    newErrors.email = 'Invalid email'
  }

  if (data.password.length < 6) {
    newErrors.password = 'Password must be at least 6 characters'
  }

  errors.set(newErrors)
  return Object.keys(newErrors).length === 0
}

const handleSubmit = (e: Event) => {
  e.preventDefault()
  if (validate()) {
    console.log('Form submitted:', form.get())
  }
}

const LoginForm = () => html`
  <form onsubmit=${handleSubmit}>
    <div>
      <input
        type="email"
        placeholder="Email"
        value=${form.get().email}
        oninput=${(e: Event) =>
          form.set({ ...form.get(), email: (e.target as HTMLInputElement).value })
        }
      />
      ${errors.get().email && html`<p class="error">${errors.get().email}</p>`}
    </div>
    <div>
      <input
        type="password"
        placeholder="Password"
        value=${form.get().password}
        oninput=${(e: Event) =>
          form.set({ ...form.get(), password: (e.target as HTMLInputElement).value })
        }
      />
      ${errors.get().password && html`<p class="error">${errors.get().password}</p>`}
    </div>
    <button type="submit">Login</button>
  </form>
`

render(LoginForm(), '#app')
```

## Próximos Passos

Agora que você domina o sistema de estado, explore:

1. [Batch Updates](../05-batch/README.md) - Otimizar múltiplas atualizações de estado
2. [Componentes](../06-components/README.md) - Usar state em componentes reutilizáveis
3. [Router](../07-router/README.md) - State management para roteamento
