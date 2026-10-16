# Live audio drum recognition — version 126

Version 127 improves Connect audio startup and visible errors. See below.

## Playing through an EAD sensor or microphone

Open **Controllers / drums → Audio drum recognition · experimental**. Connect
an EAD10/20/50 USB TO HOST data cable and install Yamaha's supported Windows USB
audio driver if needed (the EAD driver guide remains in the same dialog). This
mode reads audio, so it does not require separate MIDI triggers on every drum.
It can also use another USB audio interface or microphone exposed by the browser.

1. Choose **Connect audio** and allow microphone access. Device names become
   available after permission. Select the EAD's USB audio input, then choose
   **Reconnect selected audio** if it was not the default input. The connected
   input name and live level identify what is being listened to.
2. Use headphones and route only live drums into the EAD USB input. Backing-song
   or metronome loopback in that input can trigger false hits even with headphones.
   Disable/reduce EAD effects and keep the same effects/gain/sensor position for
   learning and playing. The input is not monitored through the browser speakers.
3. Choose **Start kit soundcheck**. Follow six prompts in order: snare, hi-hat,
   tom, cymbal, floor tom, kick. Strike only the named sound three times, about
   one second apart. Each prompt has a 20-second timeout. All six consistent,
   distinguishable sounds are required before audio play can be enabled.
4. Test the displayed recognized colors. Relearn an individual sound if needed.
   Clipping is shown in the level display; reduce hardware gain. Lower the noise
   gate for quiet hits, or raise it to reject ambient noise. Uncertain sounds
   and clipped attacks do not score. Similar templates prevent enabling play
   until the affected sounds are relearned or the sensor/effects are adjusted.
5. Turn on **Use audio drums for play**, close setup, select Drums and play.
   Soundcheck and chart preview do not score. Pause, other instruments, dialogs,
   hidden pages, editing fields and global controller disable suppress scoring.

Four-lane play maps snare/hi-hat/tom/cymbal-or-floor-tom to Red/Yellow/Blue/Green.
Five-lane play keeps Orange cymbal and Green floor tom independent. A clearly
recognized pair can score both lanes; a pair that collapses to the same four-lane
color produces one input for that color. No chart note or expected lane is used
to decide which drum was played. Guitar/Bass/Vocals remain unchanged.

Audio mode suppresses MIDI/gamepad drum scoring while enabled to avoid counting
an EAD strike twice. Keyboard and touch input remain available. Pause/Overdrive
commands still work with keyboard/touch or mapped command controls. Audio-play
best scores have a separate key from keyboard/controller-only play.

## Capture, privacy and lifecycle

Microphone permission is requested only by Connect audio. No capture starts on
page load or after a reload. The input requests echo cancellation, noise
suppression and automatic gain control off, with an ideal two-channel stream.
Browsers/devices may not honor every ideal constraint. An AudioWorklet analyzes
locally; its output is silent and is connected through a zero-gain node. There
is no recording API, network recognition service, audio upload or stored waveform.

Only learned normalized sound features, noise gate and extra delay preference
are stored locally per browser input identity. They are not part of song metadata
or riffpack backups. Reconnect after reload and explicitly enable play again.
If the OS/browser changes the input's identity, a new soundcheck may be needed.

Closing setup cancels an unfinished soundcheck but keeps the microphone connected
for play/test. The main Controllers / drums button displays **mic on** whenever
capture is connected. **Stop audio** stops every media track, disconnects nodes,
and closes the capture context immediately; it also cancels a pending permission
request's eventual stream. After connection finishes, losing window focus stops capture. Pending microphone
permission requests survive focus changes caused by browser permission UI.
Hiding/leaving the page, device loss or a worklet error stops capture. Device loss pauses an audio gameplay run.
Automatic updates wait while audio capture or a connection request is active.

## Recognition and timing

The worklet uses a 2048-sample Hann-window FFT at a 256-sample hop, pooling spectral
energy into 48 logarithmic bands. A thresholded positive spectral-growth detector
rejects unchanged ringing tails and gathers approximately 27 ms of attack growth
before emitting an event, with a 55 ms minimum onset spacing. This is not a trained
neural model or a certified acoustic transcription system.

Soundcheck averages three normalized attack features per role, rejecting
inconsistent strikes. Cosine similarity identifies isolated sounds. A bounded
nonnegative two-template fit recognizes clear pairs when it improves over the
single-sound fit and meets confidence/error thresholds. Ambiguous/unmatched
sounds are ignored; soundcheck roles with nearly identical templates block play.

Events retain their estimated attack timestamp across worklet/main-thread delivery.
Gameplay subtracts measured delivery age and optional extra USB delay from input
time, scaled by the current practice speed. Stale events over 300 ms are ignored.
The extra compensation is adjustable from -100 to +200 ms; positive moves hits
earlier. It does not change the global Timing preference. Audio input/output
hardware latency and browser scheduling still need calibration on the actual PC.

Limitations include room noise, speech/song bleed, drum tuning, sensor location,
EAD effects, soft hits under loud cymbals, similar toms/cymbals, dense rolls faster
than the detector spacing and combinations of more than two drums. Similar or
masked hits can be missed or misclassified. A synthetic match percentage measures
template similarity, not a measured real-world recognition accuracy. MIDI remains
more reliable where separate trigger signals are available.

## Verification

Tests use deterministic percussive PCM (including continuous rapid kicks and
mixed simultaneous attacks), the actual FFT/onset/classifier path, opt-in capture
and cancellation adapters, local persistence, full production soundcheck UI,
controller suppression and four-/five-lane game scoring. They also cover preview,
pause, focus loss, stale delivery, clipping, incomplete/conflicting soundchecks,
permission denial and offline asset inclusion. These are synthetic fixtures,
not a benchmark of recorded acoustic drums or a physical EAD device.

The managed browser preview could not start because its sandbox could not mount
proc. Browser rendering and real audio/driver latency were not verified in this
environment. Test with the user's EAD and room before relying on scores.

API sources: [W3C Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
and [Web Audio API](https://www.w3.org/TR/webaudio/).

## Connect audio startup — version 127

Status now appears immediately below Connect audio, above the level controls.
Clicking shows the microphone-permission request message immediately; no input,
busy Windows devices, denied access, an unavailable selected device or unsupported
capture APIs show actionable errors in the same visible place. The privacy state
remains explicit and capture still requires the button click.

A small independent startup guard binds the button before loading recognition or
game scripts. If dependencies fail to load or initialization throws, the button
shows a reload instruction instead of becoming inert. If browser microphone policy
blocks an embedded view, it recommends opening the literal published Riffbound
link in its own tab. It does not bypass site or browser permission policies.

The audio modules now export to the browser window consistently while preserving
CommonJS test imports and the worker global. A regression test executes the actual
classic scripts plus full game initialization, checks that Connect requests
microphone access exactly once, simulates browser-window blur during pending
permission, then verifies the visible missing-device error and retryable button.
Other tests cover blocked/insecure views and dependency/startup failures. Physical
browser/EAD behavior still needs verification on the player's Windows computer.
