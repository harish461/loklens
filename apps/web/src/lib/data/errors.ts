import type { ApiError } from './types'

/** Errors the helpers throw for bad input. Pages map them to 400; the not-found case returns null instead. */
export class DataError extends Error {
  readonly code: ApiError['error']['code']

  constructor(code: ApiError['error']['code'], message: string) {
    super(message)
    this.name = 'DataError'
    this.code = code
  }
}

export class BadRequestError extends DataError {
  constructor(message: string) {
    super('BAD_REQUEST', message)
    this.name = 'BadRequestError'
  }
}

/** Shapes any error into the contract's ApiError body (contract §1, §3). */
export function toApiError(err: unknown): { status: 400 | 500; body: ApiError } {
  if (err instanceof DataError) {
    return {
      status: err.code === 'BAD_REQUEST' ? 400 : 500,
      body: { error: { code: err.code, message: err.message } },
    }
  }
  return { status: 500, body: { error: { code: 'SERVER_ERROR', message: 'Internal error' } } }
}
