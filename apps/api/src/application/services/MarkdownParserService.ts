import matter from 'gray-matter';
import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { ParseError } from '../../domain/errors/index.js';
import { DEFAULT_VIDEO_STYLE, DEFAULT_DURATION_PER_PART } from '@vidtoolkits/shared';

// Minimal unist UnistNode type (unist doesn't export its types via module)
interface UnistNode {
  type: string;
  children?: UnistNode[];
  value?: string;
  depth?: number;
}

interface ParsedPart {
  title: string;
  script: string;
  keywords: string[];
}

export interface ParseResult {
  title: string;
  style: string;
  voiceName: string;
  durationPerPart: number;
  parts: ParsedPart[];
}

interface HeadingNode extends UnistNode {
  type: 'heading';
  depth: number;
  children: UnistNode[];
}

interface ParagraphNode extends UnistNode {
  type: 'paragraph';
  children: UnistNode[];
}

interface TextNode extends UnistNode {
  type: 'text';
  value: string;
}

export class MarkdownParserService {
  parse(rawMd: string): ParseResult {
    if (!rawMd || rawMd.trim().length === 0) {
      throw new ParseError('Markdown content is empty', 'content');
    }

    let parsed: { data: Record<string, unknown>; content: string };
    try {
      parsed = matter(rawMd);
    } catch (err) {
      throw new ParseError(`Failed to parse front matter: ${(err as Error).message}`);
    }

    const { data: fm, content: body } = parsed;

    const title = String(fm.title || 'Untitled Video').slice(0, 200);
    const style = String(fm.style || DEFAULT_VIDEO_STYLE);
    const voiceName = String(fm.voice || fm.voiceName || 'en-US-AriaNeural');
    const durationPerPart = Number(fm.durationPerPart || fm.duration || DEFAULT_DURATION_PER_PART);

    let ast;
    try {
      ast = remark().use(remarkGfm).parse(body);
    } catch (err) {
      throw new ParseError(`Failed to parse markdown body: ${(err as Error).message}`);
    }

    const parts = this.extractParts(ast);

    return { title, style, voiceName, durationPerPart, parts };
  }

  private extractParts(ast: UnistNode): ParsedPart[] {
    const parts: ParsedPart[] = [];
    let currentPart: ParsedPart | null = null;
    let currentScriptLines: string[] = [];
    let currentKeywords: string[] = [];

    visit(ast, (node: UnistNode): void => {
      if (node.type === 'heading') {
        const heading = node as HeadingNode;
        if (heading.depth === 2) {
          if (currentPart) {
            currentPart.script = currentScriptLines.join('\n').trim();
            currentPart.keywords = [...new Set(currentKeywords)];
            parts.push(currentPart);
          }

          const titleText = this.extractText(heading);
          currentPart = { title: titleText.replace(/^Part\s+\d+:\s*/i, '').trim(), script: '', keywords: [] };
          currentScriptLines = [];
          currentKeywords = [];
        }
      } else if (node.type === 'paragraph') {
        const para = node as ParagraphNode;
        const text = this.extractText(para);

        const kwMatch = text.match(/keywords?:\s*(.+)/i);
        if (kwMatch) {
          const raw = kwMatch[1];
          const extracted = raw.split(/[,\s]+/).filter(k => k.length > 0 && k.length <= 50);
          currentKeywords.push(...extracted);
        } else if (currentPart) {
          currentScriptLines.push(text);
        }
      }
    });

    // Flush remaining part
    if (currentPart) {
      parts.push({
        title: (currentPart as ParsedPart).title,
        script: currentScriptLines.join('\n').trim(),
        keywords: [...new Set(currentKeywords)],
      });
    }

    return parts;
  }

  private extractText(node: UnistNode): string {
    let text = '';
    visit(node, (n: UnistNode) => {
      if (n.type === 'text') {
        text += (n as TextNode).value;
      }
      if (n.type === 'inlineCode') {
        text += (n as TextNode & { value: string }).value;
      }
    });
    return text;
  }
}