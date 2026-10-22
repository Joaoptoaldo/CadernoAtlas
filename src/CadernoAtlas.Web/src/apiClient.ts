export class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'HttpError'
  }
}

interface ProblemDetails {
  detail?: unknown
  title?: unknown
  errors?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return isRecord(value)
}

function getProblemMessage(problem: unknown, fallback: string): string {
  if (!isProblemDetails(problem)) return fallback
  if (typeof problem.detail === 'string') return problem.detail
  if (typeof problem.title === 'string') return problem.title
  return fallback
}

function getValidationMessage(problem: unknown): string | undefined {
  if (!isProblemDetails(problem) || !isRecord(problem.errors)) {
    return undefined
  }

  return Object.values(problem.errors)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .find(
      (value): value is string =>
        typeof value === 'string' && Boolean(value),
    )
}

async function readErrorMessage(
  response: Response,
  includeValidationErrors: boolean,
): Promise<string> {
  const fallback = `A API respondeu com o status ${response.status}.`

  try {
    const problem: unknown = await response.json()
    const message = getProblemMessage(problem, fallback)

    if (includeValidationErrors) {
      return getValidationMessage(problem) ?? message
    }

    return message
  } catch {
    // Algumas respostas de erro não possuem corpo JSON.
    return fallback
  }
}

export function isHttpError(error: unknown): error is HttpError {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
  )
}

export async function apiGet<TResponse>(
  path: string,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new HttpError(
      await readErrorMessage(response, false),
      response.status,
    )
  }

  return response.json() as Promise<TResponse>
}

export async function apiPost<
  TResponse,
  TBody extends object,
>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new HttpError(
      await readErrorMessage(response, true),
      response.status,
    )
  }

  return response.json() as Promise<TResponse>
}

export async function apiPut<
  TResponse,
  TBody extends object,
>(
  path: string,
  body: TBody,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new HttpError(
      await readErrorMessage(response, true),
      response.status,
    )
  }

  return response.json() as Promise<TResponse>
}