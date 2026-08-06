import {
  loadFunctionalUatBrowserEnvironment,
  removeFunctionalUatBrowserTransientOutput,
} from "./functional-uat-environment";

export default async function teardownFunctionalUatBrowser(): Promise<void> {
  await removeFunctionalUatBrowserTransientOutput(loadFunctionalUatBrowserEnvironment());
}
