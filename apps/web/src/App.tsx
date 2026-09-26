import { useState } from "react";
import AppShell from "./shell/AppShell";
import { BOTTOM_NAV, PRIMARY_NAV } from "./shell/nav";

const LABELS: Record<string, string> = Object.fromEntries(
  [...PRIMARY_NAV, ...BOTTOM_NAV].map((item) => [item.id, item.label]),
);

export default function App() {
  const [active, setActive] = useState("chat");

  return (
    <AppShell
      active={active}
      onNavigate={setActive}
      title={LABELS[active] ?? "24H"}
      version="v0.1.0"
    />
  );
}
