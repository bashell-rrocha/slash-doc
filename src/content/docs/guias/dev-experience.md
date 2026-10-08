---
title: Developer Experience
description: Ferramentas e configurações para desenvolvimento
---

Slash oferece ferramentas para melhorar a experiência de desenvolvimento, incluindo warnings automáticos, mensagens de erro detalhadas e controle sobre o comportamento em dev/produção.

## Dev Mode

Por padrão, Slash detecta automaticamente se está em modo de desenvolvimento baseado em `process.env.NODE_ENV`:

```typescript
import { isDevMode } from '@_bashell/slash'

console.log(isDevMode()) // true em dev, false em produção
```

### Configurando Dev Mode

Você pode controlar manualmente o dev mode:

```typescript
import { setDevMode, isDevMode } from '@_bashell/slash'

// Desabilitar dev mode manualmente
setDevMode(false)
console.log(isDevMode()) // false

// Habilitar dev mode
setDevMode(true)
console.log(isDevMode()) // true
```

**Quando usar:**
- Em testes: desabilitar warnings para testes limpos
- Em produção: garantir que dev mode está desabilitado
- Em staging: habilitar warnings mesmo em build de produção

## Warnings Automáticos

Em dev mode, Slash emite warnings úteis no console quando detecta problemas:

### Tipos de Warnings

**1. Props inválidas:**
```typescript
import { html } from '@_bashell/slash'

// ⚠️ Warning: Unknown prop "onclick" (should be "onClick")
html`<button onclick=${() => {}}>Click</button>`

// ✅ Correto
html`<button onClick=${() => {}}>Click</button>`
```

**2. State mutations:**
```typescript
import { createState } from '@_bashell/slash'

const state = createState({ count: 0 })

// ⚠️ Warning: Não modifique o estado diretamente
state.get().count++ // Mutação direta

// ✅ Correto
state.set({ count: state.get().count + 1 })
```

**3. Memory leaks potenciais:**
```typescript
// ⚠️ Warning: Watcher não foi removido (memory leak)
const state = createState(0)
state.watch(() => {
  // ... sem cleanup
})

// ✅ Correto: sempre limpe watchers
const unwatch = state.watch(() => {
  // ...
})
// Quando não precisar mais:
unwatch()
```

### Controlando Warnings

Você pode habilitar ou desabilitar warnings:

```typescript
import { setWarningsEnabled, isWarningsEnabled } from '@_bashell/slash'

// Desabilitar warnings
setWarningsEnabled(false)
console.log(isWarningsEnabled()) // false

// Habilitar warnings novamente
setWarningsEnabled(true)
console.log(isWarningsEnabled()) // true
```

**Casos de uso:**
```typescript
// Em testes: desabilitar warnings temporariamente
beforeEach(() => {
  setWarningsEnabled(false)
})

afterEach(() => {
  setWarningsEnabled(true)
})

// Em CI: garantir que warnings não quebrem builds
if (process.env.CI) {
  setWarningsEnabled(false)
}
```

## Error Messages

### Throw em Erros

Por padrão, erros são apenas logados no console. Você pode fazer Slash lançar exceções:

```typescript
import { setErrorsThrow } from '@_bashell/slash'

// Fazer erros lançarem exceções
setErrorsThrow(true)

try {
  // Código que pode gerar erro
  const state = createState(null)
  state.set(undefined) // Lança Error
} catch (error) {
  console.error('Caught:', error)
}

// Voltar ao comportamento padrão (apenas log)
setErrorsThrow(false)
```

**Quando usar:**
- **Testes**: capturar erros esperados
- **Debug**: parar execução em erros críticos
- **Produção**: deixar false (default) para não quebrar a aplicação

### Mensagens de Erro Detalhadas

Em dev mode, mensagens de erro incluem:
- **Stack trace** completo
- **Contexto** do erro (qual state/component)
- **Sugestões** de correção

**Exemplo de mensagem:**
```
❌ [Slash Error] Invalid state update

Context: state "userForm" (line 42 in UserForm.ts)
Problem: Attempted to set undefined value
Suggestion: Use null instead of undefined, or provide a default value

Stack trace:
  at setState (state.ts:66)
  at UserForm (UserForm.ts:42)
  ...
```

## TypeScript Support

Slash é escrito em TypeScript e oferece tipos completos para toda a API.

### Tipos Automáticos

```typescript
import { createState, html } from '@_bashell/slash'
import type { State, Props } from '@_bashell/slash'

// Type inference automático
const count = createState(0) // State<number>
const name = createState('Alice') // State<string>

// Props tipadas
interface ButtonProps extends Props {
  label: string
  onClick: () => void
  disabled?: boolean
}

const Button = ({ label, onClick, disabled = false }: ButtonProps) => {
  return html`
    <button onClick=${onClick} disabled=${disabled}>
      ${label}
    </button>
  `
}
```

### Tipos Genéricos

```typescript
import { createState } from '@_bashell/slash'
import type { State } from '@_bashell/slash'

interface User {
  id: number
  name: string
  email: string
}

// State tipado
const user: State<User | null> = createState<User | null>(null)

// Autocomplete funciona
user.set({
  id: 1,
  name: 'Alice', // TypeScript valida as props
  email: 'alice@example.com'
})

// ❌ TypeScript error: Property 'age' does not exist
user.set({ id: 1, name: 'Bob', age: 30 })
```

