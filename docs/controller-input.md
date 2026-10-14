# Controllers and drum mapping — version 101

Open **Controllers / drums** at Soundcheck. Connect the controller to Windows with
its supported USB connection or receiver, then press a button so the browser can
expose it. Choose the device and mapping layout. Beside each color, kick, strum or
command, choose **Add input**, strike only that pad/control, and release it.
Incoming controls and assigned rows appear in the live test. Close setup and press
Play; opening setup during a run pauses it and testing never scores the song.

Mappings are saved in browser-local storage by device identity and layout:

| Layout | Assignments |
| --- | --- |
| Clone Hero four-lane drums | Red, Yellow, Blue, Green, kick, Overdrive, pause/resume |
| Guitar Hero five-lane drums | Red, Yellow, Blue, Orange, Green, kick, Overdrive, pause/resume |
| Guitar / Bass / vocal pitch pads | Five frets/pitch pads, strum, Overdrive, pause/resume |

During play the current song/instrument selects the appropriate saved layout.
Changing the mapping-layout selector only edits that mapping; it does not change
the song or its chart. Add alternate controls to an action for multiple cymbals,
two kick pedals or two strum directions. Clear removes that action's inputs;
Clear this layout affects only the selected device/layout. An identical assignment
moves from its previous action to prevent accidental double scoring. Several
mapped devices can play together and retain independent hold ownership.

The optional standard gamepad preset is a starting point for conventional
controllers, not a claim of a particular drum kit's button numbering. Unknown
hardware starts with no assigned controls. Button combinations are learned as a
single binding; a matched combination takes precedence over its component
bindings. Axis directions use a neutral baseline and a dead zone. Connect with
sticks, pedals and strum controls at rest. Some adapters collapse distinct pad
hits into indistinguishable states; software cannot recover inputs they omit.

For MIDI, connect a USB drum module or a five-pin MIDI OUT through a USB-MIDI
interface. Choose **Enable MIDI inputs**, allow access, select the MIDI device,
then learn the notes or apply the General MIDI drum preset. MIDI permission is
requested only on that button, with `sysex: false`; the game sends no MIDI output.
Learned notes preserve their channel. The preset accepts any channel; reassigning
a specific note removes conflicting preset assignments. Every positive-velocity
drum note-on triggers one hit, even without note-off messages; velocity-zero
note-ons and note-offs do not score. Guitar/pitch-pad MIDI holds use note-offs.

Disconnected devices release their active inputs. Switching instruments, pausing,
resetting, losing focus, or blocking input for dialogs releases held controls.
Gamepad controls must return to neutral before firing again. Assignments time out
after ten seconds and can be cancelled. Corrupt preferences are ignored; a failed
storage write leaves the current mapping usable and shows a save warning. The
enable switch disables mapped gameplay without disabling the live setup test.

Use desktop Chrome or Edge over the deployed HTTPS URL, preferably in its own
tab. Browser permission policies can block gamepad/MIDI access in embedded views;
the setup reports these errors. Existing keyboard and touch controls still work.
Mappings stay on the device/browser and are not song metadata or part of riffpack
backups. Offline assets include both controller modules.

Hardware boundaries: Riffbound can read only inputs exposed by the OS/browser.
This update does not replace an Xbox 360 receiver or a USB-MIDI interface, and
does not establish that an unpaired Xbox 360 drum brain sends MIDI output. The
announced Stage Tour PC USB connection is a possible device route, but no physical
Stage Tour, Xbox drum kit, receiver, or MIDI interface was available for validation.
Its browser exposure and exact pad signals still require a physical test.

Validation uses the production input module, real scoring engine and game/setup
handlers with deterministic Gamepad, MIDI, audio and DOM adapters. It covers both
drum layouts on desktop/mobile layouts, saved mappings, chords, kicks, cymbal
alternates, strumming/sustains, permission failures, disconnects, focus changes,
setup isolation and saved-song preservation. This is not a physical-device or
browser-rendering certification.

API references: [W3C Gamepad](https://www.w3.org/TR/gamepad/) and
[W3C Web MIDI](https://www.w3.org/TR/webmidi/).
