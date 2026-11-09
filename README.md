# stop-signal-task

A stop-signal task that runs in the browser. It compares three kinds of inhibition: stopping when a signal appears, overriding a habitual response with an anti rule, and choosing to withhold on your own (free veto). SSD is set by a staircase and SSRT is estimated following Verbruggen et al. (2019).

It's a single HTML file. No server or install, and data stays in the participant's browser until it's downloaded as CSV at the end.

I originally built this for my AP Research project on Libet's idea of "free won't." That version used three fixed SSDs and only 63 trials, which isn't enough to estimate SSRT. This rebuild adds adaptive SSDs, SSRT estimation, frame-synced timing, and a longer design.

## Running it

Open `index.html` in Chrome or Edge (Firefox and Safari also work). Or turn on GitHub Pages and use the hosted link.

The experimenter enters an ID, age, and gender, then the participant reads the instructions and does a 14-trial practice round with feedback. The main task is 5 blocks of 90 trials, with breaks in between that show the participant their speed, accuracy, and stop rate. Expect about 20 minutes plus breaks.

At the end, download both CSV files before closing the page. Nothing is saved anywhere else.

The window needs to be at least 960 px wide. Full screen is best.

## Task

A dot appears on the left or right. F = left, J = right.

| Condition | Cue | Response |
|---|---|---|
| Go-Pro | PRO | Same side as the dot |
| Go-Anti | ANTI | Opposite side |
| Stop | PRO or ANTI, then STOP | Don't respond |
| Free-Veto | FREE VETO | Same side, or withhold (participant's choice) |

Stop trials use the same cues as go trials, so there's no way to know a stop is coming.

Trial sequence: cue and fixation (500 ms), random foreperiod (500–1000 ms), dot, response window (1500 ms), ITI (500 ms).

Each rule gets 150 go and 50 stop trials (25% stop), plus 50 free-veto trials overall. Trial types are balanced for side and shuffled within blocks.

## Staircase and SSRT

PRO and ANTI each have their own one-up/one-down staircase, since ANTI RTs are slower. SSD starts at 250 ms and moves ±50 ms after each stop trial (up after a successful stop, down after a failed one), limited to 50–1000 ms. Practice has separate staircases that reset before the main task.

Any response on a stop trial is a failed stop, even if it came before STOP appeared. Those are flagged in `responded_before_stop`.

SSRT is computed per rule with the integration method, replacing go omissions with the max go RT. Choice errors stay in the go distribution. The nth RT uses R's `quantile(type = 6)` interpolation to match the consensus paper's code. The summary also includes the race-model check (failed-stop RT < go RT) and flags SSRT as unreliable when P(respond | signal) is outside 0.25–0.75.

## Timing

Stimuli are drawn with `requestAnimationFrame`. Onsets come from the timestamp of the frame after the draw, which is when the change actually hits the screen. STOP is drawn on the frame closest to the intended SSD, and the measured SSD is logged as `ssd_actual`. RTs use the key event's `timeStamp`. Refresh rate is measured at the start of each session.

The browser can't account for monitor or keyboard latency, so absolute RTs will run a few ms long. This should affect all conditions about equally. SSDs are rounded to whole frames (~16.7 ms at 60 Hz). If absolute timing matters for your study, check your setup with a photodiode.

## Configuration

Everything is in `CONFIG` at the top of the script. The full config is saved in each summary file. If you change the task, bump `VERSION` too.

| Setting | Default | |
|---|---|---|
| `keys.left` / `keys.right` | `f` / `j` | Response keys |
| `timing.fixationMs` | 500 | |
| `timing.foreperiodMinMs` / `MaxMs` | 500 / 1000 | |
| `timing.responseWindowMs` | 1500 | |
| `timing.itiMs` | 500 | |
| `staircase.startMs` | 250 | Starting SSD |
| `staircase.stepMs` | 50 | |
| `staircase.minMs` / `maxMs` | 50 / 1000 | |
| `mainBlocks` | 5 | |
| `trialsPerMainBlock` | 30 / 30 / 10 / 10 / 10 | Go-Pro, Go-Anti, Stop-Pro, Stop-Anti, Free-Veto |
| `practiceTrials` | 4 / 4 / 2 / 2 / 2 | Same order |
| `reliablePRespond` | 0.25–0.75 | |

## Output

### `<id>_trial_data.csv`

One row per trial, including practice.

| Column | |
|---|---|
| `participant_id`, `age`, `gender` | From the start screen |
| `stage` | `practice` or `main` |
| `block`, `trial_in_block`, `trial` | `trial` counts within the stage |
| `family` | `go`, `stop`, `free` |
| `rule` | `pro` or `anti` (free-veto uses `pro`) |
| `side` | Side of the dot |
| `correct_key` | Key the rule calls for |
| `foreperiod` | ms |
| `ssd_intended` | Staircase SSD |
| `ssd_actual` | Measured SSD. Blank if the response came before STOP |
| `key`, `rt` | Blank if no response. RT is from dot onset |
| `key_matches_rule` | |
| `correct` | Right key on go trials, withholding on stop trials. Free-veto withholds count as correct |
| `response_type` | `go_response`, `go_omission`, `successful_stop`, `failed_stop`, `voluntary_go`, `voluntary_withhold` |
| `responded_before_stop` | Failed stops only |
| `early_presses` | Presses before the dot |
| `tab_hidden` | Participant left the tab during the trial |

### `<id>_summary_stats.csv`

Main task only. Session info (version, refresh rate, window size, browser) and, per rule: go accuracy, mean RTs, omission and choice error rates, P(respond | signal), mean SSD, failed-stop RT, race check, SSRT, and reliability flag. Also free-veto withhold rate and RT, data quality counts, and the config.

## Tests

`ssrt_estimator_check.js` simulates 5,000 sessions with a true SSRT of 200 ms using the quantile function from `index.html`. Mean estimate is about 195 ms (SD ≈ 18). The integration method slightly underestimates SSRT, which is expected.

```
node tests/ssrt_estimator_check.js
```

`run_simulation.py` runs a simulated race-model participant through a shortened version of the task in headless Chromium (~4 min) and checks that it finishes, the files download, and both staircases converge near 0.5. It doesn't test real-world timing.

```
pip install playwright
playwright install chromium
python tests/run_simulation.py
```

## Notes

Use participant IDs that don't identify anyone, and get IRB approval before collecting real data. CSV files are in `.gitignore` so data doesn't get committed by accident.

## References

Logan, G. D., & Cowan, W. B. (1984). On the ability to inhibit thought and action: A theory of an act of control. *Psychological Review, 91*(3), 295–327.

Verbruggen, F., Aron, A. R., Band, G. P. H., Beste, C., Bissett, P. G., Brockman, A. T., ... Boehler, C. N. (2019). A consensus guide to capturing the ability to inhibit actions and impulsive behaviors in the stop-signal task. *eLife, 8*, e46323.

## License

MIT. To cite, use `CITATION.cff` or the "Cite this repository" button.
