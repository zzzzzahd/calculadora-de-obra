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
Sprint 1 concluído: estrutura, tema claro/escuro, cadastro de dimensões (m, cm, mm) e vários ambientes.