### Strict Mode

Para máxima type safety, use strict mode no `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

## Debugging Tools

### Inspecionando State

```typescript
import { createState } from '@_bashell/slash'

const state = createState({ count: 0, items: [] })

// Ver valor atual
console.log('Current state:', state.get())

// Watch todas as mudanças
state.watch((value) => {
  console.log('State changed:', value)
})

// Debug com stack trace
state.watch((value) => {
  console.trace('State changed from:', value)
})
```

### DevTools Integration

Slash pode integrar com Redux DevTools para time-travel debugging:

```typescript
import { createState } from '@_bashell/slash'

const state = createState(0, {
  history: true, // Habilita histórico
  maxHistory: 50 // Máximo de estados salvos
})

// Acesse histórico
console.log(state.history) // [0, 1, 2, 3, ...]

// Time-travel
state.undo() // Volta para estado anterior
state.redo() // Avança para próximo estado
```

### Console Helpers

```typescript
// Adicione helpers globais para debug
if (process.env.NODE_ENV === 'development') {
  window.__SLASH_DEBUG__ = {
    states: new Map(),
    logAll: () => {
      window.__SLASH_DEBUG__.states.forEach((state, name) => {
        console.log(`${name}:`, state.get())
      })
    }
  }

  // Registrar states para inspeção
  const count = createState(0)
  window.__SLASH_DEBUG__.states.set('count', count)
}
```

## Performance Profiling

### Medindo Renders

```typescript
import { html, render } from '@_bashell/slash'

const Component = () => {
  console.time('render')
  const result = html`<div>Heavy component</div>`
  console.timeEnd('render')
  return result
}

render(html`<${Component} />`, '#app')
```

### Performance Marks

```typescript
import { createState } from '@_bashell/slash'

const state = createState(0)

state.watch(() => {
  performance.mark('state-update-start')

  // ... operações custosas

  performance.mark('state-update-end')
  performance.measure('state-update', 'state-update-start', 'state-update-end')
})

// Ver medições
const measures = performance.getEntriesByType('measure')
console.table(measures)
```

## Environment Detection

### isServer()

Detecte se o código está rodando no servidor (SSR) ou cliente:

```typescript
import { isServer } from '@_bashell/slash'

if (isServer()) {
  // Código apenas no servidor
  console.log('Running on server')
} else {
  // Código apenas no cliente
  console.log('Running on client')
  window.addEventListener('click', () => {})
}
```

**Uso em componentes:**
```typescript
import { isServer, html } from '@_bashell/slash'

const Component = () => {
  const clientOnly = isServer()
    ? null
    : html`<div>Client-side only content</div>`

  return html`
    <div>
      <h1>Universal content</h1>
      ${clientOnly}
    </div>
  `
}
```

## Build Optimization

### Production Builds

Em produção, certifique-se de:

1. **Desabilitar dev mode:**
```typescript
import { setDevMode } from '@_bashell/slash'

if (process.env.NODE_ENV === 'production') {
  setDevMode(false)
}
```

2. **Tree-shaking:**
Ferramentas de build modernas (Vite, Webpack, Rollup) removem automaticamente código de dev:

```typescript
// Este código é removido em produção
if (process.env.NODE_ENV === 'development') {
  console.log('Debug info')
}
```

3. **Minificação:**
```bash
# Vite
bun run build

# Output minificado: dist/assets/index-abc123.js
```

### Bundle Size

O repositório mede o tamanho de um app mínimo (`createState` + `html` + `render`, minificado) com `bun test scripts/bundle-size.test.ts` no pacote core. Resultado medido na versão atual: **5,12 KB gzip** e 4,48 KB brotli. O tamanho real do seu build depende do que você importa (router, forms, SSR) e não foi medido por parte aqui. Não há medições de outras bibliotecas no repositório.

## Configuração Recomendada

Para melhor DX em desenvolvimento:

```typescript
// src/config/dev.ts
import {
  setDevMode,
  setWarningsEnabled,
  setErrorsThrow
} from '@_bashell/slash'

export const setupDev = () => {
  const isDev = process.env.NODE_ENV === 'development'
  const isTest = process.env.NODE_ENV === 'test'

  // Dev mode
  setDevMode(isDev)

  // Warnings (desabilitar em testes)
  setWarningsEnabled(isDev && !isTest)

  // Throw errors apenas em testes
  setErrorsThrow(isTest)

  // Console helpers
  if (isDev) {
    window.__SLASH_DEBUG__ = {
      version: '1.0.0',
      isDev: true
    }
  }
}
```

**Uso:**
```typescript
// src/main.ts
import { setupDev } from './config/dev'

setupDev()

// ... resto da aplicação
```

## Próximos Passos

- [Performance](/guias/performance/) - Otimizações e best practices
- [API Reference](/referencia/api/) - Documentação completa da API
- [Exemplos](/guias/exemplos/) - Aplicações práticas
