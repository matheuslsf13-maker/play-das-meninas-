# 🏐 Play de Sexta — Beach Tennis

App para organizar o **Play de Sexta**, o campeonato de **beach tennis** da V3 Arena: monta as duplas equilibradas,
lança os placares, fecha o dia, soma os pontos no ranking do mês e mostra as
estatísticas individuais, de duplas e de confrontos.

## O que ele faz

- **Duplas automáticas e equilibradas** — a cada rodada as combinações mudam
  (o app evita repetir parceira), as duplas são montadas pela pontuação de cada
  jogadora para os jogos ficarem parelhos, e as folgas são revezadas de forma justa.
- **Quantidade livre** — você informa quantas jogadoras vieram e quantas quadras
  temos. O app calcula quem folga em cada rodada.
- **Rodízio completo (padrão)** — o app calcula **sozinho quantas rodadas são
  necessárias para cada uma fazer dupla com cada uma das outras exatamente uma
  vez**, e o número se adapta à quantidade de jogadoras da semana. Com 8, 12, 16
  ou 20 jogadoras o rodízio fecha perfeito: `N−1` rodadas, nenhuma dupla
  repetida e todas jogando o mesmo número de partidas. Dá para desmarcar e fixar
  o número de rodadas quando o tempo for curto.
- **Pontuação do cartaz** — partida até 4 pontos, sem empate:
  `4x0 = 4 pts · 4x1 = 3 pts · 4x2 = 2 pts · 4x3 = 1 pt` (a derrota não pontua).
  Dá para mudar o "vai até" na criação do play.
- **Status de sequência 🔥** — terminar sextas seguidas no **pódio do dia** dá
  status, de 🔥 *Em chamas* (2 sextas) até 👑💎🌟 **Duquesa da V3** (8 ou mais).
  No fechamento do mês a jogadora escolhe **usar** o status (vira pontos e zera)
  ou **preservar** (segue crescendo e ganha 1 vida).
- **Ranking do dia e do mês** — pódio com as fotos do top 3 e classificação
  (pontos, jogos, vitórias, derrotas, saldo de games, aproveitamento). A tela
  mostra o top 10 e expande para a lista inteira quando você quiser.
- **Finalizar o dia** — soma os pontos ao ranking do mês, mostra o ranking do dia
  e oferece o botão para **gerar as duplas do próximo play**.
- **Estatísticas** — em dois modos. *Por jogadora*: aproveitamento, saldo,
  sequência e status, pódios, dias vencidos, com quem mais venceu, parceria mais
  difícil, de quem mais ganha e para quem mais perde. *Por dupla*: a lista de
  todas as duplas que já se formaram, com busca e ordenação, e o retrospecto
  completo de cada uma — inclusive contra quem jogaram e o placar de cada partida.
- **Compartilhar no WhatsApp** — botões que copiam o ranking do mês, o ranking do
  dia e as duplas de cada rodada já formatados para colar no grupo.
- **Imagem de fechamento do mês** — gera a arte do pódio (1080×1350, formato de
  post/status) com as fotos do top 3, coroa na campeã, pontos, vitórias e as
  demais colocadas. Um toque para compartilhar ou salvar.
- **Fotos** — cada jogadora pode ter foto de perfil (aparece no pódio e na arte
  do mês); dá para pôr, trocar e remover, e o arquivo antigo é apagado do
  armazenamento junto.

## Como as meninas acessam

O app é um site. Quem organiza entra com e-mail e senha para lançar resultados;
**todas as outras só abrem o link** e já veem o ranking atualizado em tempo real.

## Rodando localmente

```bash
npm install
npm run dev
```

Sem configuração o app roda em **modo local**: funciona 100%, mas os dados ficam
salvos apenas no navegador de quem está usando. Ótimo para testar.

## Ligando o Supabase (para o grupo todo acessar)

1. Crie um projeto grátis em <https://supabase.com>.
2. No **SQL Editor**, cole e rode o conteúdo de [`supabase/schema.sql`](supabase/schema.sql).
   Isso cria as tabelas, libera a leitura pública, ativa o tempo real e cria o
   bucket `photos` para as fotos de perfil.
3. Em **Authentication → Users**, clique em *Add user* e crie o login de quem vai
   organizar os plays (e-mail + senha). Só quem tem login consegue editar.
4. Preencha [`src/config.ts`](src/config.ts) com os dados de
   **Project Settings → API**:

   ```ts
   export const SUPABASE_URL = 'https://xxxx.supabase.co'   // Project URL
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...'         // anon public
   ```

   (Também dá para usar as variáveis `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` num `.env` — elas têm prioridade sobre o config.)

5. `npm run dev` — o cabeçalho passa a mostrar a bolinha verde.

> A `anon key` é pública por natureza: quem tem o link consegue **ler** os dados.
> A escrita é protegida pelas políticas de RLS do `schema.sql` (só autenticadas).

## Publicando (GitHub Pages)

O workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) publica
o site a cada push na `main`.

1. No repositório: **Settings → Pages → Source: GitHub Actions**.
2. Com `src/config.ts` preenchido não precisa de mais nada. (Se preferir não
   versionar as chaves, apague-as do config e crie os secrets
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em
   **Settings → Secrets and variables → Actions**.)
3. Faça um push na `main`. O link fica
   `https://<seu-usuario>.github.io/<nome-do-repo>/` — é esse link que você manda
   no grupo do WhatsApp.

Também funciona direto na Vercel/Netlify: build `npm run build`, pasta `dist`,
e as mesmas duas variáveis de ambiente.

## No celular da organizadora

