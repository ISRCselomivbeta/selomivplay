## ✅ **README.MD - DOCUMENTAÇÃO DO PROJETO**

Excelente! O arquivo `README.md` é essencial para documentar seu projeto. Como você não forneceu o conteúdo, vou criar um **README.md completo e profissional** para o SELO MIV, que você pode adaptar conforme necessário.

---

# 🎵 SELO MIV - Plataforma de Investimento Musical com Blockchain

![SELO MIV Logo](https://github.com/ISRCselomivbeta/selomivplay/raw/main/images/logo.png)

## 📋 Sobre o Projeto

O **SELO MIV** é uma plataforma inovadora que permite investimentos em direitos musicais através de tecnologia blockchain. Artistas podem tokenizar suas músicas e investidores podem adquirir frações, recebendo royalties proporcionais aos streams e visualizações.

### ✨ Funcionalidades Principais

- **Marketplace Musical** - Navegue e invista em músicas de diversos artistas
- **Bolsa Externa** - Invista em músicas que ainda não estão no catálogo oficial
- **Blockchain Explorer** - Visualize todos os blocos minerados e transações
- **Streaming com Mineração** - Ganhe recompensas ao ouvir músicas (30s = 1 bloco)
- **Sistema de Negociação** - Compre e venda ações entre usuários
- **Painel do Artista** - Artistas podem cadastrar e gerenciar suas músicas
- **Integração YouTube** - Dados reais de visualizações e estimativas de receita

---

## 🏗️ Arquitetura do Projeto

```
📦 selo-miv
├── 📁 api
│   └── backend.js          # Backend serverless (Vercel)
├── 📁 public
│   └── TERMOS DE USO - SELO MIV PLATFORM.pdf
├── 📁 images
│   └── logo.png
├── index.html               # Front-end principal
├── confirm-email.html       # Página de confirmação de email
├── reset-password.html      # Página de recuperação de senha
├── package.json             # Dependências
├── vercel.json              # Configuração Vercel
└── README.md                # Documentação
```

---

## 🚀 Tecnologias Utilizadas

### Front-end
- HTML5, CSS3, JavaScript (ES6+)
- Bootstrap 5.3
- Bootstrap Icons
- YouTube Iframe API

### Back-end
- **Vercel Serverless Functions** (Node.js)
- **Google Apps Script** (Planilhas como banco de dados)
- **YouTube Data API v3**

### Infraestrutura
- **Vercel** - Hospedagem e deploys automáticos
- **Google Sheets** - Banco de dados principal
- **Google Drive** - Backups automáticos

---

## ⚙️ Configuração do Ambiente

### Pré-requisitos
- Node.js 18+
- Conta no Vercel
- Conta Google (para Apps Script)
- Chave de API do YouTube

### Variáveis de Ambiente (Vercel)
```env
```

### Google Apps Script Properties
```javascript
// Script Properties
```

---

## 📊 Estrutura do Banco de Dados (Google Sheets)

### Planilha `musicas` (35 colunas)
| Coluna | Nome | Descrição |
|--------|------|-----------|
| A | id | ID único da música |
| B | timestamp | Data de criação |
| C | user_id | ID do artista |
| D | titulo | Título da música |
| E | artista | Nome do artista |
| F | genero | Gênero musical |
| G | subgenero | Subgênero |
| H | link_youtube | Link do YouTube |
| I | link_spotify | Link do Spotify |
| J | link_deezer | Link do Deezer |
| K | link_capa | URL da capa |
| L | link_audio | Link do áudio |
| M | valor_acao | Valor por ação |
| N | percentual_disponivel | % disponível para venda |
| O | acoes_totais | Total de ações |
| P | acoes_vendidas | Ações vendidas |
| Q | acoes_disponiveis | Ações disponíveis |
| R | total_investidores | Nº de investidores |
| S | total_investido | Valor total investido |
| T | rentabilidade_media | Rentabilidade média |
| U | rentabilidade_mensal | Rentabilidade mensal |
| V | status | ativo/pausado/excluído |
| W | visualizacoes_youtube | Views do YouTube |
| X | curtidas_youtube | Likes do YouTube |
| Y | streams_spotify | Streams no Spotify |
| Z | royalties_acumulados | Royalties acumulados |
| AA | royalties_pagos | Royalties pagos |
| AB | data_lancamento | Data de lançamento |
| AC | duracao | Duração da música |
| AD | gravadora | Gravadora |
| AE | compositores | Compositores |
| AF | produtores | Produtores |
| AG | letra | Letra da música |
| AH | descricao | Descrição |
| AI | created_at | Data de criação |
| AJ | updated_at | Data de atualização |

### Outras Planilhas
- `users` - Dados dos usuários
- `carteira` - Investimentos dos usuários
- `extrato` - Histórico de transações
- `external_musicas` - Músicas da bolsa externa
- `streaming_blocks` - Blockchain de streaming
- `trades` - Negociações entre usuários
- `withdraw_requests` - Solicitações de saque
- `system_logs` - Logs do sistema

---

## 🔗 Endpoints da API

### Backend Vercel (`/api/backend`)
| Ação | Descrição |
|------|-----------|
| `health` | Status da API |
| `login` | Autenticação de usuário |
| `register` | Registro de novo usuário |
| `get_musicas` | Lista músicas do marketplace |
| `get_external_musicas` | Lista músicas da bolsa externa |
| `get_saldo` | Consulta saldo do usuário |
| `get_carteira` | Consulta investimentos |
| `get_extrato` | Histórico de transações |
| `buy` | Comprar ações |
| `buy_external` | Comprar ações externas |
| `suggest_external_music` | Sugerir música externa |
| `upload_music` | Artista cadastrar música |
| `create_playlist` | Criar playlist |
| `toggle_favorite` | Favoritar/desfavoritar |
| `request_withdrawal` | Solicitar saque |
| `search_youtube` | Buscar músicas no YouTube |
| `get_streaming_stats` | Estatísticas de streaming |
| `register_streaming` | Registrar streaming |
| `get_mining_blocks` | Buscar blocos minerados |
| `create_trade` | Criar oferta de negociação |
| `get_trades` | Listar negociações |
| `accept_trade` | Aceitar negociação |
| `request_password_reset` | Solicitar recuperação de senha |
| `reset_password` | Redefinir senha |

---

## 🎯 Funcionalidades Detalhadas

### 🎵 Sistema de Streaming e Mineração
- Cada 30 segundos de reprodução minera 1 bloco
- Recompensas em SELO COIN
- Visualização da blockchain em tempo real
- Ranking de mineradores

### 💰 Investimentos
- Compra de frações de músicas (ações)
- Cálculo automático de royalties
- Rentabilidade baseada em streams reais
- Mercado secundário entre usuários

### 🌐 Bolsa Externa
- Investimento antecipado em músicas
- Meta de R$ 1 milhão para entrada no catálogo
- Taxa de especulação de 0,99%

### 🔗 Blockchain
- Cada streaming gera um bloco único
- Hashes SHA-256 encadeados
- Dificuldade ajustável
- Transparência total

---

## 🚀 Deploy e Implantação

### Deploy no Vercel
```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Google Apps Script
1. Crie um novo projeto em [script.google.com](https://script.google.com)
2. Cole o código do arquivo `code.gs`
3. Configure as Script Properties
4. Implante como aplicação web

---

## 🔧 Manutenção e Backup

### Backups Automáticos
- Backup diário das planilhas
- Retenção de 30 dias
- Salvos no Google Drive

### Limpeza de Cache
```javascript
limparCache(); // Remove cache do sistema
```

### Verificação de Integridade
```javascript
verifyDataIntegrity(); // Verifica consistência dos dados
```

---

## 🐛 Troubleshooting Comum

### Erro: "You do not have permission to call UrlFetchApp.fetch"
**Solução:** Autorize o script no Google Apps Script executando `forcarAutorizacao()`

### Erro: "Requests from referer ... are blocked"
**Solução:** Configure as restrições da chave de API no Google Cloud Console

### Pesquisa não funciona
**Solução:** Verifique se `YOUTUBE_API_KEY` está configurada no front-end

---

## 📝 Licença e Termos de Uso

Este projeto está sob a licença **SELO MIV**. Consulte o arquivo [TERMOS DE USO](./public/TERMOS%20DE%20USO%20-%20SELO%20MIV%20PLATFORM.pdf) para mais informações.

---

## 👥 Equipe e Contato

- **Desenvolvimento:** [Seu Nome]
- **Email:** contato@selomiv.com
- **Site:** [https://selomivplay.vercel.app](https://selomivplay.vercel.app)

---

## 🆘 Suporte

Para suporte técnico, abra uma issue no repositório ou envie um email para selomiv@gmail.com

---

**© 2026 SELO MIV - Todos os direitos reservados**
