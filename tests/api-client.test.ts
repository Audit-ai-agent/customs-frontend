import { describe, expect, it } from "vitest";
import { stableApiErrorMessage } from "../src/api/user-facing-errors";
import { ApiClient } from "../src/api/v1/client";
import { decodeLlmConnectionTest, decodeLlmSettings, decodeRasterTextExtractionEnvelope } from "../src/api/v1/decoders";

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function reviewRunPayload() {
  return {
    review_run_id: "run-1", case_id: "case-1", org_id: "org-a", job_id: "job-1", case_revision: 1,
    review_as_of: "2026-08-05", trade_type: "import", execution_status: "succeeded", assessment: "issues_detected",
    review_disposition: "human_review_required", completion_eligibility: { eligible: false, unmet_reason_codes: ["human_review_required"] },
    agent_schema_version: "3.3", agent_status: "needs_review", agent_engine: { kind: "deterministic", model_id: "fixture" },
    report: {
      overall_status: "needs_review", summary: "검토 결과입니다.", disclaimer: "담당자 검토가 필요합니다.",
      sections: [
        ["conclusion", "심사 결론"], ["execution_process", "실행 과정"], ["document_comparison", "문서 비교"], ["issues_and_causes", "문제와 원인"],
        ["legal_evidence", "법령 근거"], ["impact", "영향"], ["next_actions", "다음 조치"], ["limitations", "한계"],
      ].map(([section, title], index) => ({
        section,
        title,
        claims: [{ claim_id: `claim-${index + 1}`, text: `${title} 설명`, fact_ids: index === 4 ? [] : [index === 6 ? "fact-human-1" : "fact-1"], comparison_ids: index === 2 ? ["comparison-1"] : [], evidence_ids: index === 4 ? ["evidence-1"] : [] }],
      })),
    },
    workflow: {
      status: "completed", stages: [{ stage: "classify_documents", status: "completed", attempt_count: 1, summary: "문서를 판별했습니다." }], reextractions: [],
      planner: { cycle_count: 2, actions: [
        { cycle: 1, action: "analyze_documents", status: "completed", summary: "문서를 분석했습니다.", correction_proposal_ids: [] },
        { cycle: 2, action: "apply_human_corrections", status: "completed", summary: "승인된 수정값을 반영했습니다.", correction_proposal_ids: ["proposal-1"] },
      ] },
    },
    document_analyses: [{
      document_id: "document-1", filename: "invoice.txt", declared_type: "invoice", document_type: "invoice",
      classification_source: { source_kind: "document", document_id: "document-1", quote: "INVOICE", occurrence: 0 }, extraction_status: "complete",
      facts: [
        { fact_id: "fact-1", name: "hs_code", raw_value: "8471.30", normalized_value: "8471.30", unit: null, source: { source_kind: "document", document_id: "document-1", quote: "8471.30", occurrence: 0 } },
        { fact_id: "fact-human-1", name: "quantity", raw_value: "12", normalized_value: "12", unit: "EA", source: { source_kind: "human_provided", document_id: "document-1", correction_proposal_id: "proposal-1", reason: "Packing List 원문 재확인" } },
      ],
      line_items: [], warnings: [],
    }],
    comparisons: [{
      comparison_id: "comparison-1", rule_code: "QTY_MISMATCH_INVOICE_PACKING", status: "mismatch",
      left: { document_id: "document-1", item_id: null, fact_ids: ["fact-1"], display_value: "10" },
      right: { document_id: "document-1", item_id: null, fact_ids: [], display_value: "12" },
      expected_value: "10", observed_value: "12", unit: "EA", message: "수량을 확인하십시오.",
    }],
    evidence: [{ evidence_id: "evidence-1", item_id: "item-1", title: "관세법", text: "근거 조문", source_uri: "https://example.test/law", source_type: "law", source_hash: "a".repeat(64), law_id: "law-1", law_name: "관세법" }],
    findings: [{ finding_id: "finding-1", kind: "validation_issue", code: "QTY_MISMATCH_INVOICE_PACKING", severity: "high", message: "수량을 확인하십시오.", item_id: null, evidence_ids: ["evidence-1"], comparison_id: "comparison-1", document_ids: ["document-1"], fact_ids: ["fact-1"] }],
    required_actions: [{ action_code: "inspect_quantity", message: "수량을 확인하십시오.", finding_ids: ["finding-1"] }, { action_code: "human_review_required", message: "담당자 검토", finding_ids: [] }],
    reviewer_decisions: [], created_by: "reviewer", created_at: "2026-08-05T00:00:00Z",
  };
}

