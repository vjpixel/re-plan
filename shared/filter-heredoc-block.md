Passe o JSON via heredoc (evita quoting issues com aspas, backticks, `$`):

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts filter-gcal <<'JSON'
{aqui-cola-o-array-de-eventos-do-MCP, sem processamento}
JSON
```

Alternativa mais confiável no Windows/git-bash — heredocs podem falhar com `unexpected EOF` por causa de finais de linha CRLF quebrando o delimitador: grave o JSON num arquivo (tool Write) e use `--file`, sem precisar de stdin/heredoc:

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts filter-gcal --file arquivo.json
```
