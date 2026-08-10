// Runs a few sanity checks and writes a short, clean summary to
// diagnose-output.txt in the app root — meant for hosts (like cPanel's
// "Run JS script" UI) where reading long stderr output in the browser is
// impractical. Deleted once deployment is working; not part of the app.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const results = [];

function run(label, cmd) {
  try {
    const output = execSync(cmd, { encoding: "utf8", cwd: process.cwd() });
    results.push(`=== ${label}: OK ===\n${output.slice(0, 1500)}`);
  } catch (error) {
    results.push(
      `=== ${label}: FAILED ===\n` +
        `message: ${error.message}\n\n` +
        `stdout:\n${(error.stdout || "").toString().slice(0, 2500)}\n\n` +
        `stderr:\n${(error.stderr || "").toString().slice(0, 2500)}`
    );
  }
}

run("node --version", "node --version");
run("npm --version", "npm --version");
run("prisma --version", "npx prisma --version");
run("prisma generate", "npx prisma generate");

writeFileSync("diagnose-output.txt", results.join("\n\n---\n\n"));
console.log("Wrote diagnose-output.txt");
