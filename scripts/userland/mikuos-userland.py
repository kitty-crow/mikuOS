#!/usr/bin/env python3
"""Safely stage, activate, inspect and roll back upstream mikuOS commands.

This tool edits a host-backed mikuOS root such as .thistle. It never compiles
software. Candidates must already be host-cross-compiled for RV64GC/LP64D musl
and converted to THX2 before they are staged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import stat
import sys
import tempfile
import time
from typing import Any

SCHEMA = 1
META_NAME = ".thistle-meta.json"
OVERRIDES = "/var/lib/mikuos/userland-overrides.json"
RESCUE_ROOT = "/usr/libexec/mikuos/builtin"
UPSTREAM_ROOT = "/usr/libexec/mikuos/upstream"


class UserlandError(RuntimeError):
    pass


def utc_stamp() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime())


def utc_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def guest_path(value: str) -> str:
    path = PurePosixPath(value)
    if not path.is_absolute() or ".." in path.parts:
        raise UserlandError(f"invalid guest path: {value}")
    return str(path)


def command_name(value: str) -> str:
    if not value or "/" in value or value in {".", ".."}:
        raise UserlandError(f"invalid command name: {value!r}")
    return value


def package_name(value: str) -> str:
    if not value or value in {".", ".."} or any(ch not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._+-" for ch in value):
        raise UserlandError(f"invalid package name: {value!r}")
    return value


def host_path(root: Path, guest: str) -> Path:
    guest = guest_path(guest)
    root_absolute = Path(os.path.abspath(root))
    candidate = Path(os.path.abspath(root_absolute / guest.lstrip("/")))
    try:
        common = Path(os.path.commonpath([root_absolute, candidate]))
    except ValueError as error:
        raise UserlandError(f"guest path escapes root: {guest}") from error
    if common != root_absolute:
        raise UserlandError(f"guest path escapes root: {guest}")
    return candidate


def load_json(path: Path, default: Any | None = None) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        if default is not None:
            return default
        raise UserlandError(f"missing file: {path}") from None
    except json.JSONDecodeError as error:
        raise UserlandError(f"invalid JSON in {path}: {error}") from error


def write_json_atomic(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp-{os.getpid()}")
    temporary.write_text(json.dumps(value, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    os.replace(temporary, path)


def fnv_sum(data: bytes) -> str:
    value = 0x811C9DC5
    for byte in data:
        value ^= byte
        value = (value * 0x01000193) & 0xFFFFFFFF
    return f"{len(data)}:{value:x}"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def now_ms() -> int:
    return int(time.time() * 1000)


class RootEditor:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.meta_path = self.root / META_NAME
        self.manifest = load_json(self.meta_path)
        if self.manifest.get("ver") != 1 or not isinstance(self.manifest.get("ent"), list):
            raise UserlandError(f"unsupported metadata format: {self.meta_path}")
        self.entries: list[dict[str, Any]] = self.manifest["ent"]
        self.by_path: dict[str, dict[str, Any]] = {entry["p"]: entry for entry in self.entries}
        self.next_id = max((int(entry.get("id", 0)) for entry in self.entries), default=0) + 1

    def allocate_id(self) -> int:
        value = self.next_id
        self.next_id += 1
        return value

    def entry(self, path: str) -> dict[str, Any] | None:
        return self.by_path.get(guest_path(path))

    def replace_entry(self, entry: dict[str, Any]) -> None:
        path = guest_path(str(entry["p"]))
        entry["p"] = path
        old = self.by_path.get(path)
        if old is None:
            self.entries.append(entry)
        else:
            self.entries[self.entries.index(old)] = entry
        self.by_path[path] = entry

    def ensure_directory(self, guest: str, mode: int = 0o755) -> None:
        guest = guest_path(guest)
        if guest == "/":
            return
        parent = str(PurePosixPath(guest).parent)
        self.ensure_directory(parent, mode)
        path = host_path(self.root, guest)
        path.mkdir(exist_ok=True)
        os.chmod(path, mode)
        old = self.entry(guest)
        timestamp = now_ms()
        if old is not None and old.get("k") != "d":
            raise UserlandError(f"{guest} exists but is not a directory")
        self.replace_entry({
            "p": guest,
            "k": "d",
            "id": int(old["id"]) if old else self.allocate_id(),
            "mode": mode,
            "uid": 0,
            "gid": 0,
            "at": int(old.get("at", timestamp)) if old else timestamp,
            "mt": timestamp,
            "ct": timestamp,
        })

    def install_file(self, guest: str, source: Path, mode: int = 0o755) -> None:
        guest = guest_path(guest)
        self.ensure_directory(str(PurePosixPath(guest).parent))
        destination = host_path(self.root, guest)
        if destination.is_dir() and not destination.is_symlink():
            raise UserlandError(f"refusing to replace directory: {guest}")
        destination.unlink(missing_ok=True)
        shutil.copyfile(source, destination)
        os.chmod(destination, mode)
        data = destination.read_bytes()
        old = self.entry(guest)
        timestamp = now_ms()
        self.replace_entry({
            "p": guest,
            "k": "f",
            "id": int(old["id"]) if old and old.get("k") == "f" else self.allocate_id(),
            "mode": mode,
            "uid": 0,
            "gid": 0,
            "at": int(old.get("at", timestamp)) if old else timestamp,
            "mt": timestamp,
            "ct": timestamp,
            "sum": fnv_sum(data),
        })

    def install_symlink(self, guest: str, target: str, mode: int = 0o777) -> None:
        guest = guest_path(guest)
        target = guest_path(target)
        self.ensure_directory(str(PurePosixPath(guest).parent))
        destination = host_path(self.root, guest)
        if destination.is_dir() and not destination.is_symlink():
            raise UserlandError(f"refusing to replace directory: {guest}")
        destination.unlink(missing_ok=True)
        relative = os.path.relpath(host_path(self.root, target), destination.parent)
        try:
            destination.symlink_to(relative)
        except OSError:
            destination.write_text(f"THISTLE-LINK {target}\n", encoding="utf-8")
        old = self.entry(guest)
        timestamp = now_ms()
        self.replace_entry({
            "p": guest,
            "k": "l",
            "id": int(old["id"]) if old and old.get("k") == "l" else self.allocate_id(),
            "mode": mode,
            "uid": 0,
            "gid": 0,
            "at": int(old.get("at", timestamp)) if old else timestamp,
            "mt": timestamp,
            "ct": timestamp,
            "to": target,
        })

    def save(self) -> None:
        self.entries.sort(key=lambda entry: str(entry["p"]))
        write_json_atomic(self.meta_path, self.manifest)


def backup_root_files(project: Path, root: Path, command: str, paths: list[str]) -> Path:
    base = project / "backups" / "userland-switch"
    stem = f"{utc_stamp()}-{command}"
    backup = base / stem
    suffix = 1
    while backup.exists():
        backup = base / f"{stem}-{suffix:02d}"
        suffix += 1
    backup.mkdir(parents=True, exist_ok=False)
    shutil.copy2(root / META_NAME, backup / META_NAME)
    for guest in paths:
        source = host_path(root, guest)
        relative = guest.lstrip("/")
        destination = backup / "root" / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        if source.is_symlink():
            destination.symlink_to(os.readlink(source))
        elif source.is_file():
            shutil.copy2(source, destination)
    override = host_path(root, OVERRIDES)
    if override.is_file():
        destination = backup / "root" / OVERRIDES.lstrip("/")
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(override, destination)
    return backup


def overrides_path(root: Path) -> Path:
    return host_path(root, OVERRIDES)


def load_overrides(root: Path) -> dict[str, Any]:
    value = load_json(overrides_path(root), {"schema": SCHEMA, "commands": {}})
    if value.get("schema") != SCHEMA or not isinstance(value.get("commands"), dict):
        raise UserlandError(f"unsupported override manifest: {overrides_path(root)}")
    return value


def save_overrides(editor: RootEditor, value: dict[str, Any]) -> None:
    temporary = Path(tempfile.mkstemp(prefix="mikuos-overrides-", suffix=".json")[1])
    try:
        temporary.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
        editor.install_file(OVERRIDES, temporary, 0o644)
    finally:
        temporary.unlink(missing_ok=True)


def ensure_rescue(editor: RootEditor, command: str) -> str:
    rescue = f"{RESCUE_ROOT}/{command}"
    rescue_host = host_path(editor.root, rescue)
    rescue_entry = editor.entry(rescue)
    if rescue_host.is_file() and rescue_entry and rescue_entry.get("k") == "f":
        return rescue

    active = f"/bin/{command}"
    active_host = host_path(editor.root, active)
    try:
        data = active_host.read_bytes()
    except OSError as error:
        raise UserlandError(f"missing rescue path and original built-in: {command}") from error
    expected = f"#!thistle:{command}\n".encode()
    if data != expected:
        raise UserlandError(
            f"{rescue} is missing and {active} is not the original built-in stub; boot Stage 0A first"
        )
    with tempfile.NamedTemporaryFile(delete=False) as stream:
        stream.write(expected)
        temporary = Path(stream.name)
    try:
        editor.install_file(rescue, temporary, 0o755)
    finally:
        temporary.unlink(missing_ok=True)
    return rescue


def resolve_root(args: argparse.Namespace) -> tuple[Path, Path]:
    project = Path(args.project).resolve() if args.project else project_root()
    root = Path(args.root).resolve() if args.root else project / ".thistle"
    if not root.is_dir():
        raise UserlandError(f"mikuOS root does not exist: {root}")
    return project, root


def candidate_record(overrides: dict[str, Any], command: str) -> dict[str, Any]:
    record = overrides["commands"].get(command)
    if not isinstance(record, dict):
        raise UserlandError(f"no staged candidate for {command}")
    return record


def do_stage(args: argparse.Namespace) -> None:
    project, root = resolve_root(args)
    command = command_name(args.command)
    package = package_name(args.package)
    source = Path(args.candidate).resolve()
    if not source.is_file():
        raise UserlandError(f"candidate is not a regular file: {source}")
    data = source.read_bytes()
    if not data:
        raise UserlandError("candidate is empty")
    candidate = guest_path(args.guest_path or f"{UPSTREAM_ROOT}/{package}/{command}")
    if not candidate.startswith(f"{UPSTREAM_ROOT}/"):
        raise UserlandError(f"candidate must live below {UPSTREAM_ROOT}")

    editor = RootEditor(root)
    rescue = ensure_rescue(editor, command)
    backup = backup_root_files(project, root, command, [f"/bin/{command}", rescue, candidate])
    editor.install_file(candidate, source, 0o755)
    overrides = load_overrides(root)
    previous = overrides["commands"].get(command)
    overrides["commands"][command] = {
        "command": command,
        "package": package,
        "provider": args.provider,
        "version": args.version,
        "state": "staged",
        "activePath": f"/bin/{command}",
        "candidatePath": candidate,
        "rescuePath": rescue,
        "sha256": hashlib.sha256(data).hexdigest(),
        "size": len(data),
        "stagedAt": utc_iso(),
        **({"previous": previous} if isinstance(previous, dict) else {}),
    }
    save_overrides(editor, overrides)
    editor.save()
    print(f"staged {command}: {candidate}")
    print(f"backup: {backup}")
    print("active provider unchanged")


def do_activate(args: argparse.Namespace) -> None:
    project, root = resolve_root(args)
    command = command_name(args.command)
    editor = RootEditor(root)
    overrides = load_overrides(root)
    record = candidate_record(overrides, command)
    candidate = guest_path(str(record.get("candidatePath", "")))
    rescue = ensure_rescue(editor, command)
    candidate_host = host_path(root, candidate)
    if not candidate_host.is_file():
        raise UserlandError(f"staged candidate is missing: {candidate}")
    digest = sha256(candidate_host)
    if digest != record.get("sha256"):
        raise UserlandError(f"candidate hash changed: {candidate}")
    backup = backup_root_files(project, root, command, [f"/bin/{command}", rescue, candidate])
    editor.install_symlink(f"/bin/{command}", candidate)
    record["state"] = "active"
    record["activatedAt"] = utc_iso()
    record["rescuePath"] = rescue
    save_overrides(editor, overrides)
    editor.save()
    print(f"activated {command}: /bin/{command} -> {candidate}")
    print(f"backup: {backup}")


def do_rollback(args: argparse.Namespace) -> None:
    project, root = resolve_root(args)
    command = command_name(args.command)
    editor = RootEditor(root)
    overrides = load_overrides(root)
    rescue = ensure_rescue(editor, command)
    record = overrides["commands"].get(command)
    candidate = str(record.get("candidatePath", "")) if isinstance(record, dict) else ""
    paths = [f"/bin/{command}", rescue]
    if candidate.startswith("/"):
        paths.append(candidate)
    backup = backup_root_files(project, root, command, paths)
    editor.install_symlink(f"/bin/{command}", rescue)
    if not isinstance(record, dict):
        record = {
            "command": command,
            "activePath": f"/bin/{command}",
            "rescuePath": rescue,
        }
        overrides["commands"][command] = record
    record["state"] = "builtin"
    record["rolledBackAt"] = utc_iso()
    record["rescuePath"] = rescue
    save_overrides(editor, overrides)
    editor.save()
    print(f"rolled back {command}: /bin/{command} -> {rescue}")
    print(f"backup: {backup}")


def provider_for(root: Path, command: str, overrides: dict[str, Any]) -> tuple[str, str]:
    path = host_path(root, f"/bin/{command}")
    target = ""
    if path.is_symlink():
        raw = os.readlink(path)
        target_host = (path.parent / raw).resolve()
        try:
            target = "/" + str(target_host.relative_to(root.resolve())).replace(os.sep, "/")
        except ValueError:
            target = raw
    elif path.is_file():
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = ""
        if text.startswith("THISTLE-LINK "):
            target = text.removeprefix("THISTLE-LINK ").strip()
        elif text == f"#!thistle:{command}\n":
            target = f"{RESCUE_ROOT}/{command}"
    record = overrides["commands"].get(command)
    if target.startswith(f"{UPSTREAM_ROOT}/"):
        return "upstream", target
    if target == f"{RESCUE_ROOT}/{command}" or target == "":
        state = str(record.get("state", "builtin")) if isinstance(record, dict) else "builtin"
        return state if state == "staged" else "builtin", target or f"/bin/{command}"
    return "custom", target


def do_status(args: argparse.Namespace) -> None:
    _, root = resolve_root(args)
    overrides = load_overrides(root)
    commands: set[str] = set(overrides["commands"])
    rescue_dir = host_path(root, RESCUE_ROOT)
    if rescue_dir.is_dir():
        commands.update(path.name for path in rescue_dir.iterdir() if path.is_file())
    bin_dir = host_path(root, "/bin")
    if bin_dir.is_dir():
        for path in bin_dir.iterdir():
            if not path.is_file() or path.is_symlink():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue
            if text == f"#!thistle:{path.name}\n":
                commands.add(path.name)
    if args.command:
        commands = {command_name(args.command)}
    rows = []
    for command in sorted(commands):
        state, target = provider_for(root, command, overrides)
        record = overrides["commands"].get(command, {})
        rows.append({
            "command": command,
            "state": state,
            "target": target,
            "package": record.get("package", "") if isinstance(record, dict) else "",
            "version": record.get("version", "") if isinstance(record, dict) else "",
        })
    if args.json:
        print(json.dumps({"schema": SCHEMA, "root": str(root), "commands": rows}, indent=2))
        return
    if not rows:
        print("no staged or rescue commands found")
        return
    widths = {
        key: max(len(key), *(len(str(row[key])) for row in rows))
        for key in ("command", "state", "package", "version", "target")
    }
    print("  ".join(key.ljust(widths[key]) for key in widths))
    print("  ".join("-" * widths[key] for key in widths))
    for row in rows:
        print("  ".join(str(row[key]).ljust(widths[key]) for key in widths))


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project", help="mikuOS project root; defaults to the script's project")
    parser.add_argument("--root", help="host-backed guest root; defaults to PROJECT/.thistle")
    sub = parser.add_subparsers(dest="action", required=True)

    stage = sub.add_parser("stage", help="copy a tested candidate into the guest root without activating it")
    stage.add_argument("command")
    stage.add_argument("--package", required=True)
    stage.add_argument("--candidate", required=True)
    stage.add_argument("--provider", required=True)
    stage.add_argument("--version", required=True)
    stage.add_argument("--guest-path")
    stage.set_defaults(run=do_stage)

    activate = sub.add_parser("activate", help="atomically point /bin/COMMAND at its staged candidate")
    activate.add_argument("command")
    activate.set_defaults(run=do_activate)

    rollback = sub.add_parser("rollback", help="point /bin/COMMAND back at its immutable built-in rescue")
    rollback.add_argument("command")
    rollback.set_defaults(run=do_rollback)

    status = sub.add_parser("status", help="show staged and active provider state")
    status.add_argument("command", nargs="?")
    status.add_argument("--json", action="store_true")
    status.set_defaults(run=do_status)

    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    try:
        args = parse_args(argv)
        args.run(args)
        return 0
    except UserlandError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
