import { defineSchedule } from "@opencomputer/agent";

export default defineSchedule({
  id: "morning-check",
  cron: "0 9 * * 1-5",
  timezone: "Europe/London",
  enabled: ["production"],
  overlap: "skip",
  dispatch: {
    text: "Follow our published SDK quickstart in a clean project. If it fails, propose a verified documentation fix.",
    payload: {
      mode: "quickstart-check",
      repository: "diggerhq/opencomputer-example-quickstart-check",
      base: "main",
      guide: "docs/quickstart.md",
    },
  },
});
