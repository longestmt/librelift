# Feature Spec: Cardio Logging

## Overview

Add cardio exercise logging to LibreLift so users can track conditioning work alongside their lifting — all within the same workout flow. The goal is **not** to build a running app. It's to let lifters log cardio sets using the same patterns they already know (start workout, log sets, review progression) with input fields swapped to match cardio metrics.

## Design Principles

- Cardio exercises live inside regular workouts, not in a separate mode
- The UI adapts input fields based on exercise category — no new pages or flows
- Progression tracking uses duration and distance instead of weight and reps
- Keep the same offline-first, IndexedDB architecture

---

## 1. Data Model Changes

### 1.1 Exercise Category (no schema change needed)

The `Cardio` category already exists in the `CATEGORIES` constant. No database migration required — just seed cardio exercises.

### 1.2 Seed Cardio Exercises

Add to `exercises-seed.js`:

```
Treadmill Run     | Cardio | Full Body  | Machine
Stationary Bike   | Cardio | Quadriceps | Machine
Rowing Machine    | Cardio | Full Body  | Machine
Elliptical        | Cardio | Full Body  | Machine
Stairmaster       | Cardio | Quadriceps | Machine
Jump Rope         | Cardio | Full Body  | Bodyweight
Assault Bike      | Cardio | Full Body  | Machine
Farmer's Walk     | Cardio | Full Body  | Dumbbell
Sled Push         | Cardio | Full Body  | Machine
Battle Ropes      | Cardio | Full Body  | Other
Swimming          | Cardio | Full Body  | Bodyweight
Walking           | Cardio | Full Body  | Bodyweight
Sprints           | Cardio | Full Body  | Bodyweight
```

Include `instructions` and `mediaUrl` (YouTube) for each, matching the pattern of existing seed exercises.

### 1.3 Set Record — New Optional Fields

Current set fields: `id, workoutId, exerciseId, exerciseName, setNumber, weight, reps, rpe, completed, failed, notes, setType`

**Add these optional fields to the set record** (only populated for cardio exercises):

