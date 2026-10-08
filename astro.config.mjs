// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightThemeCatppuccin from 'starlight-theme-catppuccin';

// https://astro.build/config
export default defineConfig({
	site: 'https://slash.bashell.com.br',
	integrations: [
		starlight({
			title: 'Slash Documentation',
			description: 'Biblioteca reativa sem VDOM — htm + hyper + estado reativo com createState',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/bashell-rrocha/slash' }
			],
			plugins: [
				starlightThemeCatppuccin({
					flavor: 'mocha',
					accent: 'mauve'
				})
			],
			sidebar: [
				{
					label: 'Introdução',
					items: [
						{ label: 'Conceitos Core', slug: 'intro/conceitos-core' },
						{ label: 'Instalação e Setup', slug: 'intro/instalacao' },
					],
				},
				{
					label: 'Fundamentos',
					items: [
						{ label: 'Renderização Básica', slug: 'fundamentos/renderizacao' },
						{ label: 'Sistema de Estado', slug: 'fundamentos/estado' },
						{ label: 'Batch Updates', slug: 'fundamentos/batch' },
						{ label: 'Segurança', slug: 'fundamentos/seguranca' },
					],
				},
				{
					label: 'Componentes',
					items: [
						{ label: 'Conceitos', slug: 'componentes/conceitos' },
						{ label: 'Lifecycle e Cleanup', slug: 'componentes/lifecycle' },
					],
				},
				{
					label: 'Roteamento',
					items: [
						{ label: 'Conceitos', slug: 'roteamento/conceitos' },
						{ label: 'Navigation Guards', slug: 'roteamento/guards' },
					],
				},
				{
					label: 'Formulários',
					items: [
						{ label: 'Conceitos', slug: 'formularios/conceitos' },
					],
				},
				{
					label: 'Error Handling',
					items: [
						{ label: 'ErrorBoundary', slug: 'error-handling/error-boundary' },
					],
				},
				{
					label: 'Recursos Avançados',
					items: [
						{ label: 'Server-Side Rendering', slug: 'avancado/ssr' },
						{ label: 'Static Site Generation', slug: 'avancado/ssg' },
						{ label: 'Data Loading', slug: 'avancado/data-loading' },
						{ label: 'Hydration', slug: 'avancado/hydration' },
					],
				},
				{
					label: 'Exemplos Práticos',
					items: [
						{ label: 'Todo App (CSR)', slug: 'exemplos/todo-app' },
						{ label: 'Blog com SSR', slug: 'exemplos/blog-ssr' },
						{ label: 'SPA com Roteamento', slug: 'exemplos/spa-routing' },
						{ label: 'Form Validation', slug: 'exemplos/form-validation' },
						{ label: 'Data Fetching', slug: 'exemplos/data-fetching' },
					],
				},
				{
					label: 'Guias',
					items: [
						{ label: 'Developer Experience', slug: 'guias/dev-experience' },
						{ label: 'Performance', slug: 'guias/performance' },
					],
				},
				{
					label: 'Referência',
					items: [
						{ label: 'API Reference', slug: 'referencia/api' },
						{ label: 'Slash vs React', slug: 'referencia/slash-vs-react' },
						{ label: 'Slash vs Vue', slug: 'referencia/slash-vs-vue' },
						{ label: 'Slash vs Solid', slug: 'referencia/slash-vs-solid' },
						{ label: 'Migração e Integração', slug: 'referencia/migracao' },
					],
				},
			],
		}),
	],
});
