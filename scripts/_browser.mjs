// Every Playwright browser the scripts open goes through here, so none is
// left behind:
//
//   launch(type, options)  headless unless the command line has --headed
//                          (whatever `headless` the options say)
//   session(main)          runs main(); in its finally every browser
//                          launch() opened is closed, whether main returned,
//                          threw (a failed check, a timeout) or the run was
//                          interrupted (Ctrl+C, SIGTERM). Then exits with
//                          main's return value (a thrown error exits 1).
//
// Inside session(), `return code` instead of process.exit(code): exiting
// there would skip the finally.
//
// node scripts/strays.mjs lists any browser a run left anyway; --kill closes them.

export const HEADED = process.argv.includes("--headed");

const open = new Set();

export async function launch(type, options = {}) {
  const browser = await type.launch({ ...options, headless: !HEADED });
  open.add(browser);
  browser.once("disconnected", () => open.delete(browser));
  return browser;
}

const closeAll = () => Promise.allSettled([...open].map((b) => b.close()));

let interrupted = null;
for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) {
  process.once(signal, () => {
    interrupted ??= closeAll().then(() => process.exit(130));
  });
}

export async function session(main) {
  let code = 1;
  try {
    code = (await main()) ?? 0;
  } catch (e) {
    console.error(e);
  } finally {
    await closeAll();
  }
  process.exit(code);
}
