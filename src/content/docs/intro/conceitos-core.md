---
title: Introdução e Conceitos Core
description: Entenda a filosofia e arquitetura do Slash
---


## O que é Slash?

Slash é uma biblioteca reativa moderna para construção de interfaces de usuário que elimina a necessidade de um Virtual DOM (VDOM). A biblioteca combina três paradigmas principais:

- **HTM** (Hyperscript Tagged Markup): Template strings para JSX-like syntax sem compilação
- **Hyperscript**: Criação programática de elementos DOM
- **Reactive State**: Sistema de reatividade baseado em Observer Pattern para atualizações eficientes

### Por que Slash?

Diferente de bibliotecas tradicionais como React ou Vue, Slash não utiliza Virtual DOM para gerenciar atualizações da interface. Em vez disso, usa um sistema de **estado reativo baseado em Observer Pattern**: componentes que leem um state com `get()` re-renderizam quando ele muda, substituindo seus nós no DOM.

**Vantagens:**
- Zero overhead de diffing do VDOM
- Atualizações DOM precisas e performáticas
- Bundle size reduzido
- Renderização server-side (SSR) nativa
- TypeScript first-class support
- API minimalista e intuitiva

## Filosofia: htm + hyperscript + reactive state

### HTM (Hyperscript Tagged Markup)

