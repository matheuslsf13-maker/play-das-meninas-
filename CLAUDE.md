# Play da Sexta — guia rápido do projeto

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
src/lib/         regras: pairing (fila de partidas e grupos), scoring,
                 streaks (status 🔥), stats, poster (imagens de fechamento),
                 roster (importar lista), emQuadra (horários locais), store
src/data/        armazenamento: localRepo (navegador) e supabaseRepo, com fila
                 de escrita otimista que sobrevive a refresh (queue.ts)
src/config.ts    URL e chave pública do Supabase (NUNCA a secret/service_role)
supabase/*.sql   migrações, rodadas na ordem numérica no SQL Editor
```

⚠️ Duas colunas do banco têm nome enganoso, mantido para não migrar dados:
`matches.round` é a **posição na fila** (não existe mais rodada) e
`sessions.rounds` é o **total de partidas do dia**.

`hasSupabase` decide qual driver é usado. Escrita exige login; leitura é pública.

## Regras do campeonato (não invente, elas são específicas)

- Partida até 4 pontos, sem empate. Pontos = games do vencedor − do perdedor
  (mínimo 1). Quem perde não pontua.
- **Não há rodadas.** O play é uma **fila de partidas**; cada quadra que vaga
  puxa da fila a partida cujas quatro meninas estão livres, dando preferência a
  quem está fora há mais tempo (`proximasDasQuadras`).
- Rodízio completo: cada uma faz dupla com cada uma das outras exatamente uma
  vez. **Quem enfrenta quem também é escolhido**, sempre pela dupla que menos
  se enfrentou até ali — o alvo é espalhar, não zerar (é impossível zerar).
- **Dois formatos**, escolhidos ao criar o play: `todas` (rodízio único) e
  `grupos` (o mesmo rodízio dentro de grupos formados por nível, grupo 1 com as
  mais bem pontuadas). Nos grupos os pontos continuam **individuais** e o
  ranking do dia é **um só**.
- **Status 🔥**: mantido terminando a sexta no **pódio do dia** (top 3). Faltar
  na sexta zera o status, mesmo com vida. Escada em `src/lib/streaks.ts`, de
  🔥 *Em chamas* (2) até 👑💎🌟 **Duquesa da V3** (8+). No fim do mês a jogadora
  escolhe **usar** (vira pontos, zera) ou **preservar** (segue e ganha 1 vida).
- **O mês fecha na mão**, no botão "🏁 Finalizar o mês" do Ranking (dá para
  reabrir). A premiação acontece na última sexta, antes de o calendário virar.
- **O ranking zera todo mês, o histórico não.** A força usada para equilibrar as
  duplas e dividir os grupos sai de `ratings()`, que olha os **últimos 4 plays**
  (`PLAYS_PARA_FORCA` em `src/lib/stats.ts`) — não o ranking do mês nem o
  histórico inteiro. A janela atravessa a virada do mês, então o primeiro play
  do mês já sai equilibrado; e quem foi boa há um ano mas anda mal não cai no
  grupo forte. Quem jogou pouco na janela é completada com o histórico dela.
- **Play avulso** (`sessions.ranked = false`): conta no histórico e na força,
  mas **não soma no ranking do mês nem mexe nas sequências**. Serve para o jogo
  de segunda que não é o campeonato.
- **Partida iniciada**: quem está em quadra agora é definido pelo botão
  "▶️ Partida iniciada"; lançar o placar encerra. Isso alimenta o aviso de
  quadra parada e a troca de jogadoras.
- A lista "Próximas na fila" usa `ordemPrevista()`, não a ordem gravada: mostrar
  a ordem de geração colocava na frente quem tinha acabado de sair da quadra.
- **O placar só é lançável depois de "▶️ Partida iniciada"** (botões de "venceu"
  desabilitados). Corrigir placar é o ✏️ da lista "Já jogadas", que abre um modal
  e **preserva o `ended_at`** — não devolve a partida para a fila.

## Convenções

- Comentários e nomes em português, sem acento em identificadores.
- Código sem dependências novas sempre que der; o bundle é servido para
  celulares em quadra.
- Rodar `npm run build` antes de commitar; o push na `main` publica o site.
