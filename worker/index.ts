import { handleApi } from "./api";
import { runIngestion } from "./ingest";
import { londonHour, shouldRunScheduledIngestion } from "./schedule";
import type { Env } from "./types";

export default {
  async fetch(request, env): Promise<Response> {
    const apiResponse = await handleApi(request, env);
    if (apiResponse) return apiResponse;
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env): Promise<void> {
    const ukHour = londonHour(controller.scheduledTime);

    console.log("MC Predict scheduled trigger", {
      scheduledTime: new Date(controller.scheduledTime).toISOString(),
      ukHour,
      cron: controller.cron
    });

    if (!shouldRunScheduledIngestion(controller.scheduledTime)) {
      console.log("MC Predict scheduled trigger ignored outside intended UK hours", { ukHour });
      return;
    }

    await runIngestion(env, "scheduled", ukHour);
  }
} satisfies ExportedHandler<Env>;