Slash utiliza a biblioteca [htm](https://github.com/developit/htm) para permitir sintaxe JSX-like sem necessidade de transpilação:

```typescript
import { html } from '@_bashell/slash'

const element = html`
  <div class="container">
    <h1>Hello, Slash!</h1>
    <p>No build step required</p>
  </div>
`
```

### Hyperscript

Para quem prefere uma abordagem programática, a função `h()` está disponível:

```typescript
import { h } from '@_bashell/slash'

const element = h('div', { class: 'container' },
  h('h1', null, 'Hello, Slash!'),
  h('p', null, 'Programmatic approach')
)
```

### Reactive State

O coração do Slash é seu sistema de estado reativo baseado em Observer Pattern:

```typescript
import { createState, html, render } from '@_bashell/slash'

// O state fica fora do componente: se fosse criado dentro, seria recriado a cada render
const count = createState(0)

const Counter = () => html`
  <div>
    <p>Count: ${count.get()}</p>
    <button onClick=${() => count.set(count.get() + 1)}>
      Increment
    </button>
  </div>
`

// Monte como <${Counter} />. render(Counter(), '#app') renderiza uma vez, sem reatividade
render(html`<${Counter} />`, '#app')
```

Quando `count.set()` é chamado, os componentes que leram `count.get()` durante a renderização **re-renderizam**: seus nós anteriores são substituídos pelos novos. A granularidade é o componente, não o nó, e não há Virtual DOM nem diff. Passar o próprio state na interpolação (`${count}`) não é reativo: use `${count.get()}` dentro de um componente.

**Arquitetura de Reatividade:** O Slash utiliza `createState()` que retorna objetos `State<T>` com métodos `get()`, `set()` e `watch()`. Esta abordagem combina:
- **Auto-tracking**: chamadas a `state.get()` feitas enquanto um componente executa registram o state como dependência dele, e o componente re-renderiza quando o state muda
- **Imutabilidade**: Deep cloning garante que o estado nunca seja mutado acidentalmente
- **FCIS Pattern**: Lógica pura em `state-core.ts`, side effects em `state.ts`
- **Batching**: Múltiplas atualizações podem ser agrupadas com `batch()` para uma única notificação
- **Duck typing**: objetos com `get()` e `subscribe()` (como o `Router`) são reativos como child ou prop. Um `State` tem `get()` e `watch()`, não `subscribe()`, e por isso não é reativo quando interpolado diretamente

## Quando usar Slash?

### Casos de Uso Ideais

- **SPAs (Single Page Applications)**: Roteamento integrado e gerenciamento de estado
- **SSR Applications**: Suporte nativo para renderização server-side com hidratação
- **Progressive Enhancement**: HTML do servidor visível antes do JS; o cliente o substitui por uma renderização nova
- **Aplicações com foco em performance**: Quando bundle size e velocidade são críticos
- **Projetos TypeScript**: Type safety completo em toda a API

### Quando considerar alternativas

- **Ecossistema massivo**: React tem mais bibliotecas e componentes prontos
- **Equipe familiarizada com outras libs**: Curva de aprendizado pode impactar produtividade inicial
- **Requisitos de compatibilidade**: Integração com bibliotecas que dependem de React/Vue

### Comparação rápida

| Característica | Slash | React | Vue | Solid |
|----------------|-------|-------|-----|-------|
| VDOM | ❌ | ✅ | ✅ | ❌ |
| Reatividade | createState + Auto-tracking | Hooks/VDOM | Reactivity API | Fine-grained Signals |
| SSR Nativo | ✅ | ✅ | ✅ | ✅ |
| JSX sem build | ✅ (htm) | ❌ | ❌ | ❌ |
| Bundle size | ~10KB | ~45KB | ~35KB | ~7KB |
| TypeScript | ✅ | ✅ | ✅ | ✅ |
| Imutabilidade | ✅ (deep clone) | ❌ | ❌ | ❌ |
| FCIS Pattern | ✅ | ❌ | ❌ | ❌ |

## Requisitos Mínimos

### Runtime

- **Node.js**: 18+ (para SSR)
- **Bun**: 1.0+ (recomendado)
- **Browsers**: ES2022+ (Chrome 94+, Firefox 93+, Safari 15+)

### Dependências

Slash tem **apenas uma dependência**:
- `htm` (^3.1.1): Para template strings

### TypeScript

- TypeScript 5.0+
- Configuração recomendada: `strict: true`, `target: "ES2022"`

### Build Tools (opcional)

Slash funciona sem build step, mas pode ser usado com:
- Vite
- Bun build
- esbuild
- Webpack
- Rollup

## Arquitetura: FCIS (Functional Core, Imperative Shell)

Slash segue o padrão **Functional Core, Imperative Shell** para separar lógica pura de side effects:

### Functional Core

Módulos com sufixo `-core.ts` contêm **lógica pura**:
- Sem side effects
- Funções determinísticas
- Fácil de testar
- Facilita raciocínio sobre o código

Exemplo: [state-core.ts](../../src/state-core.ts:1)
```typescript
// Pure function - no side effects
export function deepClone<T>(value: T): T {
  // Implementação pura de clonagem
}

// Pure decision function
export function shouldNotifyWatchers<T>(
  oldValue: T,
  newValue: T
): boolean {
  return !deepEqual(oldValue, newValue)
}
```

### Imperative Shell

Módulos sem sufixo `-core` contêm **side effects**:
- Gerenciamento de estado
- DOM manipulation
- Event handling
- API calls

Exemplo: [state.ts](../../src/state.ts:1)
```typescript
// Imperative shell - manages side effects
export function createState<T>(
  initialValue: T,
  options?: StateOptions
): State<T> {
  let currentValue = initialValue
  const watchers = new Set<StateWatcher<T>>()

  return {
    get: () => currentValue,
    set: (newValue) => {
      // Side effect: notify watchers
      watchers.forEach(watcher => watcher(newValue))
    },
    watch: (callback) => {
      watchers.add(callback)
      return () => watchers.delete(callback)
    }
  }
}
```

### Benefícios do FCIS

1. **Testabilidade**: Functional cores são triviais de testar
2. **Manutenibilidade**: Lógica de negócio isolada de side effects
3. **Previsibilidade**: Funções puras são determinísticas
4. **Reutilização**: Cores podem ser usados em diferentes contextos

## Próximos Passos

Agora que você entende os conceitos fundamentais, explore:

1. [Instalação e Setup](../02-installation/README.md) - Como começar a usar Slash
2. [Renderização Básica](../03-rendering/README.md) - Aprenda a criar elementos e renderizar na página
3. [Sistema de Estado](../04-state/README.md) - Mergulhe fundo no state management reativo
