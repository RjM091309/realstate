import React, { useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Box, Button, Popover, Typography, Slide } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { PickersDay } from '@mui/x-date-pickers/PickersDay';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const CALENDAR_COLORS = {
  panelBg: '#ffffff',
  panelBorder: '#e2e8f0',
  surfaceSoft: '#f8fafc',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  accent: '#334155',
  accentHover: '#1e293b',
  rangeFill: '#e2e8f0',
  rangeFillHover: '#cbd5e1',
  selectedText: '#f8fafc',
};

function formatRange(value: [Date | null, Date | null], placeholder: string = 'Enter Date') {
  const [start, end] = value;
  if (!start && !end) return placeholder;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start && !end) return `${fmt(start)} –`;
  return '–– – ––';
}

type RangeDayProps = {
  isRangeMiddle?: boolean;
  isRangeStart?: boolean;
  isRangeEnd?: boolean;
};

const RangePickersDay = styled(PickersDay, {
  shouldForwardProp: (prop) =>
    prop !== 'isRangeMiddle' && prop !== 'isRangeStart' && prop !== 'isRangeEnd',
})<RangeDayProps>(({ theme, isRangeMiddle, isRangeStart, isRangeEnd }) => {
  const stripBg = theme.palette.mode === 'dark' ? alpha('#94a3b8', 0.34) : CALENDAR_COLORS.rangeFill;
  const stripText = theme.palette.mode === 'dark' ? '#e2e8f0' : CALENDAR_COLORS.textPrimary;
  const selectedBg = theme.palette.mode === 'dark' ? '#e2e8f0' : CALENDAR_COLORS.accent;
  const selectedText = theme.palette.mode === 'dark' ? '#0f172a' : CALENDAR_COLORS.selectedText;

  return {
    ...(isRangeMiddle && {
      borderRadius: 0,
      backgroundColor: stripBg,
      color: stripText,
      fontWeight: 600,
      '&:hover, &:focus': {
        backgroundColor:
          theme.palette.mode === 'dark' ? alpha('#94a3b8', 0.48) : CALENDAR_COLORS.rangeFillHover,
      },
    }),
    ...((isRangeStart || isRangeEnd) && {
      zIndex: 1,
      backgroundColor: selectedBg,
      color: selectedText,
      fontWeight: 700,
      borderRadius: '50%',
      '&:hover, &:focus': {
        backgroundColor: theme.palette.mode === 'dark' ? '#cbd5e1' : CALENDAR_COLORS.accentHover,
      },
    }),
  };
});

