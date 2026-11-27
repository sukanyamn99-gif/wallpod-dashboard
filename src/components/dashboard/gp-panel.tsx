import { cn } from "@/lib/utils";

// Not a client component on purpose: the page (a server component) hands it an
// icon, which could not cross into a client component as a prop.
export function GpPanel({
  title,
  icon: Icon,
  action,
  className,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("gp-glass p-4", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-white">
          <Icon className="h-5 w-5 text-sky-300" />
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
