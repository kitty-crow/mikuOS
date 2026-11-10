/* Vendored from kitty-crow/unicode-art-studio/extras/term/colour.h
 * Copyright (c) 2026 Kitty Crow, MIT licence. See src/boot/COLOUR-LICENCE.
 * Keep this parser in sync with Unicode Art Studio's <#RRGGBB> format.
 */
#ifndef COLOUR_H
#define COLOUR_H

#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#include <wchar.h>

#define LOGO_C_SENT ((wchar_t)0xE000)
#define LOGO_C_MAX_A 64
#define LOGO_C_MAX_N 31

struct logoCAlias { char n[LOGO_C_MAX_N + 1]; int r; int g; int b; int d; };

static struct logoCAlias logoCA[LOGO_C_MAX_A];
static int logoCAN = 0;
static dev_t logoCDev = 0;
static ino_t logoCIno = 0;
static int logoCBound = 0;
static int logoCDefs = 0;

static inline int logoCHex(int c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return 10 + (c - 'a');
  if (c >= 'A' && c <= 'F') return 10 + (c - 'A');
  return -1;
}

static inline int logoCSp(int c) { return c == ' ' || c == '\t' || c == '\n' || c == '\r' || c == '\f' || c == '\v'; }
static inline const char *logoCSkipSp(const char *s) { while (*s && logoCSp((unsigned char)*s)) s++; return s; }
static inline int logoCName(int c) { return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_' || c == '-'; }
static inline void logoCClr(void) { logoCAN = 0; }

static inline void logoCStore(const char *n, size_t nl, int r, int g, int b, int d) {
  for (int i = 0; i < logoCAN; i++) {
    if (strlen(logoCA[i].n) != nl || memcmp(logoCA[i].n, n, nl) != 0) continue;
    logoCA[i].r = r; logoCA[i].g = g; logoCA[i].b = b; logoCA[i].d = d; return;
  }
  if (logoCAN >= LOGO_C_MAX_A || nl > LOGO_C_MAX_N) return;
  struct logoCAlias *a = &logoCA[logoCAN++];
  memcpy(a->n, n, nl); a->n[nl] = '\0'; a->r = r; a->g = g; a->b = b; a->d = d;
}

static inline const struct logoCAlias *logoCFind(const char *n, size_t nl) {
  for (int i = 0; i < logoCAN; i++) if (strlen(logoCA[i].n) == nl && memcmp(logoCA[i].n, n, nl) == 0) return &logoCA[i];
  return NULL;
}

static inline int logoCSpec(const char *s, size_t *sl, int *r, int *g, int *b, int *d) {
  if (!s || s[0] != '#') return 0;
  if ((s[1] == 'd' || s[1] == 'D') && (s[2] == 'e' || s[2] == 'E') && (s[3] == 'f' || s[3] == 'F') && (s[4] == 'a' || s[4] == 'A') && (s[5] == 'u' || s[5] == 'U') && (s[6] == 'l' || s[6] == 'L') && (s[7] == 't' || s[7] == 'T')) {
    *sl = 8; *r = *g = *b = 0; *d = 1; return 1;
  }
  if (logoCHex((unsigned char)s[1]) >= 0 && logoCHex((unsigned char)s[2]) >= 0 && logoCHex((unsigned char)s[3]) >= 0 && logoCHex((unsigned char)s[4]) >= 0 && logoCHex((unsigned char)s[5]) >= 0 && logoCHex((unsigned char)s[6]) >= 0) {
    int r1 = logoCHex((unsigned char)s[1]), r2 = logoCHex((unsigned char)s[2]);
    int g1 = logoCHex((unsigned char)s[3]), g2 = logoCHex((unsigned char)s[4]);
    int b1 = logoCHex((unsigned char)s[5]), b2 = logoCHex((unsigned char)s[6]);
    *sl = 7; *r = (r1 << 4) | r2; *g = (g1 << 4) | g2; *b = (b1 << 4) | b2; *d = 0; return 1;
  }
  if (logoCHex((unsigned char)s[1]) >= 0 && logoCHex((unsigned char)s[2]) >= 0 && logoCHex((unsigned char)s[3]) >= 0) {
    int rv = logoCHex((unsigned char)s[1]), gv = logoCHex((unsigned char)s[2]), bv = logoCHex((unsigned char)s[3]);
    *sl = 4; *r = (rv << 4) | rv; *g = (gv << 4) | gv; *b = (bv << 4) | bv; *d = 0; return 1;
  }
  return 0;
}

static inline int logoCHexTag(const char *s, size_t *tl, int *r, int *g, int *b, int *d, int *bg) {
  if (!s || s[0] != '<') return 0;
  size_t off = 1; *bg = 0;
  if (s[off] == '@') { *bg = 1; off++; }
  if (s[off] != '#') return 0;
  size_t sl = 0;
  if (!logoCSpec(s + off, &sl, r, g, b, d) || s[off + sl] != '>') return 0;
  *tl = off + sl + 1; return 1;
}

static inline int logoCAliasTag(const char *s, size_t *tl, int *r, int *g, int *b, int *d, int *bg) {
  if (!s || s[0] != '<') return 0;
  size_t off = 1; *bg = 0;
  if (s[off] == '@') { *bg = 1; off++; }
  if (s[off] == '#' || s[off] == '>' || !logoCName((unsigned char)s[off])) return 0;
  const char *n = s + off; size_t nl = 0;
  while (logoCName((unsigned char)n[nl])) nl++;
  if (n[nl] != '>') return 0;
  if (nl == 7 && memcmp(n, "default", 7) == 0) { *tl = off + nl + 1; *r = *g = *b = 0; *d = 1; return 1; }
  const struct logoCAlias *a = logoCFind(n, nl); if (!a) return 0;
  *tl = off + nl + 1; *r = a->r; *g = a->g; *b = a->b; *d = a->d; return 1;
}

static inline int logoCTag(const char *s, size_t *tl, int *r, int *g, int *b, int *d, int *bg) {
  return logoCHexTag(s, tl, r, g, b, d, bg) || logoCAliasTag(s, tl, r, g, b, d, bg);
}

static inline int logoCDefLine(const char *line) {
  const char *p = logoCSkipSp(line);
  if (p[0] != '#' || p[1] != 'd' || p[2] != 'e' || p[3] != 'f' || p[4] != 'i' || p[5] != 'n' || p[6] != 'e') return 0;
  if (p[7] != '\0' && !logoCSp((unsigned char)p[7])) return 0;
  p = logoCSkipSp(p + 7); const char *n = p; size_t nl = 0;
  while (logoCName((unsigned char)p[nl])) nl++;
  if (nl == 0 || nl > LOGO_C_MAX_N) return 0;
  p = logoCSkipSp(p + nl); if (*p != '=') return 0; p = logoCSkipSp(p + 1);
  size_t sl = 0; int r = 0, g = 0, b = 0, d = 0;
  if (!logoCSpec(p, &sl, &r, &g, &b, &d)) return 0;
  p = logoCSkipSp(p + sl); if (*p != ';') return 0; p = logoCSkipSp(p + 1); if (*p != '\0') return 0;
  logoCStore(n, nl, r, g, b, d); return 1;
}

static inline int logoCId(FILE *fp, dev_t *dev, ino_t *ino) {
  if (!fp || !dev || !ino) return 0;
  int fd = fileno(fp);
  if (fd < 0) return 0;
  struct stat st;
  if (fstat(fd, &st) != 0) return 0;
  *dev = st.st_dev;
  *ino = st.st_ino;
  return 1;
}

static inline int logoCIsLogo(FILE *fp) {
  const char *path = getenv("ASCII_LOGO");
  if (!path || !*path || !fp) return 0;
  struct stat want;
  if (stat(path, &want) != 0) return 0;
  int fd = fileno(fp);
  if (fd < 0) return 0;
  struct stat got;
  if (fstat(fd, &got) != 0) return 0;
  return want.st_dev == got.st_dev && want.st_ino == got.st_ino;
}

static inline void logoCBind(FILE *fp) {
  dev_t dev = 0; ino_t ino = 0; if (!logoCId(fp, &dev, &ino)) return;
  if (!logoCBound || logoCDev != dev || logoCIno != ino) { logoCDev = dev; logoCIno = ino; logoCBound = 1; logoCDefs = 0; logoCClr(); }
}

static inline char *logoCFGets(char *s, int size, FILE *fp) {
  if (!s || size <= 0 || !fp) return NULL;
  if (!logoCIsLogo(fp)) return fgets(s, size, fp);
  logoCBind(fp); if (logoCDefs) return fgets(s, size, fp); logoCDefs = 1;
  while (fgets(s, size, fp)) { if (logoCDefLine(s)) continue; return s; }
  return NULL;
}

static inline size_t logoCMbr(wchar_t *wc, const char *s, size_t n, mbstate_t *st) {
  size_t tl = 0; int r = 0, g = 0, b = 0, d = 0, bg = 0;
  if (logoCTag(s, &tl, &r, &g, &b, &d, &bg)) { if (wc) *wc = LOGO_C_SENT; return tl; }
  return mbrtowc(wc, s, n, st);
}

static inline int logoCW(wchar_t wc) { if (wc == LOGO_C_SENT) return 0; return wcwidth(wc); }

static inline int logoCEsc(FILE *fp, int r, int g, int b, int d, int bg) {
  if (d) return fprintf(fp, bg ? "\033[49m" : "\033[39m") < 0 ? EOF : 0;
  return fprintf(fp, bg ? "\033[48;2;%d;%d;%dm" : "\033[38;2;%d;%d;%dm", r, g, b) < 0 ? EOF : 0;
}

static inline int logoCFPuts(const char *s, FILE *fp) {
  const char *chunk = s, *cur = s; int saw = 0; if (!s) return EOF;
  while (*cur) {
    size_t tl = 0; int r = 0, g = 0, b = 0, d = 0, bg = 0;
    if (!logoCTag(cur, &tl, &r, &g, &b, &d, &bg)) { cur++; continue; }
    if (cur > chunk) { size_t len = (size_t)(cur - chunk); if (fwrite(chunk, 1, len, fp) != len) return EOF; }
    saw = 1; if (logoCEsc(fp, r, g, b, d, bg) == EOF) return EOF; cur += tl; chunk = cur;
  }
  if (cur > chunk) { size_t len = (size_t)(cur - chunk); if (fwrite(chunk, 1, len, fp) != len) return EOF; }
  if (saw && (logoCEsc(fp, 0, 0, 0, 1, 0) == EOF || logoCEsc(fp, 0, 0, 0, 1, 1) == EOF)) return EOF;
  return 0;
}

static inline int logoCPuts(const char *s) { if (logoCFPuts(s, stdout) == EOF) return EOF; return fputc('\n', stdout) == EOF ? EOF : 0; }

static inline int logoCRender(FILE *in, FILE *out) {
  if (!in || !out) return EOF;
  char line[65536]; int defs = 1; logoCClr();
  while (fgets(line, (int)sizeof(line), in)) {
    if (defs && logoCDefLine(line)) continue;
    defs = 0;
    if (logoCFPuts(line, out) == EOF) return EOF;
  }
  return ferror(in) ? EOF : 0;
}

#define fgets   logoCFGets
#define mbrtowc logoCMbr
#define wcwidth logoCW
#define fputs   logoCFPuts
#define puts    logoCPuts

#endif
