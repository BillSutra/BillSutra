import { cn } from "@/lib/utils";

type FloatingInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
  min?: string;
  max?: string;
  step?: string;
};

const FloatingInput = ({
  id,
  label,
  value,
  onChange,
  type = "text",
  className,
  min,
  max,
  step,
}: FloatingInputProps) => {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type={type}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className="app-field peer h-11 w-full rounded-xl px-3 pt-5 pb-1 text-sm text-foreground caret-foreground transition-colors focus:outline-none focus-visible:border-ring focus-visible:ring-ring/45 focus-visible:ring-[3px]"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 bg-transparent px-1 text-sm text-muted-foreground transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-primary peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs"
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingInput;
