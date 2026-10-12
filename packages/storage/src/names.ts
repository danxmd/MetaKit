/**
 * The names a Kit has in stored and exchanged files (ADR 0011). New files are written with the
 * `KIT_…` names; the `OLDER_…` names are what releases before the Kit rename wrote, and they are
 * still read. Existing Kits stay where they are: a Kit in `tools/<slug>/` is never moved, because
 * its sync files belong to other app instances (rule 6).
 */

/** The workspace folder that new Kits are created in, one subfolder each: `kits/<slug>/`. */
export const KIT_FOLDER = 'kits';

/** The folder that releases before the Kit rename kept Kits in. Kits there are read and edited in place. */
export const OLDER_KIT_FOLDER = 'tools';

/** Every folder a Kit can be in, the current one first. */
export const KIT_FOLDERS = [KIT_FOLDER, OLDER_KIT_FOLDER] as const;

/** The identity file of a Kit folder in `kits/`. */
export const KIT_IDENTITY_FILE = 'kit.json';

/** The identity file of a Kit folder in `tools/`. */
export const OLDER_KIT_IDENTITY_FILE = 'tool.json';

/** The document kind of a Kit, written in identity files, snapshots and presence. */
export const KIT_KIND = 'kit';

/** The kind that releases before the rename wrote for a Kit; read as `kit`. */
export const OLDER_KIT_KIND = 'tool';

/** The Kit document in a Git repository (or in the folder of one that the link names). */
export const GIT_KIT_FILE = 'kit.json';

/** The Kit document in a repository written by a release before the rename; the next commit renames it. */
export const OLDER_GIT_KIT_FILE = 'tool.json';

/** The extension of a Kit package. */
export const KIT_PACKAGE_EXTENSION = '.mkkit';

/** The extension of a Kit package from a release before the rename; still imported. */
export const OLDER_KIT_PACKAGE_EXTENSION = '.mktool';

/** The `kind` in the `package.json` of a Kit package. */
export const KIT_PACKAGE_KIND = 'mkkit';

/** The `kind` of a Kit package from a release before the rename. */
export const OLDER_KIT_PACKAGE_KIND = 'mktool';

/** The Kit document inside a Kit package. */
export const KIT_PACKAGE_FILE = 'kit.json';

/** The Kit document inside a `.mktool` package. */
export const OLDER_KIT_PACKAGE_FILE = 'tool.json';

/** The Kit document inside a `.mkbundle`. */
export const BUNDLE_KIT_PATH = 'kit/kit.json';

/** The Kit document inside a `.mkbundle` of format 1. */
export const OLDER_BUNDLE_KIT_PATH = 'tool/tool.json';

/**
 * The field that names the Kit in a model manifest, a `.mkmodel` file, a bundle and a Kit
 * package (`ModelManifest.kit`, `MkModelFile.kit`, `BundleManifest.kit`, `KitPackageInfo.kit`).
 * Files of the previous format call it `tool`.
 */
export const MODEL_KIT_FIELD = 'kit';

/** The field of a model manifest that holds the version of its Kit; `toolVersion` before the rename. */
export const MODEL_KIT_VERSION_FIELD = 'kitVersion';
