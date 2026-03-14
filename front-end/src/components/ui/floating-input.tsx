import { cn } from "@/lib/utils";

type FloatingInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  className?: string;
};

const FloatingInput = ({
  id,
  label,
  value,
  onChange,
  type = "text",
  className,
}: FloatingInputProps) => {
  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder=" "
        className="peer h-11 w-full rounded-xl border border-gray-200 bg-white px-3 pt-5 pb-1 text-sm shadow-sm transition-colors focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-gray-700 dark:bg-gray-800 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
      />
      <label
        htmlFor={id}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 bg-transparent px-1 text-sm text-gray-500 transition-all peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-sm peer-focus:top-2 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:text-indigo-600 peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-xs dark:text-gray-400 dark:peer-focus:text-indigo-300"
      >
        {label}
      </label>
    </div>
  );
};

export default FloatingInput;
