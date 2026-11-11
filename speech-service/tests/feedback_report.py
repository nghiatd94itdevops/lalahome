"""C3: accuracy from the Đúng/Sai marks users give live transcripts on the web page."""

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ACCURACY_TARGET = 0.85
# speech-service/tests/ -> project root
DEFAULT_LOG = Path(__file__).resolve().parents[2] / "logs" / "feedback.jsonl"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--log", type=Path, default=DEFAULT_LOG)
    args = parser.parse_args()
    if not args.log.is_file():
        print(f"no feedback yet: {args.log} does not exist")
        return 1

    by_model: dict[str, list[dict]] = defaultdict(list)
    for line_number, line in enumerate(args.log.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            record = json.loads(line)
        except json.JSONDecodeError as error:
            print(f"skip line {line_number}: invalid JSON ({error})")
            continue
        by_model[record["asr_model"]].append(record)

    is_passing = True
    for model, records in by_model.items():
        correct = sum(record["is_correct"] for record in records)
        accuracy = correct / len(records)
        is_passing &= accuracy >= ACCURACY_TARGET
        print(f"{model}: {correct}/{len(records)} correct = {accuracy:.0%} (target {ACCURACY_TARGET:.0%})")
        for record in records:
            if not record["is_correct"]:
                print(f"  heard:   {record['transcript']}\n  correct: {record['corrected_text']}")
    return 0 if is_passing else 1


if __name__ == "__main__":
    sys.exit(main())
