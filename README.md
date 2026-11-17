# Calculadora de Obras

Levantamento de quantitativos de materiais de construção. Uso pessoal, sem login, sem banco de dados e sem histórico.

## Executar localmente
```
npm install
npm run dev
```
Outros comandos: `npm run typecheck`, `npm test`, `npm run build`.

## Publicar
1. Crie um repositório no GitHub e envie o código (`git push origin main`).
2. Na Vercel: Add New → Project → importe o repositório. O `vercel.json` já define build, saída (`dist`) e rotas SPA.
3. Variáveis de ambiente (Sprint 2): copie os nomes de `.env.example` e preencha em Project Settings → Environment Variables. Nunca versione chaves.
4. Cada push na `main` gera um novo deploy automático; acompanhe na aba Deployments. Em caso de erro, abra o log de build e rode `npm run build` localmente.

## Status
Módulo de licitações (Sprint 3: movimentações e saldos; Sprint 2: importação de Excel/CSV com conferência e duplicidades; Sprint 1: cadastro de processos e materiais, painel, filtros, IndexedDB). Implementado (v16 inclui escadas em L, em U e em leque; v15 inclui tipo de fundação, drywall/gesso, telha metálica, estrutura metálica e de madeira; v14 inclui laje pré-moldada, fossa e sumidouro, piscina; v13 inclui esquadrias, muro, calçada e escada; v12 inclui vergas, laje, formas, escoramento, impermeabilização, transporte, cal, fixação do telhado e opções de bloco/telha/piso; v11 inclui telhado de 4 águas e espigões; v10 inclui composições próprias e preços no Excel; v9 inclui o assistente de perguntas dinâmicas): cadastro, motor de cálculo (terreno, fundação, estrutura, alvenaria, piso e acessórios, revestimentos, forro, pintura completa, cobertura com calhas e rufos, instalações elétricas e hidráulicas por pontos, drenagem), leitor de plantas por IA, Excel, PDF, orçamento opcional e backup JSON.

## Leitor de plantas (IA)
A rota `api/ler-planta.ts` (função serverless da Vercel) chama a API da Anthropic. Configure em Project Settings → Environment Variables:
`ANTHROPIC_API_KEY` (obrigatória) e `ANTHROPIC_MODEL` (opcional). A chave nunca vai ao navegador. Há limite de 10 leituras/hora por IP e o uso pode gerar custos.
Localmente, use `npx vercel dev` com um arquivo `.env.local` para testar o leitor (com `npm run dev` só a interface sobe). Sem a chave, o leitor mostra um aviso e o cálculo manual segue funcionando.

## Leitura de PDF e fotos de atas/contratos (módulo de licitações)
A rota `api/ler-licitacao.ts` usa a mesma `ANTHROPIC_API_KEY` do leitor de plantas. O PDF é dividido no navegador em blocos de 4 páginas (máx. 60 páginas por importação), cada bloco é lido pela IA e tudo vai para a tela de conferência antes de cadastrar. Há limite de 60 requisições/hora por IP e o uso pode gerar custos.
