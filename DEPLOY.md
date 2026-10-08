# Deploy da Documentação Slash para Cloudflare Pages

## Pré-requisitos

1. **Conta Cloudflare** (gratuita)
   - Acesse: https://dash.cloudflare.com/sign-up
   - Crie sua conta se ainda não tiver

2. **API Token do Cloudflare**
   - Acesse: https://dash.cloudflare.com/profile/api-tokens
   - Clique em "Create Token"
   - Use o template "Edit Cloudflare Workers"
   - Ou crie um custom token com permissões:
     - Account > Cloudflare Pages > Edit

## Primeira vez - Autenticação

Execute o comando de login (só precisa fazer uma vez):

```bash
bunx wrangler login
```

Isso abrirá o navegador para você autorizar o acesso.

## Deploy

### Opção 1: Via Script (Recomendado)

```bash
cd packages/doc
bun run deploy
```

### Opção 2: Manual

```bash
cd packages/doc
bun run build
bunx wrangler pages deploy dist --project-name=slash-docs
```

## Primeira execução

Na primeira execução, o Wrangler vai:
1. Criar o projeto "slash-docs" automaticamente
2. Fazer o deploy inicial
3. Te dar uma URL tipo: `https://slash-docs.pages.dev`

## Configurar Custom Domain (ezbug.dev)

Após o primeiro deploy:

### 1. No Cloudflare Dashboard

1. Acesse: https://dash.cloudflare.com
2. Vá em **Workers & Pages** > **slash-docs**
3. Clique na aba **Custom domains**
4. Clique em **Set up a custom domain**
5. Digite: `slash.ezbug.dev`
6. Cloudflare vai te mostrar os registros DNS necessários

### 2. No Google Workspace (Admin Console)

1. Acesse: https://admin.google.com
2. Vá em **Domains** > **Manage domains**
3. Clique em **ezbug.dev**
4. Vá em **DNS** > **Custom resource records**
5. Adicione o registro CNAME:
   ```
   Name:   slash
   Type:   CNAME
   TTL:    3600
   Data:   slash-docs.pages.dev
   ```

### 3. Aguarde propagação DNS

- Pode levar de 5 minutos a 48 horas (geralmente ~15 minutos)
- Teste com: `dig slash.ezbug.dev`
- O SSL será provisionado automaticamente pelo Cloudflare

## Deploy automático via Git (Opcional)

Para deploy automático a cada push:

1. No Cloudflare Dashboard:
   - Workers & Pages > slash-docs > Settings
   - Connect to Git
   - Conecte seu repositório GitHub
   - Configure:
     ```
     Build command:    bun run build
     Build directory:  packages/doc
     Output directory: dist
     ```

2. Cada push na branch principal fará deploy automático

## Verificar deploy

Após deploy bem-sucedido:
- URL temporária: https://slash-docs.pages.dev
- URL custom (após DNS): https://slash.ezbug.dev

## Troubleshooting

### Erro de autenticação
```bash
bunx wrangler login
```

### Ver logs do projeto
```bash
bunx wrangler pages deployment list --project-name=slash-docs
```

### Deploy específico de uma branch
```bash
bunx wrangler pages deploy dist --project-name=slash-docs --branch=main
```
