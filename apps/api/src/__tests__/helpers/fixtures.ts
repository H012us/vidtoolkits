export const SAMPLE_MARKDOWN = `---
title: "My Video Title"
style: "cinematic"
voice: "en-US-AriaNeural"
durationPerPart: 8
---

## Part 1: Introduction
keywords: sunset, ocean, beach

Welcome to this video about beautiful sunsets.
We'll explore the most stunning ocean views.

## Part 2: Deep Dive
keywords: mountain, forest, hiking

Let's talk about mountain adventures.
The forest is a magical place.
`;

export const MINIMAL_MARKDOWN = `---
title: "Minimal Video"
---

## Part 1: Intro

Hello world.
`;

export const EMPTY_BODY_MARKDOWN = `---
title: "No Body"
---
`;

export const NO_PARTS_MARKDOWN = `---
title: "Empty Parts"
---

Just a regular paragraph without a heading.
Another line.
`;

export const MULTI_KEYWORD_MARKDOWN = `---
title: "Multi Keywords"
voice: "en-GB-SoniaNeural"
---

## Part 1: Keywords Test
keywords: sunset, ocean, beach, mountain, forest

This part has multiple keywords separated by commas and spaces.
`;

export const INLINE_CODE_MARKDOWN = `---
title: "Code Test"
---

## Part 1: Code

Use \`npm install\` to get started.
Run \`pnpm dev\` to begin.
`;

export const VERY_LONG_TITLE = 'A'.repeat(250);
export const LONG_TITLE_MARKDOWN = `---
title: "${VERY_LONG_TITLE}"
---

## Part 1: Intro

Content.
`;

export const MISSING_TITLE_MARKDOWN = `---

## Part 1: No Title Frontmatter

Some content.
`;

export const MALFORMED_FRONT_MATTER = `---
title: "Broken"
  invalid yaml: [unclosed
---

## Part 1: Content

Hello.
`;

export const EMPTY_MARKDOWN = '';
export const WHITESPACE_MARKDOWN = '   \n\t  \n';
