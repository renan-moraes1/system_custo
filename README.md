# KCA Financeiro

## Executar continuamente com PM2

Requisitos: Node.js 22.13 ou superior e dependências instaladas com `npm ci`.

Crie o arquivo `.dev.vars` na raiz do projeto e defina o código secreto do primeiro administrador:

```text
ADMIN_SETUP_TOKEN=troque-por-uma-chave-forte-com-24-ou-mais-caracteres
```

Na primeira instalação em uma base de dados vazia, compile, aplique as migrações e inicie a aplicação com um único comando:

```bash
npm run pm2:setup
```

Nas próximas inicializações ou depois de atualizar o código, use `npm run pm2:start`.

O processo `kca-financeiro` usa uma única instância, escuta em `0.0.0.0:3000`, preserva o banco em `.wrangler/state` e reinicia automaticamente se encerrar por falha.

Para restaurar o processo automaticamente depois de reiniciar a VPS:

```bash
npx pm2 startup
npm run pm2:save
```

O primeiro comando exibirá uma instrução adicional com `sudo`; execute essa instrução antes de salvar.

Comandos de operação:

```bash
npm run pm2:status
npm run pm2:logs
npm run pm2:restart
npm run pm2:stop
npm run pm2:remove
```

- `pm2:stop` interrompe a aplicação sem apagá-la da lista do PM2.
- `pm2:remove` encerra e remove a aplicação do PM2.
- Alterar `.dev.vars` exige `npm run pm2:restart` para carregar os novos valores.
- Para usar outra porta: `PORT=8080 npm run pm2:start`.
