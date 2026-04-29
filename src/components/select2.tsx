import React from 'react';
import { useTranslation } from 'react-i18next';
import Select, { components, ControlProps, SingleValueProps } from 'react-select';
import { cn } from '@/lib/utils';

interface Option {
  value: string | number;
  label: string;
}

interface Select2Props {
  options: Option[];
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
}

const Control = ({ children, ...props }: ControlProps<Option, false>) => {
  const { leftIcon } = (props.selectProps as { leftIcon?: React.ReactNode });
  return (
    <components.Control {...props}>
      {leftIcon && (
        <div className="pl-4 text-gray-400 shrink-0">
          {leftIcon}
        </div>
      )}
      {children}
    </components.Control>
  );
};

const SingleValue = ({ children, ...props }: SingleValueProps<Option, false>) => {
  const { leftIcon } = (props.selectProps as { leftIcon?: React.ReactNode });
  return (
    <components.SingleValue {...props}>
      <div className={cn("flex items-center", leftIcon && "ml-1")}>
        {children}
      </div>
    </components.SingleValue>
  );
};

export const Select2: React.FC<Select2Props> = ({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
  leftIcon
}) => {
  const { t } = useTranslation();
  const selectedOption = options.find(opt => opt.value === value) || null;

  return (
    <div className={cn("w-full", className)}>
      <Select
        value={selectedOption}
        onChange={(opt) => onChange(opt ? opt.value : null)}
        options={options}
        placeholder={placeholder || t('common.select_placeholder')}
        isDisabled={disabled}
        isClearable
        isSearchable
        components={{
          Control,
          SingleValue
        }}
        classNames={{
          control: (state) =>
            cn(
              '!min-h-[48px] !rounded-xl !shadow-none !cursor-pointer',
              '!bg-white/55 dark:!bg-slate-950/45',
              'supports-[backdrop-filter]:!backdrop-blur-xl',
              '!border !border-white/30 dark:!border-white/10',
              state.isFocused ? '!ring-2 !ring-indigo-500/25' : '!ring-0',
              disabled ? '!opacity-60 !cursor-not-allowed' : undefined,
            ),
          placeholder: () => '!text-slate-500/80 dark:!text-slate-300/70 !text-sm',
          input: () => '!text-slate-900 dark:!text-slate-50 !text-sm',
          singleValue: () => '!text-slate-900 dark:!text-slate-50 !text-sm',
          menu: () =>
            cn(
              '!rounded-xl !mt-2 !overflow-hidden',
              '!bg-white/75 dark:!bg-slate-950/65',
              'supports-[backdrop-filter]:!backdrop-blur-xl',
              '!border !border-white/30 dark:!border-white/10',
              '!shadow-[0_18px_45px_-18px_rgba(0,0,0,0.45)] !ring-1 !ring-black/5 dark:!ring-white/10',
            ),
          menuList: () => '!py-1',
          option: ({ isSelected, isFocused }) => cn(
            '!py-2.5 !px-4 !text-sm !cursor-pointer !transition-colors',
            isSelected
              ? '!bg-indigo-500/15 !text-indigo-700 dark:!text-indigo-200 !font-bold'
              : isFocused
                ? '!bg-indigo-500/10 !text-slate-900 dark:!text-slate-50'
                : '!text-slate-900 dark:!text-slate-50'
          ),
          valueContainer: () => '!px-2',
          clearIndicator: () => '!text-slate-500 hover:!text-rose-500 dark:!text-slate-300 !p-1',
          dropdownIndicator: () => '!text-slate-500 dark:!text-slate-300 !p-1',
        }}
        menuPortalTarget={document.body}
        styles={{
          control: (base, state) => ({
            ...base,
            // Keep border + focus effects controlled by classNames (Tailwind).
            borderColor: 'transparent',
            boxShadow: 'none',
          }),
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
        // Custom prop consumed by Control / SingleValue (not a react-select standard prop)
        // @ts-expect-error — forwarded via selectProps
        leftIcon={leftIcon}
      />
    </div>
  );
};
