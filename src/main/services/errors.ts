import type { IpcErrorPayload } from '@shared/types'

export class AppError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }

  toPayload(): IpcErrorPayload {
    return {
      code: this.code,
      message: this.message,
      details: this.details
    }
  }
}

export function serializeError(err: unknown): IpcErrorPayload {
  if (err instanceof AppError) return err.toPayload()
  if (err instanceof Error) {
    return {
      code: err.name || 'Error',
      message: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  }
  return {
    code: 'UnknownError',
    message: String(err)
  }
}

export function wrapHandler<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult | Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args)
    } catch (err) {
      const payload = serializeError(err)
      const error = new Error(payload.message) as Error & { code: string; details?: unknown }
      error.code = payload.code
      error.details = payload.details
      throw error
    }
  }
}
