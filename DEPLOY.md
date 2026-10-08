# Deploy da Documentação Slash para Cloudflare Pages

## Deploy automático (padrão)

O workflow `.github/workflows/deploy.yml` publica o site no projeto `slash-docs` do Cloudflare Pages (conta bashell, `https://slash-docs-59t.pages.dev`)
sempre que a `main` recebe um push (git flow: `release/x.y.z` -> `main`). Também pode ser disparado
manualmente em **Actions → deploy → Run workflow**.

Ele precisa de dois secrets no repositório (configuração única):

```bash
gh secret set CLOUDFLARE_API_TOKEN -R bashell-rrocha/slash-doc   # token com Account > Cloudflare Pages > Edit
gh secret set CLOUDFLARE_ACCOUNT_ID -R bashell-rrocha/slash-doc  # ID da conta (Workers & Pages, coluna da direita)
```

As dependências são instaladas com `bun install --frozen-lockfile` a partir do `bun.lock` deste repositório.
Ao mudar dependências, rode `bun install` aqui e faça commit do `bun.lock`.

O restante deste documento descreve o deploy manual (pela sua máquina), útil como alternativa.

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
3. Te dar uma URL tipo: `https://slash-docs-59t.pages.dev`

## Configurar Custom Domain (bashell.com.br)

Após o primeiro deploy:

### 1. No Cloudflare Dashboard

1. Acesse: https://dash.cloudflare.com
2. Vá em **Workers & Pages** > **slash-docs**
3. Clique na aba **Custom domains**
4. Clique em **Set up a custom domain**
5. Digite: `slash.bashell.com.br`
6. Cloudflare vai te mostrar os registros DNS necessários

### 2. No Google Workspace (Admin Console)

1. Acesse: https://admin.google.com
2. Vá em **Domains** > **Manage domains**
3. Clique em **bashell.com.br**
4. Vá em **DNS** > **Custom resource records**
5. Adicione o registro CNAME:
   ```
   Name:   slash
   Type:   CNAME
   TTL:    3600
   Data:   slash-docs-59t.pages.dev
   ```

### 3. Aguarde propagação DNS

- Pode levar de 5 minutos a 48 horas (geralmente ~15 minutos)
- Teste com: `dig slash.bashell.com.br`
- O SSL será provisionado automaticamente pelo Cloudflare

## Verificar deploy

Após deploy bem-sucedido:
- URL temporária: https://slash-docs-59t.pages.dev
- URL custom (após DNS): https://slash.bashell.com.br

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
