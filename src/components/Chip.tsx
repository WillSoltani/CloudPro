type Props = {
    children: string;
  };
  
  export function Chip({ children }: Props) {
    return (
      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
        {children}
      </span>
    );
  }
  