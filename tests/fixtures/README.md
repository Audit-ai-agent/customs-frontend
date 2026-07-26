# Cross-repository fixtures

`backend-63079af-public-review-run.json` is the complete JSON returned by
`GET /api/v1/review-runs/{review_run_id}` from Backend commit
`63079affe2055ea244867ad52b291a04c2d57593` on 2026-07-22.

It was generated through the Backend `TestClient`, `WorkbenchService`, and
public response model after executing the provider-contract fixture. It is not
an Agent raw result assembled by Frontend tests. Its SHA-256 is
`5ade0503e375915d752f0492ed14b567fe8a45d16fff8c1498886e4b34e52122`.
The Backend-computed effective-summary `result_digest` embedded in that response is
`de7900f91fb5895d2fcd8187c8031b5d3dd898e17c3e90e44173b4979113e31d`;
the Frontend test independently recomputes it with the same UTF-8, sorted-key,
compact canonical JSON algorithm.

The fixture proves the consumer boundary against Backend's safe public
serializer. It intentionally demonstrates a fail-closed
`human_review_required / production_candidate` result. The separate strict
auto-completion tests cover released positive and adversarial envelopes.
