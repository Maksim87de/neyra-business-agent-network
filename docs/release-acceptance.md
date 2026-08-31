# Release acceptance matrix

A release is eligible for a client only after all applicable rows have evidence from a clean contour.

| Gate | Evidence | Blocks release when failed |
|---|---|---|
| Image | registry digest matches release manifest | yes |
| Base runtime | healthcheck and gateway status | yes |
| Provider | native auth record, client-local API-key presence or custom-provider configuration is verified according to auth mode | yes |
| Model | fixed direct smoke response | yes |
| Channel | approved user receives an answer | yes when channel is included |
| Legal | synthetic task → legal profile → evidence | yes when legal is included |
| Finance | synthetic task → finance profile → evidence | yes when finance is included |
| Knowledge | ingest, citation, unknown fact, deletion, isolation | yes when RAG is included |
| Restart | response persists after controlled restart | yes |
| Rollback | prior image/state path restores | yes |
| Isolation | no mount, search or injected context crosses contours | yes |

A passing `docker ps`, dashboard HTTP status or a configured model name never replaces the corresponding user-path evidence.
