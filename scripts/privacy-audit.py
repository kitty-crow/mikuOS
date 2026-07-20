#!/usr/bin/env python3
"""Reject personal identity leakage from first-party mikuOS files."""

from __future__ import annotations

from pathlib import Path
import base64
import sys
import tarfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
TOKENS = tuple(base64.b64decode(value).lower() for value in (
    "amF2aWVy",
    "Z29uemFsZXo=",
    "Z29uesOhbGV6",
    "Y3VlcnZvcw==",
    "amN1ZXJ2b3M=",
))
EXCLUDED_ROOTS = {
    "upstream",
    "node_modules",
    "build",
    "dist",
    "vendor",
    ".git",
}
EXCLUDED_PREFIXES = (
    Path(".thistle/usr/include"),
    Path(".thistle/usr/bin"),
    Path(".thistle/usr/sbin"),
    Path(".thistle/usr/lib"),
    Path(".thistle/usr/libexec"),
    Path(".thistle/usr/share/licenses"),
    Path(".thistle/usr/share/locale"),
    Path(".thistle/usr/share/man"),
    Path("assets/thistle-toolchain.tpk.gz"),
)
ARCHIVE_SUFFIXES = (".tar.gz", ".tgz", ".tar", ".zip")


def forbidden(data: bytes) -> bool:
    lowered = data.lower()
    return any(token in lowered for token in TOKENS)


def excluded(relative: Path) -> bool:
    if relative.parts and relative.parts[0] in EXCLUDED_ROOTS:
        return True
    return any(relative == prefix or prefix in relative.parents for prefix in EXCLUDED_PREFIXES)


def scan_archive(path: Path) -> list[str]:
    failures: list[str] = []
    try:
        if path.name.endswith((".tar.gz", ".tgz", ".tar")):
            with tarfile.open(path, "r:*") as archive:
                for member in archive.getmembers():
                    if forbidden(member.name.encode("utf-8", "ignore")):
                        failures.append(f"{path.relative_to(ROOT)}::{member.name}")
                    if not member.isfile() or member.size > 16 * 1024 * 1024:
                        continue
                    stream = archive.extractfile(member)
                    if stream is not None and forbidden(stream.read()):
                        failures.append(f"{path.relative_to(ROOT)}::{member.name}")
        elif path.suffix.lower() == ".zip":
            with zipfile.ZipFile(path) as archive:
                for member in archive.infolist():
                    if forbidden(member.filename.encode("utf-8", "ignore")):
                        failures.append(f"{path.relative_to(ROOT)}::{member.filename}")
                    if member.file_size <= 16 * 1024 * 1024 and forbidden(archive.read(member)):
                        failures.append(f"{path.relative_to(ROOT)}::{member.filename}")
    except (tarfile.TarError, zipfile.BadZipFile, OSError) as error:
        failures.append(f"{path.relative_to(ROOT)}: unreadable archive: {error}")
    return failures


def main() -> int:
    failures: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT)
        if excluded(relative):
            continue
        if path.name.endswith(ARCHIVE_SUFFIXES):
            failures.extend(scan_archive(path))
            continue
        try:
            if path.stat().st_size > 16 * 1024 * 1024:
                continue
            with path.open("rb") as stream:
                carry = b""
                while True:
                    chunk = stream.read(1024 * 1024)
                    if not chunk:
                        break
                    data = carry + chunk
                    if forbidden(data):
                        failures.append(str(relative))
                        break
                    carry = data[-64:]
        except OSError as error:
            failures.append(f"{relative}: unreadable: {error}")

    if failures:
        print("privacy audit failed; forbidden personal identity found:", file=sys.stderr)
        for failure in sorted(set(failures)):
            print(f"  {failure}", file=sys.stderr)
        return 1

    print("privacy audit passed: first-party attribution is Kitty Crow <https://kittycrow.dev>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