describe("Backend API client", () => {
  it("keeps text-only raster OCR profile-bound and confirms only the edited draft", async () => {
    const asset = {
      asset_id: "asset-ocr-1", case_id: "case-1", document_type: "CI" as const, filename: "scan.png",
      media_type: "image/png" as const, byte_size: 4, page_count: 1, pixel_count: 1,
      created_by: "reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const jobBase = {
      raster_text_extraction_job_id: "raster-text-job-1", asset_id: asset.asset_id, case_id: asset.case_id,
      profile_revision: "synthetic-raster-text-v1:9eb7f34b", attempt_count: 1,
      created_by: "reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
    };
    const queued = {
      asset, job: { ...jobBase, status: "queued" }, idempotency_reused: false,
      current_profile_revision: jobBase.profile_revision, profile_superseded: false,
    };
    const needsReview = {
      asset,
      job: {
        ...jobBase,
        status: "needs_review",
        result: {
          status: "needs_review",
          pages: [{ page_number: 1, text: "INVOICE 001", confidence: 0.976 }],
          canonical_text: "INVOICE 001",
          warnings: ["human_confirmation_required"],
          needs_review_reasons: ["ocr_low_confidence"],
        },
      },
      idempotency_reused: false,
      current_profile_revision: jobBase.profile_revision,
      profile_superseded: false,
    };
    const confirmed = {
      record: {
        document_id: "document-ocr-1", case_id: "case-1", document_type: "CI", filename: "scan.txt",
        media_type: "text/plain", content_sha256: "a".repeat(64), byte_size: 19, character_count: 19,
        created_by: "reviewer", created_at: "2026-08-29T00:00:02Z",
      },
      content_text: "INVOICE 001 EDITED",
    };
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/raster-text-extractions")) return json(queued, 202);
      if (url.endsWith("/raster-text-extractions/raster-text-job-1")) return json(needsReview);
      if (url.endsWith("/source")) {
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: {
            "cache-control": "private, no-store",
            "content-disposition": "inline; filename=source.png",
            "content-length": "4",
            "content-type": "image/png",
            "x-content-type-options": "nosniff",
          },
        });
      }
      if (url.endsWith("/confirmed-document")) return json(confirmed, 201);
      throw new Error(`unexpected test URL: ${url}`);
    };
    const api = new ApiClient(fetcher, async () => "local-token");

    await expect(api.requestRasterTextExtraction("case-1", asset.asset_id, "raster-text-key-1"))
      .resolves.toMatchObject({ job: { status: "queued" } });
    await expect(api.getRasterTextExtraction("case-1", asset.asset_id, jobBase.raster_text_extraction_job_id))
      .resolves.toMatchObject({ job: { status: "needs_review" } });
    await expect(api.getDocumentAssetSource("case-1", asset)).resolves.toMatchObject({ size: 4, type: "image/png" });
    await api.confirmExtractedText("case-1", asset.asset_id, {
      raster_text_extraction_job_id: jobBase.raster_text_extraction_job_id,
      filename: "scan.txt",
      content_text: "INVOICE 001 EDITED",
    });

    expect(new Headers(calls[0]?.init?.headers).get("Idempotency-Key")).toBe("raster-text-key-1");
    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/cases/case-1/document-assets/asset-ocr-1/raster-text-extractions",
      "/api/v1/cases/case-1/document-assets/asset-ocr-1/raster-text-extractions/raster-text-job-1",
      "/api/v1/cases/case-1/document-assets/asset-ocr-1/source",
      "/api/v1/cases/case-1/document-assets/asset-ocr-1/confirmed-document",
    ]);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({
      raster_text_extraction_job_id: "raster-text-job-1",
      filename: "scan.txt",
      content_text: "INVOICE 001 EDITED",
    });
  });

  it("requests raster OCR + layout, decodes spans, fields, and tables, and confirms with the layout job id", async () => {
    const asset = {
      asset_id: "asset-ocr-2", case_id: "case-1", document_type: "PL" as const, filename: "packing.png",
      media_type: "image/png" as const, byte_size: 4, page_count: 1, pixel_count: 1,
      created_by: "reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const jobBase = {
      raster_extraction_job_id: "raster-job-1", asset_id: asset.asset_id, case_id: asset.case_id,
      profile_revision: "synthetic-raster-v1:9eb7f34b", attempt_count: 1,
      created_by: "reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
    };
    const queued = {
      asset, job: { ...jobBase, status: "queued" }, idempotency_reused: false,
      current_profile_revision: jobBase.profile_revision, profile_superseded: false,
    };
    const ready = {
      asset,
      job: {
        ...jobBase,
        status: "needs_review",
        result: {
          status: "needs_review",
          document_type: "packing_list",
          classification_confidence: 0.91,
          pages: [{
            page_number: 1, width: 100, height: 100, coordinate_unit: "pixels",
            spans: [
              { span_id: "s2", ordinal: 2, text: "Quantity: 2 PCS", confidence: 0.8, reading_order: 2 },
              { span_id: "s1", ordinal: 1, text: "PACKING LIST", confidence: 0.99, reading_order: 1 },
            ],
          }],
          field_candidates: [{ field_id: "quantity", value: "2 PCS", confidence: 0.8, evidence_span_ids: ["s2"] }],
          tables: [{ table_id: "t1", page_number: 1, rows: [{ row_index: 0, cells: [
            { cell_id: "c1", row_index: 0, column_index: 0, text: "Quantity", confidence: 0.9, evidence_span_ids: ["s2"] },
          ] }] }],
          warnings: ["human_confirmation_required"],
          needs_review_reasons: ["table_structure_uncertain"],
        },
      },
      idempotency_reused: false,
      current_profile_revision: jobBase.profile_revision,
      profile_superseded: false,
    };
    const confirmed = {
      record: {
        document_id: "document-ocr-2", case_id: "case-1", document_type: "PL", filename: "packing.txt",
        media_type: "text/plain", content_sha256: "a".repeat(64), byte_size: 19, character_count: 19,
        extraction_source: "raster_ocr", layout_summary: { page_count: 1, table_count: 1, span_count: 2, field_candidate_count: 1, mean_confidence: 0.895 },
        created_by: "reviewer", created_at: "2026-08-29T00:00:02Z",
      },
      content_text: "PACKING LIST\nQuantity: 2 PCS",
    };
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/raster-extractions")) return json(queued, 202);
      if (url.endsWith("/raster-extractions/raster-job-1")) return json(ready);
      if (url.endsWith("/confirmed-document")) return json(confirmed, 201);
      throw new Error(`unexpected test URL: ${url}`);
    };
    const api = new ApiClient(fetcher, async () => "local-token");

    await expect(api.requestRasterExtraction("case-1", asset.asset_id, "raster-key-1")).resolves.toMatchObject({ job: { status: "queued" } });
    const envelope = await api.getRasterExtraction("case-1", asset.asset_id, "raster-job-1");
    expect(envelope.job.result?.pages[0]?.spans.map((span) => span.span_id)).toEqual(["s2", "s1"]);
    expect(envelope.job.result?.field_candidates[0]).toMatchObject({ field_id: "quantity", confidence: 0.8 });
    expect(envelope.job.result?.tables[0]?.rows[0]?.cells[0]?.text).toBe("Quantity");
    const record = await api.confirmExtractedText("case-1", asset.asset_id, {
      raster_extraction_job_id: "raster-job-1", filename: "packing.txt", content_text: "PACKING LIST\nQuantity: 2 PCS",
    });
    expect(record.extraction_source).toBe("raster_ocr");
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      raster_extraction_job_id: "raster-job-1", filename: "packing.txt", content_text: "PACKING LIST\nQuantity: 2 PCS",
    });
    expect(() => api.confirmExtractedText("case-1", asset.asset_id, {
      raster_extraction_job_id: "raster-job-1", raster_text_extraction_job_id: "raster-text-job-1", filename: "x.txt", content_text: "x",
    })).toThrow("exactly one extraction job ID is required");
  });

  it("accepts only fail-closed raster text profile supersession states", () => {
    const asset = {
      asset_id: "asset-ocr-1", case_id: "case-1", document_type: "CI", filename: "scan.png",
      media_type: "image/png", byte_size: 4, page_count: 1, pixel_count: 1,
      created_by: "reviewer", created_at: "2026-08-29T00:00:00Z",
    };
    const unavailable = {
      asset,
      job: {
        raster_text_extraction_job_id: "raster-text-job-1", asset_id: asset.asset_id, case_id: asset.case_id,
        profile_revision: "synthetic-raster-text-v1:old", status: "unavailable", attempt_count: 0,
        error_code: "raster_text_profile_unavailable",
        result: { status: "unavailable", pages: [], canonical_text: null, warnings: ["raster_text_profile_unavailable"], needs_review_reasons: [] },
        created_by: "reviewer", created_at: "2026-08-29T00:00:00Z", updated_at: "2026-08-29T00:00:01Z",
      },
      idempotency_reused: false,
      current_profile_revision: null,
      profile_superseded: true,
    };
    expect(decodeRasterTextExtractionEnvelope(unavailable)).toMatchObject({
      current_profile_revision: null,
      profile_superseded: true,
      job: { status: "unavailable" },
    });
    expect(() => decodeRasterTextExtractionEnvelope({
      ...unavailable,
      current_profile_revision: unavailable.job.profile_revision,
    })).toThrow("supersession does not name a newer profile");
  });

  it("explains Backend confirmation races as text-only OCR failures", () => {
    expect(stableApiErrorMessage(503, "raster_ocr_unavailable")).toContain("OCR 텍스트");
    expect(stableApiErrorMessage(409, "raster_profile_superseded")).toContain("이전 텍스트 초안 등록을 중단");
  });

  it("creates a loopback development session without sending a bearer token", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push([input, init]);
      const approver = init?.body === JSON.stringify({ actor: "approver" });
      return json({ access_token: (approver ? "p" : "a").repeat(32), token_type: "Bearer", expires_in: 3_600, session: { subject: approver ? "local-approver" : "local-reviewer", org_id: "local-org", roles: [approver ? "approver" : "reviewer"] } });
    };
    const api = new ApiClient(fetcher, async () => "must-not-be-sent");
    await expect(api.createLocalDevelopmentSession()).resolves.toMatchObject({ session: { subject: "local-reviewer", org_id: "local-org" } });
    await expect(api.createLocalDevelopmentSession("approver")).resolves.toMatchObject({ session: { subject: "local-approver", roles: ["approver"] } });
    expect(String(calls[0]?.[0])).toBe("/api/v1/dev/session");
    expect(new Headers(calls[0]?.[1]?.headers).has("Authorization")).toBe(false);
    expect(JSON.parse(String(calls[1]?.[1]?.body))).toEqual({ actor: "approver" });
    expect(new Headers(calls[1]?.[1]?.headers).has("Authorization")).toBe(false);
  });

  it("uses only the Backend v1 boundary and validates the organization", async () => {
    const calls: Array<[RequestInfo | URL, RequestInit | undefined]> = [];
    const replies = [
      json({ subject: "reviewer", org_id: "org-a", roles: ["reviewer"] }),
      json({ items: [{ case_id: "case-1", org_id: "org-a", title: "입항 서류", status: "open", revision: 0, updated_at: "2026-08-05T00:00:00Z" }] }),
    ];
    const fetcher: typeof fetch = async (input, init) => { calls.push([input, init]); return replies.shift() ?? json({}); };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.getSession();
    await expect(api.listCases()).resolves.toMatchObject({ items: [expect.objectContaining({ case_id: "case-1" })] });
    for (const [url, init] of calls) {
      expect(String(url)).toMatch(/^\/api\/v1\//u);
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer local-token");
    }
  });

  it("keeps review input compact and records a reviewer decision only through Backend", async () => {
    const requests: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetcher: typeof fetch = async (input, init) => {
      requests.push({ url: String(input), init });
      if (String(input).endsWith("/reviews")) return json({ job: { job_id: "job-1", case_id: "case-1", review_run_id: "run-1", status: "queued", created_by: "reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:00:00Z" }, idempotency_reused: false }, 202);
      return json({ finding_id: "finding-1", status: "resolved", reason: "보완 문서를 확인했습니다.", decided_by: "reviewer", decided_at: "2026-08-05T00:00:00Z", history: [{ status: "resolved", reason: "보완 문서를 확인했습니다.", decided_by: "reviewer", decided_at: "2026-08-05T00:00:00Z" }] });
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.enqueueReview("case-1", { trade_type: "import" }, "review-key-1");
    await api.setFindingDecision("run-1", "finding-1", { status: "resolved", reason: "보완 문서를 확인했습니다." });
    expect(JSON.parse(String(requests[0]?.init?.body))).toEqual({ trade_type: "import" });
    expect(requests[1]?.url).toBe("/api/v1/review-runs/run-1/findings/finding-1/decision");
    expect(requests[1]?.init?.method).toBe("PUT");
  });

  it("decodes the structured V3.2 human-review projection including human-provided facts", async () => {
    const api = new ApiClient(async () => json(reviewRunPayload()), async () => "local-token");
    const result = await api.getReviewRun("run-1");
    expect(result.agent_schema_version).toBe("3.3");
    expect(result.workflow.stages).toEqual(expect.arrayContaining([expect.objectContaining({ stage: "classify_documents" })]));
    expect(result.workflow.planner).toMatchObject({ cycle_count: 2, actions: expect.arrayContaining([expect.objectContaining({ action: "apply_human_corrections" })]) });
    expect(result.report.sections).toEqual(expect.arrayContaining([expect.objectContaining({ section: "conclusion" })]));
    expect(result.document_analyses[0]?.facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ fact_id: "fact-human-1", source: expect.objectContaining({ source_kind: "human_provided", correction_proposal_id: "proposal-1" }) }),
    ]));
    expect(result.comparisons).toEqual(expect.arrayContaining([expect.objectContaining({ comparison_id: "comparison-1" })]));
    expect(result.findings).toEqual(expect.arrayContaining([expect.objectContaining({ finding_id: "finding-1" })]));
  });

  it("keeps assistant, correction, and child-review actions on planned Backend v1 routes", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const conversation = {
      conversation_id: "conversation-1", review_run_id: "run-1", title: "수량 확인",
      created_by: "reviewer", created_at: "2026-08-05T00:00:00Z", updated_at: "2026-08-05T00:01:00Z",
    };
    const userMessage = {
      message_id: "message-user-1", conversation_id: "conversation-1", role: "user",
      content: "수량을 확인해 줘", created_by: "reviewer", created_at: "2026-08-05T00:01:00Z",
    };
    const assistantMessage = {
      message_id: "message-assistant-1", conversation_id: "conversation-1", role: "assistant",
      content: "Invoice와 Packing List의 수량을 확인해야 합니다.", answer_scope: "case_grounded",
      citations: [{ kind: "comparison", reference_id: "comparison-1" }],
      suggested_questions: ["관련 문서 원문을 보여줘"],
      correction_draft: { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준" },
      created_by: "agent", created_at: "2026-08-05T00:01:01Z",
    };
    const proposal = {
      correction_proposal_id: "proposal-1", review_run_id: "run-1", finding_id: "finding-1",
      document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA",
      reason: "Packing List 원문 기준", status: "proposed", created_by: "reviewer", created_at: "2026-08-05T00:02:00Z", history: [{ event: "proposed", reason: "Packing List 원문 기준", actor: "reviewer", occurred_at: "2026-08-05T00:02:00Z" }],
    };
    const job = { job_id: "job-child-1", case_id: "case-1", review_run_id: "run-child-1", status: "queued", created_by: "reviewer", created_at: "2026-08-05T00:03:00Z", updated_at: "2026-08-05T00:03:00Z" };
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/assistant/conversations") && init?.method === "GET") return json({ items: [conversation] });
      if (url.endsWith("/assistant/conversations") && init?.method === "POST") return json(conversation);
      if (url.endsWith("/messages") && init?.method === "GET") return json({ items: [userMessage, assistantMessage] });
      if (url.endsWith("/messages") && init?.method === "POST") return json({ user_message: userMessage, assistant_message: assistantMessage });
      if (url.endsWith("/correction-proposals") && init?.method === "GET") return json({ items: [proposal] });
      if (url.endsWith("/correction-proposals") && init?.method === "POST") return json(proposal);
      if (url.endsWith("/decision")) return json({ ...proposal, status: "approved", decision: { status: "approved", reason: "문서 원문 확인", decided_by: "reviewer", decided_at: "2026-08-05T00:03:00Z" }, history: [...proposal.history, { event: "approved", reason: "문서 원문 확인", actor: "reviewer", occurred_at: "2026-08-05T00:03:00Z" }] });
      if (url.endsWith("/revisions")) return json({ job, idempotency_reused: false }, 202);
      return json({ detail: "unexpected request" }, 500);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    await api.listAssistantConversations("run-1");
    await api.createAssistantConversation("run-1", { title: "수량 확인" });
    await api.listAssistantMessages("conversation-1");
    await api.sendAssistantMessage("conversation-1", { content: "수량을 확인해 줘" }, "assistant-key-1");
    await api.listCorrectionProposals("run-1");
    await api.createCorrectionProposal("run-1", { document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준", finding_id: "finding-1" });
    await api.decideCorrectionProposal("proposal-1", { status: "approved", reason: "문서 원문 확인" });
    await api.enqueueRevision("run-1", { proposal_ids: ["proposal-1"] }, "revision-key-1");
    expect(calls.map((item) => item.url)).toEqual([
      "/api/v1/review-runs/run-1/assistant/conversations",
      "/api/v1/review-runs/run-1/assistant/conversations",
      "/api/v1/assistant/conversations/conversation-1/messages",
      "/api/v1/assistant/conversations/conversation-1/messages",
      "/api/v1/review-runs/run-1/correction-proposals",
      "/api/v1/review-runs/run-1/correction-proposals",
      "/api/v1/correction-proposals/proposal-1/decision",
      "/api/v1/review-runs/run-1/revisions",
    ]);
    expect(JSON.parse(String(calls[3]?.init?.body))).toEqual({ content: "수량을 확인해 줘" });
    expect(new Headers(calls[3]?.init?.headers).get("Idempotency-Key")).toBe("assistant-key-1");
    expect(JSON.parse(String(calls[5]?.init?.body))).toEqual({ document_id: "document-1", fact_id: "fact-1", field_name: "quantity", new_value: "12", unit: "EA", reason: "Packing List 원문 기준", finding_id: "finding-1" });
    expect(new Headers(calls[7]?.init?.headers).get("Idempotency-Key")).toBe("revision-key-1");
  });

  it("keeps the HSK, origin, and duty views on planned Backend v1 routes and validates their wire shapes", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const classification = {
      review_run_id: "run-1",
      case_id: "case-1",
      reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명" },
      candidates: [{
        code: "0303540000", name_ko: "고등어", name_en: "Mackerel",
        ancestors: [{ level: 2, code: "03", name_ko: "어류" }],
        confidence: 1, in_reference: true, recommended: true,
        basis: [{ document_id: "document-1", fact_id: "fact-1", fact_name: "hs_code", raw_value: "0303540000" }],
      }],
    };
    const selection = {
      code: "0303540000", reason: "문서 근거 일치", selected_by: "reviewer", selected_at: "2026-08-05T00:00:00Z",
      history: [{ code: "0303540000", reason: "문서 근거 일치", selected_by: "reviewer", selected_at: "2026-08-05T00:00:00Z" }],
    };
    const origin = {
      review_run_id: "run-1", case_id: "case-1", status: "verified",
      certificate: { document_id: "document-2", filename: "co.txt", extraction_status: "complete" },
      origin_country: "VN",
      checks: [{ field: "origin_country", certificate_value: "VN", reference_value: "VN", reference_document_id: "document-1", status: "match" }],
      fta_hints: [{ agreement_code: "KR-VN", agreement_name: "한-베트남 FTA", origin_covered: true, certificate_form: "KV Form", source_uri: "https://www.customs.go.kr/ftaportalkor/main.do" }],
    };
    const duty = {
      review_run_id: "run-1", case_id: "case-1", status: "estimated",
      reference: { as_of: "2026-01-01", source: "관세율 스냅샷", disclaimer: "참조용" },
      hs_code: { code: "0303540000", source: "reviewer_selection", name_ko: "고등어" },
      origin_country: "VN",
      dutiable_value: { amount: 30000, currency: "USD", basis: "invoice_total_amount", document_id: "document-1" },
      rates: [
        { rate_kind: "basic", label: "기본세율", rate_pct: 10, source_uri: "https://unipass.customs.go.kr/clip/index.do", requirements: [], applicable: true },
        { rate_kind: "fta", agreement_code: "KR-VN", label: "한-베트남 FTA", rate_pct: 0, source_uri: "https://unipass.customs.go.kr/clip/index.do", requirements: [{ code: "certificate_present", satisfied: true }], applicable: true },
      ],
      applied: { rate_kind: "fta", agreement_code: "KR-VN", rate_pct: 0, duty_amount: 0, vat_rate_pct: 10, vat_amount: 3000, total_estimated: 3000, currency: "USD" },
      savings: { vs_basic_duty: 3000, currency: "USD", blocked_requirements: [] },
    };
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/hs-classification") && init?.method === "GET") return json(classification);
      if (url.endsWith("/hs-classification") && init?.method === "POST") return json(selection);
      if (url.endsWith("/origin-verification")) return json(origin);
      if (url.endsWith("/duty-assessment")) return json(duty);
      return json({ detail: "unexpected request" }, 500);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    const classificationResult = await api.getHsClassification("run-1");
    expect(classificationResult.candidates[0]?.code).toBe("0303540000");
    const selectionResult = await api.recordHsSelection("run-1", { code: "0303540000", reason: "문서 근거 일치" });
    expect(selectionResult.history).toHaveLength(1);
    const originResult = await api.getOriginVerification("run-1");
    expect(originResult.status).toBe("verified");
    const dutyResult = await api.getDutyAssessment("run-1");
    expect(dutyResult.applied?.rate_kind).toBe("fta");
    expect(dutyResult.savings?.vs_basic_duty).toBe(3000);
    expect(calls.map((item) => item.url)).toEqual([
      "/api/v1/review-runs/run-1/hs-classification",
      "/api/v1/review-runs/run-1/hs-classification",
      "/api/v1/review-runs/run-1/origin-verification",
      "/api/v1/review-runs/run-1/duty-assessment",
    ]);
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ code: "0303540000", reason: "문서 근거 일치" });
  });

  it("reads server-computed operations metrics from the planned v1 route", async () => {
    const metrics = {
      generated_at: "2026-08-18T03:00:00+00:00",
      cases: { total: 3, open: 1, in_review: 1, closed: 1 },
      reviews: { total: 4, revisions: 1, no_issue_detected: 1, issues_detected: 3, indeterminate: 0, succeeded: 4, partial: 0, failed: 0 },
      findings: { total: 2, decided: 1, open: 1 },
      closures: { cleared: 1, returned: 0 },
      daily_reviews: [{ date: "2026-08-18", count: 2 }],
      review_load: {
        cases_with_findings: 1,
        cases_without_findings: 1,
        comparisons: { total: 5, passed: 3, mismatch: 1, needs_review: 1, skipped: 0 },
        findings_by_code: [{ code: "invoice_packing_quantity_unit", count: 2 }],
        decision_statuses: { confirmed: 1, needs_information: 0, resolved: 0 },
        decision_reason_codes: [{ code: "notation_difference", count: 1 }],
      },
    };
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return json(metrics);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    const result = await api.getOperationsMetrics();
    expect(result.cases.total).toBe(3);
    expect(result.reviews.revisions).toBe(1);
    expect(result.findings.open).toBe(1);
    expect(result.daily_reviews[0]?.count).toBe(2);
    expect(result.review_load.comparisons.passed).toBe(3);
    expect(result.review_load.findings_by_code[0]?.code).toBe("invoice_packing_quantity_unit");
    expect(calls).toEqual(["/api/v1/operations-metrics"]);
  });

  it("sends a preset decision rationale without prose and insists on prose for 기타", async () => {
    const decision = {
      finding_id: "finding-1", status: "confirmed", reason_code: "notation_difference",
      reason: "표기·단위·반올림 차이로 실질 불일치 아님", decided_by: "reviewer", decided_at: "2026-08-18T03:00:00Z",
      history: [{ status: "confirmed", reason_code: "notation_difference", reason: "표기·단위·반올림 차이로 실질 불일치 아님", decided_by: "reviewer", decided_at: "2026-08-18T03:00:00Z" }],
    };
    const calls: { url: string; init?: RequestInit | undefined }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return json(decision);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    const recorded = await api.setFindingDecision("run-1", "finding-1", { status: "confirmed", reason_code: "notation_difference", reason: "" });
    expect(recorded.reason_code).toBe("notation_difference");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ status: "confirmed", reason_code: "notation_difference", reason: "" });
    // The contract guard runs before any request is made, so it throws synchronously.
    expect(() => api.setFindingDecision("run-1", "finding-1", { status: "confirmed", reason_code: "other", reason: " " })).toThrow(
      "reviewer decision reason is invalid",
    );
    // Decisions recorded before rationale codes existed still decode.
    const legacyFetcher: typeof fetch = async () => json({ ...decision, reason_code: undefined, history: [{ ...decision.history[0], reason_code: undefined }] });
    const legacy = await new ApiClient(legacyFetcher, async () => "local-token").setFindingDecision("run-1", "finding-1", { status: "confirmed", reason: "확인" });
    expect(legacy.reason_code).toBeUndefined();
  });

  it("searches the HSK reference by code prefix or item name", async () => {
    const search = {
      query: "티셔츠",
      mode: "name",
      results: [{ code: "6109101000", name_ko: "티셔츠", name_en: "T-shirts", ancestors: [{ level: 2, code: "61", name_ko: "의류" }] }],
      truncated: false,
      partial: true,
      reference: { as_of: "2026-01-01", source: "관세청 HS부호 단위별 품목명" },
    };
    const calls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      calls.push(String(input));
      return json(search);
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    const result = await api.searchHskReference(" 티셔츠 ");
    expect(result.mode).toBe("name");
    expect(result.partial).toBe(true);
    expect(result.results[0]?.code).toBe("6109101000");
    expect(result.results[0]?.ancestors[0]?.name_ko).toBe("의류");
    expect(calls).toEqual([`/api/v1/hsk-reference?q=${encodeURIComponent("티셔츠")}`]);
    expect(() => api.searchHskReference("   ")).toThrow("HSK reference search query is invalid");
  });
});

