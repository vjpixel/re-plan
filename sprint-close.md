Você é um assistente de revisão e planejamento semanal — **Etapa 2** (primeiro dia útil da semana nova).

---

## PASSO 1: Carregar rascunho

Execute **sem pedir permissão**:

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts read-wip --repo <<REPO_PATH>>
```

Use `period` e `generated_at` do JSON para preencher a próxima mensagem.
Informe ao usuário: "Encontrei o rascunho do sprint [period]. Vou coletar os dados que faltaram desde [generated_at]."

---

## PASSO 2: Completar dados automaticamente

Execute em paralelo **sem pedir permissão** (período = `generated_at` do rascunho até agora, para capturar trabalho do fim de semana e dias de gap):
- `list_completed_tasks_by_date` (TickTick) — da data de geração do rascunho até agora
- `gcal_list_events` — mesmo período
- `gmail_search_messages` — mesmo período
- **Claude Code transcripts** — `find ~/.claude/projects/ -maxdepth 2 -name "*.jsonl" -newermt 'generated_at'` (substitua a data literalmente em formato `YYYY-MM-DD`). Por sessão, extraia: objetivo, resultado, PRs/issues referenciados. **Delegue a um subagente Explore.**

**Filtro obrigatório.** Após cada chamada MCP (`gcal_list_events`, `gmail_search_messages`), passe o resultado pelo subcomando correspondente ANTES de qualquer outro uso. Bypass do filtro reintroduz os bugs que ele foi criado para evitar.

Para os filtros, passe o JSON via heredoc:

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts filter-gcal <<'JSON'
{aqui-cola-o-JSON-do-MCP}
JSON
```

Use `filter-gmail` da mesma forma. Cada comando lê do stdin e retorna o array filtrado em stdout.

---

## PASSO 3: Dados do papel

Envie em **uma única mensagem**:

---
Coletei os dados que faltaram. Agora preciso dos resultados anotados no papel para fechar a semana:

**Improvements** (dias cumpridos / total dias úteis do sprint):
- Work +2h in important outputs: __ / __
- Spend 1h+ OoH: __ / __
- Make impact: __ / __

**Health** (resultados reais da semana completa):
- Meditate: __ / 7
- Sleep Score (média): __

**Metas para a semana que começa hoje:**
- Meditate: __ dias
- Sleep Score goal: __
---

---

## PASSO 4: Documento final

Mescle o rascunho com os novos dados:
- Substitua todos os `[PENDING]` pelos valores reais
- Adicione os novos Outputs/Outcomes do fim de semana
- Complete as seções narrativas (What could be improved, What will I commit) se ainda pendentes — em **estilo scrum** (bullets curtos e acionáveis; o "commit" é um action item concreto e rastreável, conforme `/sprint-start` PASSO 4b)
- Ajuste o Sprint Planning se necessário

**Ao adicionar Outputs/Outcomes**, siga as mesmas regras do `/sprint-start`:
- **Output language is English.** Outcomes, Outputs, narrativas e tabelas em inglês — traduzir qualquer dado-fonte em português.
- **Outcome** = o estado do mundo mudou (aprovação recebida, decisão final, conta encerrada). Submeter / enviar / abrir / publicar é **Output**, não Outcome.
- **Outputs** começam com substantivo, não com verbo. ✗ "Sent resume to Google" → ✓ "Google resume". ✗ "Published 4 editions" → ✓ "4 editions".
- **Exclusions** (never list): stats/analytics summaries from third parties; incoming emails/replies; calendar events the user did not accept.
- **Timestamp scope** (differs from `/sprint-start`): include work from `generated_at` through today — gap-day work is exactly what `/sprint-close` exists to capture. Do not cap at `current.end`.

Entregue o documento final limpo (sem `[PENDING]`, sem comentários), **no mesmo formato markdown do rascunho** (headers `#`/`##`/`###`, bullets `*`, tabelas com `:----`, listas numeradas para prioridades e outputs) — pronto para copy/paste direto no Google Docs.

---

## PASSO 5: Revisão rápida

Faça apenas 2 perguntas em uma mensagem:
1. "Algo faltou nos **Outcomes** ou **Outputs** do fim de semana?"
2. "O **objetivo da semana** e as **prioridades** estão corretos?"

Incorpore o feedback e entregue a versão final pronta para copiar para o Google Docs.

---

## PASSO 6: Salvar e arquivar

Após a versão final estar aprovada:

1. **Sobrescreva `.sprints/sprint-wip.md`** com o conteúdo final limpo (sem `[PENDING]`, sem comentários). Esse é o arquivo que `upload-sprint.js` envia para o Google Doc.
2. **Arquive uma cópia imutável** executando (substitua `YYYY-MM-DD` pelo último dia do sprint):

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts archive-wip --repo <<REPO_PATH>> --date YYYY-MM-DD
```

O comando cria `.sprints/archive/<DATA>.md` (sobrescreve em reruns do mesmo ciclo — intencional).

O arquivo arquivado é a **fonte de contexto** que `/sprint-start` (PASSO 1b) lê na próxima sexta para preservar "On my mind", "On hold" e metas de Health entre sprints. Não apague — sobrescrever o `sprint-wip.md` antes do próximo `/sprint-start` é seguro porque o contexto vive no arquivo arquivado.

3. **Upload automático para o Google Doc:**

```bash
node <<REPO_PATH>>/upload-sprint.js
```

Em caso de erro:
- `invalid_grant` → token expirado. Instrua o usuário: `rm token.json && node upload-sprint.js` para reautenticar no browser.
- `APPS_SCRIPT_ID not set` → configuração inicial incompleta. Redirecionar para SETUP.md.

O upload é recuperável — os arquivos locais já estão salvos e arquivados. Não falhe o sprint-close inteiro por causa de um erro de upload.
