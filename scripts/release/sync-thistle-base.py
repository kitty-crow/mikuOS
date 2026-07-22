#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import posixpath
import re
import shutil
import stat
import sys
import tempfile
import time
from typing import Any

PROJECT = Path(__file__).resolve().parents[2]
SOURCE = PROJECT / ".thistle"
DESTINATION = PROJECT / ".thistle.base"
FIXED_TIME_MS = 1_700_000_000_000
MAX_GITHUB_FILE = 95 * 1024 * 1024
HOSTNAME = "mikuos"

SAFE_TOP_LEVEL = (
    "bin",
    "sbin",
    "usr",
    "lib",
    "lib64",
    "opt",
    "boot",
    "etc",
)

SAFE_EXTRA_PATHS = (
    "var/lib/mikuos",
)

REMOVE_PATHS = (
    "etc/machine-id",
    "etc/subuid",
    "etc/subgid",
    "etc/passwd-",
    "etc/group-",
    "etc/shadow-",
    "etc/gshadow-",
    "etc/ssl/private",
    "etc/wireguard",
    "etc/NetworkManager/system-connections",
    "etc/sudoers.d",
    "var/lib/dbus/machine-id",
    "var/lib/systemd/random-seed",
    "var/lib/sudo",
)

PRIVATE_NAMES = {
    ".bash_history",
    ".zsh_history",
    ".ash_history",
    ".python_history",
    ".node_repl_history",
    ".lesshst",
    ".wget-hsts",
    ".sqlite_history",
    ".mysql_history",
    ".psql_history",
    "authorized_keys",
    "known_hosts",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
}

PRIVATE_KEY_MARKERS = (
    b"-----BEGIN OPENSSH PRIVATE KEY-----",
    b"-----BEGIN RSA PRIVATE KEY-----",
    b"-----BEGIN EC PRIVATE KEY-----",
    b"-----BEGIN DSA PRIVATE KEY-----",
    b"-----BEGIN PRIVATE KEY-----",
)

HOST_PATH_PATTERN = re.compile(
    r"(?:"
    r"/home/[^/\s]+/"
    r"(?:nodeapps|Downloads|Documents|Desktop|mikuos-private-backups)/"
    r"|"
    r"[A-Za-z]:\\Users\\[^\\\s]+\\"
    r")"
)

PASSWORD_HASH_PATTERN = re.compile(
    r"(?m)^[^:\n]+:\$(?:1|2[aby]?|5|6|y)\$"
)


def fail(message: str) -> None:
    raise RuntimeError(message)


def remove_any(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink(missing_ok=True)
    elif path.is_dir():
        shutil.rmtree(path)


def source_manifest() -> dict[str, Any]:
    metadata = SOURCE / ".thistle-meta.json"
    if not metadata.is_file():
        fail(f"Missing local CLI metadata: {metadata}")

    value = json.loads(metadata.read_text(encoding="utf-8"))
    if value.get("ver") != 1 or not isinstance(value.get("ent"), list):
        fail(f"Unsupported local CLI metadata: {metadata}")
    return value


def fnv_sum(data: bytes) -> str:
    value = 0x811C9DC5
    for byte in data:
        value ^= byte
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"{len(data)}:{value:x}"


def normalise_source_hostname() -> None:
    manifest = source_manifest()
    entries = manifest["ent"]
    by_path = {
        str(entry["p"]): entry
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("p"), str)
    }
    next_id = max(
        (
            int(entry.get("id", 0))
            for entry in by_path.values()
            if isinstance(entry.get("id"), int)
        ),
        default=0,
    ) + 1
    changed = False

    files = {
        "/etc/hostname": f"{HOSTNAME}\n".encode(),
        "/etc/hosts": (
            f"127.0.0.1 localhost {HOSTNAME}\n"
            f"::1 localhost {HOSTNAME}\n"
        ).encode(),
    }

    now = int(time.time() * 1000)

    for guest, data in files.items():
        path = SOURCE / guest.lstrip("/")
        path.parent.mkdir(parents=True, exist_ok=True)
        old_data = path.read_bytes() if path.is_file() and not path.is_symlink() else None
        old = by_path.get(guest)
        expected_sum = fnv_sum(data)
        metadata_ok = (
            old is not None
            and old.get("k") == "f"
            and int(old.get("mode", -1)) == 0o644
            and int(old.get("uid", -1)) == 0
            and int(old.get("gid", -1)) == 0
            and old.get("sum") == expected_sum
        )

        if old_data == data and metadata_ok:
            continue

        remove_any(path)
        path.write_bytes(data)
        os.chmod(path, 0o644)

        if old is None:
            old = {
                "p": guest,
                "id": next_id,
                "at": now,
            }
            next_id += 1
            entries.append(old)
            by_path[guest] = old

        old.update({
            "p": guest,
            "k": "f",
            "mode": 0o644,
            "uid": 0,
            "gid": 0,
            "at": int(old.get("at", now)),
            "mt": now,
            "ct": now,
            "sum": expected_sum,
        })
        old.pop("to", None)
        changed = True

    if changed:
        entries.sort(key=lambda entry: str(entry.get("p", "")))
        metadata = SOURCE / ".thistle-meta.json"
        metadata.write_text(
            json.dumps(manifest, indent=2) + "\n",
            encoding="utf-8",
        )
        os.chmod(metadata, 0o600)
        print("Updated the private CLI root hostname to mikuos.")


