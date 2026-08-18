"""Add a Certificate of Origin (E####_CO.pdf) to every error set.

Each CO is built from the set's ground-truth manifest row (clean_manifest.csv,
C#### row = base data of E####). A deterministic 35% of sets additionally get
exactly one CO-specific injected error, labelled in error_labels.csv with
affected_doc=CERTIFICATE_OF_ORIGIN, and error_type_summary.csv is updated.

New error types (4):
  CO_ORIGIN_MISMATCH        CO 원산지가 실제 원산지(REPUBLIC OF KOREA)와 다름
  CO_INVOICE_NO_MISMATCH    CO에 기재된 송장번호가 Invoice와 불일치
  CO_CONSIGNEE_MISMATCH     CO 수하인이 Invoice 수입자와 불일치
  CO_DESCRIPTION_MISMATCH   CO 품명이 Invoice 품명과 불일치

Deterministic (seed 20260814): rerunning reproduces identical PDFs and labels.
Standard library only: python make_error_co.py
"""

from __future__ import annotations

import csv
import random
from pathlib import Path

ROOT = Path(__file__).parent
SEED = 20260814
CO_ERROR_RATE = 0.35

PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN_X = 60
TOP_Y = 730
TITLE_SIZE = 15
BODY_SIZE = 10
LINE_STEP = 17

WRONG_ORIGINS = ["CHINA", "VIETNAM", "THAILAND", "INDONESIA", "MALAYSIA", "TAIWAN"]
WRONG_CONSIGNEES = [
    "GLOBAL TRADE PARTNERS INC.",
    "OCEANIC DISTRIBUTION GMBH",
    "SUNRISE COMMERCE LTD.",
    "ATLANTIC SUPPLY CHAIN B.V.",
    "MERIDIAN LOGISTICS CO.",
]
WRONG_GOODS = [
    "WOMEN'S POLYESTER JACKETS",
    "STAINLESS STEEL KITCHENWARE",
    "PLASTIC HOUSEHOLD CONTAINERS",
    "LED LIGHTING FIXTURES",
    "RUBBER AUTOMOTIVE PARTS",
]


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build_pdf(lines: list[tuple[str, int, bool]]) -> bytes:
    """Minimal valid PDF; text layer = the given (text, size, bold) lines."""

    content_parts = []
    y = TOP_Y
    for text, size, bold in lines:
        if text:
            font = "F2" if bold else "F1"
            content_parts.append(f"BT /{font} {size} Tf {MARGIN_X} {y} Td ({_escape(text)}) Tj ET")
        y -= LINE_STEP if size <= BODY_SIZE else LINE_STEP + 10
    content = ("\n".join(content_parts) + "\n").encode("ascii")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
        ).encode("ascii"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(content)).encode("ascii") + b" >>\nstream\n" + content + b"endstream",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{number} 0 obj\n".encode("ascii") + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    out += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        out += f"{offset:010d} 00000 n \n".encode("ascii")
    out += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_at}\n%%EOF\n"
    ).encode("ascii")
    return bytes(out)


