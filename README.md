# KCA Financeiro

## VPS AlmaLinux 8: executar com Docker

O AlmaLinux 8 usa glibc 2.28, mas as versões atuais do `workerd`/Wrangler precisam de glibc 2.35 ou superior. Nesta VPS, use o container definido em `compose.yaml`: ele usa Node.js 22 sobre Debian Bookworm e não altera a glibc nem os processos PM2 do servidor.

Crie o arquivo de configuração antes de iniciar:

```bash
cp .dev.vars.example .dev.vars
nano .dev.vars
```

Mantenha a aplicação na porta 3001 e informe uma chave secreta forte:

```text
KCA_PORT=3001
ADMIN_SETUP_TOKEN=troque-por-uma-chave-forte-com-24-ou-mais-caracteres
```

Compile, aplique as migrações e mantenha o serviço em execução:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 kca-financeiro
```

O Docker Compose lê `.dev.vars` e injeta essas variáveis diretamente no container, sem montar o arquivo de segredos. O container executa o PM2 em modo próprio para containers e possui a política `restart: unless-stopped`. Depois de uma falha ou reinicialização da VPS, ele volta automaticamente. A aplicação fica disponível somente em `127.0.0.1:3001`, sem conflito com as aplicações das portas 3000 e 6005.

O banco local é preservado no volume Docker `kca_financeiro_d1_data`. Não remova esse volume durante atualizações. Para atualizar o código:

```bash
git pull
docker compose up -d --build
docker compose logs --tail=100 kca-financeiro
```

Para parar somente este sistema:

```bash
docker compose stop kca-financeiro
```

Para iniciá-lo novamente:

```bash
docker compose start kca-financeiro
```

Não execute `docker compose down -v`, pois a opção `-v` remove o volume que contém o banco de dados.

## Executar continuamente com PM2

Esta opção é destinada a sistemas que já tenham glibc 2.35 ou superior. No AlmaLinux 8, use o procedimento com Docker acima.

Requisitos: Node.js 22.13 ou superior e dependências instaladas com `npm ci`. Com NVM, execute `nvm install` e `nvm use` na raiz do projeto para carregar a versão definida em `.nvmrc`.

Copie `.dev.vars.example` para `.dev.vars` e defina o código secreto do primeiro administrador. Como as portas 3000 e 6005 já estão ocupadas na VPS, mantenha a KCA na porta 3001:

```text
KCA_PORT=3001
ADMIN_SETUP_TOKEN=troque-por-uma-chave-forte-com-24-ou-mais-caracteres
```

Na primeira instalação em uma base de dados vazia, compile, aplique as migrações e inicie a aplicação com um único comando:

```bash
npm run pm2:setup
```

Nas próximas inicializações, use `npm run pm2:start`. Depois de atualizar o código, use `npm run pm2:update`; no Windows, esse comando libera os arquivos antes da nova compilação.

O processo `kca-financeiro` usa uma única instância, carrega a porta e a chave diretamente de `.dev.vars`, escuta em `0.0.0.0:3001` na VPS, preserva o banco em `.wrangler/state` e reinicia automaticamente se encerrar por falha.

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
npm run pm2:update
npm run pm2:restart
npm run pm2:stop
npm run pm2:remove
```

- `pm2:stop` interrompe a aplicação sem apagá-la da lista do PM2.
- `pm2:remove` encerra e remove a aplicação do PM2.
- Alterar `.dev.vars` exige `npm run pm2:restart` para carregar os novos valores.
- Para trocar a porta permanentemente, altere `KCA_PORT` no arquivo `.dev.vars` e execute `npm run pm2:update`.