def copy_path(relative: str, output: Path) -> None:
    source = SOURCE / relative
    destination = output / relative

    if not source.exists() and not source.is_symlink():
        return

    destination.parent.mkdir(parents=True, exist_ok=True)

    if source.is_symlink():
        destination.symlink_to(os.readlink(source))
    elif source.is_dir():
        shutil.copytree(
            source,
            destination,
            symlinks=True,
            copy_function=shutil.copy2,
        )
    else:
        shutil.copy2(source, destination)


def ensure_directory(root: Path, guest: str, mode: int) -> None:
    path = root / guest.lstrip("/")
    if path.is_symlink() or path.is_file():
        remove_any(path)
    path.mkdir(parents=True, exist_ok=True)
    os.chmod(path, mode)


def write_file(root: Path, guest: str, content: str, mode: int) -> None:
    path = root / guest.lstrip("/")
    path.parent.mkdir(parents=True, exist_ok=True)

    # Protected copied files such as /etc/sudoers may be read-only.
    # Replace the inode rather than attempting to overwrite it in place.
    if path.exists() or path.is_symlink():
        remove_any(path)

    path.write_text(content, encoding="utf-8")
    os.chmod(path, mode)


def guest_path(path: Path, root: Path) -> str:
    relative = path.relative_to(root)
    if not relative.parts:
        return "/"
    return "/" + relative.as_posix()


def redact_host_paths(root: Path) -> None:
    """Remove host build paths from text files, binaries and static archives."""

    patterns = (
        re.compile(rb"/home/[^/\\s]+/(?:nodeapps|Downloads|Documents|Desktop|mikuos-private-backups)/"),
        re.compile(rb"[A-Za-z]:\\\\Users\\\\[^\\\\\s]+\\\\"),
    )

    for path in root.rglob("*"):
        if path.is_symlink() or not path.is_file():
            continue

        data = path.read_bytes()
        updated = data

        for pattern in patterns:
            def replace(match: re.Match[bytes]) -> bytes:
                original = match.group(0)
                prefix = b"/mikuos/build/"
                if len(prefix) > len(original):
                    prefix = b"/src/"
                return prefix + (b"_" * (len(original) - len(prefix)))

            updated = pattern.sub(replace, updated)

        if updated != data:
            path.write_bytes(updated)
            print(f"Redacted host build path from {path.relative_to(root)}")


