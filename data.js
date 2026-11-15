// Developed with AI assistance (see README → Use of AI)
// RIDGE Monitor — data.js
// Sources map, RIDGE hazards, body regions, indicators, illustrative thresholds
// and the synthetic demo-data generator. No real health data lives in this file.
//
// Citation convention: a marker like [S5] inside any text is turned into a link
// to SOURCES.S5 by app.js. Every health fact carries at least one marker.
(function (global) {
  'use strict';

  // ---------------------------------------------------------------------------
  // SOURCES — the only places health facts in this app come from.
  // ---------------------------------------------------------------------------
  var SOURCES = {
    S1: { org: 'NASA HRP', title: 'Space Radiation (video miniseries page)', url: 'https://www.nasa.gov/hrp/radiation/space-radiation-miniseries/' },
    S2: { org: 'NASA HRP', title: 'Hazard: Isolation and Confinement', url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/' },
    S3: { org: 'NASA HRP', title: 'Hazard: Distance from Earth', url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/' },
    S4: { org: 'NASA HRP', title: 'Hazard: Hostile/Closed Environments', url: 'https://www.nasa.gov/hrp/hazard-hostile-closed-environments/' },
    S5: { org: 'NASA HRP', title: 'Hazard: Gravity Fields', url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/' },
    S6: { org: 'NASA HRP', title: 'Risks of Human Spaceflight', url: 'https://www.nasa.gov/hrp/risks/' },
    S6a: { org: 'NASA HRP', title: 'Risk of Spaceflight Associated Neuro-ocular Syndrome (SANS)', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-associated-neuro-ocular-syndrome-sans/' },
    S6b: { org: 'NASA HRP', title: 'Risk of Spaceflight-Induced Bone Changes', url: 'https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/' },
    S6c: { org: 'NASA HRP', title: 'Risk from Inadequate Sleep and Irregular Schedules', url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/' },
    S6d: { org: 'NASA HRP', title: 'Risk of Cardiovascular Adaptations', url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/' },
    S7: { org: 'NASA HRP', title: '5 Hazards of Human Spaceflight', url: 'https://www.nasa.gov/hrp/hazards/' },
    S8: { org: 'NASA HRP', title: 'Ongoing HRP Research in Space', url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/' },
    S8a: { org: 'NASA HRP', title: 'Standard Measures', url: 'https://www.nasa.gov/reference/standard-measures/' },
    S8b: { org: 'NASA HRP', title: 'ARCHeR (Artemis Research for Crew Health & Readiness)', url: 'https://www.nasa.gov/reference/archer/' },
    S8c: { org: 'NASA HRP', title: 'Thigh Cuff', url: 'https://www.nasa.gov/reference/thigh-cuff/' },
    S9: { org: 'CSA', title: 'Monitoring radiation for astronaut health', url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp' },
    S10: { org: 'CSA', title: 'Why do we conduct science experiments in space?', url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp' },
    S10a: { org: 'CSA', title: 'How does space affect the human body? (infographic, text version)', url: 'https://www.asc-csa.gc.ca/eng/multimedia/search/image/8056' },
    S11: { org: 'NASA', title: 'The Human Body in Space (defines RIDGE)', url: 'https://www.nasa.gov/humans-in-space/the-human-body-in-space/' }
  };

  // ---------------------------------------------------------------------------
  // PROTOTYPE_ASSUMPTIONS — every number that is NOT from a source lives here.
  // These are illustrative prototype values, not medical thresholds.
  // ---------------------------------------------------------------------------
  var PROTOTYPE_ASSUMPTIONS = {
    label: 'illustrative prototype value',
    // Personal baseline = average of the first N recorded days of each indicator.
    baselineDays: 7,
    // Threshold types:
    //   range          usual[lo,hi] → Usual; inside watch[lo,hi] → Watch; else Act
    //   min            value < watch → Watch; value < act → Act (optional avgDays)
    //   max            value > watch → Watch; value > act → Act
    //   baselineDelta  |value − baseline| > watch / act
    //   baselineRatio  value / baseline > watch / act
    //   flag           Yes → Watch; Yes on actAfterDays days in a row → Act
    thresholds: {
      restingHR: { type: 'baselineDelta', watch: 10, act: 20 },
      systolic: { type: 'range', usual: [100, 130], watch: [90, 140] },
      diastolic: { type: 'range', usual: [60, 85], watch: [55, 90] },
      glucose: { type: 'range', usual: [70, 110], watch: [60, 140] },
      temperature: { type: 'range', usual: [36.0, 37.4], watch: [35.5, 38.0] },
      sleepHours: { type: 'min', watch: 6.5, act: 5 },
      mood: { type: 'min', watch: 3, act: 2 },
      stress: { type: 'max', watch: 3, act: 4 },
      exerciseMin: { type: 'min', watch: 60, act: 30, avgDays: 3 },
      hydrationCups: { type: 'min', watch: 8, act: 5 },
      vision: { type: 'flag', actAfterDays: 2 },
      dizziness: { type: 'flag', actAfterDays: 2 },
      illness: { type: 'flag', actAfterDays: 2 },
      dosimeter: { type: 'baselineRatio', watch: 2, act: 4 }
    },
    // One-way communication delay per environment. Only the Mars figure is
    // sourced ([S3]: up to 20 minutes one way). The others are illustrative.
    commDelay: {
      station: { oneWayMin: 0, text: 'near real-time', sourced: false },
      transit: { oneWayMin: 20, text: 'up to 20 min one way', sourced: true },
      moon: { oneWayMin: 0, text: 'a few seconds', sourced: false },
      mars: { oneWayMin: 20, text: 'up to 20 min one way', sourced: true },
      rover: { oneWayMin: 20, text: 'up to 20 min one way', sourced: true }
    },
    // The dosimeter unit is our choice: the sources give no dose unit or limit.
    // Gravity transition check: number of "Yes" answers for Watch and for Act.
    landing: { watch: 1, act: 2 },
    // "Simulate space weather event": today's dosimeter reading is shown as this
    // many times the personal baseline. Illustrative, and never saved.
    simulation: { dosimeterFactor: 6 },
    dosimeterUnit: 'mSv/day',
    cupMl: 240,
    // Mission routine points and badge rules (all illustrative).
    // times = minutes after local midnight when each daily task is due (illustrative)
    routine: { pointsPerTask: 10, times: { vitals: 420, exercise: 720, journal: 1140, closeout: 1290 } },
    badges: { windowDays: 7, streakDays: 7, exerciseMin: 60, exerciseDays: 5, hydrationCups: 8, journalDays: 3 }
  };

  // ---------------------------------------------------------------------------
  // RIDGE hazards — R, I, D, G, E as defined by NASA [S11].
  // ---------------------------------------------------------------------------
  var HAZARDS = {
    R: {
      name: 'Space Radiation', source: 'S1',
      facts: [
        'Space radiation is made of protons and the nuclei of all elements, moving at close to the speed of light. It is ionizing and can damage DNA [S1].',
        'Astronauts cannot see or feel it. It comes from galactic cosmic rays and from solar particle events and coronal mass ejections, also called space weather [S1].',
        'NASA\'s current strategy combines shielding, radiation monitoring and operational procedures [S11].',
        'Neutrons make up about 30% of the total radiation on the International Space Station. The Canadian Space Agency is developing an autonomous instrument to measure them continuously [S9].'
      ]
    },
    I: {
      name: 'Isolation and Confinement', source: 'S2',
      facts: [
        'Small groups that live isolated and confined for a long time show behavioral changes [S2].',
        'Sleep loss, a shifted body clock and work overload make this worse and can reduce performance and health [S2].',
        'Station crews see 16 sunrises and sunsets a day, which can disrupt the sleep-wake cycle [S6c].',
        'NASA uses journaling, lighting matched to a day-night cycle, wrist activity trackers and short attention self-tests [S2] [S11].'
      ]
    },
    D: {
      name: 'Distance from Earth', source: 'S3',
      facts: [
        'Mars is on average 140 million miles from Earth. A Mars mission lasts about three years, compared with a three-day trip to the Moon [S3].',
        'One-way communication delay at Mars can reach 20 minutes, so crews must solve problems without real-time help from mission control [S3] [S11].',
        'Crews must handle medical situations with minimal support from Earth, and supplies are limited [S3].'
      ]
    },
    G: {
      name: 'Gravity Fields', source: 'S5',
      facts: [
        'A Mars mission has three gravity phases: about six months weightless, about one-third of Earth\'s gravity on Mars, then readapting to Earth [S5].',
        'Changing gravity affects balance, coordination and orientation. Some crew members get space motion sickness [S5].',
        'Weight-bearing bones lose on average 1% to 1.5% of their mineral density per month in spaceflight [S5].',
        'Fluids shift toward the head, which may press on the eyes and cause vision problems. Kidney stone risk rises with dehydration and calcium released from bone [S5].'
      ]
    },
    E: {
      name: 'Hostile/Closed Environments', source: 'S4',
      facts: [
        'A spacecraft is a closed habitat. Temperature, pressure, lighting, noise and the amount of space all matter for health [S4].',
        'Microbes can change in space and pass more easily from person to person in a closed habitat [S4].',
        'Stress hormone levels can rise and the immune system can change, which could mean more allergies or illness. More research is needed [S4].',
        'NASA monitors the air, swabs surfaces and the body for microbes, and analyzes blood and saliva [S11].'
      ]
    }
  };
  var HAZARD_ORDER = ['R', 'I', 'D', 'G', 'E'];

  // ---------------------------------------------------------------------------
  // INDICATORS — the daily check-in fields.
  // "how" steps are illustrative prototype instructions, not agency procedures.
  // Guidance is general wellness and escalation only: no drugs, no diagnoses.
  // ---------------------------------------------------------------------------
  var ACT_COMMON = 'Tell your crew medical officer and send the flight surgeon report today.';

  var INDICATORS = {
    restingHR: {
      label: 'Resting heart rate', short: 'Heart rate', unit: 'bpm', kind: 'number',
      min: 30, max: 220, step: 1, decimals: 0, group: 'Morning vitals', hazards: ['G'],
      why: 'Spaceflight can alter the heart and blood vessels [S6d]. Your status compares today with your own baseline.',
      how: ['Rest quietly for 5 minutes.', 'Count your pulse at the wrist for 60 seconds, or read it from your monitor.', 'Measure at the same time each day.'],
      guidance: {
        watch: ['Rest for 10 minutes and measure again.', 'Look at today\'s other indicators for a pattern.', 'Regular exercise and a healthy diet help keep the heart and blood vessels fit [S6d].'],
        act: ['Measure again now to confirm.', ACT_COMMON]
      }
    },
    systolic: {
      label: 'Blood pressure — systolic (top number)', short: 'Systolic BP', unit: 'mmHg', kind: 'number',
      min: 60, max: 250, step: 1, decimals: 0, group: 'Morning vitals', hazards: ['G'],
      why: 'Spaceflight can lead to low blood pressure, which raises the chance of fainting at landing [S6d].',
      how: ['Sit still for 5 minutes with the cuff on your upper arm.', 'Take the reading and enter the top (larger) number here.'],
      guidance: {
        watch: ['Sit still for 5 minutes and measure again.', 'Move slowly when you change position.', 'Regular exercise and a healthy diet help keep the heart and blood vessels fit [S6d].'],
        act: ['Measure again now to confirm.', ACT_COMMON]
      }
    },
    diastolic: {
      label: 'Blood pressure — diastolic (bottom number)', short: 'Diastolic BP', unit: 'mmHg', kind: 'number',
      min: 30, max: 160, step: 1, decimals: 0, group: 'Morning vitals', hazards: ['G'],
      why: 'Spaceflight can lead to low blood pressure, which raises the chance of fainting at landing [S6d].',
      how: ['Use the same reading as for the top number.', 'Enter the bottom (smaller) number here.'],
      guidance: {
        watch: ['Sit still for 5 minutes and measure again.', 'Move slowly when you change position.'],
        act: ['Measure again now to confirm.', ACT_COMMON]
      }
    },
    glucose: {
      label: 'Blood glucose', short: 'Glucose', unit: 'mg/dL', kind: 'number',
      min: 20, max: 600, step: 1, decimals: 0, group: 'Morning vitals', hazards: ['G'],
      why: 'Astronauts can develop insulin resistance in weightlessness [S10a].',
      how: ['Use the crew glucose meter as trained.', 'Measure before breakfast so that days are comparable.', 'Enter the value in mg/dL.'],
      guidance: {
        watch: ['Test again at the same time tomorrow.', 'Keep to the planned menu and meal times, and log your meals.'],
        act: ['Test again now to confirm.', ACT_COMMON]
      }
    },
    temperature: {
      label: 'Body temperature', short: 'Temperature', unit: '°C', kind: 'number',
      min: 30, max: 45, step: 0.1, decimals: 1, group: 'Morning vitals', hazards: [],
      noSource: 'General wellness indicator — no direct RIDGE source.',
      why: 'General wellness indicator — no direct RIDGE source.',
      how: ['Use the crew thermometer as trained.', 'Measure at the same time each day.'],
      guidance: {
        watch: ['Measure again in one hour.', 'Note any other signs of illness in today\'s check-in.'],
        act: ['Measure again now to confirm.', ACT_COMMON]
      }
    },
    sleepHours: {
      label: 'Sleep in the last sleep period', short: 'Sleep', unit: 'h', kind: 'number',
      min: 0, max: 16, step: 0.5, decimals: 1, group: 'Sleep and mind', hazards: ['I'],
      why: 'Sleep loss and a shifted body clock can reduce performance and health [S2].',
      how: ['Enter the hours you actually slept, to the nearest half hour.', 'If you wear an activity tracker, use its sleep estimate. NASA studies use wrist actigraphy for this [S8b].'],
      guidance: {
        watch: ['Protect your next sleep period: keep to the schedule.', 'Use the habitat lighting schedule. Lighting that follows a day-night cycle helps crews sleep better [S6c].', 'Use your scheduled relaxation time. It is part of the crew routine to prevent burnout [S6c].'],
        act: [ACT_COMMON, 'Ask the ground team to review your workload and schedule. Work overload makes sleep loss worse [S2].']
      }
    },
    mood: {
      label: 'Mood today', short: 'Mood', unit: '/5', kind: 'scale',
      min: 1, max: 5, step: 1, decimals: 0, group: 'Sleep and mind', hazards: ['I'],
      scale: ['1 — very low', '2 — low', '3 — okay', '4 — good', '5 — very good'],
      why: 'Long isolation and confinement can change mood and morale [S2] [S11].',
      how: ['Rate your overall mood today from 1 (very low) to 5 (very good).', 'Add a short journal note. NASA uses journaling to understand mental and emotional state in isolation [S2].'],
      guidance: {
        watch: ['Write a journal entry. It is a safe outlet for frustrations [S11].', 'Plan one meaningful activity today, such as learning a new skill. This can help morale [S11].', 'Talk with a crewmate. Communication within the crew is vital [S11].'],
        act: [ACT_COMMON, 'Ask for support. Crews are meant to be supported throughout the mission [S2].']
      }
    },
    stress: {
      label: 'Stress today', short: 'Stress', unit: '/5', kind: 'scale',
      min: 1, max: 5, step: 1, decimals: 0, group: 'Sleep and mind', hazards: ['I'],
      scale: ['1 — calm', '2 — mild', '3 — moderate', '4 — high', '5 — very high'],
      why: 'Work overload, sleep loss and confinement add up over a long mission [S2].',
      how: ['Rate your stress today from 1 (calm) to 5 (very high).'],
      guidance: {
        watch: ['Use your scheduled relaxation and self-care time [S6c].', 'Write a journal entry. It is a safe outlet for frustrations [S11].', 'Talk with a crewmate. Communication within the crew is vital [S11].'],
        act: [ACT_COMMON, 'Ask the ground team to review your workload and schedule [S2].']
      }
    },
    exerciseMin: {
      label: 'Exercise today', short: 'Exercise', unit: 'min', kind: 'number',
      min: 0, max: 600, step: 5, decimals: 0, group: 'Body', hazards: ['G'],
      why: 'Exercise is essential against bone loss [S6b] and supports the heart, muscles and balance [S11].',
      how: ['Add up today\'s minutes of aerobic and resistance exercise.', 'Your status uses the average of the last 3 days, so one rest day does not raise an alert.'],
      guidance: {
        watch: ['Schedule tomorrow\'s session now and protect that time.', 'Do both aerobic and resistance exercise. Both are used to protect heart, bone and muscle [S11].', 'Train with a partner or set a small goal. NASA studies workout partners to keep crews exercising [S11].'],
        act: [ACT_COMMON, 'Ask the ground team to re-plan your schedule so that exercise fits every day.']
      }
    },
    hydrationCups: {
      label: 'Fluids today', short: 'Hydration', unit: 'cups', kind: 'number',
      min: 0, max: 40, step: 1, decimals: 0, group: 'Body', hazards: ['G'],
      why: 'Dehydration, together with calcium released from bone, raises the risk of kidney stones [S5].',
      how: ['Count the drink bags or cups you finished since waking.', 'One cup is about 240 mL in this prototype.'],
      guidance: {
        watch: ['Drink a cup of water now and one with each meal.', 'Keep a drink bag within reach while you work.'],
        act: ['Drink water now and keep sipping through the day.', ACT_COMMON, 'Urine can be analyzed to check kidney stone risk and to adjust diet, exercise and water intake [S11].']
      }
    },
    vision: {
      label: 'Any change in vision today?', short: 'Vision change', unit: '', kind: 'flag',
      group: 'Body', hazards: ['G'],
      why: 'Fluids shift toward the head in weightlessness, which may press on the eyes and cause vision problems [S5].',
      how: ['Cover one eye. At reading distance, look at the dot in the center of the grid.', 'Are all the lines straight and complete? Repeat with the other eye.', 'Answer Yes if lines look bent or missing, or if you notice new blur or spots.'],
      howNote: 'The grid is an illustrative self-check made for this prototype. It is not a clinical test and does not come from the NASA or CSA sources.',
      guidance: {
        watch: ['Repeat the self-check tomorrow in the same lighting.', 'Note which eye is affected and what changed.'],
        act: [ACT_COMMON, 'Crews can image their own eyes in orbit with a fundoscope so that changes can be tracked [S6a].']
      }
    },
    dizziness: {
      label: 'Any dizziness or balance trouble today?', short: 'Dizziness', unit: '', kind: 'flag',
      group: 'Body', hazards: ['G'],
      why: 'Moving between gravity levels affects balance and orientation, and can cause lightheadedness and fainting [S5].',
      how: ['Think about the last 24 hours.', 'Answer Yes if you felt dizzy, lightheaded or unsteady.'],
      guidance: {
        watch: ['Move slowly and keep a handhold when you turn your head or body.', 'Put off tasks that need fine coordination, if you can. Gravity changes can make walking or driving hard [S6].'],
        act: ['Stop hazardous tasks such as driving or piloting.', ACT_COMMON]
      }
    },
    illness: {
      label: 'Any signs of illness today (rash, allergy, cold-like symptoms)?', short: 'Illness signs', unit: '', kind: 'flag',
      group: 'Body', hazards: ['E'],
      why: 'The immune system can change in spaceflight, which could mean more allergies or illness [S4]. Spaceflight stress can also reactivate dormant viruses and cause rashes [S6].',
      how: ['Check your skin for new rashes.', 'Note sneezing, congestion, a sore throat or allergy-like symptoms.'],
      guidance: {
        watch: ['Write down the symptoms and when they started.', 'Clean your hands and shared surfaces. Microbes pass more easily between people in a closed habitat [S4].'],
        act: [ACT_COMMON, 'Keep cleaning shared surfaces. Surface cleaning is one of the safeguards used on the station [S11].']
      }
    },
    dosimeter: {
      label: 'Personal dosimeter reading', short: 'Dosimeter', unit: 'mSv/day', kind: 'number',
      min: 0, max: 1000, step: 0.01, decimals: 2, group: 'Radiation', hazards: ['R'],
      why: 'Space radiation cannot be seen or felt, so it has to be measured [S1]. Your status compares today with your own baseline.',
      how: ['Read your personal dosimeter at the end of the day.', 'Enter the reading for the last 24 hours.'],
      howNote: 'The unit (mSv/day) is an illustrative prototype value. This app shows no dose limits, because our sources give none.',
      guidance: {
        watch: ['Read the dosimeter again and note the time.', 'Check with mission control for space weather alerts.', 'Follow your mission\'s radiation procedures. NASA\'s strategy combines shielding, monitoring and operational procedures [S11].'],
        act: [
          'Go to the most shielded area named in your mission\'s radiation procedure. Shielding is part of NASA\'s strategy against space radiation [S11].',
          'Read your dosimeter again and write down the reading and the time. Radiation cannot be seen or felt, so it has to be measured [S1].',
          ACT_COMMON
        ]
      }
    }
  };
  var INDICATOR_ORDER = ['restingHR', 'systolic', 'diastolic', 'glucose', 'temperature',
    'sleepHours', 'mood', 'stress', 'exerciseMin', 'hydrationCups', 'vision', 'dizziness', 'illness', 'dosimeter'];

  // ---------------------------------------------------------------------------
  // REGIONS — the clickable parts of the body figure.
  // "fn" lines are general anatomy, not taken from the mission sources.
  // ---------------------------------------------------------------------------
  var REGIONS = {
    brain: {
      name: 'Brain and Behavior', hazards: ['I', 'G'],
      fn: 'Controls thinking, mood, sleep and balance.',
      effects: [
        'Living isolated and confined for a long time changes behavior. Sleep loss, a shifted body clock and work overload can reduce performance and harm health [S2].',
        'Station crews see 16 sunrises and sunsets a day, which can disrupt the sleep-wake cycle [S6c].',
        'Moving between gravity levels affects orientation, coordination and balance. Some crew members get space motion sickness [S5].'
      ],
      inSpace: [
        'Wrist activity trackers record movement and light to assess sleep, and a 10-minute self-test checks attention and fatigue [S11].',
        'Journaling is used to assess mental and emotional state [S2].',
        'NASA\'s Standard Measures include sleep reports, cognition tests and balance tests [S8a].'
      ],
      helps: [
        'Lighting that follows a day-night cycle helps keep the body clock aligned [S2] [S6c].',
        'Scheduled relaxation and self-care time helps prevent burnout [S6c].',
        'Meaningful activities and good communication within the crew support morale [S11].'
      ],
      indicators: ['sleepHours', 'mood', 'stress', 'dizziness']
    },
    eyes: {
      name: 'Eyes', hazards: ['G'],
      fn: 'Let you read instruments and procedures and see your surroundings.',
      effects: [
        'In weightlessness, fluids shift toward the head. This may press on the eyes and cause vision problems [S5].',
        'NASA calls the resulting eye and brain changes SANS: swelling of the optic nerve, folds in the retina and flattening of the back of the eye. About 70 percent of space station astronauts show some swelling at the back of the eye [S6a].',
        'The risk is higher on longer missions, and the long-term outcome is still being studied [S6a].'
      ],
      inSpace: [
        'Crews image their own eyes in orbit with a fundoscope [S6a].',
        'In the Thigh Cuff study, crew members record vision and blood-flow changes and scan leg and neck veins with ultrasound [S8c].'
      ],
      helps: [
        'NASA is testing whether tight thigh cuffs keep more fluid in the legs. This is research, with no results published on the study page [S8c].',
        'Nutritional supplements and mechanical ways to reverse the fluid shift are being studied [S6a].'
      ],
      indicators: ['vision']
    },
    heart: {
      name: 'Heart and Circulation', hazards: ['G'],
      fn: 'Pumps blood that carries oxygen and nutrients around the body.',
      effects: [
        'Low gravity and other stressors can alter the heart and blood vessels. This can lead to blood clots, an irregular heartbeat and low blood pressure, which raises the chance of fainting at landing [S6d].',
        'The heart can become more spherical in low gravity [S6d].',
        'Blood vessels stiffen, and astronauts can develop insulin resistance [S10a].'
      ],
      inSpace: [
        'Crew members scan each other with an ultrasound device aboard the space station [S8].',
        'Crews do periodic fitness self-evaluations to track heart function [S11].'
      ],
      helps: [
        'Regular exercise and a healthy diet help crews keep their cardiovascular fitness [S6d].',
        'Lower-body compression garments and plenty of fluids before landing can help prevent low blood pressure [S6d].'
      ],
      indicators: ['restingHR', 'systolic', 'diastolic', 'glucose']
    },
    bones: {
      name: 'Bones (spine, hips, legs)', hazards: ['G'],
      fn: 'Support the body and protect the organs.',
      effects: [
        'Weight-bearing bones lose on average 1% to 1.5% of their mineral density per month in spaceflight [S5].',
        'The spine and hips are affected most. The loss can make crew members susceptible to fractures and early osteoporosis [S6b].',
        'More research is needed to learn whether the loss continues at the same rate on very long missions [S6b].'
      ],
      inSpace: [
        'Bone density is scanned before and after a flight, not during it [S6b]. In this prototype, daily exercise is the self-check for bones.'
      ],
      helps: [
        'Exercise is an essential part of preventing bone loss [S6b].',
        'Crews use both aerobic and resistance exercise [S11].'
      ],
      indicators: ['exerciseMin']
    },
    muscles: {
      name: 'Muscles', hazards: ['G'],
      fn: 'Move the body and hold its posture.',
      effects: [
        'Without proper diet and exercise, muscle mass is lost faster in microgravity than on Earth [S11].',
        'Muscles lose mass and strength, and reflexes slow down [S10a].'
      ],
      inSpace: [
        'NASA\'s Standard Measures include a total body strength test [S8a].'
      ],
      helps: [
        'Exercise counters the loss of muscle strength, bone density and heart performance [S6].',
        'Crews use both aerobic and resistance exercise [S11].'
      ],
      indicators: ['exerciseMin']
    },
    kidneys: {
      name: 'Kidneys', hazards: ['G'],
      fn: 'Filter the blood and balance water and minerals.',
      effects: [
        'Without preventive measures, the risk of kidney stones rises because of dehydration and calcium released from the bones [S5].'
      ],
      inSpace: [
        'Urine is collected and analyzed to check kidney stone risk [S11].'
      ],
      helps: [
        'Based on the results, crews adjust diet, exercise and water intake [S11].'
      ],
      indicators: ['hydrationCups']
    },
    immune: {
      name: 'Immune System', hazards: ['E'],
      fn: 'Defends the body against infection.',
      effects: [
        'In a closed habitat, stress hormone levels can rise and the immune system can change. This could mean more allergies or illness, and more research is needed [S4].',
        'Spaceflight stress can reactivate dormant viruses in the body, causing rashes and other symptoms [S6].',
        'Microbes can change in space and pass more easily from person to person [S4].'
      ],
      inSpace: [
        'Blood and saliva are analyzed for immune changes, and the body and station surfaces are swabbed for microbes [S11].',
        'The Immune Biomarkers study uses blood and saliva samples from the Artemis II crew [S8].'
      ],
      helps: [
        'Safeguards on the station include surface cleaning, air filter changes and water treatment [S11].',
        'Crews get flu shots and are quarantined before launch [S11].'
      ],
      indicators: ['illness']
    },
    radiation: {
      name: 'Whole-Body Radiation', hazards: ['R'],
      fn: 'Radiation passes through the whole body, so this region covers every organ.',
      effects: [
        'Space radiation is ionizing and can damage DNA. Astronauts cannot see or feel it [S1].',
        'For astronauts the main risk is long-term. Cancer, heart disease and cataracts are seen in people exposed to radiation on Earth [S11].',
        'Crews exposed to space radiation may be more likely to develop cancer [S6].'
      ],
      inSpace: [
        'Radiation is monitored on board, and new detectors are being developed for better dose estimates [S11].',
        'Bubble detectors, the predecessor of a new Canadian neutron instrument, have been used on the space station [S9].'
      ],
      helps: [
        'NASA\'s current strategy combines shielding, radiation monitoring and operational procedures [S11].',
        'This prototype shows no dose limits, because the sources it uses give none.'
      ],
      indicators: ['dosimeter']
    }
  };
  var REGION_ORDER = ['brain', 'eyes', 'heart', 'bones', 'muscles', 'kidneys', 'immune', 'radiation'];

  // ---------------------------------------------------------------------------
  // ENVIRONMENTS — where the crew member is. Changes comm delay and context.
  // ---------------------------------------------------------------------------
  var ENVIRONMENTS = [
    {
      id: 'station', label: 'Space station',
      comm: 'Contact with mission control is near real-time (illustrative prototype value). The station orbits 240 miles above Earth and receives cargo flights [S11].',
      gravity: 'Weightless. Bones, muscles and body fluids are all affected [S5].',
      radiation: 'Radiation is monitored on the station. Neutrons make up about 30% of the total there [S9].'
    },
    {
      id: 'transit', label: 'Spacecraft (transit to Mars)',
      comm: 'The delay reaches up to 20 minutes one way on a Mars mission [S3].',
      gravity: 'Weightless for about six months between the planets [S5].',
      radiation: 'Outside Earth\'s magnetic field and atmosphere, space radiation is a serious risk [S1].'
    },
    {
      id: 'moon', label: 'Moon base',
      comm: 'The delay is a few seconds (illustrative prototype value). The Moon is 1,000 times farther from Earth than the space station [S11].',
      gravity: 'Partial gravity. Astronauts may need time to adjust after landing before they do critical tasks [S5]. Our sources give no value for lunar gravity.',
      radiation: 'Longer missions to the Moon mean more exposure to radiation [S10].'
    },
    {
      id: 'mars', label: 'Mars base',
      comm: 'The delay is up to 20 minutes one way [S3]. A question and its answer can take 40 minutes or more.',
      gravity: 'About one-third of Earth\'s gravity [S5]. Expect balance and coordination changes after landing.',
      radiation: 'Space radiation is one of the biggest challenges for a human journey to Mars [S1].'
    },
    {
      id: 'rover', label: 'Rover (Mars surface)',
      comm: 'The delay is up to 20 minutes one way [S3]. Away from the base, a question and its answer can take 40 minutes or more.',
      gravity: 'About one-third of Earth\'s gravity [S5]. Dizziness and coordination problems can make walking or driving hard [S6].',
      radiation: 'Space radiation is one of the biggest challenges for a human journey to Mars [S1].'
    }
  ];

  // ---------------------------------------------------------------------------
  // ROUTINE — daily prompts built from the check-in. A task is done when all of
  // its indicators are recorded. The times of day are illustrative.
  // ---------------------------------------------------------------------------
  var ROUTINE = [
    { id: 'vitals', label: 'Morning vitals', when: 'After waking', group: 'Morning vitals', hazards: ['G'],
      needs: ['restingHR', 'systolic', 'diastolic', 'glucose', 'temperature'] },
    { id: 'exercise', label: 'Exercise session', when: 'Midday', group: 'Body', hazards: ['G'],
      needs: ['exerciseMin'] },
    { id: 'vision', label: 'Weekly vision check', when: 'Once every 7 days', group: 'Body', hazards: ['G'],
      needs: ['vision'], withinDays: 7 },
    { id: 'journal', label: 'Sleep, mood and journal entry', when: 'Evening', group: 'Sleep and mind', hazards: ['I'],
      needs: ['sleepHours', 'mood', 'stress'], needsNote: true },
    { id: 'closeout', label: 'End-of-day check', when: 'Before sleep', group: 'Body', hazards: ['G', 'E', 'R'],
      needs: ['hydrationCups', 'dizziness', 'illness', 'dosimeter'] }
  ];

  // BADGES — light gamification for healthy routines. The rules use the numbers
  // in PROTOTYPE_ASSUMPTIONS.badges.
  var BADGES = [
    { id: 'streak', name: 'Steady Logger', hazards: [],
      why: 'Check in every day, so that missing data never hides a change.' },
    { id: 'exercise', name: 'Bone Builder', hazards: ['G'],
      why: 'Exercise is an essential part of preventing bone loss [S6b].' },
    { id: 'hydration', name: 'Well Hydrated', hazards: ['G'],
      why: 'Dehydration raises the risk of kidney stones [S5].' },
    { id: 'journal', name: 'Journal Keeper', hazards: ['I'],
      why: 'Journaling is a safe outlet and helps track mental and emotional state [S2] [S11].' }
  ];

  // ---------------------------------------------------------------------------
  // LANDING — "Gravity transition check": a short readiness checklist for the
  // time after landing or any change of gravity. The "how" steps are
  // illustrative prototype instructions, not agency procedures.
  // ---------------------------------------------------------------------------
  var LANDING = {
    intro: 'Moving from weightlessness into gravity can cause lightheadedness and fainting, and it affects balance, coordination and walking [S5]. Astronauts may need time to adjust after landing before they do mission-critical tasks [S5].',
    surface: ['moon', 'mars', 'rover'],
    items: [
      { id: 'stand', q: 'Lightheaded or dizzy when you stand up?',
        why: 'Low blood pressure raises the chance of fainting at landing [S6d].',
        how: 'Stand up slowly from sitting, with a handhold. Wait one minute.' },
      { id: 'balance', q: 'Unsteady when you stand or walk?',
        why: 'Gravity transitions affect balance and walking [S5]. NASA tests balance after landing with functional tasks [S11].',
        how: 'Stand with your feet together near a handhold for 30 seconds, then walk a few steps.' },
      { id: 'coordination', q: 'Trouble with hand-eye coordination?',
        why: 'Gravity transitions affect head-eye and hand-eye coordination [S5]. NASA also tests fine motor skills [S11].',
        how: 'Touch a fixed point with a fingertip several times, then do a small task such as fastening a strap.' },
      { id: 'weakness', q: 'Unusual muscle weakness?',
        why: 'Muscles lose mass and strength in weightlessness [S10a].',
        how: 'Compare with how you felt before the flight when you climb, lift or hold your posture.' }
    ],
    guidance: {
      ok: ['No signs reported. Repeat the check after every change of gravity and before mission-critical tasks.'],
      watch: [
        'Take extra time to adjust before mission-critical tasks [S5].',
        'Move slowly and keep a handhold when you stand up or turn.',
        'Drink fluids. Plenty of fluids and lower-body compression garments before landing can help prevent low blood pressure [S6d].'
      ],
      act: [
        'Put off hazardous tasks such as driving or piloting. Dizziness and coordination problems can make walking or driving hard [S6].',
        'Sit or lie down if you feel faint. Lightheadedness and fainting can happen when moving into gravity [S5].',
        ACT_COMMON
      ]
    }
  };

  var CREW = { id: 'CM-2 · Nova', note: 'fictional crew member' };

  // ---------------------------------------------------------------------------
  // Date helpers (local time, ISO yyyy-mm-dd strings).
  // ---------------------------------------------------------------------------
  function pad(n) { return String(n).padStart(2, '0'); }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseIso(s) { var a = s.split('-').map(Number); return new Date(a[0], a[1] - 1, a[2]); }
  function addDays(s, n) { var d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); }

  // ---------------------------------------------------------------------------
  // Synthetic demo data — 30 days for a fictional crew member.
  // Deterministic (seeded), so the demo tells the same story every time:
  //   • sleep declines and mood drops, stress rises        → Isolation [S2]
  //   • exercise slips in the second half                  → Gravity / bones [S5]
  //   • one "space weather" dosimeter spike on day 22      → Radiation [S1]
  //   • two days with illness signs mid-mission            → Environment [S4]
  //   • a vision change on the last two days               → Gravity / eyes [S5]
  //   • blood glucose not measured today                   → shows "No data"
  // ---------------------------------------------------------------------------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function generateDemoData(todayIso) {
    var rnd = mulberry32(2026), n = 30, entries = {};
    function jit(a) { return (rnd() * 2 - 1) * a; }
    function ramp(i, from, to) { return i <= from ? 0 : i >= to ? 1 : (i - from) / (to - from); }
    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    var notes = {
      23: 'Slept poorly again. Schedule shifted for cargo operations.',
      21: 'Space weather alert from mission control. Dosimeter reading is high today.',
      28: 'Text on the procedures looks slightly blurry in my right eye.',
      29: 'Tired. Skipped part of the workout.'
    };
    for (var i = 0; i < n; i++) {
      var slide = ramp(i, 11, 29);  // slow decline in sleep and mood
      var slip = ramp(i, 14, 27);   // exercise slipping
      var e = {
        restingHR: Math.round(58 + 4 * slide + jit(2)),
        systolic: Math.round(116 + jit(4)),
        diastolic: Math.round(74 + jit(3)),
        glucose: Math.round(92 + jit(6)),
        temperature: Math.round((36.7 + jit(0.2)) * 10) / 10,
        sleepHours: Math.round((7.6 - 2.0 * slide + jit(0.3)) * 2) / 2,
        mood: clamp(Math.round(4.2 - 2.2 * slide + jit(0.4)), 1, 5),
        stress: clamp(Math.round(1.8 + 2.2 * slide + jit(0.4)), 1, 5),
        exerciseMin: Math.round((110 - 65 * slip + jit(10)) / 5) * 5,
        hydrationCups: Math.round(9.5 - 1.0 * slide + jit(0.8)),
        vision: i >= n - 2,
        dizziness: false,
        illness: i === 16 || i === 17,
        dosimeter: Math.round((0.5 + jit(0.05)) * 100) / 100,
        note: notes[i] || ''
      };
      if (i === 21) e.dosimeter = 2.6;   // space weather spike
      if (i === 22) e.dosimeter = 1.2;
      if (i === n - 1) e.glucose = null; // not measured today → "No data"
      entries[addDays(todayIso, i - (n - 1))] = e;
    }
    return { entries: entries, missionStart: addDays(todayIso, -(n - 1)) };
  }

  global.RIDGE_DATA = {
    SOURCES: SOURCES,
    PROTOTYPE_ASSUMPTIONS: PROTOTYPE_ASSUMPTIONS,
    HAZARDS: HAZARDS,
    HAZARD_ORDER: HAZARD_ORDER,
    INDICATORS: INDICATORS,
    INDICATOR_ORDER: INDICATOR_ORDER,
    REGIONS: REGIONS,
    REGION_ORDER: REGION_ORDER,
    ENVIRONMENTS: ENVIRONMENTS,
    ROUTINE: ROUTINE,
    LANDING: LANDING,
    BADGES: BADGES,
    CREW: CREW,
    generateDemoData: generateDemoData,
    util: { iso: iso, parseIso: parseIso, addDays: addDays }
  };
})(typeof window !== 'undefined' ? window : globalThis);
