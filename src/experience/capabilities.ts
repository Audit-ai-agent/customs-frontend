import type { Session } from "../api/v1/types";

export type WorkbenchMutationCapability =
  | "create_case"
  | "register_document"
  | "start_review"
  | "ask_assistant"
  | "propose_revision"
  | "decide_revision"
  | "verify_supporting_document"
  | "run_test_scenario";

type WorkbenchRole = Session["roles"][number];

const CAPABILITY_ROLES: Readonly<
  Record<WorkbenchMutationCapability, readonly WorkbenchRole[]>
> = {
  create_case: ["reviewer", "admin"],
  register_document: ["reviewer", "admin"],
  start_review: ["reviewer", "admin"],
  ask_assistant: ["reviewer", "approver", "admin"],
  propose_revision: ["reviewer", "admin"],
  decide_revision: ["approver", "admin"],
  verify_supporting_document: ["approver", "admin"],
  run_test_scenario: ["reviewer", "admin"],
};

export function canMutate(
  session: Session | null,
  capability: WorkbenchMutationCapability,
): boolean {
  return Boolean(
    session
    && session.roles.some((role) => CAPABILITY_ROLES[capability].includes(role)),
  );
}

