import { Link } from "react-router";
import type { CitationReference } from "../../api/v2/types";
import { citationLabel } from "../labels";

export function CaseCitationLink({
  caseId,
  citation,
}: {
  caseId: string;
  citation: CitationReference;
}): React.ReactElement {
  return (
    <Link
      to={citationDestination(caseId, citation)}
      data-testid={`citation-${citation.kind}-${citation.reference_id}`}
    >
      {citationLabel(citation.kind)}
    </Link>
  );
}

export function citationDestination(caseId: string, citation: CitationReference): string {
  const root = `/cases/${encodeURIComponent(caseId)}`;
  if (citation.kind === "evidence") {
    return `${root}/evidence#reference-${encodeURIComponent(citation.reference_id)}`;
  }
  if (citation.kind === "issue" || citation.kind === "finding") {
    return `${root}/review-actions#reference-${encodeURIComponent(citation.reference_id)}`;
  }
  if (citation.kind === "field_source") {
    return `${root}/documents#document-workspace`;
  }
  return `${root}/overview#result-heading`;
}
