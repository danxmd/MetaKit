// File System Access API pieces that lib.dom does not ship yet.
interface FileSystemObserverLike {
  observe(
    handle: FileSystemHandle,
    options?: { recursive?: boolean },
  ): Promise<void>;
  disconnect(): void;
}

interface Window {
  showDirectoryPicker(options?: {
    mode?: 'read' | 'readwrite';
  }): Promise<FileSystemDirectoryHandle>;
  FileSystemObserver?: new (
    callback: (records: unknown[]) => void,
  ) => FileSystemObserverLike;
}

interface FileSystemHandle {
  queryPermission(options?: {
    mode?: 'read' | 'readwrite';
  }): Promise<PermissionState>;
  requestPermission(options?: {
    mode?: 'read' | 'readwrite';
  }): Promise<PermissionState>;
}
