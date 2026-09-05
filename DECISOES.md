# 📌 Decisões do projeto — por que as coisas são do jeito que são

Este arquivo guarda o **caminho** até o sistema atual: o que foi testado, o que
foi descartado e por quê. O `CLAUDE.md` diz *como o app funciona hoje*; aqui
está *por que ele funciona assim*.

> Serve para não refazer discussão já encerrada nem "melhorar" algo que já foi
> medido e descartado.

---

## O campeonato

**Play de Sexta**, beach tennis feminino na **V3 Arena**, toda sexta.
Não confundir com "Play das Meninas" — esse é um campeonato **concorrente**
(o repositório se chama `play-das-meninas-` por causa do nome antigo, mas o
nome do produto é Play de Sexta).

Duas coisas mudam toda semana e por isso são informadas na hora de criar o play:
**quantas jogadoras vieram** (as meninas decidem durante a semana) e **quantas
quadras** temos.

## Pontuação

Regra do cartaz original, mantida: partida até 4 pontos, sem empate.
`4x0 = 4 · 4x1 = 3 · 4x2 = 2 · 4x3 = 1`. Quem perde não pontua.
Generalizada para partidas até N ("vai até"), mas o padrão é 4.

## Duplas equilibradas e rodízio

As duplas são montadas pela pontuação acumulada, para os jogos ficarem parelhos,
e mudam a cada rodada.

- O rodízio completo usa o **método do círculo** (1-fatoração): com 8, 12, 16 ou
  20 jogadoras fecha perfeito em `N−1` rodadas, ninguém repete parceira e todas
  jogam o mesmo tanto.
- O ajuste fino é uma **busca local** com pesos em `src/lib/pairing.ts`
  (`W_PARTNER=120`, `W_OPPONENT=22`, `W_BALANCE=30`, `W_SPREAD=6`).
  Repetir parceira é o pecado mais caro de propósito.
- **Bug já corrigido, não reintroduzir:** a contagem de rodadas do rodízio era
  calculada num sorteio *diferente* do que gerava as partidas. Como o processo é
  aleatório, os dois divergiam e o app caía no modo heurístico em silêncio (a
  cobertura despencava para 81–99%). A correção foi `bestFullRotation`
  (melhor de 8 tentativas) mais o modo explícito `'completo'`, que **ignora** o
  número de rodadas pedido.
- Medição feita com rodadas fixas: o app forma **48 duplas distintas de 48
  possíveis** (zero repetição no mesmo dia) e aproveita **17,8 de 18** duplas
  que nunca tinham se formado na semana anterior — contra 10,5 se fosse sorteio
  puro.

## Status 🔥 (o atrativo do campeonato)

A pergunta difícil foi: **o que mantém o status?** Ganhar a sexta seguidas vezes
não serve. Simulações sobre 400 sextas mostraram que:

- a chance de vencer duas sextas seguidas é de só **11%** — justamente porque as
  duplas são equilibradas de propósito;
- logo, os degraus acima de 3 **nunca seriam alcançados** e o sistema morreria.

Quatro regras candidatas foram medidas. A escolhida foi **pódio do dia (top 3)
+ 1 vida**:

- termina a sexta no top 3 → mantém e sobe o status;
- **faltar na sexta zera o status, mesmo tendo vida** (regra explícita do dono);
- a vida absorve **uma** sexta fora do pódio, e é ganha ao preservar no fim do mês.

Escada (`src/lib/streaks.ts`), calibrada para 2/3/4 serem possíveis dentro de um
mês e 5/6/7 no segundo: 🔥 Em chamas (2) · 🔥🔥 Pegando fogo (3) ·
🔥🔥🔥 Imparável (4) · 👑🔥 Lenda do Play (5) · 👑💎 Rainha do Play (6) ·
👑🌟 Imperatriz do Play (7) · 👑💎🌟 **Duquesa da V3** (8+, o teto).

**Por que alguém usaria o status em vez de acumular?** Porque a diferença entre
1º e 2º no mês é de apenas **3,6 pontos** em média — então sacar o bônus decide
o mês. No fechamento a jogadora escolhe **usar** (vira pontos e zera, é
irreversível e pede confirmação) ou **preservar** (padrão: não pontua, o status
segue e ela ganha 1 vida).

> No banco os valores gravados continuam `'sacar'` / `'continuar'`, traduzidos
> por `acaoDe()`. Foi de propósito, para não precisar migrar dados existentes.

## Campeã do dia

**Empate exato** (mesmos pontos, saldo e vitórias) gera **co-campeãs**. Uma
simulação mostrou o problema antigo: a Duda venceu 3 dias e ficou com 0 de bônus
enquanto a Ana levou +10, só porque "Ana" vem antes no alfabeto. Desempate por
ordem alfabética nunca mais.

