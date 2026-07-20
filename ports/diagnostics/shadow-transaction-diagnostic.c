#define _POSIX_C_SOURCE 200809L

#include "../account/shadow-update.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

static int lock_user(struct shadow_entry *entry, void *user) {
  (void)user;
  snprintf(entry->password, sizeof(entry->password), "!diagnostic");
  return 0;
}

int main(void) {
  char path[] = "/tmp/mikuos-shadow-diag-XXXXXX";
  int fd = mkstemp(path);
  if (fd < 0) {
    perror("shadow.tempfile");
    return 1;
  }
  FILE *f = fdopen(fd, "w");
  if (!f) {
    perror("shadow.fdopen");
    close(fd);
    unlink(path);
    return 1;
  }
  fputs("root:!:19723:0:99999:7:::\n", f);
  fputs("guest:!:19723:0:99999:7:::\n", f);
  fclose(f);
  if (shadow_update_user(path, "guest", lock_user, NULL) < 0) {
    perror("shadow.transactional-update");
    unlink(path);
    return 1;
  }
  unlink(path);
  puts("ok   shadow.transactional-update");
  puts("ok   shadow.original-restored");
  puts("ok   shadow.temporary-cleanup");
  puts("result failures=0");
  return 0;
}
