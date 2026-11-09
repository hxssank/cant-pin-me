# Cant Pin Me

A browser workout planner with routine editing, workout history, exercise search, and 3D movement demonstrations. The application connects completed sets to muscle-group summaries and keeps workout records in browser storage.

[Product portfolio](https://github.com/hxssank/recruiter-portfolio)

## What is implemented

- A searchable catalog of 60 exercises with equipment and muscle filters.
- Editable routines, set logging, rest timing, completed workouts, and backup import/export.
- Muscle summaries that distinguish recorded workload from exercises with unknown anatomical mappings.
- Animated poses for 18 exercises, reduced-motion diagrams, and a rotatable anatomical model.
- Two-bone inverse kinematics with segment-length constraints and clamping for unreachable targets.

## Code worth reviewing

| Area | Implementation | Why it matters |
| --- | --- | --- |
| Workout records | [model.js](dist/model.js), [workout.js](dist/workout.js) | Keeps routine templates and completed-workout state separate |
| Storage and recovery | [persistence.js](dist/persistence.js), [tests](tests/) | Handles malformed backups and storage failures |
| Search and exercise catalog | [exercise-library.js](dist/exercise-library.js), [catalog-exercises.js](dist/catalog-exercises.js) | Combines text, equipment, muscle, and animation filters |
| Movement demos | [exercise-motion.js](dist/exercise-motion.js), [motion tests](tests/exercise-motion.test.mjs) | Tests reachable targets, segment lengths, and pose coverage |
| Training summaries | [muscle-stats.js](dist/muscle-stats.js) | Preserves uncertainty when an exercise has no anatomical mapping |
| Anatomy asset pipeline | [build-anatomy.py](scripts/build-anatomy.py), [asset provenance](dist/assets/anatomy/sources.json) | Records upstream geometry, transformations, and source hashes |

`dist/` contains the maintained application source in this repository. It is not a disposable build directory.

## Run locally

Use Node 24 for the tests and Python 3 for the local static server.

```sh
npm ci
npm test
npm run dev
```

Open `http://127.0.0.1:4173`. The checked-in Three.js runtime lets the static app load without a JavaScript build step. `npm run vendor` refreshes that runtime from the installed dependency.

The application stores records in the browser used to open it. Export a backup before clearing site data or moving to a different browser.

## Validation and limits

All 71 Node tests passed on November 9, 2026 against this source snapshot, using the existing local Three.js dependency. Tests cover the exercise catalog, storage validation, timing, workout history, muscle summaries, and movement constraints.

The animations illustrate movement. Pose tests do not establish clinical accuracy, tissue behavior, or exercise safety. This snapshot has no account service or cloud sync, and the GitHub preparation did not include a fresh browser walkthrough.

## Model and library credits

The anatomical model adapts BodyParts3D by the Database Center for Life Science and Z-Anatomy. The repository retains the [attribution](dist/assets/anatomy/ATTRIBUTION.txt), [source licence](dist/assets/anatomy/SOURCE-LICENSE.txt), and [source hashes](dist/assets/anatomy/sources.json). The adapted model is marked CC BY-SA 4.0. Exercise posters are renders of this adapted model, produced by [the poster script](scripts/render-exercise-posters.py), and retain the same attribution and licence.

Three.js retains its [MIT licence](dist/vendor/three/LICENSE). These asset and dependency licences do not establish a licence for unrelated application code.
