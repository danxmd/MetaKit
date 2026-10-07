// Runs ELK off the main thread. The minified worker script from elkjs installs its own message
// handler (the elk-api protocol), so this file only has to load it; `LayoutService` speaks that
// protocol from the other side.
import 'elkjs/lib/elk-worker.min.js';
