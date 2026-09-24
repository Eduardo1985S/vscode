# JS Studio

**JS Studio** é uma distribuição enxuta do Code - OSS focada em **JavaScript e TypeScript**.

A proposta é simples: abrir o editor e programar no ecossistema JS/TS com o mínimo de distração possível.

## Princípios

- JavaScript e TypeScript como foco principal
- Tema Dracula como experiência padrão
- IntelliSense e snippets nativos
- Node.js, NPM, terminal, Git e depuração
- HTML, CSS e JSON como tecnologias de apoio ao desenvolvimento web
- Scratchpad local para testes rápidos
- Telemetria desativada
- Sem Copilot, chat de IA ou dependência de serviços de IA no produto

## O que foi removido ou reduzido

O fork remove extensões de linguagem que não fazem parte do objetivo central do JS Studio, como Java, C#, Python, PHP, C/C++, Go, Rust, Ruby e outras.

Alguns componentes do Code - OSS continuam presentes quando são necessários para o funcionamento do editor, do terminal, do Git, do depurador ou do ecossistema web.

## Snippets JS Studio

Além dos snippets já existentes no Code - OSS, o JS Studio inclui atalhos adicionais, entre eles:

- `clg` — `console.log()`
- `afn` — arrow function
- `fetchjson` — fetch + JSON
- `maparr` — `Array.map()`
- `filterarr` — `Array.filter()`
- `reducearr` — `Array.reduce()`
- `tryjs` — try/catch

Os snippets utilizam o mecanismo nativo do editor. Não há IA envolvida.

## Scratchpad

Use a Paleta de Comandos:

- **JS Studio: Abrir Scratchpad JS/TS**
- **JS Studio: Novo Scratchpad JS/TS**

O Scratchpad executa código localmente, suporta JavaScript e transpila TypeScript antes da execução. Em workspaces não confiáveis, a execução é bloqueada.

## Desenvolvimento

A versão de Node usada pelo projeto está definida em `.nvmrc`.

```bash
npm ci
npm run compile
```

Para executar a versão de desenvolvimento:

```bash
./scripts/code.sh
```

No Windows, use os scripts de desenvolvimento correspondentes do Code - OSS.

## Instalador para Windows

O workflow `.github/workflows/build-installer.yml` gera um instalador Windows x64.

Ele pode ser executado manualmente no GitHub Actions.

Tags no formato `v*` também criam uma release com o instalador gerado.

## Projeto base e licença

JS Studio é baseado no projeto open source **Code - OSS**, desenvolvido pela Microsoft e pela comunidade.

O código original do Code - OSS é distribuído sob a licença MIT. Este fork mantém os avisos de copyright e licença aplicáveis.

- Projeto upstream: https://github.com/microsoft/vscode
- Licença: [MIT](LICENSE.txt)

**JS Studio não é afiliado, endossado ou distribuído pela Microsoft.**
