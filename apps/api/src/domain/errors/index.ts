export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class ParseError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'PARSE_ERROR', 400);
    this.name = 'ParseError';
  }
}

export class MediaFetchError extends DomainError {
  constructor(
    message: string,
    public readonly provider?: string,
    public readonly recoverable = true
  ) {
    super(message, 'MEDIA_FETCH_ERROR', 502);
    this.name = 'MediaFetchError';
  }
}

export class TTSError extends DomainError {
  constructor(
    message: string,
    public readonly engine?: string,
    public readonly recoverable = true
  ) {
    super(message, 'TTS_ERROR', 502);
    this.name = 'TTSError';
  }
}

export class RenderError extends DomainError {
  constructor(
    message: string,
    public readonly recoverable = false
  ) {
    super(message, 'RENDER_ERROR', 500);
    this.name = 'RenderError';
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, public readonly field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 'NOT_FOUND', 404);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 'CONFLICT', 409);
    this.name = 'ConflictError';
  }
}