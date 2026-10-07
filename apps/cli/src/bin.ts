import { run } from './index';

process.exitCode = await run(process.argv.slice(2), {
  out: (text) => console.log(text),
  err: (text) => console.error(text),
});
