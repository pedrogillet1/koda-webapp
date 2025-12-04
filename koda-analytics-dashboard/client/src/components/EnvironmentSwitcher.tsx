import { useEnvironment } from "@/contexts/EnvironmentContext";
import { getAllEnvironments } from "@/lib/environments";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function EnvironmentSwitcher() {
  const { currentEnvironment, switchEnvironment } = useEnvironment();
  const environments = getAllEnvironments();

  return (
    <Select
      value={currentEnvironment.id}
      onValueChange={switchEnvironment}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue>
          <div className="flex items-center gap-2">
            <span>{currentEnvironment.icon}</span>
            <span>{currentEnvironment.name}</span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {environments.map((env) => (
          <SelectItem key={env.id} value={env.id}>
            <div className="flex items-center gap-2">
              <span>{env.icon}</span>
              <div className="flex flex-col">
                <span className="font-medium">{env.name}</span>
                <span className="text-xs text-muted-foreground">
                  {env.description}
                </span>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
