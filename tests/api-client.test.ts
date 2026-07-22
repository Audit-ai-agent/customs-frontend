import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../src/api/v1/client";
import { ContractError } from "../src/api/v1/decoders";
import { decodeReviewRun } from "../src/api/v1/decoders";
import backendPublicReviewRun from "./fixtures/backend-63079af-public-review-run.json";

const json = (value: unknown, status = 200): Response =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

const textSha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

const jobPayload = (jobId: string, kind: "review" | "revision" = "review") => ({
  job_id: jobId,
  case_id: "case-1",
  status: "queued",
  agent_call_state: "not_started",
  kind,
  attempt_count: 0,
  created_by: "reviewer-1",
  review_run_id: "",
  created_at: "2026-07-21",
  updated_at: "2026-07-21",
});

const canonicalJson = (value: unknown): string => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
};

const canonicalSha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

const backendEffectiveSummary = (value: Record<string, unknown>): Record<string, unknown> => ({
  provider_result_sha256: value.provider_result_sha256,
  input_manifest_digest: value.input_manifest_digest,
  input_document_manifest: value.input_document_manifest ?? [],
  execution_status: value.execution_status,
  assessment: value.assessment,
  review_disposition: value.review_disposition,
  assurance_level: value.assurance_level,
  completion_eligibility: value.completion_eligibility,
  required_actions: value.required_actions ?? [],
  review_stage_trace: value.review_stage_trace ?? [],
  auto_completion_profile: value.auto_completion_profile ?? {
    profile_id: null,
    approved_document_types: [],
    approved_required_document_codes: [],
    approval_digest: null,
  },
});

const reviewRunPayload = (overrides: Record<string, unknown> = {}) => {
  const payload: Record<string, unknown> = {
    review_run_id: "run-1",
    case_id: "case-1",
    org_id: "org-1",
    created_by: "reviewer-1",
    case_revision: 1,
    created_at: "2026-07-21",
    execution_status: "succeeded",
    assessment: "no_issue_detected",
    review_disposition: "human_review_required",
    assurance_level: "production_candidate",
    input_document_manifest: [],
    input_manifest_digest: "a".repeat(64),
    agent_input_manifest_sha256: "b".repeat(64),
    provider_result_sha256: "c".repeat(64),
    completion_eligibility: {
      eligible: false,
      profile_id: null,
      scope: [],
      unmet_reason_codes: ["domain_approval_missing"],
    },
    required_actions: [],
    action_trace: [],
    review_stage_trace: [],
    auto_completion_profile: {
      profile_id: null,
      approved_document_types: [],
      approved_required_document_codes: [],
      approval_digest: null,
    },
    result_detail: {},
    ...overrides,
  };
  payload.result_digest = overrides.result_digest ?? canonicalSha256(backendEffectiveSummary(payload));
  return payload;
};

