# Home privacy link and mobile Messenger keyboard fix

## Changes
- Add a clearly labelled Privacy Policy link on the signed-in home page, pointing to `/policy`.
- Remove the duplicate keyboard translation that pushes the private-chat composer too far upward.
- Let the Messenger panel follow the phone’s visible screen height while the keyboard is open, keeping the composer and recent messages in view.
- Apply the same keyboard-safe sizing to both private chat and the Battle Zone.

## Verification
- Check the home link opens the existing privacy policy.
- Test Messenger at phone width with a focused message field and verify the text field remains visible without page overlap.
- Confirm the preview build remains successful.