function stripTime(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

function isBetweenInclusive(day: Date, start: Date, end: Date) {
  const t = day.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function getRelativeRange(days: number): [Date, Date] {
  const end = stripTime(new Date());
  const start = new Date(end);
  start.setDate(end.getDate() - (days - 1));
  return [start, end];
}

function getTodayRange(): [Date, Date] {
  const today = stripTime(new Date());
  return [today, today];
}

function getYesterdayRange(): [Date, Date] {
  const day = stripTime(new Date());
  day.setDate(day.getDate() - 1);
  return [day, day];
}

function getMonthRange(offsetMonths: number): [Date, Date] {
  const now = stripTime(new Date());
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 0);
  return [start, end];
}

type PresetKey =
  | 'today'
  | 'yesterday'
  | 'last7'
  | 'last30'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

function sameRange(a: [Date | null, Date | null], b: [Date, Date]) {
  const [as, ae] = a;
  return Boolean(as && ae && isSameDay(as, b[0]) && isSameDay(ae, b[1]));
}

function detectPreset(range: [Date | null, Date | null]): PresetKey {
  if (sameRange(range, getTodayRange())) return 'today';
  if (sameRange(range, getYesterdayRange())) return 'yesterday';
  if (sameRange(range, getRelativeRange(7))) return 'last7';
  if (sameRange(range, getRelativeRange(30))) return 'last30';
  if (sameRange(range, getMonthRange(0))) return 'thisMonth';
  if (sameRange(range, getMonthRange(-1))) return 'lastMonth';
  return 'custom';
}

export function DatePicker({
  value,
  onChange,
  compact = false,
  showPresets = false,
  mode = 'range',
  placeholder = 'Enter Date',
  fullWidth = false,
  inputClassName = '',
}: {
  value: any;
  onChange: (next: any) => void;
  compact?: boolean;
  showPresets?: boolean;
  mode?: 'single' | 'range';
  placeholder?: string;
  fullWidth?: boolean;
  inputClassName?: string;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  let rangeText = '';
  let start: Date | null = null;
  let end: Date | null = null;
  let isEmpty = true;
  let selectedPreset: PresetKey | null = null;

  if (mode === 'single') {
    isEmpty = !value;
    rangeText = value ? value.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : placeholder;
  } else {
    rangeText = formatRange(value, placeholder);
    [start, end] = value || [null, null];
    isEmpty = !start && !end;
    selectedPreset = detectPreset(value || [null, null]);
  }
  const presets: { key: PresetKey; label: string; range?: [Date, Date] }[] = [
    { key: 'today', label: 'Today', range: getTodayRange() },
    { key: 'yesterday', label: 'Yesterday', range: getYesterdayRange() },
    { key: 'last7', label: 'Last 7 Days', range: getRelativeRange(7) },
    { key: 'last30', label: 'Last 30 Days', range: getRelativeRange(30) },
    { key: 'thisMonth', label: 'This Month', range: getMonthRange(0) },
    { key: 'lastMonth', label: 'Last Month', range: getMonthRange(-1) },
    { key: 'custom', label: 'Custom range' },
  ];

  return (
    <>
      {compact ? (
        <motion.button
          type="button"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          aria-label="Open date range picker"
          whileHover={{ scale: 1.08, y: -1 }}
          whileTap={{ scale: 0.9 }}
          animate={open ? { scale: 1.05 } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 480, damping: 20 }}
          className="h-9 w-9 inline-flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] transition-colors shrink-0"
          style={{
            backgroundColor: 'color-mix(in oklab, var(--control-bg) 88%, transparent)',
          }}
        >
          <motion.span
            animate={open ? { rotateY: 180 } : { rotateY: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{ display: 'inline-flex', transformStyle: 'preserve-3d' }}
          >
            <CalendarDays size={16} />
          </motion.span>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: -8, scale: 0.96 }}
          animate={
            open
              ? { opacity: 1, y: 0, scale: [1, 0.96, 1.03, 1] }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={
            open
              ? { duration: 0.42, times: [0, 0.25, 0.6, 1], ease: 'easeOut' }
              : { type: 'spring', stiffness: 380, damping: 22 }
          }
          whileHover={!open ? { y: -2, scale: 1.015 } : undefined}
          className={cn(
            'relative group w-full',
            fullWidth ? '' : 'sm:w-36 md:w-44 lg:w-64 xl:w-72 max-w-[170px] lg:max-w-none',
          )}
        >
          {/* Expanding ripple rings on click/open */}
          <AnimatePresence>
            {open && (
              <>
                {[0, 1].map((i) => (
                  <motion.span
                    key={`ripple-${i}`}
                    aria-hidden
                    initial={{ opacity: 0.55, scale: 0.85 }}
                    animate={{ opacity: 0, scale: 1.45 + i * 0.2 }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.7,
                      delay: i * 0.12,
                      ease: 'easeOut',
                    }}
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-brand-blue/50 dark:border-sky-400/40"
                  />
                ))}
              </>
            )}
          </AnimatePresence>

          <motion.div
            variants={{
              rest: {},
              hover: {},
              open: {},
            }}
            initial="rest"
            animate={open ? 'open' : 'rest'}
            whileHover="hover"
            className="relative"
          >
            {/* Shimmer sweep — hover only */}
            <motion.span
              aria-hidden
              variants={{
                rest: { opacity: 0, x: '-30%' },
                hover: {
                  opacity: [0, 1, 0],
                  x: ['-30%', '120%'],
                  transition: { duration: 0.7, ease: 'easeInOut' },
                },
                open: { opacity: 0 },
              }}
              className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/60 to-transparent dark:via-white/20"
            />

            <span className="pointer-events-none absolute left-3 top-1/2 z-[2] -translate-y-1/2 text-[var(--text-muted)] group-focus-within:text-brand-blue">
              <motion.span
                aria-hidden
                variants={{
                  rest: { rotateY: 0, scale: 1 },
                  hover: { scale: 1.1, transition: { duration: 0.25 } },
                  open: {
                    rotateY: [0, 180],
                    scale: [1, 1.15, 1],
                    transition: { duration: 0.5, ease: 'easeInOut' },
                  },
                }}
                className="inline-flex"
                style={{ transformStyle: 'preserve-3d' }}
              >
                <CalendarDays size={14} />
              </motion.span>
            </span>

            <input
              type="text"
              readOnly
              value={isEmpty ? '' : rangeText}
              placeholder={placeholder}
              aria-label="Date range"
              aria-expanded={open}
              onClick={(e) => setAnchorEl(e.currentTarget)}
              className={cn(
                'relative z-0 h-9 w-full cursor-pointer rounded-full border pl-9 pr-8 text-xs transition-[border-color,box-shadow,background-color] duration-300',
                'border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)]',
                'hover:border-brand-blue/40 focus:border-brand-blue/50 focus:outline-none focus:ring-2 focus:ring-brand-blue/25',
                open &&
                  'border-brand-blue bg-brand-blue/[0.06] shadow-[inset_0_2px_8px_rgba(75,137,205,0.18)] ring-0 dark:bg-brand-blue/10',
                inputClassName,
              )}
              style={{
                backgroundColor: open
                  ? undefined
                  : 'color-mix(in oklab, var(--control-bg) 70%, transparent)',
                borderColor: open
                  ? undefined
                  : 'color-mix(in oklab, var(--border) 88%, #cbd5e1)',
                opacity: isEmpty ? 0.72 : 1,
                whiteSpace: 'nowrap',
              }}
            />

            <span className="pointer-events-none absolute right-2.5 top-1/2 z-[2] -translate-y-1/2">
              <motion.span
                aria-hidden
                animate={open ? { rotate: 180 } : { rotate: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className={cn(
                  'inline-flex text-slate-400 transition-colors',
                  open && 'text-brand-blue',
                )}
              >
                <ChevronDown size={14} />
              </motion.span>
            </span>
          </motion.div>
        </motion.div>
      )}

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        TransitionComponent={Slide}
        TransitionProps={{ direction: 'down' } as React.ComponentProps<typeof Slide>}
        transitionDuration={{ enter: 280, exit: 180 }}
        slotProps={{
          paper: {
            sx: {
              overflow: 'hidden',
              borderRadius: 2.5,
              border: `1px solid ${CALENDAR_COLORS.panelBorder}`,
              backgroundColor: CALENDAR_COLORS.panelBg,
              boxShadow: '0 22px 48px -12px rgba(15, 23, 42, 0.28), 0 8px 20px -10px rgba(75, 137, 205, 0.25)',
              width: { xs: 'calc(100vw - 12px)', sm: 'max-content' },
              maxWidth: 'calc(100vw - 16px)',
              maxHeight: { xs: 'min(88vh, 640px)', sm: 'none' },
              mt: 1,
            },
          },
        }}
      >
        <Box
          sx={(t) => ({
            px: { xs: 1, sm: 1.25 },
            pt: { xs: 0.75, sm: 1 },
            pb: { xs: 0.5, sm: 0.75 },
            bgcolor: t.palette.mode === 'dark' ? '#0f172a' : CALENDAR_COLORS.surfaceSoft,
            color: t.palette.mode === 'dark' ? '#f8fafc' : CALENDAR_COLORS.textPrimary,
            borderBottom: `1px solid ${CALENDAR_COLORS.panelBorder}`,
          })}
        >
          <Typography
            variant="overline"
            sx={{
              opacity: 1,
              letterSpacing: '0.1em',
              fontWeight: 700,
              lineHeight: 1.2,
              fontSize: { xs: 10, sm: 11 },
              color: CALENDAR_COLORS.textSecondary,
            }}
          >
            {mode === 'single' ? 'SELECTED DATE' : 'SELECTED RANGE'}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 600,
              mt: 0.25,
              lineHeight: 1.35,
              fontSize: { xs: '1rem', sm: '1.3rem' },
            }}
          >
            {rangeText}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: showPresets ? { xs: '1fr', sm: '128px max-content' } : 'max-content',
            minHeight: { xs: 'auto', sm: 'auto' },
            maxHeight: { xs: 'calc(88vh - 160px)', sm: 'none' },
            overflowY: { xs: 'auto', sm: 'visible' },
          }}
        >
          {showPresets ? (
            <Box
              sx={{
                p: 0.75,
                borderRight: {
                  xs: 'none',
                  sm: `1px solid ${CALENDAR_COLORS.panelBorder}`,
                },
                borderBottom: {
                  xs: `1px solid ${CALENDAR_COLORS.panelBorder}`,
                  sm: 'none',
                },
                display: 'flex',
                flexDirection: { xs: 'row', sm: 'column' },
                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                gap: 0.5,
              }}
            >
              {presets.map((preset) => {
                const active = selectedPreset === preset.key;
                return (
                  <Button
                    key={preset.key}
                    size="small"
                    variant={active ? 'contained' : 'text'}
                    onClick={() => {
                      if (preset.range) onChange(preset.range);
                    }}
                    sx={{
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      px: 1.2,
                      py: 0.7,
                      borderRadius: 0.5,
                      minHeight: 34,
                      fontSize: 13,
                      flex: { xs: '1 1 calc(50% - 4px)', sm: 'initial' },
                      minWidth: 0,
                      color: active ? CALENDAR_COLORS.selectedText : CALENDAR_COLORS.textSecondary,
                      backgroundColor: active ? CALENDAR_COLORS.accent : 'transparent',
                      '&:hover': {
                        backgroundColor: active ? CALENDAR_COLORS.accentHover : CALENDAR_COLORS.surfaceSoft,
                      },
                    }}
                  >
                    {preset.label}
                  </Button>
                );
              })}
            </Box>
          ) : null}

          <DateCalendar
            value={mode === 'single' ? value : start}
            onChange={(picked) => {
              if (!picked) return;
              const day = stripTime(picked);

              if (mode === 'single') {
                onChange(day);
                setAnchorEl(null);
                return;
              }

              if (!start || (start && end)) {
                onChange([day, null]);
                return;
              }

              const s = stripTime(start);
              if (day.getTime() < s.getTime()) {
                onChange([day, null]);
                return;
              }
              onChange([s, day]);
            }}
            sx={{
              width: { xs: '100%', sm: 'max-content' },
              maxWidth: '100%',
              mx: { xs: 'auto', sm: 0 },
              // Trim chrome only — day cell px & font sizes stay the same
              '& .MuiDateCalendar-root': { p: 0, margin: 0, width: 'max-content', maxWidth: '100%' },
              '& .MuiPickersCalendarHeader-root': {
                pl: { xs: 0.5, sm: 0.75 },
                pr: { xs: 0.5, sm: 0.75 },
                pt: 0,
                pb: 0.25,
                margin: 0,
                minHeight: 0,
              },
              '& .MuiPickersCalendarHeader-label': { fontSize: { xs: '1.1rem', sm: '1.25rem' }, fontWeight: 600 },
              '& .MuiPickersCalendarHeader-label, & .MuiDayCalendar-weekDayLabel': {
                color: CALENDAR_COLORS.textSecondary,
              },
              '& .MuiIconButton-root': {
                color: CALENDAR_COLORS.textSecondary,
                '&:hover': { backgroundColor: CALENDAR_COLORS.surfaceSoft },
              },
              '& .MuiDayCalendar-header': { px: { xs: 0.25, sm: 0.5 }, marginTop: 0 },
              '& .MuiDayCalendar-weekContainer': { mx: { xs: 0, sm: 0 } },
              '& .MuiDayCalendar-slideTransition': { marginTop: 0 },
              '& .MuiDayCalendar-weekDayLabel': {
                width: { xs: 32, sm: 36 },
                fontSize: { xs: 11, sm: 12 },
              },
              '& .MuiPickersDay-root': {
                width: { xs: 32, sm: 36 },
                height: { xs: 32, sm: 36 },
                fontSize: { xs: 13, sm: 14 },
                color: CALENDAR_COLORS.textPrimary,
                '&:hover': { backgroundColor: CALENDAR_COLORS.surfaceSoft },
              },
            }}
            slots={
              mode === 'single'
                ? undefined
                : {
                    day: (dayProps) => {
                      const day = stripTime(dayProps.day as Date);
                      const s = start ? stripTime(start) : null;
                      const e = end ? stripTime(end) : null;

                      const inSpan = Boolean(s && e && isBetweenInclusive(day, s, e));
                      const isStart = Boolean(s && isSameDay(day, s));
                      const isEnd = Boolean(e && isSameDay(day, e));
                      const isRangeMiddle = Boolean(inSpan && !isStart && !isEnd);
                      const selected = Boolean(isStart || isEnd);

                      return (
                        <RangePickersDay
                          {...dayProps}
                          day={dayProps.day}
                          selected={selected}
                          isRangeMiddle={isRangeMiddle}
                          isRangeStart={isStart}
                          isRangeEnd={isEnd}
                        />
                      );
                    },
                  }
            }
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 0.75,
            px: { xs: 0.75, sm: 1 },
            pb: { xs: 0.75, sm: 0.75 },
            pt: { xs: 0.25, sm: 0 },
            borderTop: `1px solid ${CALENDAR_COLORS.panelBorder}`,
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              size="small"
              fullWidth
              onClick={() => {
                onChange(mode === 'single' ? null : [null, null]);
                if (mode === 'single') setAnchorEl(null);
              }}
              sx={{
                borderRadius: 1.25,
                color: CALENDAR_COLORS.textSecondary,
                '&:hover': { backgroundColor: CALENDAR_COLORS.surfaceSoft },
              }}
            >
              Clear
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => setAnchorEl(null)}
              fullWidth
              sx={{
                borderRadius: 1.25,
                backgroundColor: CALENDAR_COLORS.accent,
                color: CALENDAR_COLORS.selectedText,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: CALENDAR_COLORS.accentHover,
                  boxShadow: 'none',
                },
              }}
            >
              Save
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