| Field | Type | Description |
|---|---|---|
| `durationSec` | `number \| null` | Duration in seconds |
| `distance` | `number \| null` | Distance value |
| `distanceUnit` | `string \| null` | `'mi'` or `'km'` (derived from user's unit setting: lb→mi, kg→km) |
| `calories` | `number \| null` | Calories burned (optional, user-entered) |
| `mode` | `string \| null` | `'strength'` or `'cardio'` — determines which fields the UI renders |

**No IndexedDB migration needed.** IndexedDB is schemaless for record fields — new fields are simply present or absent on individual records. Existing strength sets will have `mode: null` (treated as `'strength'` by default).

### 1.4 Plan Exercise Config — Cardio Variant

When a cardio exercise is added to a plan, its `config` object uses different target fields:

```javascript
// Strength config (existing)
{ exerciseId, exerciseName, sets: 5, reps: 5, repsMax: null, increment: 5, deloadPercent: 0.1, deloadAfter: 3 }

// Cardio config (new)
{ exerciseId, exerciseName, sets: 1, targetDurationSec: 1200, targetDistance: null, increment: null }
```

Cardio exercises in plans will typically have `sets: 1` (one block of cardio), but allow multiple sets for interval-style work (e.g., 4 × 400m sprints).

---

## 2. Workout Page UI Changes

### 2.1 Detecting Cardio vs Strength

When rendering an exercise card in the active workout, look up the exercise's `category` field. If `category === 'Cardio'`, render the cardio input layout. Otherwise, render the existing strength layout.

```
const isCardio = exercise.category === 'Cardio';
```

This check happens in the exercise card rendering loop in `workout.js`.

### 2.2 Cardio Set Row Layout

Replace the strength set row:

```
Current (strength):   SET# | WEIGHT | REPS | RPE | ✓
New (cardio):         SET# | DURATION | DISTANCE | CAL | ✓
```

**Duration input:**
- Two fields side by side: minutes (`number`, inputmode `numeric`) and seconds (`number`, inputmode `numeric`)
- Stored as `durationSec` (converted on input: `min * 60 + sec`)
- Display format: `12:30` (mm:ss)

**Distance input:**
- Type: `number`, inputmode: `decimal`
- Suffix label shows unit (`mi` or `km`) based on user's unit setting
- Optional — can be left blank for time-only cardio (jump rope, battle ropes)

**Calories input:**
- Type: `number`, inputmode: `numeric`
- Optional — most users won't fill this in, but it's there for those who read it off the machine display
- Placeholder: `—` (matching RPE field pattern)

**Completion checkbox:** Same behavior as strength sets. Tap to mark complete, locks inputs.

### 2.3 Cardio Header Row

```
SET | TIME | DIST | CAL | ✓
```

### 2.4 Previous Performance Display

For cardio exercises, the "previous performance" line above the set inputs should show:

```
Last: 20:00 / 1.5 mi
```

Instead of the current strength format (`Last: 135 × 5`).

### 2.5 Rest Timer Behavior

Rest timer should still trigger between cardio sets (for interval work like sprint repeats). No change needed for single-set cardio — the timer simply won't fire after the only set.

### 2.6 Cardio in Supersets

Cardio exercises should be eligible for superset grouping. A common pattern is pairing a lift with a cardio finisher (e.g., deadlifts superset with rowing intervals). No special handling needed — the superset system just groups exercise cards visually.

---

## 3. Progression Engine Changes

### 3.1 New Function: `suggestNextCardio(exerciseId, config, unit)`

Parallel to `suggestNextWeight()`, but for cardio exercises.

**Inputs:**
- `exerciseId` — the cardio exercise UUID
- `config` — `{ targetDurationSec, targetDistance }` from plan (or null for freeform)
- `unit` — `'lb'`/`'kg'` (used to derive distance unit)

**Logic:**
1. Query completed cardio sets for this exercise, sorted by date descending
2. Find the most recent completed set
3. Return the previous values as defaults (no auto-increment for cardio)

**Returns:**
```javascript
{ durationSec: 1200, distance: 1.5, reason: 'previous' }
// or
{ durationSec: null, distance: null, reason: 'first-time' }
```

**Why no auto-increment:** Cardio progression is less linear than strength training. A lifter adding 5 lbs per session is standard; a runner adding distance every session is a recipe for injury. Pre-fill with last session's values and let the user adjust.

### 3.2 Update `getExerciseHistory(exerciseId)`

Currently returns `{ workoutId, date, weight, reps, volume, notes }` per workout.

For cardio exercises, return a different shape:

```javascript
{
  workoutId,
  date,
  durationSec,     // from the set (or longest set if multiple)
  distance,        // from the set (or total across sets if multiple)
  distanceUnit,
  calories,        // sum across sets
  pace,            // derived: durationSec / distance (sec per mile/km), null if no distance
  notes
}
```

The function should detect whether the exercise is cardio (by checking the exercise record's category or by checking if the sets have `mode === 'cardio'`) and return the appropriate shape.

### 3.3 PR Detection for Cardio

Update `checkPersonalRecord()` to handle cardio sets:

| PR Type | Condition |
|---|---|
| Longest duration | `durationSec` exceeds all previous for this exercise |
| Farthest distance | `distance` exceeds all previous for this exercise |
| Fastest pace | `distance / durationSec` is better than all previous (only when both fields present) |

Return format matches existing PR structure:
```javascript
{ type: 'duration' | 'distance' | 'pace', label: 'New longest run!', prev: previousValue }
```

---

## 4. Analytics Changes

### 4.1 Lifetime & Weekly Metrics

**Add cardio-specific metrics alongside existing ones:**

| Metric | Computation |
|---|---|
| Total Cardio Time | Sum of `durationSec` across all completed cardio sets |
| Total Distance | Sum of `distance` across all completed cardio sets (grouped by unit) |
| Cardio Sessions | Count of workouts containing at least one completed cardio set |

Display these in a "Cardio" subsection below the existing lifetime metrics. Don't mix them into the strength metrics — `totalVolume` (weight × reps) should remain strength-only.

### 4.2 Exercise Analytics — Cardio Variant

When viewing analytics for a cardio exercise, show:

- Longest duration
- Farthest distance
- Best pace (if distance data exists)
- Total time spent on this exercise

**Chart options for cardio exercises:**
- Duration over time (line chart, Y-axis in minutes)
- Distance over time (line chart, Y-axis in mi/km)
- Pace over time (line chart, Y-axis in min/mi or min/km — lower is better)

Use the existing `renderChart()` canvas utility. The chart just needs different data and Y-axis labels.

### 4.3 Muscle Engagement

No change. Cardio exercises already have `muscleGroup` assigned (mostly "Full Body"). The existing muscle breakdown logic will count cardio sets toward muscle groups automatically.

---

## 5. History Changes

### 5.1 Workout Detail Modal

When displaying sets for a cardio exercise in the workout detail modal, format as:

```
S1    20:00 / 1.5 mi    142 cal    ✓
```

Instead of the strength format:

```
S1    135 × 5    @7    ✓
```

Detection: check `set.mode === 'cardio'` (or fall back to checking if `durationSec` is populated).

### 5.2 Exercise Progress View

For cardio exercises, the progression line chart should plot **pace** (if distance data exists) or **duration** (if time-only) instead of weight.

---

## 6. Plan Builder Changes

### 6.1 Adding Cardio to a Plan

When a user adds a cardio exercise to a plan day, show cardio-specific config fields:

```
Target Duration:  [ 20 ] min [ 00 ] sec
Target Distance:  [ 1.5 ] mi        (optional)
Sets:             [ 1 ]
```

Instead of the strength config fields (sets, reps, repsMax, increment, deload).

### 6.2 Template Plans

No changes to the three existing templates (StrongLifts, Ivysaur, Reddit PPL). Cardio can be added to custom plans only. Consider adding one cardio-inclusive template in a future update.

---

## 7. Settings

### 7.1 Distance Unit

Derive from existing unit setting: `lb` → `mi`, `kg` → `km`. No new setting needed. Users who want to override this (e.g., kg lifter who thinks in miles) can be handled in a future update if requested.

---

## 8. What NOT to Build

- GPS tracking or route mapping
- Heart rate zone integration
- Garmin/Strava/Apple Health sync
- Cadence, stride length, or other running-specific metrics
- A separate "cardio mode" or "start cardio" flow
- Auto-distance from step counting
- Interval timer programming (use sets for intervals instead)

---

## 9. Implementation Order

1. **Seed cardio exercises** — smallest change, unblocks everything else
2. **Set record `mode` field + cardio input fields** — the core workout logging change
3. **Previous performance display for cardio** — makes logging useful immediately
4. **Cardio progression engine** (`suggestNextCardio`, history, PR detection)
5. **History/analytics updates** — display layer for cardio data
6. **Plan builder cardio config** — structured cardio in plans
7. **Verify bar weight addition works with cardio excluded** — cardio sets should skip plate calculator entirely

---

## 10. Testing Checklist

- [ ] Cardio exercises appear in exercise library under Cardio category filter
- [ ] Starting a workout with a cardio exercise shows duration/distance/calories inputs (not weight/reps/RPE)
- [ ] Completing a cardio set saves `durationSec`, `distance`, `distanceUnit`, `calories`, and `mode: 'cardio'` to IndexedDB
- [ ] Mixed workouts (strength + cardio) render correct input fields for each exercise
- [ ] Previous performance shows `20:00 / 1.5 mi` format for cardio, `135 × 5` for strength
- [ ] Cardio sets do NOT appear in totalVolume (weight × reps) calculations
- [ ] Cardio sets DO appear in muscle engagement breakdown
- [ ] Exercise history chart plots duration or pace for cardio exercises
- [ ] PRs fire for longest duration, farthest distance, and fastest pace
- [ ] Plan builder shows duration/distance config for cardio exercises
- [ ] Data export includes all cardio fields
- [ ] Data import correctly restores cardio sets
- [ ] Unit switching (lb↔kg) also switches distance display (mi↔km)
- [ ] Plate calculator is not shown for cardio exercises
