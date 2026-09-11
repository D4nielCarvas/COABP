# equipment-agent

Agent standalone Node.js para consulta de **Equipamentos** e **Ordens de Serviço** via Oracle + Firebase.

Reutiliza a mesma arquitetura do `oracle-agent` do audit1t:
- **Firebase Auth** para autenticação
- **Firestore** como fila de requisições (`sync_requests`)
- **OracleDB** para execução das queries
- **Padrão Command/Strategy** no mapa de `handlers`

---

## Pré-requisitos

- Node.js 18+
- Oracle Instant Client instalado (para Thick mode — Oracle 10g/11g)
- Credenciais do Oracle configuradas no Firestore em:
  `tenants/{tenantId}/integracoes/oracle` com os campos: `host`, `user`, `password`

---

## Instalação

```bash
# Copie a pasta equipment-agent para o servidor
cd equipment-agent

# Instale as dependências
npm install

# Crie o .env a partir do exemplo
cp .env.example .env
# Edite .env com o e-mail e senha do usuário administrador do tenant
```

---

## Execução

```bash
# Produção (Oracle real)
npm start

# Modo mock — sem Oracle, retorna dados fictícios
npm run mock

# Desenvolvimento com hot-reload (Node 18+)
npm run dev
```

---

## Como funciona

```
App/Front-end
    |
    | Cria doc em Firestore:
    | tenants/{tenantId}/sync_requests/{id}
    | { status: 'pendente', acao: 'BUSCAR_EQUIPAMENTOS', payload: {...} }
    |
    v
equipment-agent (este serviço)
    |
    | onSnapshot detecta doc com status='pendente'
    | → atualiza status para 'processando'
    | → conecta no Oracle (busca credenciais do Firestore)
    | → executa a query
    | → atualiza o doc com status='concluido' e resultado=[...]
    |
    v
App/Front-end lê o resultado
```

---

## Ações suportadas

| Ação                  | Payload obrigatório           | Opcional           |
|-----------------------|-------------------------------|---------------------|
| `BUSCAR_EQUIPAMENTOS` | `codIntegracao`               | `searchTerm`, `fazendaId` |
| `BUSCAR_OS`           | `codIntegracao`               | `options.apenasAbertas` |

### Exemplo de payload para `BUSCAR_EQUIPAMENTOS`

```json
{
  "status": "pendente",
  "acao": "BUSCAR_EQUIPAMENTOS",
  "payload": {
    "fazendaId": "fazenda-abc",
    "codIntegracao": "01",
    "searchTerm": "TRATOR"
  }
}
```

---

## Adicionando novas ações

1. Crie uma função `processarNovaAcao(requestData, reqRef)` em `agent.js`
2. Registre no mapa `handlers`:
   ```js
   const handlers = {
     BUSCAR_EQUIPAMENTOS: processarBuscaEquipamentos,
     BUSCAR_OS: processarBuscaOS,
     NOVA_ACAO: processarNovaAcao  // <- adicione aqui
   }
   ```

---

## Pontos de atenção

- O `searchTerm` é sanitizado com escape de aspas simples (`''`), mas **evite passar valores não validados** diretamente do usuário.
- As credenciais Oracle ficam no Firestore, nunca no `.env`.
- O agent reconecta automaticamente ao Oracle caso a conexão caia.
