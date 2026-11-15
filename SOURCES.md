# Sources

Every health fact in RIDGE Monitor is paraphrased from one of the public pages below and linked from the interface. Source IDs match the `SOURCES` map in `data.js`.

RIDGE hazard letters: **R** space radiation · **I** isolation and confinement · **D** distance from Earth · **G** gravity fields · **E** hostile/closed environments.

## Source list

| ID | Agency | Page | URL |
|---|---|---|---|
| S1 | NASA HRP | Space Radiation | https://www.nasa.gov/hrp/radiation/space-radiation-miniseries/ |
| S2 | NASA HRP | Hazard: Isolation and Confinement | https://www.nasa.gov/hrp/hazard-isolation-and-confinement/ |
| S3 | NASA HRP | Hazard: Distance from Earth | https://www.nasa.gov/hrp/hazard-distance-from-earth/ |
| S4 | NASA HRP | Hazard: Hostile/Closed Environments | https://www.nasa.gov/hrp/hazard-hostile-closed-environments/ |
| S5 | NASA HRP | Hazard: Gravity Fields | https://www.nasa.gov/hrp/hazard-gravity-fields/ |
| S6 | NASA HRP | Risks of Human Spaceflight | https://www.nasa.gov/hrp/risks/ |
| S6a | NASA HRP | Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS) | https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/ |
| S6b | NASA HRP | Risk of Spaceflight-Induced Bone Changes | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ |
| S6c | NASA HRP | Risk from Inadequate Sleep and Irregular Schedules | https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/ |
| S6d | NASA HRP | Risk of Cardiovascular Adaptations | https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/ |
| S7 | NASA HRP | 5 Hazards of Human Spaceflight | https://www.nasa.gov/hrp/hazards/ |
| S8 | NASA HRP | Ongoing HRP Research in Space | https://www.nasa.gov/hrp/ongoing-hrp-research/ |
| S8a | NASA HRP | Standard Measures | https://www.nasa.gov/reference/standard-measures/ |
| S8b | NASA HRP | ARCHeR (Artemis Research for Crew Health & Readiness) | https://www.nasa.gov/reference/archer/ |
| S8c | NASA HRP | Thigh Cuff | https://www.nasa.gov/reference/thigh-cuff/ |
| S9 | CSA | Monitoring radiation for astronaut health | https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp |
| S10 | CSA | Why do we conduct science experiments in space? | https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp |
| S10a | CSA | How does space affect the human body? (infographic, text version) | https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056 |
| S11 | NASA | The Human Body in Space (defines RIDGE) | https://www.nasa.gov/humans-in-space/the-human-body-in-space/ |

S7 was read as background and is not cited in the interface: it gives Mars gravity as three-eighths of Earth's, while S5 and S11 say about one-third. The app uses "about one-third" from S5.

## Feature → hazard → source

### RIDGE strip and environment

| Feature | Hazard | Sources |
|---|---|---|
| RIDGE acronym and the five tiles | R I D G E | S11 |
| Tile R, Space Radiation | R | S1, S9, S11 |
| Tile I, Isolation and Confinement | I | S2, S6c, S11 |
| Tile D, Distance from Earth | D | S3, S11 |
| Tile G, Gravity Fields | G | S5 |
| Tile E, Hostile/Closed Environments | E | S4, S11 |
| Communication delay at Mars, up to 20 minutes one way | D | S3 |
| Environment notes: station, transit, Moon, Mars, rover | D G R | S1, S3, S5, S6, S9, S10, S11 |

### Body regions

| Region | Hazard | Sources |
|---|---|---|
| Brain and Behavior | I G | S2, S5, S6c, S8a, S11 |
| Eyes | G | S5, S6a, S8c |
| Heart and Circulation | G | S6d, S8, S10a, S11 |
| Bones (spine, hips, legs) | G | S5, S6b, S11 |
| Muscles | G | S6, S8a, S10a, S11 |
| Kidneys | G | S5, S11 |
| Immune System | E | S4, S6, S8, S11 |
| Whole-Body Radiation | R | S1, S6, S9, S11 |

### Check-in indicators, alerts and guidance

| Indicator | Hazard | Why it is checked | Guidance sources |
|---|---|---|---|
| Resting heart rate | G | S6d | S6d |
| Blood pressure, systolic and diastolic | G | S6d | S6d |
| Blood glucose | G | S10a | none (general self-care steps) |
| Body temperature | none | General wellness indicator, no direct RIDGE source | none |
| Sleep | I | S2, S8b | S2, S6c |
| Mood and journal note | I | S2, S11 | S2, S11 |
| Stress | I | S2 | S2, S6c, S11 |
| Exercise | G | S6b, S11 | S11 |
| Fluids | G | S5 | S11 |
| Vision change | G | S5 | S6a |
| Dizziness or balance trouble | G | S5 | S6 |
| Signs of illness | E | S4, S6 | S4, S11 |
| Personal dosimeter reading | R | S1 | S11 |

### Mission routine and badges

| Feature | Hazard | Sources |
|---|---|---|
| Daily tasks (prompts to take the check-in measurements) | G I E R | same as the indicators each task contains |
| Badge "Bone Builder" (exercise) | G | S6b |
| Badge "Well Hydrated" (fluids) | G | S5 |
| Badge "Journal Keeper" (journal notes) | I | S2, S11 |
| Badge "Steady Logger" (check-in streak) | none | none (design choice) |

### Space weather scenario, gravity transition check, offline mode

| Feature | Hazard | Sources |
|---|---|---|
| Space weather simulation: what space weather is | R | S1 |
| Space weather simulation: steps (shielding, measuring, reporting) | R | S1, S11 |
| Gravity transition check: lightheadedness and fainting when moving into gravity, time to adjust after landing | G | S5 |
| Gravity transition check: lightheaded when standing up | G | S6d |
| Gravity transition check: balance and walking | G | S5, S11 |
| Gravity transition check: hand-eye coordination | G | S5, S11 |
| Gravity transition check: muscle weakness | G | S10a |
| Gravity transition check: guidance | G | S5, S6, S6d |
| Offline mode: why the app must work with no connection | D | S3 |

## What does not come from these sources

These items are our own and are labeled in the interface:

- All numeric thresholds, the personal-baseline rule and the 2-day symptom rule (`PROTOTYPE_ASSUMPTIONS` in `data.js`): illustrative prototype values.
- The dosimeter unit, mSv/day: illustrative. The sources give no dose unit or limit, and the app shows no limits.
- Communication delay for the space station and the Moon: illustrative.
- Mission routine times of day, points and badge rules: illustrative.
- Space weather simulation: the simulated reading (six times the baseline) is illustrative. The sources do not describe a shelter procedure, so the step refers to the mission's own radiation procedure.
- Gravity transition check: the scoring rule and the "How to check" steps are illustrative.
- "How to measure" steps and the vision grid: illustrative prototype instructions.
- "What it does" lines for each body part: general anatomy.
- Body temperature: a general wellness indicator with no direct RIDGE source.

## Videos

The NASA pages embed YouTube videos. Their content could not be accessed for analysis, so no video is cited in the app or in this file.
