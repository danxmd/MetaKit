/** Local folders need the File System Access API, which only Chrome and Edge ship on desktop. */
export function supportsLocalFolders(host: object): boolean {
  return (
    typeof (host as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
    'function'
  );
}
