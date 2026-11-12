"""Shop words the recogniser should prefer ("giấy dán tường", "chống ẩm", brand names), as sherpa-onnx hotwords.

sherpa-onnx encodes each hotword into the model's BPE pieces, which needs the pieces and their scores as a text
vocabulary ("piece<TAB>score" per line). The model ships only the binary SentencePiece bpe.model, so the
vocabulary is read out of it here (a small protobuf walk) rather than adding the sentencepiece package.
"""
import struct
from pathlib import Path

# SentencePiece ModelProto: field 1 = repeated SentencePiece { 1: piece (string), 2: score (float) }.
PIECES_FIELD = 1
PIECE_TEXT_FIELD = 1
PIECE_SCORE_FIELD = 2
VARINT, FIXED64, LENGTH_DELIMITED, FIXED32 = 0, 1, 2, 5


def _varint(buffer: bytes, position: int) -> tuple[int, int]:
    shift = value = 0
    while True:
        byte = buffer[position]
        position += 1
        value |= (byte & 0x7F) << shift
        shift += 7
        if byte < 0x80:
            return value, position


def _fields(buffer: bytes):
    position = 0
    while position < len(buffer):
        key, position = _varint(buffer, position)
        number, wire_type = key >> 3, key & 7
        if wire_type == VARINT:
            value, position = _varint(buffer, position)
        elif wire_type == FIXED64:
            value, position = buffer[position:position + 8], position + 8
        elif wire_type == LENGTH_DELIMITED:
            length, position = _varint(buffer, position)
            value, position = buffer[position:position + length], position + length
        elif wire_type == FIXED32:
            value, position = buffer[position:position + 4], position + 4
        else:
            raise ValueError(f"unsupported protobuf wire type {wire_type} in bpe.model at byte {position}")
        yield number, value


def bpe_vocabulary(bpe_model: Path) -> list[tuple[str, float]]:
    pieces = []
    for number, value in _fields(bpe_model.read_bytes()):
        if number != PIECES_FIELD:
            continue
        piece, score = None, 0.0
        for inner_number, inner_value in _fields(value):
            if inner_number == PIECE_TEXT_FIELD:
                piece = inner_value.decode("utf-8")
            elif inner_number == PIECE_SCORE_FIELD:
                score = struct.unpack("<f", inner_value)[0]
        if piece is None:
            raise ValueError(f"piece {len(pieces)} in {bpe_model} has no text")
        pieces.append((piece, score))
    return pieces


def shop_words(hotwords_file: Path) -> list[str]:
    """One phrase per line; '#' starts a comment. Upper-cased because the model's pieces are upper case."""
    phrases = []
    for line in hotwords_file.read_text(encoding="utf-8").splitlines():
        phrase = " ".join(line.split("#", 1)[0].split())
        if phrase:
            phrases.append(phrase.upper())
    return phrases


def prepare(model_dir: Path, hotwords_file: Path, cache_dir: Path) -> tuple[Path, Path]:
    """Writes the files sherpa-onnx reads: the BPE vocabulary and the upper-cased hotwords. Returns their paths."""
    cache_dir.mkdir(parents=True, exist_ok=True)
    vocabulary = cache_dir / "bpe.vocab"
    vocabulary.write_text("".join(f"{piece}\t{score}\n" for piece, score in bpe_vocabulary(model_dir / "bpe.model")),
                          encoding="utf-8")
    hotwords = cache_dir / "hotwords.txt"
    hotwords.write_text("".join(f"{phrase}\n" for phrase in shop_words(hotwords_file)), encoding="utf-8")
    return vocabulary, hotwords
