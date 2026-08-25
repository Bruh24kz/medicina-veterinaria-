# VetCare - Clínica Veterinária

Sistema web com **Express + SQLite** para agendamentos e vendas.

## Rodar no GitHub Codespace

```bash
npm install
npm start
```

1. Aguarde a mensagem: `VetCare rodando em http://0.0.0.0:3000`
2. No Codespace, abra a aba **Ports** e publique a porta **3000**
3. Acesse o link gerado (Open in Browser)

> Se `sqlite3` falhar no install: `npm rebuild sqlite3`

## Páginas

| Página | Função |
|--------|--------|
| `index.html` | Home |
| `agendamentos.html` | Formulário de consulta (salva no banco) |
| `venda.html` | Consulta + produtos do banco |
| `veragendamentos.html` | Lista / confirma / cancela agendamentos |
| `carrinho.html` | Carrinho (localStorage) |

## API

- `GET /api/health` — status
- `POST /api/agendamentos` — criar
- `GET /api/agendamentos` — listar
- `PATCH /api/agendamentos/:id/status` — status
- `GET /api/produtos` — produtos

Banco: arquivo `siscristovao.db` (criado automaticamente).
