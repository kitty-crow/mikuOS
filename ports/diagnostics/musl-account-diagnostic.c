#include "../account/account-db.h"
#include "../account/password-hash.h"

#include <pwd.h>
#include <grp.h>
#include <shadow.h>
#include <stdio.h>
#include <string.h>
#include <unistd.h>

int main(void) {
  int failures = 0;
  struct passwd *root = getpwnam("root");
  struct group *users = getgrnam("users");
  struct spwd *shadow = getspnam("root");
  if (!root || root->pw_uid != 0) { puts("not ok passwd.root"); failures++; }
  else puts("ok passwd.root");
  if (!users) { puts("not ok group.users"); failures++; }
  else puts("ok group.users");
  if (!shadow) { puts("not ok shadow.root"); failures++; }
  else puts("ok shadow.root");
  printf("result failures=%d\n", failures);
  return failures ? 1 : 0;
}
