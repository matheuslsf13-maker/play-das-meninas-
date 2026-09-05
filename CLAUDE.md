# Play de Sexta — guia rápido do projeto

App do campeonato de **beach tennis** feminino da **V3 Arena**, jogado toda
sexta. Monta duplas equilibradas, lança placares, fecha o dia e o mês, e mostra
rankings e estatísticas. Tudo é operado principalmente **pelo celular**.

**Antes de mudar regra do campeonato, algoritmo de duplas ou o "quem está em
quadra", leia [`DECISOES.md`](DECISOES.md)** — ele guarda o que já foi medido e
descartado, para não refazer discussão encerrada.

## Stack

React 18 + TypeScript + Vite 5. Sem router (o estado das abas fica no `App.tsx`).
PWA (manifest + service worker). Português do Brasil em toda a interface.

## Comandos

```bash
npm run dev      # servidor local em http://localhost:5173
npm run build    # tsc -b + vite build (use antes de commitar)
npx tsc --noEmit # só a checagem de tipos
```

## Mapa do código

```
src/pages/       telas: Play.tsx (a maior), Ranking.tsx, Stats.tsx, Players.tsx
src/lib/         regras: pairing (duplas), scoring, streaks (status 🔥), stats,
                 poster (imagens de fechamento), roster (importar lista), store
src/data/        armazenamento: localRepo (navegador) e supabaseRepo, com fila
                 de escrita otimista que sobrevive a refresh (queue.ts)
src/config.ts    URL e chave pública do Supabase (NUNCA a secret/service_role)
supabase/*.sql   migrações, rodadas na ordem numérica no SQL Editor
```

`hasSupabase` decide qual driver é usado. Escrita exige login; leitura é pública.

## Regras do campeonato (não invente, elas são específicas)

- Partida até 4 pontos, sem empate. Pontos = games do vencedor − do perdedor
  (mínimo 1). Quem perde não pontua.
- Rodízio completo por padrão: o app calcula quantas rodadas são precisas para
  cada uma jogar com cada uma exatamente uma vez.
- **Status 🔥**: mantido terminando a sexta no **pódio do dia** (top 3). Faltar
  na sexta zera o status, mesmo com vida. Escada em `src/lib/streaks.ts`, de
  🔥 *Em chamas* (2) até 👑💎🌟 **Duquesa da V3** (8+). No fim do mês a jogadora
  escolhe **usar** (vira pontos, zera) ou **preservar** (segue e ganha 1 vida).
- **Partida iniciada**: quem está em quadra agora é definido pelo botão
  "▶️ Partida iniciada"; lançar o placar encerra. Isso alimenta o aviso de
  quadra parada e a troca de jogadoras.

## Convenções

- Comentários e nomes em português, sem acento em identificadores.
- Código sem dependências novas sempre que der; o bundle é servido para
  celulares em quadra.
- Rodar `npm run build` antes de commitar; o push na `main` publica o site.
