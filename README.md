# 🎾 Play das Meninas — Super 8

App para organizar o **Play de Sexta** da V3 Arena: monta as duplas equilibradas,
lança os placares, fecha o dia, soma os pontos no ranking do mês e mostra as
estatísticas individuais, de duplas e de confrontos.

## O que ele faz

- **Duplas automáticas e equilibradas** — a cada rodada as combinações mudam
  (o app evita repetir parceira), as duplas são montadas pela pontuação de cada
  jogadora para os jogos ficarem parelhos, e as folgas são revezadas de forma justa.
- **Quantidade livre** — você informa quantas jogadoras vieram, quantas quadras
  temos e quantas rodadas. O app calcula quem folga em cada rodada.
- **Pontuação do cartaz** — partida até 4 pontos, sem empate:
  `4x0 = 4 pts · 4x1 = 3 pts · 4x2 = 2 pts · 4x3 = 1 pt` (a derrota não pontua).
  Dá para mudar o "vai até" na criação do play.
- **Bônus "em chamas" 🔥** — quem vence o ranking do dia em plays seguidos ganha
  ponto extra no mês: 2 seguidos `+2`, 3 seguidos `+3`, 4 seguidos `+5`,
  5 ou mais `+7`. O app mostra o selo de fogo ao lado do nome, um card
  "Em chamas" no ranking e avisa na hora de fechar o dia.
- **Ranking do dia e do mês** — pódio com as fotos do top 3 e classificação
  completa (pontos, jogos, vitórias, derrotas, saldo de games, aproveitamento).
- **Finalizar o dia** — soma os pontos ao ranking do mês, mostra o ranking do dia
  e oferece o botão para **gerar as duplas do próximo play**.
- **Estatísticas** — por jogadora: com quem ela mais venceu, a parceria mais
  difícil, de quem ela mais ganha, para quem mais perde, além do ranking das
  melhores duplas do período.
- **Compartilhar no WhatsApp** — botões que copiam o ranking do mês, o ranking do
  dia e as duplas de cada rodada já formatados para colar no grupo.
- **Fotos** — cada jogadora pode ter foto de perfil (aparece no pódio).

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

## Como usar no dia do play

1. **Meninas** — cadastre as jogadoras (e as fotos).
2. **Play → Novo Play** — escolha data, quadras, rodadas e marque quem veio.
3. **Gerar duplas e começar** — o app monta todas as rodadas.
   Use *Enviar duplas* para colar as combinações no grupo.
4. Durante os jogos, lance os placares em cada quadra (salva sozinho).
5. **Finalizar o dia e somar os pontos** — aparece o ranking do dia para
   compartilhar, e o botão para já deixar o próximo play montado.

## Regra do bônus em chamas

Vencer o **ranking do dia** (1º lugar do play) em sequência acumula fogo:

| Plays seguidos vencidos | Selo | Bônus no ranking do mês |
| --- | --- | --- |
| 2 | 🔥 Em chamas | +2 pontos |
| 3 | 🔥🔥 Pegando fogo | +3 pontos |
| 4 | 🔥🔥🔥 Imparável | +5 pontos |
| 5 ou mais | 👑🔥 Lenda do play | +7 pontos por play |

O bônus é creditado no play que estende a sequência, então ele entra no mês
daquele play. **Perder o dia ou faltar ao play zera a sequência** — para manter o
fogo aceso é preciso estar lá e vencer.

## Como as duplas são montadas

Cada jogadora tem uma **força estimada** = média de pontos por partida no
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
src/data/            armazenamento (localStorage ou Supabase)
src/pages/           Ranking · Play · Estatísticas · Jogadoras
supabase/schema.sql  banco, permissões e bucket de fotos
```
