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

## Sem rodadas: o play é uma fila de partidas

O play era organizado em **rodadas**, e isso foi removido. Na quadra as partidas
nunca terminam juntas: uma acaba enquanto a outra ainda está rolando, e esperar
a rodada inteira fechar deixava quadra parada de graça.

Hoje o app gera uma **fila** de partidas e, a cada quadra que vaga, escolhe da
fila a partida cujas quatro meninas estão livres (`proximasDasQuadras`).
A coluna `matches.round` virou a **posição na fila** e `sessions.rounds` o
**total de partidas** — os nomes ficaram para não migrar dados existentes.

Duas coisas foram medidas e decidem o desenho atual:

- **A escolha é do conjunto, não quadra por quadra.** Pegar a melhor partida
  para a quadra 1 sem olhar as outras fazia a mesma menina ser sugerida em duas
  quadras ao mesmo tempo (visto no teste com 16 jogadoras). Agora uma busca
  preenche o máximo de quadras possível de uma vez.
- **Quando não dá para preencher, o app fala.** Em vez de sugerir alguém que já
  está jogando, a quadra mostra "nenhuma das N partidas que faltam tem quatro
  meninas livres", lista quem está livre e oferece montar uma partida com elas.

## Duplas: parceira, adversária e descanso

As duplas são montadas pela pontuação acumulada, para os jogos ficarem parelhos.

- O rodízio usa o **método do círculo** (1-fatoração): fixa uma jogadora e gira
  as outras, gerando "rondas" de duplas em que ninguém se repete. Toda
  combinação de parceiras aparece **exatamente uma vez**.
- **Quem enfrenta quem também é escolhido** — antes era sobra do sorteio, e duas
  meninas podiam se enfrentar 5 vezes enquanto outras nunca se cruzavam.
  Não dá para "nunca se enfrentar": num grupo de 8 são 28 duplas, 14 partidas e
  **56 confrontos individuais para só 28 pares possíveis** — na média cada par
  se cruza duas vezes. Então o alvo é **espalhar**, e a adversária escolhida é
  sempre a dupla que menos se enfrentou com essa até ali. Medido: os confrontos
  ficam entre **1 e 3, com média exata de 2,00**.
- **Duplas órfãs, corrigido.** Quando a ronda tem um número ímpar de duplas,
  uma sobra. Tirar sempre a mesma posição fazia as sobras caírem todas em cima
  da mesma menina, e aí elas não conseguiam se enfrentar depois: 3 duplas
  repetidas onde a matemática exige 1. Agora sai a dupla cujas jogadoras menos
  aparecem nas outras sobras, e o resultado bate o mínimo teórico: **0 duplas
  repetidas** quando o total de combinações é par, **1** quando é ímpar.
- **A otimização de confrontos só troca duplas DENTRO da mesma ronda.** Trocar
  entre rondas espalha um pouco melhor (confrontos 1–3 em vez de 1–4), mas
  destrói a propriedade de que as partidas de uma ronda cobrem o grupo inteiro
  — e é essa propriedade que permite as quadras rodarem todas ao mesmo tempo.
  Medido em 16 jogadoras e 3 quadras: **quadra ociosa em 11% dos casos com a
  restrição contra 46% sem ela**. A restrição fica.
- **Entra sempre quem está fora há mais tempo.** Sem isso acontecia de a menina
  terminar o jogo e já voltar, cansada, enquanto outra esperava sentada. O app
  guarda a hora em que cada partida terminou (`matches.ended_at` mais uma cópia
  no `localStorage`) e ordena a fila de espera por isso.

## Precisa sobrar gente para as quadras não pararem

Descoberto na simulação: **quando quadras × 4 = número de meninas, ninguém sobra
e a quadra que terminar primeiro fica parada**, porque as quatro da próxima
partida ainda estão jogando. Com 16 jogadoras e 4 quadras a quadra fica ociosa
em 51% dos casos; com as mesmas 16 em 3 quadras, 11%.

Não é bug do algoritmo, é aritmética — então a correção foi um **aviso na
criação do play** explicando que com pelo menos 4 de folga o rodízio anda
sozinho. A configuração ideal medida foi **24 jogadoras em 3 grupos de 8 com 3
quadras: 0% de quadra ociosa e 11 minutos de descanso médio**.

## Modo em grupos

Com 16 meninas o rodízio completo dá **60 partidas e 15 jogos para cada uma** —
longo demais para uma noite. O modo em grupos resolve: o mesmo rodízio acontece
**dentro de cada grupo**, então grupos de 8 dão 7 jogos por menina.

- Quem escolhe é o **tamanho do grupo**; o app calcula quantos grupos cabem a
  partir de quantas confirmaram, com tamanhos o mais parecidos possível.
- Os grupos são formados **por nível**: o grupo 1 leva as mais bem pontuadas do
  histórico, para os jogos ficarem parelhos dentro do grupo.
- **Os pontos continuam individuais e o ranking do dia é um só** — o grupo muda
  contra quem você joga, não como você pontua.
- Grupos de 8 fecham perfeitos (28 duplas, 14 partidas, zero repetição).

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

1. **Por rodada** — errado: a quadra travada estava na rodada 2 enquanto as
   presas ainda jogavam a rodada 1, então detectava zero conflito. (Hoje nem
   existem mais rodadas.)
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

## Ações que mexem em pontuação pedem confirmação forte

- **Apagar um play** tira os pontos das meninas do ranking do mês e pode
  derrubar sequências. Um "ok" não basta: a tela mostra quantas partidas serão
  perdidas, **quantos pontos cada uma perde**, avisa se o play já foi finalizado
  (o que refaz as sequências) e **exige escrever APAGAR**.
- **Fechar o mês** agora é um botão, não só a virada do calendário: a premiação
  acontece na última sexta. A confirmação lista quem fecha com status e quanto
  vale. Dá para **reabrir** — serve para teste e para desfazer engano.
  Gravado em `month_closures`; a virada do calendário continua como rede de
  segurança.

## Interface

- Tudo pensado para o **celular**, em pé, com a mão molhada de areia.
- Campos numéricos usam o componente `Stepper` (− / +). Os `input[type=number]`
  puros davam bug: apagar o campo virava 1, e digitar "4" resultava em 14.
- **Trocar jogadora não é mais um toque no nome.** O nome ficava dentro de uma
  linha cortada por reticências, então com nome comprido não dava para acertar o
  dedo. Agora é um botão "🔄 Trocar jogadora" que abre um modal de duas etapas
  com **linhas de 60px de altura ocupando a largura toda** — e os nomes das
  duplas quebram em vez de serem cortados.
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
- [x] ~~Rodar os scripts `04` e `05` no SQL Editor~~ — feito e conferido em
      05/09/2026: `started_at`, `ended_at`, `format`, `groups` e a tabela
      `month_closures` estão no banco, com RLS (leitura pública, escrita
      autenticada) e tempo real ligados nas 5 tabelas.
- [ ] Opcional: tirar o "Mais que um play, uma experiência!" do rodapé das artes
      (já aparece dentro do logo).
