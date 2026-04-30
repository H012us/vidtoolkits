export class TemplateService {
  getMarkdownTemplate(): string {
    return `---
title: "Your Video Title Here"
style: "cinematic"       # Options: cinematic | minimal | bold
voice: "en-US-AriaNeural" # Edge-TTS voice. Find others at edge.microsoft.com/cognitive-services/speech-to-text
durationPerPart: 8        # Target duration in seconds per part (auto-adjusted if too short/long)
---

# Part 1: Introduction

keywords: beach, ocean, sunset, waves, coastline
# Use 3-5 specific, visual keywords per part.
# Best: specific subjects (beach, sunset) — avoid generic (nature) or obscure terms.
# Keywords describe what VIEWERS will SEE, not the topic.

Your narration script goes here. Keep it natural and conversational.
Write 2-4 sentences — aim for about 15 words per second when spoken.
Short, punchy sentences work best for video.

# Part 2: Main Topic

keywords: mountain, forest, hiking, sunrise, trail
# Mix different subjects in your keywords: foreground + background + action.
# Example: "forest, hiking, mountain" — shows hiking through a forest toward mountains.

Continue your script here. Each part should cover one clear idea or transition.
Don't try to squeeze too much into one part — shorter = more engaging.

# Part 3: Conclusion

keywords: city, skyline, night, lights, architecture
# End with a memorable visual and a clear call-to-action in your script.

Wrap up your video here. Thank the viewer, summarize key points,
and invite them to like, comment, and subscribe.

---

## Tips for Great Videos

1. **Keywords matter** — They determine what images are shown. Use specific,
   visual words: "beach sunset" beats "travel". Avoid vague keywords like
   "nature" or "beautiful" — be specific about what viewers should see.

2. **Shorter scripts = better** — Edit ruthlessly. Each sentence should
   earn its place. Aim for 8-15 words per second when spoken aloud.

3. **One idea per part** — Don't cram multiple topics into one section.
   Each part = one clear visual + one clear idea.

4. **Style options:**
   - **cinematic** — slow fades, wide shots, ambient music feel
   - **minimal** — clean cuts, focused visuals, minimal text
   - **bold** — fast cuts, text overlays, dynamic transitions

5. **Voice** — Edge-TTS voices: en-US-AriaNeural (default), en-US-GuyNeural,
   en-GB-SoniaNeural. Find full list at Microsoft's voice gallery.

6. **Part count** — More parts = longer video. Start with 3-5 parts
   for a 1-3 minute video.
`;
  }
}