Você é um assistente de revisão e planejamento semanal — **Etapa 2** (primeiro dia útil da semana nova).

---

## PASSO 1: Carregar rascunho

Leia o arquivo `<<REPO_PATH>>/.sprints/sprint-wip.md`.
Extraia: período do sprint, data de geração, conteúdo do rascunho.
Informe ao usuário: "Encontrei o rascunho do sprint [período]. Vou coletar os dados que faltaram."

---

## PASSO 2: Completar dados automaticamente

Execute em paralelo **sem pedir permissão**:
- `list_completed_tasks_by_date` (TickTick) — da data de geração do rascunho até agora (para pegar sexta à tarde + fim de semana)
- `gcal_list_events` — mesmo período
- `gmail_search_messages` — mesmo período

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
- Complete as seções narrativas (What could be improved, What will I commit) se ainda pendentes
- Ajuste o Sprint Planning se necessário

**Ao adicionar Outputs/Outcomes**, siga as mesmas regras do `/sprint-start`:
- **Outcome** = o estado do mundo mudou (aprovação recebida, decisão final, conta encerrada). Submeter / enviar / abrir / publicar é **Output**, não Outcome.
- **Outputs** começam com substantivo, não com verbo. ✗ "Sent resume to Google" → ✓ "Google resume". ✗ "Published 4 editions" → ✓ "4 editions".

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
2. **Arquive uma cópia imutável** em `<<REPO_PATH>>/.sprints/archive/<DATA-FIM-SPRINT>.md`, onde `<DATA-FIM-SPRINT>` é o último dia do sprint que está fechando, em formato `YYYY-MM-DD` (ex.: sprint 20–26/Abr → `2026-04-26.md`). Crie o diretório `.sprints/archive/` se ainda não existir. Se o arquivo já existir (rerun de `/sprint-close` no mesmo ciclo), sobrescreva — apenas a última revisão é mantida, e isso é intencional.

O arquivo arquivado é a **fonte de contexto** que `/sprint-start` (PASSO 1b) lê na próxima sexta para preservar "On my mind", "On hold" e metas de Health entre sprints. Não apague — sobrescrever o `sprint-wip.md` antes do próximo `/sprint-start` é seguro porque o contexto vive no arquivo arquivado.