describe("Backend API v1 client", () => {
  it("reads only safe LOCAL UAT runtime identity through the Backend boundary", async () => {
    const metadata = {
      mode: "local_uat",
      assurance_ceiling: "diagnostic",
      text_only: true,
      auto_completion_enabled: false,
      claude_mode: "actual",
      evidence_profile: "preserved-3law",
      evidence_scope_label: "REAL_3_OF_58",
      planner_mode: "shadow",
      production_release: false,
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(metadata));

    await expect(new ApiClient(fetcher, () => "memory-only-token").getUatMetadata()).resolves.toEqual(metadata);
    expect(fetcher).toHaveBeenCalledWith("/api/v1/uat/metadata", expect.objectContaining({
      method: "GET",
      credentials: "same-origin",
      redirect: "error",
    }));
    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get("Authorization")).toBe("Bearer memory-only-token");

    const attacked = vi.fn<typeof fetch>().mockResolvedValue(json({ ...metadata, provider_token: "must-not-cross" }));
    await expect(new ApiClient(attacked).getUatMetadata()).rejects.toThrow("unsupported or sensitive field");
  });

  it("accepts the complete Backend 63079af public ReviewRun serialization without provider-private aliases", () => {
    const publicPayload = structuredClone(backendPublicReviewRun) as Record<string, unknown>;
    const detail = publicPayload.result_detail as Record<string, unknown>;

    expect(Object.keys(detail).sort()).toEqual([
      "document_results",
      "fact_ledger",
      "jurisdiction",
      "knowledge_snapshot_id",
      "rag_evidence",
      "regulatory_findings",
      "report",
      "retrieval_coverage",
      "retrieval_results",
      "retrieval_status",
      "review_as_of",
      "review_gaps",
      "review_plan",
      "review_stage_trace",
      "trade_type",
      "validation_issues",
    ]);
    for (const privateField of ["schema_version", "status", "requires_human_review", "case_id", "input_manifest_sha256"]) {
      expect(detail).not.toHaveProperty(privateField);
    }
    expect(decodeReviewRun(publicPayload)).toMatchObject({
      execution_status: "succeeded",
      review_disposition: "human_review_required",
      assurance_level: "production_candidate",
    });
    expect(publicPayload.result_digest).toBe("de7900f91fb5895d2fcd8187c8031b5d3dd898e17c3e90e44173b4979113e31d");
    expect(canonicalSha256(backendEffectiveSummary(publicPayload))).toBe(publicPayload.result_digest);

    const forgedDigest = structuredClone(publicPayload);
    forgedDigest.result_digest = "0".repeat(64);
    expect(() => decodeReviewRun(forgedDigest)).toThrow("Backend effective result digest mismatch");
    const forgedEffectiveSummary = structuredClone(publicPayload);
    forgedEffectiveSummary.provider_result_sha256 = "0".repeat(64);
    expect(() => decodeReviewRun(forgedEffectiveSummary)).toThrow("Backend effective result digest mismatch");

    const attacked = structuredClone(backendPublicReviewRun) as Record<string, unknown>;
    const narrative = attacked.narrative_report as Record<string, unknown>;
    const repeatedClaim = (narrative.document_consistency as Array<Record<string, unknown>>)[0]!;
    repeatedClaim.text = "같은 claim ID에 다른 의미를 주입했습니다.";
    expect(() => decodeReviewRun(attacked)).toThrow("repeated claim ID has conflicting semantics");
  });

  it("accepts only the same-origin /oidc/ reverse-proxy configuration", async () => {
    const origin = window.location.origin;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        issuer: `${origin}/oidc/realms/customs`,
        audience: "customs",
        client_id: "frontend",
        authorization_endpoint: `${origin}/oidc/realms/customs/protocol/openid-connect/auth`,
        token_endpoint: `${origin}/oidc/realms/customs/protocol/openid-connect/token`,
        end_session_endpoint: `${origin}/oidc/realms/customs/protocol/openid-connect/logout`,
        scopes: ["openid"],
        flow: "authorization_code_pkce_s256",
        token_storage: "memory_only",
      }),
    );
    await expect(new ApiClient(fetcher).getAuthConfig()).resolves.toMatchObject({
      issuer: `${origin}/oidc/realms/customs`,
      flow: "authorization_code_pkce_s256",
    });
  });

  it("fails closed when Backend omits the PKCE or memory-only security profile", async () => {
    const origin = window.location.origin;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      issuer: `${origin}/oidc/realms/customs`,
      audience: "customs",
      client_id: "frontend",
      authorization_endpoint: `${origin}/oidc/realms/customs/protocol/openid-connect/auth`,
      token_endpoint: `${origin}/oidc/realms/customs/protocol/openid-connect/token`,
      scopes: ["openid"],
    }));
    await expect(new ApiClient(fetcher).getAuthConfig()).rejects.toThrow("PKCE S256 required");
  });

  it("rejects an oversized JSON response before parsing it", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": String(4 * 1024 * 1024 + 1),
      },
    }));
    await expect(new ApiClient(fetcher, () => "token").getSession()).rejects.toThrow("4 MiB");
  });

  it("cancels a chunked JSON body immediately when it exceeds 4 MiB without Content-Length", async () => {
    const cancel = vi.fn();
    let chunk = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunk += 1;
        controller.enqueue(new Uint8Array(chunk === 1 ? 3 * 1024 * 1024 : 2 * 1024 * 1024));
      },
      cancel,
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(new ApiClient(fetcher, () => "token").getSession()).rejects.toThrow("4 MiB");
    // A ReadableStream implementation may prefetch one chunk, but the client
    // must cancel as soon as the bytes it has consumed cross the boundary.
    expect(chunk).toBeGreaterThanOrEqual(2);
    expect(chunk).toBeLessThanOrEqual(3);
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("injects an in-memory bearer token and never leaves /api/v1", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({ items: [{ case_id: "case-1", org_id: "org-1", title: "Test", status: "open", revision: 0, updated_at: "2026-07-21T00:00:00Z" }] }),
    );
    const client = new ApiClient(fetcher, () => "memory-only-token");

    const page = await client.listCases();

    expect(page.items).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/v1/cases");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer memory-only-token");
    expect(init?.credentials).toBe("same-origin");
    expect(init?.redirect).toBe("error");
    expect(window.localStorage).toHaveLength(0);
  });

  it("requires an explicit evidence-bound terminal state for delivery reconciliation", async () => {
    const reconciled = {
      ...jobPayload("job-uncertain"),
      status: "failed",
      agent_call_state: "delivery_reconciled",
      error_code: "delivery_confirmed_not_processed",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(reconciled));
    const client = new ApiClient(fetcher, () => "memory-only-token");
    const payload = {
      resolution: "confirmed_not_processed" as const,
      evidence_reference_sha256: "a".repeat(64),
      reason: "Agent 수신 로그와 요청 원장을 독립 대조했습니다.",
    };

    await expect(client.reconcileDeliveryUncertain("job-uncertain", payload)).resolves.toMatchObject({
      status: "failed",
      agent_call_state: "delivery_reconciled",
    });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/v1/jobs/job-uncertain/reconciliation");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer memory-only-token");
    expect(JSON.parse(String(init?.body))).toEqual(payload);
  });

  it("rejects a Job or reconciliation response whose identity differs from the URL", async () => {
    const getFetcher = vi.fn<typeof fetch>().mockResolvedValue(json(jobPayload("job-other")));
    await expect(new ApiClient(getFetcher).getJob("job-requested")).rejects.toThrow(
      "does not match the requested Job ID",
    );

    const reconcileFetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      ...jobPayload("job-other"),
      status: "failed",
      agent_call_state: "delivery_reconciled",
      error_code: "delivery_confirmed_not_processed",
    }));
    await expect(new ApiClient(reconcileFetcher).reconcileDeliveryUncertain("job-requested", {
      resolution: "confirmed_not_processed",
      evidence_reference_sha256: "a".repeat(64),
      reason: "Agent 수신 로그와 요청 원장을 독립 대조했습니다.",
    })).rejects.toThrow("does not match the requested Job ID");
  });

  it("rejects a reconciliation response that did not reach the required terminal state", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      ...jobPayload("job-uncertain"),
      status: "delivery_uncertain",
      agent_call_state: "delivery_uncertain",
    }));
    const client = new ApiClient(fetcher);

    await expect(client.reconcileDeliveryUncertain("job-uncertain", {
      resolution: "confirmed_not_processed",
      evidence_reference_sha256: "a".repeat(64),
      reason: "Agent 수신 로그와 요청 원장을 독립 대조했습니다.",
    })).rejects.toThrow("required terminal state");
  });

  it("binds review enqueue to an Idempotency-Key header", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
      .mockResolvedValueOnce(json({ job: jobPayload("job-1"), idempotency_reused: false }, 202));
    const client = new ApiClient(fetcher, () => "token");
    await client.getSession();

    const job = await client.enqueueReview("case-1", { trade_type: "import", submitted_document_codes: [] }, "idem-123");

    const [, init] = fetcher.mock.calls[1]!;
    expect(new Headers(init?.headers).get("Idempotency-Key")).toBe("idem-123");
    expect(JSON.parse(String(init?.body))).toEqual({
      trade_type: "import",
      submitted_document_codes: [],
    });
    expect(job.job_id).toBe("job-1");
  });

  it("rejects review enqueue without session binding or with revision/other-actor Job identities", async () => {
    const unauthenticated = new ApiClient(vi.fn<typeof fetch>(), () => "token");
    expect(() => unauthenticated.enqueueReview(
      "case-1",
      { trade_type: "import", submitted_document_codes: [] },
      "idem-missing-session",
    )).toThrow("requires an authenticated session");

    for (const attackedJob of [
      { ...jobPayload("job-revision", "revision"), parent_run_id: "run-parent" },
      { ...jobPayload("job-other-actor"), created_by: "attacker-1" },
    ]) {
      const fetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
        .mockResolvedValueOnce(json({ job: attackedJob, idempotency_reused: false }, 202));
      const client = new ApiClient(fetcher, () => "token");
      await client.getSession();
      await expect(client.enqueueReview(
        "case-1",
        { trade_type: "import", submitted_document_codes: [] },
        "idem-attacked",
      )).rejects.toThrow(ContractError);
    }
  });

  it("rejects self-declared requirement codes before any HTTP request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new ApiClient(fetcher, () => "token");

    expect(() => client.enqueueReview(
      "case-1",
      { trade_type: "import", submitted_document_codes: ["SELF_DECLARED"] },
      "idem-rejected",
    )).toThrow(ContractError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects an insecure OIDC endpoint supplied by Backend configuration", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        issuer: "http://attacker.example",
        audience: "customs",
        client_id: "frontend",
        authorization_endpoint: "http://attacker.example/auth",
        token_endpoint: "http://attacker.example/token",
        scopes: ["openid"],
      }),
    );
    const client = new ApiClient(fetcher);

    await expect(client.getAuthConfig()).rejects.toBeInstanceOf(ContractError);
  });

  it("rejects OIDC endpoints that leave the approved issuer origin", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        issuer: "https://customs.example/auth/realms/customs",
        audience: "customs",
        client_id: "frontend",
        authorization_endpoint: "https://customs.example/auth/openid",
        token_endpoint: "https://token-attacker.example/token",
        end_session_endpoint: null,
        flow: "authorization_code_pkce_s256",
        token_storage: "memory_only",
      }),
    );
    await expect(new ApiClient(fetcher).getAuthConfig()).rejects.toBeInstanceOf(ContractError);
  });

  it("rejects same-provider OIDC endpoints outside the Workbench proxy origin", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({
        issuer: "https://identity.example/oidc/realms/customs",
        audience: "customs",
        client_id: "frontend",
        authorization_endpoint: "https://identity.example/oidc/authorize",
        token_endpoint: "https://identity.example/oidc/token",
        end_session_endpoint: null,
        flow: "authorization_code_pkce_s256",
        token_storage: "memory_only",
      }),
    );
    await expect(new ApiClient(fetcher).getAuthConfig()).rejects.toBeInstanceOf(ContractError);
  });

  it("maps RFC 9457-style errors without rendering raw HTML", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      json({ title: "Invalid", status: 409, detail: "stale revision", code: "stale_revision", request_id: "req-1" }, 409),
    );
    const client = new ApiClient(fetcher, () => "token");

    await expect(client.getCase("case-1")).rejects.toMatchObject({ status: 409, code: "stale_revision", requestId: "req-1" });
  });

  it("normalizes Backend document views without exposing object-store coordinates", async () => {
    const content = "HS CODE: 0303540000";
    const record = { document_id: "doc-1", case_id: "case-1", document_type: "CI", filename: "invoice.txt", media_type: "text/plain", content_sha256: textSha256(content), byte_size: content.length, character_count: content.length, created_by: "reviewer-1", created_at: "2026-07-21" };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [{ record, content_text: null }] }))
      .mockResolvedValueOnce(json({ record, content_text: content }));
    const client = new ApiClient(fetcher, () => "token");
    const documents = await client.listDocuments("case-1");
    expect(documents[0]).toMatchObject({ document_id: "doc-1", character_count: content.length });
    expect(documents[0]?.content_text).toBeUndefined();
    const hydrated = await client.getDocumentContent("case-1", "doc-1");
    expect(hydrated).toMatchObject({ document_id: "doc-1", content_text: content });
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/v1/cases/case-1/documents/doc-1/content");
    const altered = new ApiClient(
      vi.fn<typeof fetch>().mockResolvedValue(json({ record, content_text: `${content}x` })),
      () => "token",
    );
    await expect(altered.getDocumentContent("case-1", "doc-1")).rejects.toThrow("content/hash/size metadata mismatch");
  });

  it("rejects oversized document and supporting aggregates before rendering", async () => {
    const oversizedDocument = {
      record: {
        document_id: "doc-1",
        case_id: "case-1",
        document_type: "CI",
        filename: "invoice.txt",
        media_type: "text/plain",
        content_sha256: "a".repeat(64),
        byte_size: 200_001,
        character_count: 200_001,
        created_by: "reviewer-1",
        created_at: "2026-07-21",
      },
      content_text: "x".repeat(200_001),
    };
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(json({ items: [oversizedDocument] })))
      .listDocuments("case-1")).rejects.toThrow("200000");

    const excessiveSupporting = Array.from({ length: 101 }, (_, index) => ({ document_id: `support-${index}` }));
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(json({ items: excessiveSupporting })))
      .listSupportingDocuments("case-1")).rejects.toThrow("maximum of 100");

    const oversizedMetadata = {
      document_id: "support-1",
      document_code: "REQ-1",
      issuer: "x".repeat(513),
      document_number: "CERT-1",
      issued_on: "2026-07-01",
      subject_item_ids: ["item-1"],
      hs_codes: ["0303540000"],
      source_sha256: "a".repeat(64),
      case_id: "case-1",
      org_id: "org-1",
      verification_assertions: [],
      created_by: "reviewer-1",
      created_at: "2026-07-21",
    };
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(json({ items: [oversizedMetadata] })))
      .listSupportingDocuments("case-1")).rejects.toThrow("issuer");
  });

  it("rejects incomplete diagnostic Evidence instead of fabricating verified-looking fields", () => {
    expect(() => decodeReviewRun(reviewRunPayload({
      result_detail: { evidence: [{ evidence_id: "ev-diagnostic", source_uri: "about:blank" }] },
    }))).toThrow(ContractError);
  });

  it("normalizes the Backend wrapper while preserving canonical Agent result", () => {
    const decoded = decodeReviewRun(reviewRunPayload({
      narrative_report: { summary: "문서에서 문제를 발견하지 못했습니다.", citations: [{ evidence_id: "ev-1" }], citation_verification: "passed" },
      action_trace: [{ tool: "evidence.retrieve/v3", status: "completed" }],
      result_detail: {
        facts: [{ fact_id: "fact-1", value: "0303540000" }],
        evidence: [{
          evidence_id: "ev-1",
          title: "Diagnostic Evidence",
          source_record_id: "record-1",
          text: "Diagnostic evidence text.",
          source_uri: "https://example.invalid/1",
          version_hash: "1".repeat(64),
        }],
        issues: [],
        findings: [],
      },
    }));
    expect(decoded.completion_eligibility?.unmet_reason_codes).toEqual(["domain_approval_missing"]);
    expect(decoded.narrative_report?.summary[0]?.citation_ids).toEqual(["ev-1"]);
    expect(decoded.action_trace[0]?.status).toBe("succeeded");
    expect(decoded.evidence[0]?.evidence_id).toBe("ev-1");
  });

  it("derives a fail-closed public Evidence retrieval attestation for UAT assertions", () => {
    const decoded = decodeReviewRun(reviewRunPayload({
      result_detail: {
        retrieval_status: "ok",
        retrieval_coverage: "complete",
        retrieval_results: [{ item_id: "item-1", requirements_found: false }],
      },
    }));
    expect(decoded.evidence_retrieval).toEqual({
      status: "ok",
      coverage: "complete",
      requirements_found: false,
      result_count: 1,
    });

    expect(() => decodeReviewRun(reviewRunPayload({
      result_detail: {
        retrieval_status: "failed",
        retrieval_coverage: "unknown",
        retrieval_results: [{ item_id: "item-1", requirements_found: "false" }],
      },
    }))).toThrow("requirements_found: boolean expected");

    const forgedTopLevel = decodeReviewRun(reviewRunPayload({
      evidence_retrieval: {
        status: "ok",
        coverage: "complete",
        requirements_found: false,
        result_count: 1,
      },
      result_detail: {},
    }));
    expect(forgedTopLevel.evidence_retrieval).toBeUndefined();
  });

  it("maps actual V3 document fields and line items to FactLedger-bound correction paths", () => {
    const documentId = "doc-ci-1";
    const invoiceReference = `field_${"1".repeat(64)}`;
    const quantityReference = `field_${"2".repeat(64)}`;
    const issueReference = `issue_${"3".repeat(64)}`;
    const findingReference = `finding_${"4".repeat(64)}`;
    const evidenceId = `ev_${"5".repeat(64)}`;
    const versionHash = "6".repeat(64);
    const decoded = decodeReviewRun(reviewRunPayload({
      result_detail: {
        document_results: [{
          document_id: documentId,
          fields: [{
            name: "invoice_number",
            value: "INV-001",
            normalized_value: "INV-001",
            confidence: 0.99,
            source: { page: 1, text_start: 0, text_end: 7 },
          }],
          line_items: [{
            item_id: "item-1",
            fields: [{
              name: "quantity",
              value: "1,200",
              normalized_value: "1200",
              confidence: 0.98,
              source: { page: 1, text_start: 8, text_end: 13 },
            }],
          }],
        }],
        validation_issues: [{
          issue_code: "QUANTITY_MISMATCH",
          severity: "high",
          message: "CI와 PL의 수량이 다릅니다.",
          source_document_id: documentId,
          target_document_id: "doc-pl-1",
        }],
        rag_evidence: [{
          evidence_id: evidenceId,
          source_record_id: "law-record-1",
          title: "관세법 제1조",
          text: "적용 법령 본문",
          law_id: "LAW-1",
          law_name: "관세법",
          article_no: "제1조",
          source_uri: "https://law.example.invalid/1",
          valid_from: "2026-01-01",
          version_hash: versionHash,
        }],
        regulatory_findings: [{
          finding_code: "REQUIRED_DOCUMENT_MISSING",
          severity: "high",
          message: "요건서류가 누락되었습니다.",
          item_id: "item-1",
          required_document_code: "REQ-1",
          required_document_name: "수입요건확인서",
          evidence_ids: [evidenceId],
          source: { document_id: documentId, page: 1, text_start: 8, text_end: 13 },
        }],
        fact_ledger: {
          entries: [
            { kind: "field_source", reference_id: invoiceReference, label: `${documentId}.fields.invoice_number`, value: "INV-001", document_id: documentId },
            { kind: "field_source", reference_id: quantityReference, label: `${documentId}.line_items.item-1.quantity`, value: "1200", document_id: documentId },
            { kind: "issue", reference_id: issueReference, label: "QUANTITY_MISMATCH", value: "CI와 PL의 수량이 다릅니다.", document_id: documentId },
            { kind: "finding", reference_id: findingReference, label: "REQUIRED_DOCUMENT_MISSING", value: "요건서류가 누락되었습니다.", document_id: documentId },
            { kind: "evidence", reference_id: evidenceId, label: "관세법 제1조", value: "적용 법령 본문", document_id: null },
          ],
        },
      },
    }));
    expect(decoded.fields).toEqual([
      expect.objectContaining({ field_id: invoiceReference, field_path: "fields.invoice_number", value: "INV-001", source_ids: [invoiceReference] }),
      expect.objectContaining({ field_id: quantityReference, field_path: "line_items.0.quantity", value: "1200", source_ids: [quantityReference] }),
    ]);
    expect(decoded.issues).toEqual([
      expect.objectContaining({ issue_id: issueReference, code: "QUANTITY_MISMATCH", source_ids: [issueReference] }),
    ]);
    expect(decoded.evidence).toEqual([
      expect.objectContaining({
        evidence_id: evidenceId,
        law_id: "LAW-1",
        article: "제1조",
        source_hash: versionHash,
        effective_date: "2026-01-01",
      }),
    ]);
    expect(decoded.findings).toEqual([
      expect.objectContaining({
        finding_id: findingReference,
        code: "REQUIRED_DOCUMENT_MISSING",
        title: "수입요건확인서",
        evidence_ids: [evidenceId],
        source_ids: [findingReference],
      }),
    ]);
    expect(decoded.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ source_id: invoiceReference, page: 1, start_offset: 0, end_offset: 7 }),
      expect.objectContaining({ source_id: findingReference, page: 1, start_offset: 8, end_offset: 13 }),
    ]));
  });

  it("binds multiple issues and findings by canonical identity even when Ledger hash order is reversed", () => {
    const issueA = `issue_${"a".repeat(64)}`;
    const issueB = `issue_${"1".repeat(64)}`;
    const findingA = `finding_${"b".repeat(64)}`;
    const findingB = `finding_${"2".repeat(64)}`;
    const decoded = decodeReviewRun(reviewRunPayload({
      result_detail: {
        validation_issues: [
          { issue_code: "ISSUE_A", severity: "high", message: "first issue", source_document_id: "doc-a" },
          { issue_code: "ISSUE_B", severity: "medium", message: "second issue", source_document_id: "doc-b" },
        ],
        regulatory_findings: [
          { finding_code: "FINDING_A", severity: "high", message: "first finding", required_document_name: "Permit A", evidence_ids: [], source: { document_id: "doc-a" } },
          { finding_code: "FINDING_B", severity: "medium", message: "second finding", required_document_name: "Permit B", evidence_ids: [], source: { document_id: "doc-b" } },
        ],
        fact_ledger: {
          entries: [
            { kind: "issue", reference_id: issueB, label: "ISSUE_B", value: "second issue", document_id: "doc-b" },
            { kind: "issue", reference_id: issueA, label: "ISSUE_A", value: "first issue", document_id: "doc-a" },
            { kind: "finding", reference_id: findingB, label: "FINDING_B", value: "second finding", document_id: "doc-b" },
            { kind: "finding", reference_id: findingA, label: "FINDING_A", value: "first finding", document_id: "doc-a" },
          ],
        },
      },
    }));
    expect(decoded.issues.map((item) => item.issue_id)).toEqual([issueA, issueB]);
    expect(decoded.findings.map((item) => item.finding_id)).toEqual([findingA, findingB]);
  });

  it("fails closed when an issue Ledger binding is ambiguous or an explicit reference mismatches semantics", () => {
    const duplicated = {
      kind: "issue",
      label: "DUPLICATE",
      value: "same issue",
      document_id: "doc-1",
    };
    expect(() => decodeReviewRun(reviewRunPayload({
      result_detail: {
        validation_issues: [{ issue_code: "DUPLICATE", severity: "high", message: "same issue", source_document_id: "doc-1" }],
        fact_ledger: { entries: [
          { ...duplicated, reference_id: `issue_${"1".repeat(64)}` },
          { ...duplicated, reference_id: `issue_${"2".repeat(64)}` },
        ] },
      },
    }))).toThrow("ambiguous FactLedger binding");

    expect(() => decodeReviewRun(reviewRunPayload({
      result_detail: {
        validation_issues: [{ reference_id: `issue_${"3".repeat(64)}`, issue_code: "EXPECTED", severity: "high", message: "expected", source_document_id: "doc-1" }],
        fact_ledger: { entries: [{ kind: "issue", reference_id: `issue_${"3".repeat(64)}`, label: "OTHER", value: "other", document_id: "doc-1" }] },
      },
    }))).toThrow("missing FactLedger binding");
  });

  it("fails closed when a narrative claim cites an unknown ledger ID", () => {
    expect(() => decodeReviewRun(reviewRunPayload({
      review_run_id: "run-unknown-citation",
      narrative_report: {
        title: "invalid",
        summary: [{ claim_id: "claim-1", text: "근거 없는 결론", citation_ids: ["missing-source"] }],
        document_consistency: [],
        regulatory_review: [],
        impact: [],
        recommended_actions: [],
        generated_by: "claude",
        citation_verification: "passed",
      },
    }))).toThrow(ContractError);
  });

  it("accepts auto-review completion only with a coherent released safety envelope", () => {
    const sourceRecordId = "requirement-record-1";
    const versionHash = "a".repeat(64);
    const evidenceId = `ev_${createHash("sha256").update(`${sourceRecordId}\u001f${versionHash}`).digest("hex")}`;
    const outcomeValue = {
      status: "completed",
      requires_human_review: false,
      retrieval_status: "ok",
      retrieval_coverage: "complete",
    };
    const outcomeReference = `outcome_${canonicalSha256(outcomeValue)}`;
    const profileId = "profile-0303540000-v1";
    const releaseIdentity = {
      agent_package_version: "0.3.0",
      model_id: "claude-sonnet-5-20260701",
      model_revision: "claude-sonnet-5-20260701",
      extraction_prompt_sha256: "1".repeat(64),
      result_schema_sha256: "2".repeat(64),
      policy_id: "policy-v3",
      tool_registry_id: "tools-v1",
      assertion_trust_store_sha256: "3".repeat(64),
      assertion_trust_store_state: "active",
      evidence_snapshot_id: "generation-1",
      evidence_runtime_v3_sha256: "4".repeat(64),
      release_profile_id: profileId,
      release_profile_state: "approved",
      release_profile_sha256: "5".repeat(64),
      release_profile_subject_sha256: "6".repeat(64),
      release_profile_evaluation_report_sha256: "8".repeat(64),
      kill_switch_active: false,
      backend_auto_completion_enabled: true,
      backend_auto_completion_approval_digest: "9".repeat(64),
    };
    const inputDocumentManifest = [
      { document_id: "doc-bl", document_type: "BL", content_sha256: "1".repeat(64) },
      { document_id: "doc-ci", document_type: "CI", content_sha256: "2".repeat(64) },
      { document_id: "doc-co", document_type: "CO", content_sha256: "3".repeat(64) },
      { document_id: "doc-pl", document_type: "PL", content_sha256: "4".repeat(64) },
    ];
    const resultTypes: Record<string, string> = {
      BL: "bill_of_lading",
      CI: "invoice",
      CO: "certificate_of_origin",
      PL: "packing_list",
    };
    const fieldReferences = ["a", "b", "c", "d"].map((value) => `field_${value.repeat(64)}`);
    const documentResults = inputDocumentManifest.map((document, index) => ({
      document_id: document.document_id,
      document_type: resultTypes[document.document_type],
      input_modality: "text",
      extraction_status: "completed",
      extraction_confidence: 1,
      extraction_provider: "anthropic",
      model_id: releaseIdentity.model_id,
      fields: [{
        name: "document_number",
        value: `${document.document_type}-001`,
        normalized_value: `${document.document_type}-001`,
        confidence: 1,
        source: {
          document_id: document.document_id,
          page: 1,
          source_modality: "text",
          text_start: 0,
          text_end: 6,
        },
      }],
      line_items: [],
    }));
    const fieldLedgerEntries = inputDocumentManifest.map((document, index) => ({
      fact_id: `fact_${String(index + 1).repeat(64)}`,
      kind: "field_source",
      reference_id: fieldReferences[index],
      label: `${document.document_id}.fields.document_number`,
      value: `${document.document_type}-001`,
      document_id: document.document_id,
      source_sha256: String(index + 1).repeat(64),
    }));
    const mandatoryStageTrace = [
      "load_case",
      "classify_documents",
      "extract_documents",
      "normalize_documents",
      "pair_documents",
      "validate_cross_documents",
      "retrieve_regulations",
      "compliance_review",
      "generate_xai_report",
      "route_to_human_or_complete",
      "redact_sensitive_inputs",
    ].map((stage, index) => ({ sequence: index + 1, stage, status: "completed", reason_ids: [] }));
    const inputManifestDigest = canonicalSha256({
      case_id: "case-1",
      case_revision: 1,
      review_as_of: "2026-07-21",
      trade_type: "import",
      documents: inputDocumentManifest,
    });
    const ragEvidence = {
      evidence_id: evidenceId,
      source_record_id: sourceRecordId,
      source_type: "customs_requirement",
      item_id: "item-1",
      title: "released import requirement",
      text: "A verified import permit is required.",
      law_id: "LAW-1",
      law_name: "Released Law",
      article_no: "Article 1",
      source_uri: "https://law.example.invalid/1",
      valid_from: "2026-01-01",
      valid_to: null,
      version_hash: versionHash,
      matched_hs_code: "0303540000",
      trade_type: "import",
      required_document_code: "IMPORT_PERMIT",
      required_document_name: "Import Permit",
      agencies: ["TEST_AUTHORITY"],
      eligibility: "finding",
      retrieval_methods: ["exact_hs"],
    };
    const complete = reviewRunPayload({
      review_as_of: "2026-07-21",
      trade_type: "import",
      input_document_manifest: inputDocumentManifest,
      input_manifest_digest: inputManifestDigest,
      auto_completion_profile: {
        profile_id: profileId,
        approved_document_types: ["CI", "PL", "BL", "CO"],
        approved_required_document_codes: ["IMPORT_PERMIT"],
        approval_digest: releaseIdentity.backend_auto_completion_approval_digest,
      },
      review_disposition: "auto_review_complete",
      assurance_level: "production",
      completion_eligibility: { eligible: true, profile_id: profileId, scope: ["KR/import/0303540000"], unmet_reason_codes: [] },
      narrative_report: {
        title: "released review",
        summary: [{ claim_id: `claim_${"1".repeat(64)}`, text: "No issue detected.", citation_ids: [evidenceId] }],
        document_consistency: [{ claim_id: `claim_${"4".repeat(64)}`, text: "Documents are consistent.", citation_ids: [fieldReferences[0]] }],
        regulatory_review: [{ claim_id: `claim_${"5".repeat(64)}`, text: "Released law was reviewed.", citation_ids: [evidenceId] }],
        impact: [],
        required_actions: [],
        generation_mode: "claude",
        generated_by: "claude",
        citation_verification: "passed",
      },
      action_trace: [{
        action_id: `action_${"2".repeat(64)}`,
        cycle: 0,
        tool_name: "evidence.retrieve/v3",
        reason_code: "released_evidence_required",
        input_reference_ids: [evidenceId],
        output_reference_ids: [],
        status: "succeeded",
      }],
      release_identity: releaseIdentity,
      review_stage_trace: mandatoryStageTrace,
      result_detail: {
        review_as_of: "2026-07-21",
        trade_type: "import",
        jurisdiction: "KR",
        retrieval_status: "ok",
        retrieval_coverage: "complete",
        knowledge_snapshot_id: "generation-1",
        retrieval_results: [{
          item_id: "item-1",
          hs_resolution: "exact",
          resolved_hsk10: "0303540000",
          candidate_hsk10s: ["0303540000"],
          coverage: "complete",
          requirements_found: true,
          evidence: [ragEvidence],
          errors: [],
        }],
        validation_issues: [],
        regulatory_findings: [],
        review_gaps: [],
        review_plan: { plan_id: `plan_${"1".repeat(64)}`, mode: "bounded", actions: [] },
        document_results: documentResults,
        review_stage_trace: mandatoryStageTrace,
        rag_evidence: [ragEvidence],
        report: {
          case_id: "case-1",
          overall_status: "completed",
          summary: {
            total_documents: 4,
            total_issues: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            average_extraction_confidence: 1,
            outcome_reasons: [],
            retrieval_status: "ok",
            retrieval_coverage: "complete",
            knowledge_snapshot_id: "generation-1",
          },
          document_summary: documentResults.map((document) => ({
            document_id: document.document_id,
            document_type: document.document_type,
            extraction_status: document.extraction_status,
            extraction_confidence: document.extraction_confidence,
          })),
          issues: [],
          regulatory_findings: [],
          rag_evidence: [ragEvidence],
          disclaimer: "Released pre-clearance review aid.",
        },
        fact_ledger: {
          ledger_id: `ledger_${"3".repeat(64)}`,
          entries: [...fieldLedgerEntries, {
            fact_id: `fact_${"e".repeat(64)}`,
            kind: "evidence",
            reference_id: evidenceId,
            label: "released import requirement",
            value: "A verified import permit is required.",
            document_id: null,
            source_sha256: "f".repeat(64),
          }, {
            fact_id: `fact_${"0".repeat(64)}`,
            kind: "outcome",
            reference_id: outcomeReference,
            label: "deterministic_outcome",
            value: canonicalJson(outcomeValue),
            document_id: null,
            source_sha256: "0".repeat(64),
          }],
        },
      },
    });
    expect(decodeReviewRun(complete).review_disposition).toBe("auto_review_complete");
    const mutateEveryEvidenceCopy = (
      value: Record<string, unknown>,
      key: string,
      replacement: unknown,
    ): void => {
      const detail = value.result_detail as {
        rag_evidence: Array<Record<string, unknown>>;
        report: { rag_evidence: Array<Record<string, unknown>> };
        retrieval_results: Array<{ evidence: Array<Record<string, unknown>> }>;
      };
      detail.rag_evidence[0]![key] = replacement;
      detail.report.rag_evidence[0]![key] = replacement;
      detail.retrieval_results[0]!.evidence[0]![key] = replacement;
    };
    const mutations: Array<(value: Record<string, unknown>) => void> = [
      (value) => { value.release_identity = { ...releaseIdentity, kill_switch_active: true }; },
      (value) => { value.release_identity = { ...releaseIdentity, model_id: "claude-sonnet-5", model_revision: "claude-sonnet-5" }; },
      (value) => { value.action_trace = []; },
      (value) => { (value.result_detail as Record<string, unknown>).rag_evidence = [{}]; },
      (value) => { ((value.result_detail as { rag_evidence: Array<Record<string, unknown>> }).rag_evidence[0]!).source_uri = "about:blank"; },
      (value) => { ((value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries[0]!).label = "forged label"; },
      (value) => { ((value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries[0]!).value = "forged field value"; },
      (value) => { const entry = (value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries.find((item) => item.kind === "outcome")!; entry.value = canonicalJson({ ...outcomeValue, requires_human_review: true }); },
      (value) => { (value.result_detail as Record<string, unknown>).review_gaps = [{ gap_id: `gap_${"6".repeat(64)}`, gap_type: "release_gate", reason_code: "not_released", source_reference_ids: [evidenceId], status: "deferred" }]; },
      (value) => { delete (value.result_detail as Record<string, unknown>).review_gaps; },
      (value) => { delete value.required_actions; },
      (value) => { delete (value.result_detail as Record<string, unknown>).validation_issues; },
      (value) => { delete (value.result_detail as Record<string, unknown>).regulatory_findings; },
      (value) => { value.issues = []; },
      (value) => { ((value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries).push({ fact_id: `fact_${"6".repeat(64)}`, kind: "issue", reference_id: `issue_${"6".repeat(64)}`, label: "MATERIAL_MISMATCH", value: "hidden mismatch", document_id: "doc-ci", source_sha256: "6".repeat(64) }); },
      (value) => { ((value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries).push({ fact_id: `fact_${"8".repeat(64)}`, kind: "finding", reference_id: `finding_${"8".repeat(64)}`, label: "HIDDEN_FINDING", value: "hidden finding", document_id: "doc-ci", source_sha256: "8".repeat(64) }); },
      (value) => { ((value.result_detail as { fact_ledger: { entries: Array<Record<string, unknown>> } }).fact_ledger.entries).push({ fact_id: `fact_${"9".repeat(64)}`, kind: "evidence", reference_id: `ev_${"9".repeat(64)}`, label: "hidden evidence", value: "hidden evidence", document_id: null, source_sha256: "9".repeat(64) }); },
      (value) => { ((value.result_detail as { report: { rag_evidence: Array<Record<string, unknown>> } }).report.rag_evidence).pop(); },
      (value) => { ((value.result_detail as { report: { rag_evidence: Array<Record<string, unknown>> } }).report.rag_evidence[0]!).text = "contradictory report Evidence"; },
      (value) => { ((value.result_detail as { retrieval_results: Array<{ evidence: Array<Record<string, unknown>> }> }).retrieval_results[0]!.evidence[0]!).text = "contradictory retrieval Evidence"; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).coverage = "partial"; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).hs_resolution = "ambiguous"; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).resolved_hsk10 = null; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).errors = [{ code: "UPSTREAM_PARTIAL", message: "partial", retryable: false }]; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).requirements_found = false; },
      (value) => { ((value.result_detail as { retrieval_results: Array<Record<string, unknown>> }).retrieval_results[0]!).status = "ok"; },
      (value) => { mutateEveryEvidenceCopy(value, "required_document_code", "UNVERIFIED_PERMIT"); },
      (value) => { mutateEveryEvidenceCopy(value, "required_document_name", null); },
      (value) => { mutateEveryEvidenceCopy(value, "matched_hs_code", "9999999999"); },
      (value) => { mutateEveryEvidenceCopy(value, "matched_hs_code", "030354"); },
      (value) => { mutateEveryEvidenceCopy(value, "eligibility", "blocked"); },
      (value) => { ((value.result_detail as { report: { summary: Record<string, unknown> } }).report.summary).outcome_reasons = ["manual_action_required"]; },
      (value) => { (value.narrative_report as Record<string, unknown>).generation_mode = "deterministic_fallback"; (value.narrative_report as Record<string, unknown>).generated_by = "deterministic_fallback"; },
      (value) => { ((value.narrative_report as { summary: Array<Record<string, unknown>> }).summary[0]!).citation_ids = []; },
      (value) => { delete value.input_document_manifest; },
      (value) => { ((value.input_document_manifest as Array<Record<string, unknown>>)[0]!).content_sha256 = "0".repeat(64); },
      (value) => { (value.result_detail as Record<string, unknown>).case_id = "case-other"; },
      (value) => { (value.result_detail as { document_results: unknown[] }).document_results.pop(); },
      (value) => { ((value.result_detail as { document_results: Array<Record<string, unknown>> }).document_results[0]!).document_type = "invoice"; },
      (value) => { ((value.result_detail as { document_results: Array<Record<string, unknown>> }).document_results[0]!).fields = []; },
      (value) => { (value.review_stage_trace as unknown[]).pop(); },
      (value) => { ((value.review_stage_trace as Array<Record<string, unknown>>)[3]!).stage = "pair_documents"; },
      (value) => { ((value.review_stage_trace as Array<Record<string, unknown>>)[5]!).status = "failed"; },
      (value) => { ((value.result_detail as { review_stage_trace: Array<Record<string, unknown>> }).review_stage_trace[0]!).sequence = 2; },
      (value) => { (value.narrative_report as Record<string, unknown>).impact = [{ claim_id: `claim_${"8".repeat(64)}`, text: "Uncited impact", citation_ids: [], material: false }]; },
      (value) => { (value.narrative_report as Record<string, unknown>).required_actions = [{ claim_id: `claim_${"1".repeat(64)}`, text: "Aliased claim", citation_ids: [evidenceId] }]; },
      (value) => { (value.narrative_report as Record<string, unknown>).required_actions = [{ claim_id: `claim_${"9".repeat(64)}`, text: "Manual action required.", citation_ids: [evidenceId] }]; },
      (value) => { ((value.narrative_report as { summary: Array<Record<string, unknown>> }).summary[0]!).citations = [{ reference_id: evidenceId }]; },
      (value) => { value.result_digest = "0".repeat(64); },
      (value) => { value.provider_result_sha256 = "0".repeat(64); },
    ];
    for (const mutate of mutations) {
      const attacked = structuredClone(complete);
      mutate(attacked);
      expect(() => decodeReviewRun(attacked)).toThrow(ContractError);
    }
  });

  it("treats the actual HTTP status as authoritative and rejects a conflicting Problem body", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json({
      type: "about:blank",
      title: "forged",
      status: 400,
      detail: "do not clear recovery",
    }, 503));
    await expect(new ApiClient(fetcher).getJob("job-1")).rejects.toBeInstanceOf(ContractError);
  });

  it("atomically rejects resource and organization identities that do not match the URL or session", async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
      .mockResolvedValueOnce(json({
        case_id: "case-other",
        org_id: "org-1",
        title: "forged",
        status: "open",
        revision: 0,
        updated_at: "2026-07-21",
        created_at: "2026-07-21",
      }))
      .mockResolvedValueOnce(json({ items: [
        { record: { document_id: "doc-1", case_id: "case-1", document_type: "CI", filename: "a.txt", media_type: "text/plain", content_sha256: textSha256("a"), byte_size: 1, character_count: 1, created_by: "reviewer-1", created_at: "2026-07-21" }, content_text: "a" },
        { record: { document_id: "doc-2", case_id: "case-other", document_type: "PL", filename: "b.txt", media_type: "text/plain", content_sha256: textSha256("b"), byte_size: 1, character_count: 1, created_by: "reviewer-1", created_at: "2026-07-21" }, content_text: "b" },
      ] }));
    const client = new ApiClient(fetcher);
    await client.getSession();
    await expect(client.getCase("case-1")).rejects.toThrow("requested identity");
    await expect(client.listDocuments("case-1")).rejects.toThrow("another Case");

    const crossOrg = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
      .mockResolvedValueOnce(json({ items: [{ case_id: "case-1", org_id: "org-attacker", title: "x", status: "open", revision: 0, updated_at: "2026-07-21" }] }));
    const crossOrgClient = new ApiClient(crossOrg);
    await crossOrgClient.getSession();
    await expect(crossOrgClient.listCases()).rejects.toThrow("authenticated organization");
  });

  it("binds grounded Chat to the requested Run/result/org and rejects ungrounded or unknown states", async () => {
    const request = { question: "Applicable law?", bound_result_digest: "d".repeat(64) };
    const chatKey = "chat-key";
    const base = {
      message_id: "message-1",
      review_run_id: "run-1",
      case_id: "case-1",
      org_id: "org-1",
      question: "Applicable law?",
      answer: "Article 1 applies.",
      answer_status: "answered",
      citations: [{ reference_id: `ev_${"7".repeat(64)}` }],
      bound_result_digest: "d".repeat(64),
      idempotency_key: `idem_${canonicalSha256({
        endpoint: "case.answer/v1",
        actor_id: "reviewer-1",
        org_id: "org-1",
        case_id: "case-1",
        supplied_key: chatKey,
      })}`,
      idempotency_request_digest: canonicalSha256({ review_run_id: "run-1", question: request }),
      created_by: "reviewer-1",
      created_at: "2026-07-21",
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
      .mockResolvedValueOnce(json({ ...base, review_run_id: "run-attacker" }));
    const client = new ApiClient(fetcher);
    await client.getSession();
    await expect(client.answerCaseQuestion("run-1", request, chatKey))
      .rejects.toThrow("requested identity");

    for (const attacked of [
      { ...base, answer_status: "invented" },
      { ...base, citations: [] },
      { ...base, bound_result_digest: "e".repeat(64) },
      { ...base, idempotency_key: `idem_${"0".repeat(64)}` },
      { ...base, idempotency_request_digest: "0".repeat(64) },
    ]) {
      const attackedFetcher = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer"] }))
        .mockResolvedValueOnce(json(attacked));
      const attackedClient = new ApiClient(attackedFetcher);
      await attackedClient.getSession();
      await expect(attackedClient.answerCaseQuestion("run-1", request, chatKey))
        .rejects.toBeInstanceOf(ContractError);
    }
  });

  it("rejects SSE media-type, Job identity and out-of-order sequence mutations", async () => {
    const stream = (frames: string, contentType = "text/event-stream") => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(frames));
        controller.close();
      },
    }), { status: 200, headers: { "content-type": contentType } });
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(stream("{}", "application/json")))
      .streamJobEvents("job-1", () => undefined, new AbortController().signal)).rejects.toThrow("text/event-stream");
    const wrongJob = 'event: review-stage\ndata: {"event_id":"evt-1","job_id":"job-other","sequence":1,"stage":"evidence","state":"progress","message_code":"x","occurred_at":"2026-07-21"}\n\n';
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(stream(wrongJob)))
      .streamJobEvents("job-1", () => undefined, new AbortController().signal)).rejects.toThrow("requested identity");
    const duplicate = 'event: review-stage\ndata: {"event_id":"evt-1","job_id":"job-1","sequence":1,"stage":"a","state":"progress","message_code":"a","occurred_at":"2026-07-21"}\n\nevent: review-stage\ndata: {"event_id":"evt-2","job_id":"job-1","sequence":1,"stage":"b","state":"progress","message_code":"b","occurred_at":"2026-07-21"}\n\n';
    await expect(new ApiClient(vi.fn<typeof fetch>().mockResolvedValue(stream(duplicate)))
      .streamJobEvents("job-1", () => undefined, new AbortController().signal)).rejects.toThrow("out of order");
  });

  it("streams authenticated review-stage SSE frames", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('event: review-stage\ndata: {"event_id":"evt-1","job_id":"job-1","sequence":1,"stage":"evidence","state":"progress","message_code":"evidence.started","occurred_at":"2026-07-21T00:00:00Z"}\n\n'));
        controller.close();
      },
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
    const events: string[] = [];
    await new ApiClient(fetcher, () => "memory-token").streamJobEvents("job-1", (event) => events.push(event.event_id), new AbortController().signal);
    expect(events).toEqual(["evt-1"]);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe("Bearer memory-token");
  });

  it("binds supporting-document metadata to a Backend document hash", async () => {
    const record = {
      document_id: "doc-support-1",
      document_code: "REQ-1",
      issuer: "Test Authority",
      document_number: "CERT-1",
      issued_on: "2026-07-01",
      valid_until: "2026-12-31",
      subject_item_ids: ["doc-ci-1_line_1"],
      hs_codes: ["0303540000"],
      source_sha256: "a".repeat(64),
      case_id: "case-1",
      org_id: "org-1",
      verification_assertions: [],
      created_by: "reviewer-1",
      created_at: "2026-07-21T00:00:00Z",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(record, 201));
    const created = await new ApiClient(fetcher, () => "token").addSupportingDocument("case-1", {
      document_id: record.document_id,
      document_code: record.document_code,
      issuer: record.issuer,
      document_number: record.document_number,
      issued_on: record.issued_on,
      valid_until: record.valid_until,
      subject_item_ids: record.subject_item_ids,
      hs_codes: record.hs_codes,
      source_sha256: record.source_sha256,
    });
    expect(created.source_sha256).toBe(record.source_sha256);
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/v1/cases/case-1/supporting-documents");
  });

  it("lets Backend derive every human assertion authority field", async () => {
    const sourceHash = "a".repeat(64);
    const record = {
      document_id: "doc-support-1",
      document_code: "REQ-1",
      issuer: "Test Authority",
      document_number: "CERT-1",
      issued_on: "2026-07-01",
      valid_until: "2026-12-31",
      subject_item_ids: ["doc-ci-1_line_1"],
      hs_codes: ["0303540000"],
      source_sha256: sourceHash,
      case_id: "case-1",
      org_id: "org-1",
      verification_assertions: [{
        assertion_id: `assert_${"b".repeat(64)}`,
        method: "human_approver",
        subject_document_id: "doc-support-1",
        asserted_by: "approver-1",
        asserted_at: "2026-07-21T00:00:00Z",
        authority_id: `backend:principal-sha256:${"c".repeat(64)}`,
        authority_release: "backend-human-decision-policy-v1",
        source_reference_sha256: sourceHash,
      }],
      created_by: "reviewer-1",
      created_at: "2026-07-21T00:00:00Z",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(record, 201));
    const client = new ApiClient(fetcher, () => "token");

    await client.addSupportingAssertion("case-1", "doc-support-1", {
      method: "human_approver",
    });

    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("/api/v1/cases/case-1/supporting-documents/doc-support-1/assertions");
    expect(JSON.parse(String(init?.body))).toEqual({ method: "human_approver" });
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("source_reference");
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("authority_id");
  });

  it("accepts only a receipt bound to its human decision lineage", async () => {
    const sourceHash = "a".repeat(64);
    const authorityId = `backend:principal-sha256:${"c".repeat(64)}`;
    const authorityRelease = "backend-human-decision-policy-v1";
    const record = {
      document_id: "doc-support-1",
      document_code: "REQ-1",
      issuer: "Test Authority",
      document_number: "CERT-1",
      issued_on: "2026-07-01",
      valid_until: "2026-12-31",
      subject_item_ids: ["doc-ci-1_line_1"],
      hs_codes: ["0303540000"],
      source_sha256: sourceHash,
      case_id: "case-1",
      org_id: "org-1",
      verification_assertions: [{
        assertion_id: `assert_${"b".repeat(64)}`,
        method: "human_approver",
        subject_document_id: "doc-support-1",
        asserted_by: "approver-1",
        asserted_at: "2026-07-21T00:00:00Z",
        authority_id: authorityId,
        authority_release: authorityRelease,
        source_reference_sha256: sourceHash,
        decision_record: {
          actor_id: "approver-1",
          actor_role: "approver",
          case_id: "case-1",
          decided_at: "2026-07-21T00:00:00Z",
          decision: "verify_supporting_document",
          document_id: "doc-support-1",
          policy_release: authorityRelease,
          policy_source_sha256: "d".repeat(64),
          schema_version: "backend-supporting-document-human-decision/v1",
          source_sha256: sourceHash,
          supporting_document_claims_sha256: "e".repeat(64),
        },
        receipt: {
          authority_id: authorityId,
          authority_release: authorityRelease,
          case_id: "case-1",
          decision_record_sha256: "f".repeat(64),
          expires_at: "2027-07-21T00:00:00Z",
          key_id: "backend-key-1",
          method: "human_approver",
          policy_release: authorityRelease,
          policy_source_sha256: "d".repeat(64),
          signature_base64url: "A".repeat(86),
          signed_at: "2026-07-21T00:00:00Z",
          supporting_document_claims_sha256: "e".repeat(64),
          trust_domain: "customs-ai-agent/supporting-document-verification/v1",
        },
      }],
      created_by: "reviewer-1",
      created_at: "2026-07-21T00:00:00Z",
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(json(record, 201));
    const created = await new ApiClient(fetcher, () => "token").addSupportingAssertion(
      "case-1",
      "doc-support-1",
      { method: "human_approver" },
    );
    expect(created.verification_assertions[0]?.receipt?.key_id).toBe("backend-key-1");
  });

  it("rejects caller-supplied assertion authority before any HTTP request", () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new ApiClient(fetcher, () => "token");
    const forged = {
      method: "human_approver",
      source_reference: "caller-controlled",
    } as never;

    expect(() => client.addSupportingAssertion("case-1", "doc-support-1", forged))
      .toThrow(ContractError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("creates and approves a typed revision proposal through the maker-checker endpoints", async () => {
    const proposalRequest = {
      parent_result_digest: "a".repeat(64),
      parent_input_manifest_sha256: "b".repeat(64),
      case_revision: 2,
      actions: [{ decision: "confirm_field" as const, reason: "verified", confirmed_reference_id: "source-1" }],
    };
    const createKey = "proposal-create-1";
    const decisionRequest = {
      decision: "approve" as const,
      reason: "checked",
      parent_result_digest: "a".repeat(64),
      case_revision: 2,
    };
    const decisionKey = "proposal-intent-1";
    const proposal = {
      proposal_id: "proposal-1",
      org_id: "org-1",
      case_id: "case-1",
      review_run_id: "run-1",
      parent_result_digest: "a".repeat(64),
      parent_input_manifest_sha256: "b".repeat(64),
      case_revision: 2,
      corrections: [],
      actions: proposalRequest.actions,
      idempotency_key: `idem_${canonicalSha256({
        endpoint: "revision-proposal.create/v1",
        actor_id: "reviewer-1",
        org_id: "org-1",
        case_id: "case-1",
        supplied_key: createKey,
      })}`,
      idempotency_request_digest: canonicalSha256({
        review_run_id: "run-1",
        proposal: {
          ...proposalRequest,
          actions: [{
            ...proposalRequest.actions[0],
            correction: null,
            supporting_document_id: null,
          }],
        },
      }),
      status: "approved",
      created_by: "reviewer-1",
      created_at: "2026-07-21T00:00:00Z",
    };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ subject: "reviewer-1", org_id: "org-1", roles: ["reviewer", "approver"] }))
      .mockResolvedValueOnce(json({ ...proposal, status: "pending" }, 201))
      .mockResolvedValueOnce(json({
        proposal,
        decision: {
          decision_id: "decision-1",
          org_id: "org-1",
          case_id: "case-1",
          review_run_id: "run-1",
          proposal_id: "proposal-1",
          decision: "approve",
          reason: "checked",
          idempotency_key: `idem_${canonicalSha256({
            endpoint: "revision-proposal.decide/v1",
            actor_id: "reviewer-1",
            org_id: "org-1",
            case_id: "case-1",
            supplied_key: decisionKey,
          })}`,
          idempotency_request_digest: canonicalSha256({ proposal_id: "proposal-1", decision: decisionRequest }),
          decided_by: "reviewer-1",
          created_at: "2026-07-21",
        },
        job: { ...jobPayload("job-1", "revision"), agent_call_state: "not_started", review_run_id: "run-child-1", created_by: "approver-1" },
      }, 201));
    const client = new ApiClient(fetcher, () => "token");
    await client.getSession();
    await client.createRevisionProposal("run-1", proposalRequest, createKey);
    const response = await client.decideRevisionProposal(
      proposal.proposal_id,
      decisionRequest,
      decisionKey,
    );
    expect(response.job?.job_id).toBe("job-1");
    expect(fetcher.mock.calls[1]?.[0]).toBe("/api/v1/review-runs/run-1/revision-proposals");
    expect(new Headers(fetcher.mock.calls[2]?.[1]?.headers).get("Idempotency-Key")).toBe(decisionKey);
    expect(fetcher.mock.calls[2]?.[0]).toBe("/api/v1/revision-proposals/proposal-1/decisions");
  });
});
