/**
 * The names a Kit has in stored and exchanged files. They still say "tool" because changing a
 * stored name needs a format version bump, a migration and a test (rule 8). The kit-rename change
 * changes them here in its third pull request, together with the migrations that keep reading the
 * old names; until then every value is the one earlier releases wrote.
 */

/** The workspace folder that holds the Kits, one subfolder each: `tools/<slug>/`. */
export const KIT_FOLDER = 'tools';

/** The identity file of a Kit folder in a workspace. */
export const KIT_IDENTITY_FILE = 'tool.json';

/** The document kind of a Kit, written in identity files, snapshots and presence. */
export const KIT_KIND = 'tool';

/** The Kit document in a Git repository (or in the folder of one that the link names). */
export const GIT_KIT_FILE = 'tool.json';

/** The extension of a Kit package. */
export const KIT_PACKAGE_EXTENSION = '.mktool';

/** The `kind` in the `package.json` of a Kit package. */
export const KIT_PACKAGE_KIND = 'mktool';

/** The Kit document inside a Kit package. */
export const KIT_PACKAGE_FILE = 'tool.json';

/** The Kit document inside a `.mkbundle`. */
export const BUNDLE_KIT_PATH = 'tool/tool.json';

/**
 * The field that names the Kit in a model manifest, a `.mkmodel` file, a bundle and a Kit
 * package (`ModelManifest.tool`, `MkModelFile.tool`, `BundleManifest.tool`, `KitPackageInfo.tool`).
 */
export const MODEL_KIT_FIELD = 'tool';

/** The field of a model manifest that holds the version of its Kit. */
export const MODEL_KIT_VERSION_FIELD = 'toolVersion';