def scrub(root: Path) -> None:
    for relative in REMOVE_PATHS:
        remove_any(root / relative)

    ssh = root / "etc/ssh"
    if ssh.is_dir():
        for path in ssh.glob("ssh_host_*"):
            remove_any(path)

    candidates = sorted(
        root.rglob("*"),
        key=lambda path: len(path.parts),
        reverse=True,
    )

    for path in candidates:
        name = path.name
        lower = name.lower()
        remove = (
            name in PRIVATE_NAMES
            or lower == ".env"
            or lower.startswith(".env.")
            or lower.endswith(".log")
            or lower.endswith(".bak")
            or lower.endswith(".tmp")
        )
        if remove:
            remove_any(path)

    required_directories = {
        "/": 0o755,
        "/dev": 0o755,
        "/proc": 0o755,
        "/run": 0o755,
        "/tmp": 0o777,
        "/home": 0o755,
        "/home/guest": 0o755,
        "/root": 0o700,
        "/var": 0o755,
        "/var/cache": 0o755,
        "/var/lib": 0o755,
        "/var/log": 0o755,
        "/var/spool": 0o755,
        "/var/spool/mail": 0o755,
        "/var/tmp": 0o777,
        "/etc/sudoers.d": 0o755,
    }

    for guest, mode in required_directories.items():
        ensure_directory(root, guest, mode)

    write_file(
        root,
        "/etc/passwd",
        "root:x:0:0:root:/root:/bin/thsh\n"
        "guest:x:1000:1000:Guest:/home/guest:/bin/thsh\n",
        0o644,
    )

    write_file(
        root,
        "/etc/group",
        "root:x:0:\n"
        "sudo:x:27:guest\n"
        "users:x:1000:guest\n",
        0o644,
    )

    # Root deliberately has an empty password in this browser-local machine.
    # Guest is the default session and may elevate through passwordless sudo.
    write_file(
        root,
        "/etc/shadow",
        "root::19723:0:99999:7:::\n"
        "guest:!:19723:0:99999:7:::\n",
        0o600,
    )

    write_file(
        root,
        "/etc/gshadow",
        "root:!::\n"
        "sudo:!::guest\n"
        "users:!::guest\n",
        0o600,
    )

    write_file(
        root,
        "/etc/sudoers",
        'Defaults env_reset\n'
        'Defaults secure_path="/bin:/usr/bin:/sbin:/usr/sbin"\n'
        'root ALL=(ALL:ALL) ALL\n'
        'guest ALL=(ALL:ALL) NOPASSWD: ALL\n',
        0o440,
    )

    write_file(root, "/etc/hostname", f"{HOSTNAME}\n", 0o644)

    write_file(
        root,
        "/etc/hosts",
        f"127.0.0.1 localhost {HOSTNAME}\n"
        f"::1 localhost {HOSTNAME}\n",
        0o644,
    )

    write_file(
        root,
        "/etc/resolv.conf",
        "# Browser networking is provided by the mikuOS fetch device.\n",
        0o644,
    )

    write_file(
        root,
        "/home/guest/readme.txt",
        "This browser-local guest account may use sudo to become root.\n"
        "The immutable base comes from .thistle.base.\n"
        "Changes are stored only in this browser's local overlay.\n",
        0o644,
    )


def build_metadata(root: Path, source: dict[str, Any]) -> None:
    old_entries = {
        str(entry["p"]): entry
        for entry in source.get("ent", [])
        if isinstance(entry, dict) and isinstance(entry.get("p"), str)
    }

    next_id = max(
        (
            int(entry.get("id", 0))
            for entry in old_entries.values()
            if isinstance(entry.get("id"), int)
        ),
        default=0,
    ) + 1

    generated_paths = {
        "/dev",
        "/proc",
        "/run",
        "/tmp",
        "/home",
        "/home/guest",
        "/home/guest/readme.txt",
        "/root",
        "/var/cache",
        "/var/log",
        "/var/spool",
        "/var/spool/mail",
        "/var/tmp",
        "/etc/passwd",
        "/etc/group",
        "/etc/shadow",
        "/etc/gshadow",
        "/etc/hostname",
        "/etc/hosts",
        "/etc/resolv.conf",
        "/etc/sudoers",
        "/etc/sudoers.d",
    }

    paths = [root]
    paths.extend(
        sorted(
            (
                path
                for path in root.rglob("*")
                if path.name != ".thistle-meta.json"
            ),
            key=lambda path: (
                len(path.relative_to(root).parts),
                path.relative_to(root).as_posix(),
            ),
        )
    )

    entries: list[dict[str, Any]] = []

    for path in paths:
        guest = guest_path(path, root)
        old = old_entries.get(guest, {})
        status = path.lstat()

        old_id = old.get("id")
        if isinstance(old_id, int) and old_id > 0:
            inode_id = old_id
        else:
            inode_id = next_id
            next_id += 1

        generated = guest in generated_paths
        mode = (
            stat.S_IMODE(status.st_mode)
            if generated
            else int(old.get("mode", stat.S_IMODE(status.st_mode)))
        )

        if guest == "/home/guest" or guest.startswith("/home/guest/"):
            uid, gid = 1000, 1000
        elif generated:
            uid, gid = 0, 0
        else:
            uid = int(old.get("uid", 0))
            gid = int(old.get("gid", 0))

        at = FIXED_TIME_MS if generated else int(old.get("at", FIXED_TIME_MS))
        mt = FIXED_TIME_MS if generated else int(old.get("mt", FIXED_TIME_MS))
        ct = FIXED_TIME_MS if generated else int(old.get("ct", FIXED_TIME_MS))

        base: dict[str, Any] = {
            "p": guest,
            "id": inode_id,
            "mode": mode,
            "uid": uid,
            "gid": gid,
            "at": at,
            "mt": mt,
            "ct": ct,
        }

        if path.is_symlink():
            target = old.get("to")
            if not isinstance(target, str):
                target = os.readlink(path)
            entries.append({**base, "k": "l", "to": target})
        elif path.is_dir():
            entries.append({**base, "k": "d"})
        elif path.is_file():
            data = path.read_bytes()
            entries.append({
                **base,
                "k": "f",
                "sum": fnv_sum(data),
            })
        else:
            fail(f"Unsupported filesystem entry: {guest}")

    entries.sort(
        key=lambda entry: (
            str(entry["p"]).count("/"),
            str(entry["p"]),
        )
    )

    manifest = {
        "ver": 1,
        "image": int(source.get("image", 0)),
        "ent": entries,
    }

    metadata = root / ".thistle-meta.json"
    metadata.write_text(
        json.dumps(manifest, indent=2) + "\n",
        encoding="utf-8",
    )
    os.chmod(metadata, 0o600)


