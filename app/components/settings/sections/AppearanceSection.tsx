"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import SettingsCard from "../common/SettingsCard";
import SettingsRow from "../common/SettingsRow";

import { useTheme } from "../../ThemeProvider";

export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  const options = [
    {
      value: "system" as const,
      title: "Auto (Time of Day)",
      description: "Light during the day, dark at night — switches automatically.",
      icon: <Monitor size={20} />,
    },
    {
      value: "light" as const,
      title: "Light Mode",
      description: "Bright appearance for daytime viewing.",
      icon: <Sun size={20} />,
    },
    {
      value: "dark" as const,
      title: "Dark Mode",
      description: "Comfortable viewing in low-light environments.",
      icon: <Moon size={20} />,
    },
  ];

  return (
    <SettingsCard
      icon={<Monitor size={24} />}
      title="Appearance"
      description="Customize how InPlayer looks across all your devices."
    >
      <div className="space-y-2">
        {options.map((option) => (
          <SettingsRow
            key={option.value}
            icon={option.icon}
            title={option.title}
            description={option.description}
            active={theme === option.value}
            value={theme === option.value ? "Active" : undefined}
            onClick={() => setTheme(option.value)}
          />
        ))}
      </div>
    </SettingsCard>
  );
}