def co_lines(row: dict[str, str], *, certificate_no: str, origin: str, consignee: str,
             invoice_no: str, good: str) -> list[tuple[str, int, bool]]:
    qty = row["qty"]
    unit = row["unit"]
    cartons = row["cartons"]
    return [
        ("CERTIFICATE OF ORIGIN", TITLE_SIZE, True),
        ("", BODY_SIZE, False),
        (f"Certificate No: {certificate_no}", BODY_SIZE, False),
        ("Issued by: THE KOREA CHAMBER OF COMMERCE & INDUSTRY", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("1. Exporter (Name, Address, Country)", BODY_SIZE, True),
        (f"   {row['exporter_name']}", BODY_SIZE, False),
        ("   SEOUL, REPUBLIC OF KOREA", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("2. Consignee (Name, Address, Country)", BODY_SIZE, True),
        (f"   {consignee}", BODY_SIZE, False),
        (f"   {row['final_dest']}", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("3. Transport Details", BODY_SIZE, True),
        (f"   From {row['load_port']} to {row['disch_port']}", BODY_SIZE, False),
        (f"   By {row['vessel']} V.{row['voyage']}", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("4. Country of Origin", BODY_SIZE, True),
        (f"   {origin}", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("5. Invoice No. and Date", BODY_SIZE, True),
        (f"   {invoice_no}  ({row['inv_date']})", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("6. Description of Goods / Quantity", BODY_SIZE, True),
        (f"   {good}", BODY_SIZE, False),
        (f"   Quantity: {int(float(qty)):,} {unit}  /  {cartons} CARTONS", BODY_SIZE, False),
        ("", BODY_SIZE, False),
        ("The undersigned hereby certifies that the goods described above", BODY_SIZE, False),
        ("originate in the country shown in box 4.", BODY_SIZE, False),
    ]


def main() -> None:
    rng = random.Random(SEED)

    with open(ROOT / "clean_manifest.csv", encoding="utf-8-sig", newline="") as handle:
        manifest = {row["set_id"]: row for row in csv.DictReader(handle)}

    with open(ROOT / "error_labels.csv", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        fieldnames = list(reader.fieldnames or [])
        labels = list(reader)

    new_labels: dict[str, dict[str, str]] = {}
    type_counts: dict[str, int] = {}
    written = 0

    for index in range(1, 1001):
        clean_id = f"C{index:04d}"
        error_id = f"E{index:04d}"
        row = manifest[clean_id]
        certificate_no = f"KCCI-2025-{index:05d}"
        origin = "REPUBLIC OF KOREA"
        consignee = row["importer_name"]
        invoice_no = row["inv_no"]
        good = row["good"]

        if rng.random() < CO_ERROR_RATE:
            error_type = rng.choice(
                ["CO_ORIGIN_MISMATCH", "CO_INVOICE_NO_MISMATCH",
                 "CO_CONSIGNEE_MISMATCH", "CO_DESCRIPTION_MISMATCH"]
            )
            if error_type == "CO_ORIGIN_MISMATCH":
                field, correct, wrong = "Country of Origin", origin, rng.choice(WRONG_ORIGINS)
                origin = wrong
                note = "CO 원산지가 실제 원산지(대한민국)와 불일치"
            elif error_type == "CO_INVOICE_NO_MISMATCH":
                field, correct = "Invoice No", invoice_no
                wrong = f"INV-2023-{rng.randint(1000, 9999)}"
                while wrong == invoice_no:
                    wrong = f"INV-2023-{rng.randint(1000, 9999)}"
                invoice_no = wrong
                note = "CO에 기재된 송장번호가 Invoice와 불일치"
            elif error_type == "CO_CONSIGNEE_MISMATCH":
                field, correct = "Consignee", consignee
                wrong = rng.choice([c for c in WRONG_CONSIGNEES if c != consignee])
                consignee = wrong
                note = "CO 수하인이 Invoice 수입자와 불일치"
            else:
                field, correct = "Description", good
                wrong = rng.choice([g for g in WRONG_GOODS if g != good])
                good = wrong
                note = "CO 품명이 Invoice 품명과 불일치"
            new_labels[error_id] = {
                "set_id": error_id,
                "num_errors_in_set": "",  # filled after the bump below
                "error_type": error_type,
                "affected_doc": "CERTIFICATE_OF_ORIGIN",
                "field": field,
                "correct_value": correct,
                "wrong_value": wrong,
                "note": note,
            }
            type_counts[error_type] = type_counts.get(error_type, 0) + 1

        pdf = build_pdf(co_lines(
            row, certificate_no=certificate_no, origin=origin,
            consignee=consignee, invoice_no=invoice_no, good=good,
        ))
        (ROOT / "error_sets" / f"set_{index:04d}" / f"{error_id}_CO.pdf").write_bytes(pdf)
        written += 1

    # Bump num_errors_in_set for sets that received a CO error, then splice the
    # CO label after the last existing row of its set (original order kept).
    output_rows: list[dict[str, str]] = []
    for position, label in enumerate(labels):
        set_id = label["set_id"]
        if set_id in new_labels:
            label = dict(label)
            label["num_errors_in_set"] = str(int(label["num_errors_in_set"]) + 1)
        output_rows.append(label)
        is_last_of_set = position + 1 == len(labels) or labels[position + 1]["set_id"] != set_id
        if is_last_of_set and set_id in new_labels:
            co_label = new_labels.pop(set_id)
            co_label["num_errors_in_set"] = label["num_errors_in_set"]
            output_rows.append(co_label)
    if new_labels:
        raise RuntimeError(f"sets missing from error_labels.csv: {sorted(new_labels)}")

    with open(ROOT / "error_labels.csv", "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    with open(ROOT / "error_type_summary.csv", encoding="utf-8-sig", newline="") as handle:
        summary = [row for row in csv.DictReader(handle) if not row["error_type"].startswith("CO_")]
    for error_type in sorted(type_counts):
        summary.append({"error_type": error_type, "count": str(type_counts[error_type])})
    with open(ROOT / "error_type_summary.csv", "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["error_type", "count"])
        writer.writeheader()
        writer.writerows(summary)

    total_co_errors = sum(type_counts.values())
    print(f"CO PDFs written: {written}")
    print(f"CO errors injected: {total_co_errors} ({', '.join(f'{k}={v}' for k, v in sorted(type_counts.items()))})")


if __name__ == "__main__":
    main()
