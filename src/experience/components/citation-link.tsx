import { Link } from "react-router";
import type { CitationReference } from "../../api/v2/types";
import { citationLabel } from "../labels";

export function CaseCitationLink({
  caseId,
  reviewRunId,
  citation,
}: {
  caseId: string;
  reviewRunId: string;
  citation: CitationReference;
}): React.ReactElement {
  return (
    <Link
      to={citationDestination(caseId, reviewRunId, citation)}
      data-testid={`citation-${citation.kind}-${citation.reference_id}`}
    >
      {citationLabel(citation.kind)}
    </Link>
  );
}

export function citationDestination(
  caseId: string,
  reviewRunId: string,
  citation: CitationReference,
): string {
  const root = `/cases/${encodeURIComponent(caseId)}`;
  const runQuery = `run=${encodeURIComponent(reviewRunId)}`;
  if (citation.kind === "evidence") {
    return `${root}/evidence?${runQuery}#reference-${encodeURIComponent(citation.reference_id)}`;
  }
  if (citation.kind === "issue" || citation.kind === "finding") {
    return `${root}/review-actions?${runQuery}#reference-${encodeURIComponent(citation.reference_id)}`;
  }
  if (citation.kind === "field_source") {
    return `${root}/documents?${runQuery}&source=${encodeURIComponent(citation.reference_id)}`
      + `#field-${encodeURIComponent(citation.reference_id)}`;
  }
  return `${root}/overview?${runQuery}#result-heading`;
}
