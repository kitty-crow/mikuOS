# sh/prefs

Shell preference parsing validates recognised booleans, bounded integers, key names and script language values. Unknown keys survive text updates; malformed settings produce warnings while valid preferences retain their own typed fields.

Public names: `ShellPrefs`, `DEFAULT_PREFS`, `PREF_KEYS`, `defaultPrefs`, `ParsedPrefs`, `parsePrefs`, `prefsText`, `updatePrefsText`, `DEFAULT_PREFS_FILE`.