describe("admin LLM settings contract", () => {
  const view = {
    provider: "openai", model: "gpt-5.6-luna", max_tokens: 16384, timeout_seconds: 90, source: "environment", version: 1,
    updated_at: null, error_code: null, service_mode: "functional-uat", adjustable: true,
    providers: [
      { provider: "openai", credential_present: true, default_model: "gpt-4.1-mini" },
      { provider: "anthropic", credential_present: false, default_model: "claude-haiku-4-5-20251001" },
    ],
  };

  it("decodes the settings view and rejects an unknown provider or unsafe model name", () => {
    expect(decodeLlmSettings(view).model).toBe("gpt-5.6-luna");
    expect(() => decodeLlmSettings({ ...view, provider: "gemini" })).toThrow("llm settings.provider: unsupported value");
    expect(() => decodeLlmSettings({ ...view, model: "gpt 5; rm -rf" })).toThrow("llm settings.model: model name expected");
    expect(() => decodeLlmSettings({ ...view, source: "cache" })).toThrow("llm settings.source: unsupported value");
    expect(() => decodeLlmSettings({ ...view, providers: [{ provider: "openai", credential_present: "yes", default_model: "x" }] }))
      .toThrow("credential_present: boolean expected");
    expect(decodeLlmConnectionTest({ ok: false, provider: null, model: null, latency_ms: null, error_code: "provider_request_failed" }).ok).toBe(false);
    expect(() => decodeLlmConnectionTest({ ok: "true", provider: null, model: null, latency_ms: null, error_code: null })).toThrow("ok: boolean expected");
  });

  it("validates updates locally and sends only the given fields to the approver-only routes", async () => {
    const calls: { url: string; method: string | undefined; body: string | undefined }[] = [];
    const fetcher: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), method: init?.method, body: typeof init?.body === "string" ? init.body : undefined });
      return json(String(input).endsWith("/test") ? { ok: true, provider: "openai", model: "gpt-5.5", latency_ms: 10, error_code: null } : view);
    };
    const api = new ApiClient(fetcher, async () => "local-token");

    await api.getLlmSettings();
    await api.updateLlmSettings({ model: " gpt-5.5 ", max_tokens: 8192 });
    await api.resetLlmSettings();
    await api.testLlmSettings();
    expect(calls.map((call) => [call.url, call.method, call.body])).toEqual([
      ["/api/v1/admin/llm-settings", "GET", undefined],
      ["/api/v1/admin/llm-settings", "PUT", JSON.stringify({ model: "gpt-5.5", max_tokens: 8192 })],
      ["/api/v1/admin/llm-settings", "DELETE", undefined],
      ["/api/v1/admin/llm-settings/test", "POST", "{}"],
    ]);

    expect(() => api.updateLlmSettings({})).toThrow("llm settings update is empty");
    expect(() => api.updateLlmSettings({ max_tokens: 100 })).toThrow("between 256 and 16384");
    expect(() => api.updateLlmSettings({ timeout_seconds: 0 })).toThrow("between 1 and 300");
    expect(() => api.updateLlmSettings({ model: "bad model!" })).toThrow("llm model name is invalid");
    expect(() => api.updateLlmSettings({ provider: "gemini" as never })).toThrow("llm provider is invalid");
    expect(calls).toHaveLength(4);
  });

  it("maps the admin error codes to stable Korean messages", () => {
    expect(stableApiErrorMessage(422, "llm_credential_missing")).toContain("API 키가 서버에 없습니다");
    expect(stableApiErrorMessage(422, "llm_settings_invalid")).toContain("설정 값이 올바르지 않습니다");
    expect(stableApiErrorMessage(409, "llm_settings_unavailable")).toContain("로컬 개발 모드");
  });
});

