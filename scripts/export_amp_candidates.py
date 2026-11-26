"""Build the static AMP candidate data from the six server result files."""

import argparse
import csv
import json
from pathlib import Path


def load_scores(directory, server, fields):
    scores = {}
    with (directory / f"{server}_results.csv").open(newline="") as source:
        for row in csv.DictReader(source):
            identifier = row["sequence_id"]
            if identifier in scores:
                raise ValueError(f"{server}: duplicate ID {identifier}")
            values = {}
            for field in fields:
                value = row[field].strip()
                if not value:
                    raise ValueError(f"{server}: missing {field} for {identifier}")
                if "probability" in field:
                    value = float(value)
                    if not 0 <= value <= 1:
                        raise ValueError(f"{server}: invalid {field} for {identifier}")
                values[field] = value
            scores[identifier] = (row["sequence"], values)
    return scores


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("results_directory", type=Path)
    args = parser.parse_args()
    runs = {
        "amp_scanner_v2": ("predicted_class", "prediction_probability"),
        "ampidentifier": ("predicted_class", "probability_AMP"),
        "campr3": ("svm_class", "svm_probability", "rf_class", "rf_probability",
                   "ann_class", "da_class", "da_probability"),
        "campr4": ("rf_class", "rf_probability", "svm_class", "svm_probability",
                   "ann_class", "ann_probability"),
        "classamp": ("predicted_activity_class", "probability"),
        "dbaasp_general": ("predicted_class",),
    }
    scores = {server: load_scores(args.results_directory, server, fields)
              for server, fields in runs.items()}
    reference = scores["amp_scanner_v2"]
    for server, records in scores.items():
        if records.keys() != reference.keys() or any(
            sequence != reference[identifier][0]
            for identifier, (sequence, _) in records.items()
        ):
            raise ValueError(f"{server}: IDs or sequences differ from AMP Scanner v2")

    # Store column names once to keep the static download compact.
    columns = ["sequence_id", "sequence"] + [
        f"{server}.{field}" for server, fields in runs.items() for field in fields
    ]
    rows = [
        [identifier, sequence] + [
            value for records in scores.values() for value in records[identifier][1].values()
        ]
        for identifier, (sequence, _) in sorted(reference.items())
    ]
    output = Path(__file__).resolve().parents[1] / "dashboard" / "amp-candidates.json"
    output.write_text(json.dumps({"columns": columns, "rows": rows}, separators=(",", ":")) + "\n")
    print(f"Exported {len(rows):,} peptides to {output}")


if __name__ == "__main__":
    main()
