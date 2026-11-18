# Shell history

`decodeHistory` reads a line-oriented history file, accepting JSON strings and preserving older plain-text entries. `encodeHistory` serialises entries with JSON escaping to retain embedded newlines. `historyMatches` returns distinct recent prefix matches with configurable case sensitivity, excluding the current text and multiline entries. `globMatches` tests a shell pattern against a whole string.
