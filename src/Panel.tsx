import { useEffect, useState } from "react";
import { Icon } from "@voltius/ui";
import type { PluginAPI } from "@voltius/plugin-types";

/** The api instance is passed in rather than imported — plugins never reach for globals. */
export function createPanel(api: PluginAPI) {
  return function Panel() {
    const [greeting, setGreeting] = useState("Hello");

    useEffect(() => {
      // Declared in manifest.json under contributes.configuration, so the host
      // renders its settings form for you and stores the value.
      void api.storage.get<string>("greeting").then((v) => v && setGreeting(v));
    }, []);

    return (
      <div className="p-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Icon icon="lucide:puzzle" width={16} />
          <span className="text-sm font-medium">{greeting} from your plugin</span>
        </div>
        <p className="text-xs opacity-70">
          Edit <code>src/Panel.tsx</code> and rebuild to see this change.
        </p>
      </div>
    );
  };
}
