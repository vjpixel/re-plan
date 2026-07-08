Grave o JSON num arquivo (tool Write) e passe via `--file` — mais confiável que heredoc no Windows/git-bash, onde heredocs podem falhar com `unexpected EOF` por causa de finais de linha CRLF quebrando o delimitador:

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts filter-gcal --file arquivo.json
```

Alternativa (evita o arquivo intermediário, mas sujeita ao problema de CRLF acima): heredoc via stdin, com aspas simples no delimitador para evitar quoting issues com aspas, backticks, `$`:

```bash
node -r tsx/cjs <<REPO_PATH>>/bin/sprint.ts filter-gcal <<'JSON'
{aqui-cola-o-array-de-eventos-do-MCP, sem processamento}
JSON
```
