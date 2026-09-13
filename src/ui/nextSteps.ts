import type { ReviewComparison, ReviewFinding, ReviewRun } from "../api/v1/types";
import { actionLabel, findingDisplayTitle, reviewerSentence } from "./labels";

export function comparisonFor(finding: ReviewFinding, run: ReviewRun): ReviewComparison | undefined {
  return finding.comparison_id ? run.comparisons.find((item) => item.comparison_id === finding.comparison_id) : undefined;
}

export interface NextStepRow {
  key: string;
  label: string;
  /** Set when the row points at findings of one rule title instead of carrying its own message. */
  title?: string;
  findingIds: string[];
  message?: string;
}

/**
 * The "이어서 할 일" rows shared by the review stage and the printed report.
 *
 * The Agent emits one action per finding whose message is the finding message
 * verbatim. Those are already shown as findings, so they collapse into one
 * pointer per rule title with a count. Anything else keeps its own sentence.
 */
export function nextStepRows(run: ReviewRun): NextStepRow[] {
  const actions = run.required_actions.length
    ? run.required_actions
    : [
      {
        action_code: "human_review_required",
        message: "자동 완료하지 않습니다. 담당자가 문서와 법령정보를 확인하십시오.",
        finding_ids: [],
      },
    ];
  const findingByMessage = new Map(run.findings.map((finding) => [finding.message.trim(), finding]));
  const rows: NextStepRow[] = [];
  for (const [index, action] of actions.entries()) {
    const restated = findingByMessage.get(action.message.trim());
    if (restated) {
      const title = findingDisplayTitle(restated, comparisonFor(restated, run));
      const key = `judge:${title}`;
      const existing = rows.find((row) => row.key === key);
      if (existing) existing.findingIds.push(restated.finding_id);
      else rows.push({ key, label: "확인 사항 판단", title, findingIds: [restated.finding_id] });
    } else {
      rows.push({
        key: `${action.action_code}-${index}`,
        label: actionLabel(action.action_code),
        findingIds: [],
        message: reviewerSentence(action.message),
      });
    }
  }
  return rows;
}
