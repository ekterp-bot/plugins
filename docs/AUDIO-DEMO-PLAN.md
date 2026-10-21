# Audio comparisons — preparation only

October 21, 2026. No player, audio processing, uploads or demo publication is
implemented by this pass. Existing listening-room controls remain a labeled
visual preview. Filling manifest fields will not activate them.

## Content handoff

`content/audio-demos.schema.json` defines the planned editorial format using
JSON Schema 2020-12. `content/audio-demos.example.json` deliberately contains
zero examples and `publicationEnabled: false`: there are no invented recordings,
parameter settings, measurements or approvals. Neither file is copied into
`dist` by the current build. Keep permission documents and source sessions in
private storage; the manifest carries only opaque evidence references.

Hex the Engineer selects and personally processes each excerpt. Initial genre
groups may be Hip-Hop / Trap, R&B / Pop, Rock / Alternative, Electronic / EDM and
Acoustic / Live; genre remains an editorial string, not a processing mode.

| Record | Required information |
| --- | --- |
| Identity | Stable example ID, genre, permitted track display name/alias, approved credit or null, premaster/bus/track context |
| Product | Display name, version, exact build ID, compiled module SHA-256, state schema version |
| Settings | Clarity, Silk, Air, Tame and Mix in percent; Output in dB; processed render with Bypass and Delta Listen off |
| Audio pair | Original/processed paths, final file hashes, sample rate, channels, decoded frame counts, measured LUFS/true peak and baked comparison gain |
| Explanation | Short engineer note describing the material and finishing decision |
| Review | Alignment/settings/listening checks, measured level difference, rights and owner publication approval |

Parameter ranges were inspected read-only in the engineering repository's
`Source/PluginProcessor.cpp:22-34` on October 21: the five percentage controls
are 0–100%; Output is −18 to +18 dB; each uses a 0.01 increment. Persisted state
currently uses schema 2. Record the actual render's values/build, not those of
the newest available installer. Read saved state or exact host values; the
one-decimal idle display is insufficient. Serialize hundredth-unit values
without binary-float noise. Schema v1 requires constant settings throughout an
excerpt; automation needs an explicit future format, not a misleading snapshot.

## Prepare an honest pair

1. Preserve the source excerpt/session, exact plugin state and render evidence
   privately. Start with short excerpts, approximately 20–30 seconds, to keep
   loading and decoded-memory use modest. This is a proposed content budget.
2. Render the same source/time range twice through otherwise identical chains.
   Original excludes ProjectNebula; processed includes only its documented
   changes. Freeze random/time-varying upstream processing or render from the
   same fixed source. Use adequate pre-roll for adaptive processing, then trim
   both at identical sample boundaries. Preserve dry reference and unadjusted
   processed renders; record any intentional upstream processing privately.
3. Bake **static comparison-only gain** into delivery copies. Measure integrated
   loudness over the complete aligned excerpts using the same documented meter
   and method. Proposed acceptance: absolute difference no greater than 0.2 LU,
   with both final decoded assets at or below −1 dBTP. These are website QA
   targets, not plugin capabilities or a mastering target. Reduce both levels
   if headroom is needed; do not add limiting to make a comparison fit. Listen
   as well as measure. Reject silence/non-finite measurements.
4. Preserve lossless masters. Select one browser-supported delivery format after
   size/quality checks; PCM WAV is a straightforward first reference, while a
   compressed format needs decoder-delay, gapless-length and audible-artifact
   checks. Measure the final decoded delivery assets again. Require equal
   sample rate, channel count and frame count plus verified sample alignment.
   Encoding can change peaks and timing; filename duration is not evidence.
5. Record all six plugin values beside the note. Display any comparison gains
   separately from Output. Do not claim automatic loudness matching in the
   plugin. The website compares prepared renders, not live VST3 processing.

## Next-pass player design

Use one Web Audio `AudioContext` created/resumed after a user gesture. Fetch and
decode only the selected approved pair; show loading and retry states, cancel
stale requests, and retain at most a small bounded cache. Decode the full short
files; `decodeAudioData` resamples to the context rate, so validate equal decoded
length/channel counts before playback. [Decode behavior](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData)

Schedule two `AudioBufferSourceNode`s at the same context time and offset,
through separate gain nodes. Both advance continuously; A/B changes gains,
not playback positions. Use a short complementary linear ramp, initially about
10 ms, and listen for transition artifacts; avoid an equal-power boost for
highly correlated material. Pause/seek stores one shared offset and recreates
both source nodes when resuming, because source nodes are single-use. Derive
the displayed position from the audio clock. [Scheduled start and offsets](https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start),
[resuming a context](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume)

Provide keyboard-operable play/pause, seek and A/B controls, current-side text,
accessible progress and explicit error messages. Never autoplay, run JUCE/WASM
DSP, accept uploads or fake playback. Stop old audio on track/genre change and
handle page suspension without losing track identity. Keep the existing visual
design; replace the illustrative waveform with an honest static measured
waveform or omit it. Test mobile/browser decoding, repeated switching, seeking,
end-of-excerpt behavior, failed fetches and keyboard operation with real approved
material. No new backend is required for public pre-rendered examples.

## Publication gate for the future implementation

Schema validation is necessary but is **not implemented in the current build**
and is not permission to publish. The next pass must add a fail-closed validator
and a public-data projection before reading this content into any page:

- Require explicit owner approval for the exact content and deployment, all
  rights scopes cleared (recording/performance, composition, web streaming,
  promotional use and displayed name/credit), and unexpired/unwithdrawn rights.
  Review any territory, platform or reuse restrictions in the private evidence;
  do not treat a collaborator's possession of audio as clearance.
- Validate unique IDs, referenced files/hashes, exact build/state, parameter
  precision, equal pair geometry, alignment/listening checks, and measurements.
  Recompute the LUFS difference from asset measurements; reject forged or stale
  QA flags. JSON Schema alone cannot verify files, time expiry or these cross-field
  relationships. Enable date-time format validation explicitly.
- Bind approval to a SHA-256 of canonical JSON for the example excluding its
  `publication` object: recursively sort object keys, retain array order, emit
  compact UTF-8 JSON without BOM/newline. Asset hashes and rights are included.
  Any content/asset/rights edit invalidates that approval. Recompute at publish
  time. Approval does not authorize publishing source audio or installers.
- Keep `publicationEnabled` false until approved deployment. A publishable
  editorial set must contain only approved examples. Emit an allowlisted public
  projection containing display metadata, settings/build, engineer note,
  approved audio paths and relevant comparison facts. Exclude rights evidence,
  internal reviewer identities and source-session references. Publish only its
  referenced approved audio files; an unlinked public file is still public.
- Recheck expiry on publication and arrange removal by the applicable expiry;
  changing a private flag cannot remove bytes already deployed. A rights
  withdrawal requires removal of both page references and served assets/cache.

The next logical pass is one owner-supplied, permissioned pair through this
validation/publishing path and the synchronized player, followed by targeted
browser checks. Add further genres only after that complete flow works.
