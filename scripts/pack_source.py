"""Pack the project into one zip for moving to another machine.

Leaves out rebuildable folders (.venv, node_modules, .next, __pycache__, .git), logs and earlier zips, so the
archive is small and has no file that a running server keeps locked. Unless --no-data is given, it also saves
the LalaFlow database and uploaded images from Docker into lalaflow/backups/ so the site keeps its data.

    python scripts/pack_source.py               # zip into the parent folder, with LalaFlow data
    python scripts/pack_source.py --no-data     # code only
    python scripts/pack_source.py --include-env # also pack .env files (they hold passwords; keep the zip private)
    python scripts/pack_source.py --full        # everything in the folder: node_modules, .venv, logs, .env, old zips
"""
import argparse
import datetime
import os
import shutil
import stat
import subprocess
import sys
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# _archive holds parked, unused source kept only for reference; a deploy package does not need it.
SKIP_DIRS = {".venv", "venv", "node_modules", ".next", "__pycache__", ".git", ".pytest_cache", "_archive"}
LOGS_KEEP = {"feedback.jsonl"}
DB_CONTAINER = "lalaflow-db"
BACKEND_CONTAINER = "lalaflow-backend"
BACKUP_DIR = os.path.join(ROOT, "lalaflow", "backups")
WINDOWS_PATH_LIMIT = 260


def run(command):
    return subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")


def container_running(name):
    result = run(["docker", "inspect", "-f", "{{.State.Running}}", name])
    return result.returncode == 0 and result.stdout.strip() == "true"


def export_lalaflow_data():
    if not shutil.which("docker"):
        print("! Docker not found: LalaFlow database is NOT included.")
        return
    if not container_running(DB_CONTAINER):
        print(f"! Container {DB_CONTAINER} is not running: LalaFlow database is NOT included. Start it with 'docker compose up -d' in lalaflow/.")
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    dump_path = os.path.join(BACKUP_DIR, "lalaflow-data.sql")
    dump = run(["docker", "exec", DB_CONTAINER, "sh", "-c",
                "mariadb-dump -uroot -p\"$MARIADB_ROOT_PASSWORD\" --single-transaction --routines --triggers --default-character-set=utf8mb4 lalaflow"])
    if dump.returncode != 0:
        sys.exit(f"Database dump failed: {dump.stderr.strip()}")
    with open(dump_path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(dump.stdout)
    print(f"  database -> {os.path.relpath(dump_path, ROOT)} ({len(dump.stdout) // 1024} KB)")

    if not container_running(BACKEND_CONTAINER):
        print(f"! Container {BACKEND_CONTAINER} is not running: uploaded images are NOT included.")
        return
    uploads_path = os.path.join(BACKUP_DIR, "uploads")
    shutil.rmtree(uploads_path, ignore_errors=True)
    copy = run(["docker", "cp", f"{BACKEND_CONTAINER}:/app/uploads", uploads_path])
    if copy.returncode != 0:
        sys.exit(f"Copying uploads failed: {copy.stderr.strip()}")
    print(f"  uploads  -> {os.path.relpath(uploads_path, ROOT)} ({len(os.listdir(uploads_path))} files)")


def is_link(path):
    # npm links local packages with Windows junctions; one that points back at its own package recurses forever.
    try:
        info = os.lstat(path)
    except OSError:
        return False
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & stat.FILE_ATTRIBUTE_REPARSE_POINT)


def should_skip_file(relative_dir, name, include_env):
    in_logs = relative_dir == "logs" or relative_dir.startswith("logs" + os.sep)
    if in_logs and name not in LOGS_KEEP:
        return True
    if relative_dir == "." and name.lower().endswith(".zip"):
        return True
    is_env = name == ".env" or (name.startswith(".env.") and not name.endswith(".example"))
    return is_env and not include_env


def pack(target, include_env, full_copy):
    top = os.path.basename(ROOT)
    files = 0
    raw = 0
    longest = 0
    skipped_env = []
    unreadable = []
    links = []
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for current, dirs, names in os.walk(ROOT):
            relative_dir = os.path.relpath(current, ROOT)
            for name in [d for d in dirs if is_link(os.path.join(current, d))]:
                links.append(os.path.relpath(os.path.join(current, name), ROOT))
                dirs.remove(name)
            if not full_copy:
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not (relative_dir == "logs" or relative_dir.startswith("logs" + os.sep))]
            for name in names:
                full = os.path.join(current, name)
                if os.path.abspath(full) == os.path.abspath(target):
                    continue
                if not full_copy and should_skip_file(relative_dir, name, include_env):
                    if name.startswith(".env"):
                        skipped_env.append(os.path.relpath(full, ROOT))
                    continue
                arcname = os.path.join(top, os.path.relpath(full, ROOT))
                try:
                    archive.write(full, arcname)
                except OSError as error:
                    # A running server can hold a file open exclusively; keep going and report it instead of aborting.
                    unreadable.append(f"{os.path.relpath(full, ROOT)} ({error.strerror or error})")
                    continue
                files += 1
                raw += os.path.getsize(full)
                longest = max(longest, len(arcname))
                if files % 20000 == 0:
                    print(f"  … {files} files")
    return files, raw, longest, skipped_env, unreadable, links


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-data", action="store_true", help="do not export the LalaFlow database and uploads")
    parser.add_argument("--include-env", action="store_true", help="also pack .env files")
    parser.add_argument("--full", action="store_true", help="pack every file in the folder, including node_modules, .venv, logs and .env")
    parser.add_argument("--out", help="output zip path (default: next to the project folder)")
    args = parser.parse_args()

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M")
    target = os.path.abspath(args.out or os.path.join(os.path.dirname(ROOT), f"{os.path.basename(ROOT)}_{stamp}.zip"))
    print(f"Packing {ROOT}")
    if not args.no_data:
        export_lalaflow_data()
    files, raw, longest, skipped_env, unreadable, links = pack(target, args.include_env, args.full)

    with zipfile.ZipFile(target) as archive:
        broken = archive.testzip()
    if broken:
        sys.exit(f"Zip check failed at {broken}")
    print(f"  {files} files, {raw / 1048576:.1f} MB before compression")
    print(f"  zip -> {target} ({os.path.getsize(target) / 1048576:.1f} MB), integrity OK")
    print(f"  longest path inside the zip: {longest} chars (extract into a folder shorter than {WINDOWS_PATH_LIMIT - longest} chars)")
    if links:
        print(f"  skipped {len(links)} folder link(s) that npm recreates on install: {', '.join(links[:5])}")
    if unreadable:
        print(f"! {len(unreadable)} file(s) could not be read (locked by a running program) and are NOT in the zip:")
        for item in unreadable[:20]:
            print(f"    {item}")
        if len(unreadable) > 20:
            print(f"    … and {len(unreadable) - 20} more")
    if args.full:
        print("  full copy: includes .env files with passwords - keep this zip private")
    if skipped_env:
        print(f"  left out (passwords): {', '.join(skipped_env)} - copy them separately or use --include-env")


if __name__ == "__main__":
    main()
