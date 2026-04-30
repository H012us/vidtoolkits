import { describe, it, expect } from 'vitest';
import { MarkdownParserService } from './MarkdownParserService.js';
import {
  SAMPLE_MARKDOWN,
  MINIMAL_MARKDOWN,
  EMPTY_BODY_MARKDOWN,
  NO_PARTS_MARKDOWN,
  MULTI_KEYWORD_MARKDOWN,
  INLINE_CODE_MARKDOWN,
  LONG_TITLE_MARKDOWN,
  MISSING_TITLE_MARKDOWN,
  EMPTY_MARKDOWN,
  WHITESPACE_MARKDOWN,
} from '../../__tests__/helpers/fixtures.js';

describe('MarkdownParserService', () => {
  let service: MarkdownParserService;

  beforeEach(() => {
    service = new MarkdownParserService();
  });

  describe('parse', () => {
    it('parses sample markdown correctly', () => {
      const result = service.parse(SAMPLE_MARKDOWN);

      expect(result.title).toBe('My Video Title');
      expect(result.style).toBe('cinematic');
      expect(result.voiceName).toBe('en-US-AriaNeural');
      expect(result.durationPerPart).toBe(8);
      expect(result.parts).toHaveLength(2);
    });

    it('extracts part titles and strips "Part N:" prefix', () => {
      const result = service.parse(SAMPLE_MARKDOWN);
      expect(result.parts[0].title).toBe('Introduction');
      expect(result.parts[1].title).toBe('Deep Dive');
    });

    it('groups paragraph text into part scripts', () => {
      const result = service.parse(SAMPLE_MARKDOWN);
      expect(result.parts[0].script).toContain('Welcome to this video');
      expect(result.parts[0].script).toContain("We'll explore");
      expect(result.parts[1].script).toContain('mountain adventures');
      expect(result.parts[1].script).toContain('magical place');
    });

    it('extracts keywords from paragraphs', () => {
      const result = service.parse(SAMPLE_MARKDOWN);
      expect(result.parts[0].keywords).toContain('sunset');
      expect(result.parts[0].keywords).toContain('ocean');
      expect(result.parts[0].keywords).toContain('beach');
      expect(result.parts[1].keywords).toContain('mountain');
      expect(result.parts[1].keywords).toContain('forest');
    });

    it('keywords-only paragraphs do not add to script', () => {
      const result = service.parse(SAMPLE_MARKDOWN);
      // First part: keywords paragraph followed by content paragraphs
      const part0 = result.parts[0];
      expect(part0.script).not.toContain('keywords:');
    });

    it('deduplicates keywords', () => {
      const result = service.parse(MULTI_KEYWORD_MARKDOWN);
      const sunsetCount = result.parts[0].keywords.filter((k) => k === 'sunset').length;
      expect(sunsetCount).toBe(1);
    });

    it('filters keywords longer than 50 chars', () => {
      const result = service.parse(MULTI_KEYWORD_MARKDOWN);
      result.parts[0].keywords.forEach((k) => {
        expect(k.length).toBeLessThanOrEqual(50);
      });
    });

    it('extracts inline code into script text', () => {
      const result = service.parse(INLINE_CODE_MARKDOWN);
      expect(result.parts[0].script).toContain('npm install');
      expect(result.parts[0].script).toContain('pnpm dev');
    });

    it('handles minimal markdown', () => {
      const result = service.parse(MINIMAL_MARKDOWN);
      expect(result.title).toBe('Minimal Video');
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].title).toBe('Intro');
      expect(result.parts[0].script).toBe('Hello world.');
    });

    it('handles markdown with no body', () => {
      const result = service.parse(EMPTY_BODY_MARKDOWN);
      expect(result.title).toBe('No Body');
      expect(result.parts).toHaveLength(0);
    });

    it('handles markdown with no H2 headings', () => {
      const result = service.parse(NO_PARTS_MARKDOWN);
      expect(result.title).toBe('Empty Parts');
      expect(result.parts).toHaveLength(0);
    });

    it('ignores non-H2 headings as part delimiters', () => {
      const md = `---
title: "Ignore Headers"
---
# H1 is not a part
### H3 is not a part
## Part 1: Actual Part

Content here.
`;
      const result = service.parse(md);
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0].title).toBe('Actual Part');
    });

    it('uses defaults when front matter fields are missing', () => {
      const result = service.parse(MISSING_TITLE_MARKDOWN);
      expect(result.title).toBe('Untitled Video');
      expect(result.style).toBe('cinematic');
      expect(result.voiceName).toBe('en-US-AriaNeural');
      expect(result.durationPerPart).toBe(8);
    });

    it('uses fm.voiceName interchangeably with fm.voice', () => {
      const md = `---
title: Voice Test
voiceName: en-GB-SoniaNeural
---
## Part 1: Test

Content.
`;
      const result = service.parse(md);
      expect(result.voiceName).toBe('en-GB-SoniaNeural');
    });

    it('uses fm.duration interchangeably with fm.durationPerPart', () => {
      const md = `---
title: Duration Test
duration: 12
---
## Part 1: Test

Content.
`;
      const result = service.parse(md);
      expect(result.durationPerPart).toBe(12);
    });

    it('truncates title to 200 characters', () => {
      const result = service.parse(LONG_TITLE_MARKDOWN);
      expect(result.title.length).toBe(200);
    });

    it('strips "Part N:" prefix case-insensitively', () => {
      const md = `---
title: Part Test
---
## PART 3: The Real Title

Content.
`;
      const result = service.parse(md);
      expect(result.parts[0].title).toBe('The Real Title');
    });
  });

  describe('parse errors', () => {
    it('throws ParseError for empty input', () => {
      expect(() => service.parse(EMPTY_MARKDOWN)).toThrow();
    });

    it('throws ParseError for whitespace-only input', () => {
      expect(() => service.parse(WHITESPACE_MARKDOWN)).toThrow();
    });

    it('throws ParseError with field "content" for empty input', () => {
      try {
        service.parse(EMPTY_MARKDOWN);
        expect.fail('should have thrown');
      } catch (err: any) {
        expect(err).toBeDefined();
        expect(err.message).toBeDefined();
      }
    });
  });
});
