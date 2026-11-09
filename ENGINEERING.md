# Engineering notes

Cant Pin Me connects three representations of a workout: a routine template, an editable session draft, and a completed history record. A fourth representation, the anatomy view, explains exercise mappings without measuring a person's muscle force. This note describes the source as it stands. Tradeoff explanations are code-derived inferences, not claims about the author's original intent.

## Follow a completed workout

In [app.js](dist/app.js), `finishWorkout` first calls `buildCompletedSession` and `workoutTotals` to prepare a confirmation. The save handler builds the completed session again from the current draft, calls `completeWorkout`, and passes the next state to `persist`. Only a successful persistence call closes the modal and opens the saved history record. A quota error must not produce a `Workout saved` message.

[workout.js](dist/workout.js) owns the draft-to-history conversion. For `loggingVersion: 2`, `buildCompletedSession` includes only sets whose `checked` field is exactly `true`. Entering a planned rep count is therefore different from recording that the set happened. Legacy drafts without that logging version use nonblank entries for compatibility. The function validates the calendar date, rep counts, weights, and presence of at least one completed exercise before returning a cloned session with a completion timestamp.

[model.js](dist/model.js) validates the resulting state and `completeWorkout` rejects a session ID already in history. It also rejects a full 10,000-session archive instead of silently dropping older workouts. Cloning prevents later edits to a draft object from changing the stored historical record by reference.

Consider three checked sets of eight reps at 40 kg and an unchecked fourth set with the same values. The saved workout contains three sets, 24 reps, and `3 * 8 * 40 = 960` kg-reps of recorded volume. The planned fourth set contributes nothing. A zero external weight is valid, so a bodyweight movement can record reps without inventing a body-mass load.

This metric is weight times repetitions, not mechanical work in joules. The code does not integrate force over displacement or measure a lifter's range of motion. The distinction affects what conclusions a progress chart supports.

## Persistence refuses known stale writes

[createPersistence](dist/persistence.js) captures the raw localStorage value at load time. Before saving, it reads the current raw value and compares it with `expectedRaw`. A different value means another tab changed or removed the record, so a normal save fails rather than overwriting that known change. After validation and a successful write, it updates its saved snapshot and expected value.

Malformed initial storage enters a recovery state. Normal edits cannot replace the unreadable record until an explicit replacement action occurs. Export can retain the original damaged raw text, which is useful when the parser cannot explain every field. A failed save also leaves the last successful snapshot available. [Persistence tests](tests/persistence.test.mjs) cover stale tabs, damaged records, unavailable storage, quota failures, and explicit restore.

This comparison is not an atomic compare-and-swap. Two tabs can both read the same old value before either writes, then overwrite each other. The implementation catches observed stale state; it does not serialize every simultaneous write. An IndexedDB read/write transaction could close that race, at the cost of an asynchronous storage and migration path. A server would add identity and cross-device conflict handling, which this local application does not implement.

Workout timing also avoids counting timer callbacks. `elapsedSeconds` derives elapsed time from the start timestamp, accumulated paused time, and any active pause. `restRemaining` compares a deadline with the current clock. A backgrounded tab can miss animation ticks without extending a rest interval. This still depends on the wall clock, so an operating-system clock change is a separate condition to evaluate. [Workout tests](tests/workout.test.mjs) cover checked sets and background-time calculations.

## Anatomical mappings have an uncertainty state

[muscle-stats.js](dist/muscle-stats.js) matches catalog exercises to primary, secondary, or stabilizing roles using the movement-science mappings. A mapped muscle with no qualifying sessions has zero recorded sets. An unmapped muscle has `null` counters. Those values answer different questions: no logged work in a known mapping versus insufficient mapping to calculate the number.

The same exercise can contribute to several muscle views. Three recorded sets mapped to both a primary muscle and a secondary muscle appear in both summaries; adding the summaries would double-count the workout. The code does not assign an invented half-set weight to secondary muscles. Its note explicitly distinguishes recorded exercise volume from force or work performed by an individual muscle. [Muscle-stat tests](tests/muscle-stats.test.mjs) document those semantics.

The animation has a separate geometric constraint. `solveTwoBone` in [exercise-motion.js](dist/exercise-motion.js) clamps requested reach between the difference and sum of two segment lengths, with a small offset to avoid degenerate endpoints. It calculates the joint using the law of cosines and a pole direction that selects the bend plane. A fallback perpendicular direction handles a pole aligned with the limb. This preserves segment lengths for the pose; it does not validate a human joint's safe range or prescribe technique. [Motion tests](tests/exercise-motion.test.mjs) check geometric cases.

The anatomy mesh comes from BodyParts3D and Z-Anatomy adaptations. [Source provenance](dist/assets/anatomy/sources.json), [attribution](dist/assets/anatomy/ATTRIBUTION.txt), and [license terms](dist/assets/anatomy/SOURCE-LICENSE.txt) belong with the asset. The project implements the workout and rendering integration; the underlying anatomical model is upstream work.

## Next experiment

Create a controlled two-tab save test that pauses each tab after reading `expectedRaw`, then releases both writes. The present guard can lose an update in that schedule. Use the case to evaluate a transaction-based replacement. Success means both independent completed sessions survive, duplicate session IDs remain rejected, and a failed write leaves the draft recoverable with no success message. The [README validation](README.md#validation-and-limits) records prior checks; this note adds no new full-suite result.
