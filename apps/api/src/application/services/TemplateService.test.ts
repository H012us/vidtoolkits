import { describe, it, expect } from 'vitest';
import { TemplateService } from './TemplateService.js';

const service = new TemplateService();

describe('TemplateService', () => {
  it('getMarkdownTemplate() returns a non-empty string', () => {
    const template = service.getMarkdownTemplate();
    expect(typeof template).toBe('string');
    expect(template.length).toBeGreaterThan(0);
  });

  it('returns a YAML frontmatter block starting with ---', () => {
    const template = service.getMarkdownTemplate();
    expect(template.startsWith('---')).toBe(true);
  });

  it('contains a Part 1 section', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('# Part 1:');
  });

  it('contains keywords guidance', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('keywords:');
  });

  it('contains cinematic style option', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('cinematic');
  });

  it('contains minimal style option', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('minimal');
  });

  it('contains bold style option', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('bold');
  });

  it('contains en-US-AriaNeural voice', () => {
    const template = service.getMarkdownTemplate();
    expect(template).toContain('en-US-AriaNeural');
  });

  it('contains tips section', () => {
    const template = service.getMarkdownTemplate();
    expect(template.toLowerCase()).toContain('tips');
  });
});