def resolve_guest_entry(
    entries: dict[str, dict[str, Any]],
    guest: str,
) -> tuple[str, dict[str, Any]]:
    current = posixpath.normpath(guest)

    for _ in range(32):
        entry = entries.get(current)
        if entry is None:
            fail(f"Metadata has no entry for {current}")
        if entry.get("k") != "l":
            return current, entry

        target = entry.get("to")
        if not isinstance(target, str):
            fail(f"Symlink has no target: {current}")

        if target.startswith("/"):
            current = posixpath.normpath(target)
        else:
            current = posixpath.normpath(
                posixpath.join(posixpath.dirname(current), target)
            )

        pure = PurePosixPath(current)
        if not pure.is_absolute() or ".." in pure.parts:
            fail(f"Symlink escapes the guest root: {guest}")

    fail(f"Symlink loop while resolving {guest}")


def command_entry(
    entries: dict[str, dict[str, Any]],
    command: str,
) -> tuple[str, dict[str, Any]]:
    for directory in ("/bin", "/usr/bin", "/sbin", "/usr/sbin"):
        guest = f"{directory}/{command}"
        if guest in entries:
            return resolve_guest_entry(entries, guest)
    fail(f"Required public binary is missing: {command}")


def audit(root: Path) -> None:
    expected_passwd = (
        "root:x:0:0:root:/root:/bin/thsh\n"
        "guest:x:1000:1000:Guest:/home/guest:/bin/thsh\n"
    )
    expected_group = (
        "root:x:0:\n"
        "sudo:x:27:guest\n"
        "users:x:1000:guest\n"
    )
    expected_shadow = (
        "root::19723:0:99999:7:::\n"
        "guest:!:19723:0:99999:7:::\n"
    )

    if (root / "etc/passwd").read_text(encoding="utf-8") != expected_passwd:
        fail("Unexpected accounts remain in /etc/passwd")

    if (root / "etc/group").read_text(encoding="utf-8") != expected_group:
        fail("Unexpected groups remain in /etc/group")

    if (root / "etc/shadow").read_text(encoding="utf-8") != expected_shadow:
        fail("Unexpected password material remains in /etc/shadow")

    if (root / "etc/hostname").read_text(encoding="utf-8") != f"{HOSTNAME}\n":
        fail("The controlled base hostname is not mikuos")

    sudoers = (root / "etc/sudoers").read_text(encoding="utf-8")
    if "guest ALL=(ALL:ALL) NOPASSWD: ALL" not in sudoers:
        fail("Guest passwordless sudo is not configured")

    metadata = json.loads(
        (root / ".thistle-meta.json").read_text(encoding="utf-8")
    )
    entries = {
        str(entry["p"]): entry
        for entry in metadata.get("ent", [])
        if isinstance(entry, dict) and isinstance(entry.get("p"), str)
    }

    for command in ("su", "sudo"):
        path, entry = command_entry(entries, command)
        mode = int(entry.get("mode", 0))
        uid = int(entry.get("uid", -1))
        if entry.get("k") != "f" or uid != 0 or not (mode & 0o4000):
            fail(
                f"{path} must be a root-owned setuid file; "
                f"found uid={uid} mode={mode:o}"
            )

    command_entry(entries, "nano")

    permitted_home = {
        root / "home/guest",
        root / "home/guest/readme.txt",
    }

    for path in (root / "home").rglob("*"):
        if path not in permitted_home:
            fail(f"Unexpected home-directory content: {path.relative_to(root)}")

    root_home = root / "root"
    if any(root_home.iterdir()):
        fail("The controlled /root directory is not empty")

    total_size = 0
    file_count = 0

    for path in root.rglob("*"):
        if path.is_symlink() or not path.is_file():
            continue

        size = path.stat().st_size
        total_size += size
        file_count += 1

        if size > MAX_GITHUB_FILE:
            fail(
                f"{path.relative_to(root)} is {size} bytes, "
                "which is too large for the Git repository"
            )

        data = path.read_bytes()

        for marker in PRIVATE_KEY_MARKERS:
            if marker in data:
                fail(
                    f"Private-key material found in "
                    f"{path.relative_to(root)}"
                )

        text = data.decode("utf-8", errors="ignore")
        host_match = HOST_PATH_PATTERN.search(text)
        if host_match:
            fail(
                f"Host-specific absolute path found in "
                f"{path.relative_to(root)}: {host_match.group(0)}"
            )

        if PASSWORD_HASH_PATTERN.search(text):
            fail(
                f"Password-hash material found in "
                f"{path.relative_to(root)}"
            )

    print(
        f"Controlled base audit passed: "
        f"{file_count} files, {total_size} bytes"
    )


