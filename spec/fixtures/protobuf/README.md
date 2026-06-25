# GraphReFly Protobuf Golden Vectors

These fixtures exercise the D497 canonical protobuf wire profile over
`spec/protocol.proto`.

Fixture records use JSONL so each runtime can stream the same vectors:

- `schema`: always `graphrefly.protobuf.golden.v1`.
- `id`: stable vector id.
- `message`: protobuf message under test.
- `description`: short human-readable purpose.
- `hex`: raw protobuf bytes as lowercase hex.
- `canonical`: `true` for positive vectors, `false` for negative vectors.
- `errorCategory`: required when `canonical` is `false`.
- `expect`: optional small expectation hint for positive vectors.

The fixture values inside bridge DATA payloads use `StrictJsonFixtureValueV1`
bytes for readability only. They are not a production value codec, value
registry, storage hydration format, checkpoint replay format, or analytics
export format.

Current vector files:

- `wire_bridge_envelope.v1.jsonl`
- `wire_edge_frame.v1.jsonl`