## Quem está em quadra agora

Duas tentativas foram feitas antes da atual — as duas falharam e não devem
voltar:

1. **Por rodada** — errado: a quadra travada está na rodada 2 enquanto as presas
   ainda jogam a rodada 1, então detectava zero conflito.
2. **Primeira partida sem placar de cada quadra** — melhor, mas ainda adivinhação:
   errava sempre que o play saía do roteiro.

A solução é **declarativa**: o botão **"▶️ Partida iniciada"** marca, e o placar
encerra. Quem organiza é quem sabe. O início fica gravado no banco
(`matches.started_at`, script `04`) **e também no `localStorage`**
(`src/lib/emQuadra.ts`) — sem a cópia local o tempo real devolvia a partida sem
o início e o botão "voltava" sozinho.

Em cima disso funcionam o aviso **"⏳ fulana ainda está jogando em outra quadra"**
com o botão **"🔄 Chamar quem está livre"** (`liberarPartida`, mesmos critérios
do sorteio) e o "livre / em quadra" na troca de jogadoras.

## Quadras "com bug" que não eram bug

Reclamação: "selecionei 3 quadras e o play gerou com 2". A matemática estava
certa — 3 quadras exigem 12 jogadoras **ao mesmo tempo**. O problema era de
comunicação, então a correção foi um **aviso bem visível** explicando a conta e
quantas jogadoras faltam. Não mexer na lógica achando que é bug.

## "Não consegue abrir o app"

Investigado: site respondendo 200, deploys verdes, todos os arquivos no ar. Era
**cache velho no navegador das meninas**. Correções: tela de resgate no
`index.html` (fora do JS do app, com "Limpar e recarregar" que remove o service
worker e os caches), cache do SW versionado por build, rodapé com a versão e
"forçar atualização", e o logo reduzido de 848 KB para 260 KB.

## Interface

- Tudo pensado para o **celular**, em pé, com a mão molhada de areia.
- Campos numéricos usam o componente `Stepper` (− / +). Os `input[type=number]`
  puros davam bug: apagar o campo virava 1, e digitar "4" resultava em 14.
- As imagens de fechamento (dia e mês, 1080×1350) são desenhadas em canvas, com
  coroa e chamas **vetoriais**. As chamas só têm línguas no arco superior — na
  primeira versão pareciam um sol.
- O fogo e o título de status aparecem **só para o 1º lugar** na arte.
- A classificação da tela inicial mostra o top 10 e expande sob demanda.

## Infra

- **Supabase**: leitura pública (o grupo do WhatsApp só abre o link), escrita só
  autenticada (RLS). Tempo real ligado. Fotos no bucket `photos`.
- A **chave publicável** e a URL ficam versionadas em `src/config.ts` — são
  públicas por natureza, foi escolha consciente.
- ⚠️ A **secret key** (`service_role`) **nunca** entra no app nem no repositório.
  Ela dá acesso total ao banco, ignorando todas as regras de permissão.
  **Pendência aberta:** essa chave passou por uma conversa de chat e por isso
  precisa ser **rotacionada** em Project Settings → API Keys.
- Publicação por GitHub Actions no GitHub Pages a cada push na `main`.

## Escrita otimista

As alterações aparecem na tela na hora e vão para uma **fila serializável**
(`src/data/queue.ts`) que sobrevive a refresh e a celular sem sinal. Isso é
essencial: a quadra da V3 tem sinal ruim e o play não pode parar.

## Importação da lista do WhatsApp

Cola a lista numerada de confirmadas; o app casa os nomes sozinho (normalização
sem acento, distância de edição, primeiro nome, apelido/prefixo), pergunta só
nas dúvidas, cria quem falta, guarda as grafias como `aliases` para acertar
sozinho da próxima vez, **preserva pontos e status** ao vincular e permite
**desfazer a importação**. No teste com a lista real de 12 nomes: 8 resolvidos
sozinho, 4 conferidos na mão.

---

## Pendências

- [ ] **Rotacionar a secret key do Supabase** (segurança, item mais importante).
- [ ] **Apresentação para o grupo** — pedida ("pode ser um vídeo"), nunca feita.
      Deve apresentar o sistema, o que dá para consultar e principalmente o
      **sistema de sequências**, que é o atrativo do campeonato.
- [ ] Mensagem pronta para o grupo pedindo que escrevam o nome completo certo na
      lista de confirmação (facilita a importação).
- [ ] Rodar `supabase/04-partida-iniciada.sql` no SQL Editor, se ainda não foi —
      sem ele o "em quadra" funciona só no aparelho de quem organiza.
- [ ] Opcional: tirar o "Mais que um play, uma experiência!" do rodapé das artes
      (já aparece dentro do logo).
