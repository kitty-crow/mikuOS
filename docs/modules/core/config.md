# core/config

System configuration defines kernel and distribution identity, default accounts, local login behaviour and terminal settings. Credential factories return independent complete records so changes to one session do not mutate shared defaults.

Public names: `AccountConfig`, `LocalSessionConfig`, `SystemConfig`, `rootCred`, `guestCred`, `DEFAULT_CONFIG`.
