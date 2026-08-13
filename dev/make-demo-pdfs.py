"""Generate text-layer demo PDFs for the file-upload pipeline demo.

Writes simple, uncompressed single-page PDFs whose text layer carries exactly
the same lines as the backend dev-fixture "cross-document-mismatches" scenario,
so uploading them and confirming the extracted text yields a review with real
mismatch findings (quantity, origin, B/L number, container, gross weight).

Standard library only: python dev/make-demo-pdfs.py
"""

from __future__ import annotations

from pathlib import Path

PAGE_WIDTH = 612
PAGE_HEIGHT = 792
MARGIN_X = 72
TOP_Y = 720
LINE_STEP = 22
TITLE_SIZE = 16
BODY_SIZE = 11


def _escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")


def build_pdf(lines: list[str]) -> bytes:
    """Build a minimal valid PDF whose text layer is the given ASCII lines."""

    for line in lines:
        if not line.isascii():
            raise ValueError(f"demo PDF lines must be ASCII: {line!r}")
    content_parts = []
    y = TOP_Y
    for index, line in enumerate(lines):
        size = TITLE_SIZE if index == 0 else BODY_SIZE
        content_parts.append(f"BT /F1 {size} Tf {MARGIN_X} {y} Td ({_escape(line)}) Tj ET")
        y -= LINE_STEP + (8 if index == 0 else 0)
    content = ("\n".join(content_parts) + "\n").encode("ascii")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {PAGE_WIDTH} {PAGE_HEIGHT}] "
            f"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>"
        ).encode("ascii"),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
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


DOCUMENTS: dict[str, list[str]] = {
    "commercial-invoice.pdf": [
        "COMMERCIAL INVOICE",
        "Invoice No: INV-001",
        "Total Amount: USD 30",
        "Country of Origin: KR",
        "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 3 PCS | "
        "Unit: PCS | Unit Price: USD 10 | Amount: USD 30",
    ],
    "packing-list.pdf": [
        "PACKING LIST",
        "Packing No: PL-001",
        "B/L No: BL-001",
        "Container No: ABCD1234567",
        "Total Gross Weight: 100 KG",
        "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 2 PCS | "
        "Unit: PCS | Gross Weight: 100 KG",
    ],
    # The planted contamination: origin CN against the invoice's KR, so the
    # origin verification card reports a field-level mismatch.
    "certificate-of-origin.pdf": [
        "CERTIFICATE OF ORIGIN",
        "Certificate No: COO-001",
        "Origin Country: CN",
        "HS Code: 0303540000",
    ],
    "bill-of-lading.pdf": [
        "BILL OF LADING",
        "B/L No: BL-002",
        "Container No: EFGH7654321",
        "Gross Weight: 120 KG",
    ],
    # ── CO variants for the origin-verification / duty features ─────
    # Matches the default invoice (KR): verification says 일치, but KR is in
    # no FTA agreement, so the duty ladder keeps the basic rate.
    "co-kr-match.pdf": [
        "CERTIFICATE OF ORIGIN",
        "Certificate No: COO-002",
        "Origin Country: KR",
        "HS Code: 0303540000",
    ],
    # Missing certificate number and HS code: extraction succeeds but the
    # verification card reports 값 없음 rows and needs_review overall.
    "co-incomplete.pdf": [
        "CERTIFICATE OF ORIGIN",
        "Origin Country: KR",
        "Issued by: Chamber of Commerce",
    ],
    # FTA pair: upload this CO together with commercial-invoice-vn.pdf
    # (instead of the KR invoice) and the KR-VN FTA rate applies — the duty
    # screen shows the 0% ladder rung satisfied and the savings amount.
    "co-vn-match.pdf": [
        "CERTIFICATE OF ORIGIN",
        "Certificate No: KV-2026-0001",
        "Origin Country: VN",
        "HS Code: 0303540000",
    ],
    "commercial-invoice-vn.pdf": [
        "COMMERCIAL INVOICE",
        "Invoice No: INV-002",
        "Total Amount: USD 30",
        "Country of Origin: VN",
        "Description: Frozen mackerel | HS Code: 0303540000 | Quantity: 3 PCS | "
        "Unit: PCS | Unit Price: USD 10 | Amount: USD 30",
    ],
}


def main() -> None:
    target = Path(__file__).parent / "demo-files"
    target.mkdir(exist_ok=True)
    for filename, lines in DOCUMENTS.items():
        path = target / filename
        path.write_bytes(build_pdf(lines))
        print(f"wrote {path} ({path.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
