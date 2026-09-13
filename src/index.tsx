import type { PluginAPI } from "@voltius/plugin-types";
import { createPanel } from "./Panel";

export default function register(api: PluginAPI): () => void {
  const disposePanel = api.ui.registerRightPanelSection({
    id: "my-panel",
    // A function label is re-resolved when the user changes language.
    label: () => "My Plugin",
    icon: "lucide:puzzle",
    component: createPanel(api),
  });

  // Return everything that must not outlive a disable or an uninstall.
  return () => {
    disposePanel();
  };
}
