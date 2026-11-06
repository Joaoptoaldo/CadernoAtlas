export class MutationSyncError extends Error {
  readonly mutationConfirmed = true

  constructor(message: string) {
    super(message)
    this.name = 'MutationSyncError'
  }
}

export function isMutationSyncError(error: unknown): error is MutationSyncError {
  return error instanceof MutationSyncError
}
