export class SyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A sync file is not in a form this version understands. */
export class SyncFormatError extends SyncError {}

/** A file was written by a newer version; reading it could lose data, so it is refused. The name matches the storage layer's error of the same meaning. */
export class NewerFormatError extends SyncError {}

/** A file is still being written or copied: it does not end with a newline yet. */
export class PartialFileError extends SyncError {}