O app foi feito para ser usado com uma mão, na beira da quadra:

- **Placar em 2 toques** — toca na dupla que venceu, toca em quantos games a
  adversária fez. Pronto, partida lançada. Para corrigir, *Trocar placar*.
- **Uma rodada por vez** — nada de rolar 24 partidas procurando a atual. O app
  já abre na primeira rodada que falta placar, com a barrinha de rodadas
  (✓ marca as que terminaram) e setas para navegar. *Ver todas* mostra tudo.
- **Salva na hora** — o placar aparece na tela imediatamente e vai para o banco
  em segundo plano. O topo mostra *tudo salvo* / *salvando…* / *N para enviar*.
- **Aguenta sinal ruim** — sem internet, os lançamentos ficam guardados no
  celular (sobrevivem até a fechar o app) e sobem sozinhos quando o sinal volta.
  O app também abre offline mostrando o último estado conhecido.
- **Tela não apaga** enquanto um play está aberto.
- **Dá para instalar** como aplicativo: no celular, abrir o link e escolher
  *Adicionar à tela de início* (Android: menu ⋮ → *Instalar app*).

## Como usar no dia do play

1. **Meninas** — cadastre as jogadoras (e as fotos).
2. **Play → Novo Play** — escolha data, quadras, rodadas e marque quem veio.
3. **Gerar duplas e começar** — o app monta todas as rodadas.
   Use *Enviar duplas* para colar as combinações no grupo.
4. Durante os jogos, lance os placares em cada quadra (salva sozinho).
5. **Finalizar o dia e somar os pontos** — aparece o ranking do dia para
   compartilhar, e o botão para já deixar o próximo play montado.

## Status de sequência ("em chamas")

Terminar a sexta no **pódio do dia** (top 3) mantém o status vivo e faz a
sequência crescer:

| Sextas seguidas no pódio | Status | Vale |
| --- | --- | --- |
| 2 | 🔥 Em chamas | 3 pontos |
| 3 | 🔥🔥 Pegando fogo | 6 pontos |
| 4 | 🔥🔥🔥 Imparável | 10 pontos |
| 5 | 👑🔥 Lenda do Play | 16 pontos |
| 6 | 👑💎 Rainha do Play | 24 pontos |
| 7 | 👑🌟 Imperatriz do Play | 34 pontos |
| **8 ou mais** | **👑💎🌟 Duquesa da V3** | **50 pontos** |

### Por que pódio e não vitória do dia

Porque as duplas são equilibradas de propósito: medindo 400 sextas simuladas,
**a mesma jogadora vence duas sextas seguidas em apenas 11% das vezes** e
praticamente ninguém chega a 4. Com a vitória do dia como critério, os degraus
de 4 para cima seriam enfeite. Pelo pódio, a escada inteira passa a ser
alcançável e a Duquesa continua lendária (cerca de 1,5% das sequências).

### A decisão do fechamento

Os pontos do ranking **zeram todo mês**; o status, não. No fechamento, quem
terminou o mês com status escolhe:

- **Usar** — os pontos do status entram naquele mês e a sequência **zera**.
  É irreversível, então o app pede confirmação.
- **Preservar** (padrão) — não pontua, o status segue crescendo no mês seguinte
  e ela ganha **1 vida**.

A **vida** absorve uma sexta fora do pódio: o status sobrevive, mas não cresce
naquela semana. Não acumula (no máximo uma por vez). **Faltar zera o status
mesmo com vida** — tem que estar lá.

O ponto de equilíbrio: como a distância entre 1ª e 2ª colocada num mês é de
apenas ~3,6 pontos, usar um status de 10 pontos praticamente decide o mês. Vale
a pena preservar justamente quando ela já está fora da briga daquele mês.

## Como as duplas são montadas

**No rodízio completo** o app usa o *método do círculo* (uma 1-fatoração do grafo
completo): fixa uma jogadora e gira as outras, gerando conjuntos de duplas em que
ninguém se repete e toda combinação aparece uma única vez. Essas duplas são então
distribuídas pelas quadras, e a única escolha que sobra — quem enfrenta quem — é
usada para equilibrar as partidas. Quando o total de combinações é ímpar
(9, 10, 11, 14, 15, 18… jogadoras) uma dupla precisa se repetir uma vez, porque
cada partida consome duas duplas; é inevitável, e o app repete apenas uma.

Testado em 510 simulações de 6 a 24 jogadoras: **cobertura de 100% das duplas em
todas elas**.

**No modo de rodadas fixas**, cada jogadora tem uma **força estimada** = média de pontos por partida no
histórico, com os plays mais recentes pesando mais (quem nunca jogou entra na
média do grupo). Para cada rodada o app testa vários arranjos e escolhe o de
menor custo, penalizando nesta ordem: repetir parceira (peso maior), repetir
adversária, diferença de força entre as duas duplas da partida e juntar a mais
forte com a mais fraca na mesma quadra.

## Estrutura

```
src/lib/pairing.ts   geração das rodadas e duplas equilibradas
src/lib/scoring.ts   regra de pontuação (4x0=4, 4x1=3, 4x2=2, 4x3=1)
src/lib/stats.ts     rankings, força estimada, parcerias e confrontos
src/lib/streaks.ts   sequências de vitórias e bônus "em chamas"
src/lib/share.ts     textos prontos para o WhatsApp
src/lib/poster.ts    arte do fechamento do mês (canvas 1080x1350)
src/data/            armazenamento (localStorage ou Supabase)
src/pages/           Ranking · Play · Estatísticas · Jogadoras
supabase/schema.sql  banco, permissões e bucket de fotos
```
