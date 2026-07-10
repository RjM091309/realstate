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
  borderless?: boolean;
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
  leftIcon,
  borderless = true
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
              '!min-h-10 !rounded-xl !cursor-pointer !shadow-sm',
              '!bg-white dark:!bg-slate-950',
              borderless
                ? '!border !border-transparent hover:!border-transparent dark:!border-transparent'
                : '!unit-form-select-control !border !border-slate-300 dark:!border-slate-600',
              state.isFocused
                ? borderless
                  ? '!border-transparent !ring-2 !ring-indigo-500/25'
                  : '!unit-form-select-control !border-indigo-500 !ring-2 !ring-indigo-500/25'
                : '!ring-0',
              disabled ? '!opacity-60 !cursor-not-allowed' : undefined,
            ),
          placeholder: () => '!text-slate-500/80 dark:!text-slate-300/70 !text-sm',
          input: () => '!text-slate-900 dark:!text-slate-50 !text-sm',
          singleValue: () => '!text-slate-900 dark:!text-slate-50 !text-sm',
          menu: () =>
            cn(
              '!rounded-xl !mt-1.5 !overflow-hidden !shadow-lg',
              '!border !border-transparent !bg-white dark:!bg-slate-950',
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
          valueContainer: () => '!px-3 !py-1',
          indicatorsContainer: () => '!pr-1.5',
          clearIndicator: () =>
            '!px-1 !py-2 !text-slate-500 hover:!text-rose-600 dark:!text-slate-400',
          dropdownIndicator: () =>
            '!px-1.5 !py-2 !text-slate-500 dark:!text-slate-400',
        }}
        menuPortalTarget={document.body}
        styles={{
          control: (base) => ({
            ...base,
            // Border + colors come from classNames (Tailwind); avoid transparent override.
            boxShadow: 'none',
          }),
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
          valueContainer: (base) => ({
            ...base,
            flexWrap: 'nowrap',
            overflow: 'hidden',
          }),
          singleValue: (base) => ({
            ...base,
            position: 'relative',
            top: 'auto',
            transform: 'none',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            lineHeight: 1.25,
          }),
        }}
        // Custom prop consumed by Control / SingleValue (not a react-select standard prop)
        // @ts-expect-error — forwarded via selectProps
        leftIcon={leftIcon}
      />
    </div>
  );
};
