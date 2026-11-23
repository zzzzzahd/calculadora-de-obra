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
Traços e aditivos pré-definidos, perguntas Sim/Não e botões de voltar (v23). Módulo de licitações (Sprint 3: movimentações e saldos; Sprint 2: importação de Excel/CSV com conferência e duplicidades; Sprint 1: cadastro de processos e materiais, painel, filtros, IndexedDB). Implementado (v16 inclui escadas em L, em U e em leque; v15 inclui tipo de fundação, drywall/gesso, telha metálica, estrutura metálica e de madeira; v14 inclui laje pré-moldada, fossa e sumidouro, piscina; v13 inclui esquadrias, muro, calçada e escada; v12 inclui vergas, laje, formas, escoramento, impermeabilização, transporte, cal, fixação do telhado e opções de bloco/telha/piso; v11 inclui telhado de 4 águas e espigões; v10 inclui composições próprias e preços no Excel; v9 inclui o assistente de perguntas dinâmicas): cadastro, motor de cálculo (terreno, fundação, estrutura, alvenaria, piso e acessórios, revestimentos, forro, pintura completa, cobertura com calhas e rufos, instalações elétricas e hidráulicas por pontos, drenagem), leitor de plantas por IA, Excel, PDF, orçamento opcional e backup JSON.

Cadastro central de ambientes (v25, Sprint 1 · tarefa 1 e base da tarefa 2): cada ambiente guarda tipo, pé-direito, lados externos ou compartilhados com outro ambiente, portas e janelas (com lado), piso, revestimento das paredes internas, forro e origem dos dados. O módulo `src/lib/paredes.ts` resolve tudo isso e o motor lê dele: a parede compartilhada entra uma vez na alvenaria, as faces internas e externas são separadas (revestimento e pintura) e as aberturas descontam de acordo com o lado. Campos ausentes mantêm o comportamento do v24 (conferido por `src/lib/golden.test.ts`, que compara a saída completa com a do v24). Levantamento preliminar: as dimensões dos ambientes são internas e a espessura das paredes não entra.

Ações por elemento (v26, Sprint 1 · tarefa 3): cada ambiente indica o que será feito com as paredes, o revestimento e pintura, o contrapiso e piso e o forro, e cada porta ou janela e cada parede compartilhada também têm a sua ação: construir (padrão), manter, substituir, demolir, recuperar ou reaproveitar. Só construir e substituir calculam material novo. Demolir e substituir geram a etapa "Demolição e entulho" (áreas; o volume de entulho e as viagens só são calculados se as espessuras forem informadas em Parâmetros, e nenhuma espessura é assumida). Recuperar e reaproveitar aparecem na etapa "Recuperação e reaproveitamento", sem material novo. Se dois ambientes têm ações diferentes para a parede que dividem, vale construir e há aviso, até a ação ser definida no lado compartilhado.

Assistente em texto livre (v27, Sprint 1 · tarefa 4): no menu, "Descrever a obra com palavras". A IA (função `api/assistente-obra.ts`, com código de acesso, limite por hora e chave só no servidor) apenas extrai os fatos do texto para um JSON validado por `src/lib/descricao.ts`; quem decide as perguntas, as contradições e o cálculo é o código do app. As perguntas são feitas uma por vez, na ordem, sem repetir (cada pergunta respondida ou pulada com "não sei" fica registrada), com a explicação dos termos técnicos. Valor diferente do já informado, ou combinações que não podem valer juntas (ex.: sem elétrica, mas com pontos elétricos), viram uma pergunta de conflito e nada é sobrescrito em silêncio. Nada é inventado: o que não foi dito fica em branco e aparece em "Em aberto" e no aviso do levantamento. Resposta de números, sim/não e escolhas é interpretada no navegador, sem IA; só textos livres usam a IA.

Motor modular (v28, Sprint 2): o `engine.ts` (antes uma função de cerca de 500 linhas) virou uma fachada de 71 linhas. Os parâmetros ficam em `src/lib/params.ts`; o contexto compartilhado (levantamento resolvido, acumulador de itens, ajudantes de concreto e forma) em `src/lib/motor/contexto.ts`; e cada etapa é uma função em `src/lib/motor/<etapa>.ts` que recebe o contexto e acrescenta itens, chamadas por `calcular` na ordem de sempre. A lista de campos da tela de Quantitativos foi para `src/lib/campos.ts` (com teste: parâmetro novo sem campo na tela faz o teste falhar). A refatoração não muda nenhum resultado: `src/lib/golden.test.ts` compara 120 cenários pseudoaleatórios (todas as etapas) com hashes gerados a partir do motor do v24, bit a bit, mais os 5 cenários legíveis em `__golden__/v24.json`. Para adicionar uma etapa: crie `motor/<etapa>.ts`, chame-a em `calcular` e, se tiver parâmetros novos, acrescente-os em `params.ts` e `campos.ts`.

## Leitor de plantas (IA)
A rota `api/ler-planta.ts` (função serverless da Vercel) chama a API da Anthropic. Configure em Project Settings → Environment Variables:
`ANTHROPIC_API_KEY` (obrigatória) e `ANTHROPIC_MODEL` (opcional). A chave nunca vai ao navegador. Há limite de 10 leituras/hora por IP e o uso pode gerar custos.
Localmente, use `npx vercel dev` com um arquivo `.env.local` para testar o leitor (com `npm run dev` só a interface sobe). Sem a chave, o leitor mostra um aviso e o cálculo manual segue funcionando.

## Leitura de PDF e fotos de atas/contratos (módulo de licitações)
A rota `api/ler-licitacao.ts` usa a mesma `ANTHROPIC_API_KEY` do leitor de plantas. O PDF é dividido no navegador em blocos de 4 páginas (máx. 60 páginas por importação), cada bloco é lido pela IA e tudo vai para a tela de conferência antes de cadastrar. Há limite de 60 requisições/hora por IP e o uso pode gerar custos.

## Verificação de tipos
`npm run typecheck` confere o projeto inteiro, inclusive os testes (usado no GitHub Actions). `npm run build` confere só o código do aplicativo (`tsconfig.build.json`), para que um problema de tipos nos testes nunca impeça o deploy.
