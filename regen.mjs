import { Generator, getConfig } from "@tanstack/router-generator";
import { resolve } from "node:path";
const config = await getConfig({
  routesDirectory: resolve("./src/routes"),
  generatedRouteTree: resolve("./src/routeTree.gen.ts"),
});
const gen = new Generator({ config, root: process.cwd() });
await gen.run();
console.log("done");
