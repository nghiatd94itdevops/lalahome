"""Download the sherpa-onnx models the speech service needs into ./models."""

import sys
import tarfile
import urllib.request
from pathlib import Path

RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download"
MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

ARCHIVES = [
    f"{RELEASES}/asr-models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09.tar.bz2",
    f"{RELEASES}/tts-models/vits-piper-vi_VN-vais1000-medium-int8.tar.bz2",
]
FILES = [
    f"{RELEASES}/asr-models/silero_vad.onnx",
]


def download(url: str, target: Path) -> None:
    print(f"downloading {url}")
    urllib.request.urlretrieve(url, target)


def fetch_archive(url: str) -> None:
    name = url.rsplit("/", 1)[1]
    extracted_dir = MODELS_DIR / name.removesuffix(".tar.bz2")
    if extracted_dir.is_dir():
        print(f"skip {extracted_dir.name}: already present")
        return

    archive_path = MODELS_DIR / name
    download(url, archive_path)
    with tarfile.open(archive_path, "r:bz2") as archive:
        # filter="data" rejects absolute paths, links outside the target and device files.
        archive.extractall(MODELS_DIR, filter="data")
    archive_path.unlink()


def fetch_file(url: str) -> None:
    target = MODELS_DIR / url.rsplit("/", 1)[1]
    if target.is_file():
        print(f"skip {target.name}: already present")
        return
    download(url, target)


def main() -> int:
    MODELS_DIR.mkdir(exist_ok=True)
    for url in ARCHIVES:
        fetch_archive(url)
    for url in FILES:
        fetch_file(url)
    return 0


if __name__ == "__main__":
    sys.exit(main())