def tree_digest(root: Path) -> str:
    digest = hashlib.sha256()

    if not root.exists():
        return ""

    paths = [root]
    paths.extend(
        sorted(
            root.rglob("*"),
            key=lambda path: path.relative_to(root).as_posix(),
        )
    )

    for path in paths:
        relative = "." if path == root else path.relative_to(root).as_posix()
        status = path.lstat()

        digest.update(relative.encode())
        digest.update(b"\0")
        digest.update(str(stat.S_IMODE(status.st_mode)).encode())
        digest.update(b"\0")

        if path.is_symlink():
            digest.update(b"l\0")
            digest.update(os.readlink(path).encode())
        elif path.is_dir():
            digest.update(b"d\0")
        elif path.is_file():
            digest.update(b"f\0")
            with path.open("rb") as stream:
                for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                    digest.update(chunk)

        digest.update(b"\0")

    return digest.hexdigest()


def build_candidate() -> Path:
    normalise_source_hostname()
    source = source_manifest()

    output = Path(
        tempfile.mkdtemp(
            prefix=".thistle.base.tmp-",
            dir=PROJECT,
        )
    )

    try:
        for relative in SAFE_TOP_LEVEL:
            copy_path(relative, output)

        for relative in SAFE_EXTRA_PATHS:
            copy_path(relative, output)

        scrub(output)
        redact_host_paths(output)
        build_metadata(output, source)
        audit(output)
        return output
    except Exception:
        shutil.rmtree(output, ignore_errors=True)
        raise


def install(candidate: Path) -> None:
    previous = PROJECT / ".thistle.base.previous"

    remove_any(previous)

    if DESTINATION.exists():
        DESTINATION.rename(previous)

    try:
        candidate.rename(DESTINATION)
    except Exception:
        if previous.exists() and not DESTINATION.exists():
            previous.rename(DESTINATION)
        raise
    else:
        remove_any(previous)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Create the controlled public .thistle.base "
            "from the private local .thistle root."
        )
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="fail when .thistle.base does not match .thistle",
    )
    args = parser.parse_args()

    candidate = build_candidate()

    try:
        if args.check:
            expected = tree_digest(candidate)
            current = tree_digest(DESTINATION)

            if expected != current:
                print(
                    "ERROR: .thistle.base is stale.\n"
                    "Run: npm run git:upload",
                    file=sys.stderr,
                )
                return 1

            print(".thistle.base is current.")
            return 0

        install(candidate)
        print(f"Updated {DESTINATION}")
        return 0
    finally:
        if candidate and candidate.exists():
            shutil.rmtree(candidate, ignore_errors=True)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
