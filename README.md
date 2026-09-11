# COA — Sistema de Manutenções

Sistema web para registro e acompanhamento de manutenções, com autenticação via Supabase.

## Tecnologias
- **Frontend**: HTML + CSS + Vanilla JS (zero dependências)
- **Backend/DB**: [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS)

## Funcionalidades
- ✅ Login com e-mail e senha (Supabase Auth)
- ✅ Dashboard com resumo por status (cards clicáveis para filtrar)
- ✅ Filtros por status, categoria e busca por texto
- ✅ 4 status: `Na Fila`, `Em Andamento`, `Aguardando Terceiro`, `Realizada`
- ✅ 7 categorias: `Software`, `Hardware`, `Mecânica`, `Elétrica`, `Apoio`, `Solinftec`, `Administrativo`
- ✅ Data de Solicitação preenchida automaticamente na abertura
- ✅ Data de Conclusão preenchida automaticamente ao marcar como `Realizada`
- ✅ Campos Descrição e Solução editáveis
- ✅ Registro do usuário que criou/editou a manutenção

## Setup do Supabase

### 1. Criar a tabela no Supabase

Acesse o **SQL Editor** do seu projeto Supabase e execute o script em `supabase/schema.sql`.

### 2. Criar usuários

No painel do Supabase → **Authentication → Users → Add User**, crie os usuários com e-mail e senha.

### 3. Rodar localmente

Basta abrir o `index.html` em qualquer servidor HTTP estático.
Exemplo com Python:
```bash
python -m http.server 3000
```
Ou com Node.js (npx serve):
```bash
npx serve .
```

## Estrutura
```
├── index.html        # SPA principal
├── style.css         # Design system (dark mode + glassmorphism)
├── app.js            # Lógica da aplicação (Auth, CRUD, UI)
├── supabase/
│   └── schema.sql    # Script de criação da tabela
└── README.md
```