describe("case-level HSK classification", () => {
  it("reads document-text candidates and records a case selection before any review", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const classification = {
      case_id: "case-1",
      basis_kind: "document_text",
      reference: { as_of: "2026-01-01", source: "관세청 HS부호" },
      candidates: [
        {
          code: "0303540000",
          name_ko: "고등어",
          name_en: "Mackerel",
          ancestors: [],
          confidence: 1,
          in_reference: true,
          recommended: true,
          origin: "document_code",
          basis: [{ document_id: "document-1", fact_id: "text-line-3", fact_name: "document_text", raw_value: "HS CODE: 0303540000" }],
        },
      ],
    };
    const selection = {
      code: "0303540000",
      reason: "서류 기재 코드 확인",
      selected_by: "reviewer",
      selected_at: "2026-09-15T00:00:00Z",
      history: [{ code: "0303540000", reason: "서류 기재 코드 확인", selected_by: "reviewer", selected_at: "2026-09-15T00:00:00Z" }],
    };
    const fetcher: typeof fetch = async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/cases/case-1/hs-classification") && init?.method === "GET") {
        return new Response(JSON.stringify(classification), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/cases/case-1/hs-classification") && init?.method === "POST") {
        return new Response(JSON.stringify(selection), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ detail: "unexpected request" }), { status: 500, headers: { "content-type": "application/json" } });
    };
    const api = new ApiClient(fetcher, async () => "local-token");
    const view = await api.getCaseHsClassification("case-1");
    expect(view.basis_kind).toBe("document_text");
    expect(view.candidates[0]?.code).toBe("0303540000");
    expect(view.selection).toBeUndefined();
    const recorded = await api.recordCaseHsSelection("case-1", { code: "0303540000", reason: "서류 기재 코드 확인" });
    expect(recorded.history).toHaveLength(1);
    expect(calls.map((call) => call.url)).toEqual([
      "/api/v1/cases/case-1/hs-classification",
      "/api/v1/cases/case-1/hs-classification",
    ]);
  });
});
