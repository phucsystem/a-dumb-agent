// Tool definitions for the agent graph.
// Add tools here — the graph auto-registers them.
//
// Example:
// import { tool } from "@langchain/core/tools";
// import { z } from "zod";
//
// const getCurrentTime = tool(
//   async () => new Date().toISOString(),
//   {
//     name: "get_current_time",
//     description: "Get the current date and time",
//     schema: z.object({}),
//   }
// );

import type { StructuredToolInterface } from "@langchain/core/tools";

export const tools: StructuredToolInterface[] = [];
