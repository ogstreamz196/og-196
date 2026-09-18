# Background music fade and shuffle controls

## Changes
- Fade each background track smoothly from silence to the existing 50% volume whenever playback starts.
- Replace sequential playback with a shuffled order that avoids immediately repeating the current track.
- Add a next-track icon beside the header play/pause control, with an accessible label and tooltip.
- Keep automatic advance, playlist cycling, stored playback state, and browser autoplay handling working.

## Verification
- Confirm play and next controls work in the header at desktop and phone widths.
- Confirm manual and automatic track changes fade in and follow shuffled order without immediate repeats.
- Confirm the app build remains healthy.
