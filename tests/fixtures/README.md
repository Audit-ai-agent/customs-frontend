# Cross-repository fixtures

`backend-task0027-public-review-run.json` is the complete TASK-0027 JSON
projection returned by `GET /api/v1/review-runs/{review_run_id}`. The
Frontend consumer fixture was revalidated against Backend commit
`d7dd824333da0381f7f61e83a98cd2a310f61ffe` on 2026-07-27.

It was generated through the Backend `TestClient`, `WorkbenchService`, and
public response model after executing the provider-contract fixture. It is not
an Agent raw result assembled by Frontend tests. Its SHA-256 is
`75da6c35fba2a22621dca5d36a93eb2280a1febdb8d7fbcf77855ec877d4bd9f`.
The Backend-computed effective-summary `result_digest` embedded in that response is
`b1e39f387a671a5ce987af94055ec8103595c6f38496c563b11d9227f79f63c6`;
the Frontend test independently recomputes it with the same UTF-8, sorted-key,
compact canonical JSON algorithm.

The fixture proves the consumer boundary against Backend's safe public
serializer, including the result-digest-bound actual Store execution
attestation added for TASK-0027. It intentionally demonstrates a fail-closed
`human_review_required / production_candidate` result. The separate strict
auto-completion tests cover released positive and adversarial envelopes.
