import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, forwardRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
}

const variantCls: Record<Variant, string> = {
  primary: 'bg-fg text-bg hover:opacity-90 active:opacity-80',
  secondary: 'bg-elev text-fg border border-line hover:border-line-strong',
  ghost: 'text-fg-2 hover:text-fg hover:bg-elev',
  danger: 'text-danger hover:bg-elev'
}
const sizeCls = { sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg', md: 'h-10 px-4 text-[14px] gap-2 rounded-xl', lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl' }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      className={cx('no-drag inline-flex items-center justify-center font-medium transition-[opacity,background-color,border-color] duration-150 disabled:opacity-40 disabled:pointer-events-none select-none', variantCls[variant], sizeCls[size], className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
})

export function IconButton({ className, children, label, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }): JSX.Element {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx('no-drag inline-flex size-9 items-center justify-center rounded-lg text-fg-2 transition-colors duration-150 hover:bg-elev hover:text-fg disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx('h-11 w-full rounded-xl border border-line bg-bg px-4 text-[15px] transition-colors duration-150 hover:border-line-strong focus:border-line-strong', className)}
      {...rest}
    />
  )
})

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }): JSX.Element {
  return (
    <label className="block">
      <div className="mb-2 text-[13px] font-medium text-fg-2">{label}</div>
      {children}
      {hint && <div className="mt-2 text-[12px] leading-relaxed text-fg-3">{hint}</div>}
    </label>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }): JSX.Element {
  return <div className={cx('rounded-2xl border border-line bg-bg p-6', className)}>{children}</div>
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }): JSX.Element {
  return (
    <div className="mb-4 flex items-baseline justify-between">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-fg-3">{children}</h2>
      {aside}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }): JSX.Element {
  return (
    <div className={cx('inline-flex rounded-xl bg-elev p-1', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('no-drag h-8 rounded-lg px-3.5 text-[13px] font-medium transition-colors duration-150', value === o.value ? 'bg-bg text-fg shadow-sm' : 'text-fg-2 hover:text-fg')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }): JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('no-drag relative h-7 w-12 rounded-full transition-colors duration-200', checked ? 'bg-fg' : 'bg-line-strong')}
    >
      <span className={cx('absolute top-0.5 size-6 rounded-full bg-bg shadow-sm transition-transform duration-200', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  )
}

export function Choice({ selected, title, desc, onClick, right }: { selected: boolean; title: string; desc?: string; onClick: () => void; right?: ReactNode }): JSX.Element {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cx('no-drag flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors duration-150', selected ? 'border-fg' : 'border-line hover:border-line-strong')}
    >
      <span className={cx('size-4 shrink-0 rounded-full border-[5px] transition-colors', selected ? 'border-fg' : 'border-line-strong bg-transparent')} />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{title}</span>
        {desc && <span className="mt-0.5 block text-[13px] text-fg-2">{desc}</span>}
      </span>
      {right}
    </button>
  )
}

export function Sheet({ open, onClose, children, width = 560 }: { open: boolean; onClose: () => void; children: ReactNode; width?: number }): JSX.Element {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative max-h-[85vh] w-full overflow-auto rounded-3xl border border-line bg-bg p-8 shadow-[var(--shadow)]"
            style={{ maxWidth: width }}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Spinner({ className }: { className?: string }): JSX.Element {
  return <span className={cx('inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-fg', className)} />
}

export function ErrorText({ children }: { children: ReactNode }): JSX.Element | null {
  if (!children) return null
  return <div className="text-[13px] text-danger">{children}</div>
}
