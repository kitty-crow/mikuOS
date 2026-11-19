# sh/lex

The shell lexer expands quoted words, parameters and command substitutions into tokens before parsing pipelines and redirections. It keeps operator boundaries and source positions so incomplete input can be continued without silently changing quoting.

Public names: `Word`, `Tok`, `Gate`, `RMode`, `Redir`, `Cmd`, `Unit`, `Raw`, `expandHereDoc`, `split`, `lex`, `parse`.
