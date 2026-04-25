import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";
import api from "../lib/api";

type MatchType = "Practice" | "Tournament" | "Friendly";
type MatchStatus = "Upcoming" | "Today" | "Completed" | "Cancelled" | "Rescheduled";
type ReminderOption = "1 Day Before" | "2 Hours Before" | "30 Minutes Before";
type ViewMode = "list" | "calendar";
type FilterId = "all" | "thisWeek" | "thisMonth" | "tournament" | "practice" | "home" | "away";
type MatchLocationType = "Home" | "Away";

interface MatchFormState {
  opponent: string;
  date: string;
  time: string;
  venue: string;
  matchType: MatchType;
  role: string;
  notes: string;
}

interface MatchStats {
  runs: number;
  wickets: number;
  catches: number;
  result: "Won" | "Lost";
}

interface MatchItem {
  id: string;
  opponent: string;
  venue: string;
  date: string;
  time: string;
  matchType: MatchType;
  role: string;
  notes: string;
  status?: MatchStatus;
  locationType: MatchLocationType;
  reminder?: ReminderOption;
  stats?: MatchStats;
  isUserCreated?: boolean;
}

interface ServerMatch {
  id: number;
  team_a?: string;
  team_b?: string;
  match_date?: string;
  venue?: string;
}

const STORAGE_KEY = "pitchvision-upcoming-matches";
const REMINDER_KEY = "pitchvision-match-reminders";

const DEFAULT_FORM: MatchFormState = {
  opponent: "",
  date: "",
  time: "",
  venue: "",
  matchType: "Practice",
  role: "",
  notes: "",
};

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All Matches" },
  { id: "thisWeek", label: "This Week" },
  { id: "thisMonth", label: "This Month" },
  { id: "tournament", label: "Tournament" },
  { id: "practice", label: "Practice" },
  { id: "home", label: "Home" },
  { id: "away", label: "Away" },
];

const REMINDER_OPTIONS: ReminderOption[] = [
  "1 Day Before",
  "2 Hours Before",
  "30 Minutes Before",
];

const STATUS_STYLES: Record<MatchStatus, string> = {
  Upcoming: "border-blue-400/30 bg-blue-500/15 text-blue-200 shadow-[0_0_30px_rgba(59,130,246,0.18)]",
  Today: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 shadow-[0_0_30px_rgba(16,185,129,0.18)]",
  Completed: "border-slate-400/25 bg-slate-500/15 text-slate-200 shadow-[0_0_24px_rgba(148,163,184,0.14)]",
  Cancelled: "border-rose-400/30 bg-rose-500/15 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.18)]",
  Rescheduled: "border-orange-400/30 bg-orange-500/15 text-orange-200 shadow-[0_0_30px_rgba(249,115,22,0.18)]",
};

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(base: Date, days: number, hour: number, minute = 0) {
  const next = new Date(base);
  next.setDate(base.getDate() + days);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time || "00:00"}:00`);
}

function formatReadableDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatReadableTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getDerivedStatus(match: MatchItem, now: Date): MatchStatus {
  if (match.status === "Cancelled" || match.status === "Rescheduled") {
    return match.status;
  }

  const matchDate = combineDateTime(match.date, match.time);
  if (Number.isNaN(matchDate.getTime())) {
    return "Upcoming";
  }

  if (matchDate < now) {
    return "Completed";
  }

  if (isSameDay(matchDate, now)) {
    return "Today";
  }

  return "Upcoming";
}

function getCountdownLabel(match: MatchItem, now: Date) {
  const status = getDerivedStatus(match, now);
  if (status === "Completed") return "Match completed";
  if (status === "Cancelled") return "Cancelled by organiser";
  if (status === "Rescheduled") return "Rescheduled fixture";

  const matchDate = combineDateTime(match.date, match.time);
  const dayDiff = Math.ceil(
    (startOfDay(matchDate).getTime() - startOfDay(now).getTime()) / 86400000
  );
  const timeLabel = formatReadableTime(matchDate);

  if (dayDiff <= 0) return `Today at ${timeLabel}`;
  if (dayDiff === 1) return `Tomorrow at ${timeLabel}`;
  return `Starts in ${dayDiff} Days`;
}

function getLocationType(venue: string): MatchLocationType {
  const normalized = venue.toLowerCase();
  return normalized.includes("home") || normalized.includes("pitchvision") || normalized.includes("academy")
    ? "Home"
    : "Away";
}

function toLocalMatch(serverMatch: ServerMatch): MatchItem {
  const parsedDate = serverMatch.match_date ? new Date(serverMatch.match_date) : new Date();
  const fallbackOpponent = serverMatch.team_b || serverMatch.team_a || "Opponent XI";

  return {
    id: `server-${serverMatch.id}`,
    opponent: fallbackOpponent,
    venue: serverMatch.venue || "Venue to be confirmed",
    date: formatDateInput(parsedDate),
    time: formatTimeInput(parsedDate),
    matchType: "Tournament",
    role: "Playing XI",
    notes: "Imported from scheduled fixtures.",
    locationType: getLocationType(serverMatch.venue || ""),
  };
}

function buildDemoMatches(now: Date): MatchItem[] {
  const squadSession = addDays(now, 2, 18, 30);
  const cityLeague = addDays(now, 0, 19, 0);
  const nets = addDays(now, -1, 16, 0);
  const warmup = addDays(now, 4, 17, 30);
  const academyCup = addDays(now, 7, 9, 30);

  return [
    {
      id: "demo-upcoming",
      opponent: "Rising Strikers",
      venue: "PitchVision High Performance Centre",
      date: formatDateInput(squadSession),
      time: formatTimeInput(squadSession),
      matchType: "Practice",
      role: "Opening Batter",
      notes: "Powerplay simulation and short-ball prep.",
      locationType: "Home",
      reminder: "2 Hours Before",
    },
    {
      id: "demo-today",
      opponent: "City Challengers",
      venue: "Metro Oval",
      date: formatDateInput(cityLeague),
      time: formatTimeInput(cityLeague),
      matchType: "Tournament",
      role: "Vice Captain",
      notes: "Arrive 75 minutes early for strategy review.",
      locationType: "Away",
      reminder: "30 Minutes Before",
    },
    {
      id: "demo-completed",
      opponent: "Northern Knights",
      venue: "Home Turf Arena",
      date: formatDateInput(nets),
      time: formatTimeInput(nets),
      matchType: "Friendly",
      role: "Middle Order",
      notes: "Post-match debrief with the analyst team.",
      locationType: "Home",
      stats: {
        runs: 42,
        wickets: 1,
        catches: 2,
        result: "Won",
      },
    },
    {
      id: "demo-rescheduled",
      opponent: "Thunder Bolts",
      venue: "West End Cricket Ground",
      date: formatDateInput(warmup),
      time: formatTimeInput(warmup),
      matchType: "Friendly",
      role: "Finisher",
      notes: "Shifted due to weather alert from last week.",
      locationType: "Away",
      status: "Rescheduled",
    },
    {
      id: "demo-cancelled",
      opponent: "Academy Cup Qualifier",
      venue: "Riverfront Stadium",
      date: formatDateInput(academyCup),
      time: formatTimeInput(academyCup),
      matchType: "Tournament",
      role: "Squad Rotation",
      notes: "Cancelled after venue maintenance notice.",
      locationType: "Away",
      status: "Cancelled",
    },
  ];
}

export default function MatchesPage() {
  const [serverMatches, setServerMatches] = useState<MatchItem[]>([]);
  const [customMatches, setCustomMatches] = useState<MatchItem[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as MatchItem[];
      } catch (error) {
        console.error("Failed to parse saved matches", error);
      }
    }
    return [];
  });
  const [reminders, setReminders] = useState<Record<string, ReminderOption>>(() => {
    const stored = localStorage.getItem(REMINDER_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as Record<string, ReminderOption>;
      } catch (error) {
        console.error("Failed to parse match reminders", error);
      }
    }
    return {};
  });
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<MatchFormState>(DEFAULT_FORM);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [now, setNow] = useState(() => new Date());
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>("demo-completed");
  const [openReminderId, setOpenReminderId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customMatches));
  }, [customMatches]);

  useEffect(() => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
  }, [reminders]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let ignore = false;

    api
      .get<ServerMatch[]>("/matches/upcoming")
      .then((response) => {
        if (!ignore) {
          setServerMatches((response.data || []).map(toLocalMatch));
        }
      })
      .catch((error) => {
        console.error("Failed to fetch upcoming matches", error);
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const demoMatches = useMemo(() => buildDemoMatches(now), [now]);

  const allMatches = useMemo(() => {
    const mergedCustomMatches = customMatches.map((match) => ({
      ...match,
      reminder: reminders[match.id] || match.reminder,
    }));

    const mergedServerMatches = serverMatches.map((match) => ({
      ...match,
      reminder: reminders[match.id] || match.reminder,
    }));

    const sourceMatches =
      mergedServerMatches.length > 0 || mergedCustomMatches.length > 0
        ? [...mergedCustomMatches, ...mergedServerMatches]
        : demoMatches.map((match) => ({
            ...match,
            reminder: reminders[match.id] || match.reminder,
          }));

    return sourceMatches.sort(
      (left, right) =>
        combineDateTime(left.date, left.time).getTime() -
        combineDateTime(right.date, right.time).getTime()
    );
  }, [customMatches, demoMatches, reminders, serverMatches]);

  const filteredMatches = useMemo(() => {
    const currentWeekStart = startOfDay(now);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 7);

    return allMatches.filter((match) => {
      const matchDate = combineDateTime(match.date, match.time);

      switch (activeFilter) {
        case "thisWeek":
          return matchDate >= currentWeekStart && matchDate < currentWeekEnd;
        case "thisMonth":
          return (
            matchDate.getMonth() === now.getMonth() &&
            matchDate.getFullYear() === now.getFullYear()
          );
        case "tournament":
          return match.matchType === "Tournament";
        case "practice":
          return match.matchType === "Practice";
        case "home":
          return match.locationType === "Home";
        case "away":
          return match.locationType === "Away";
        default:
          return true;
      }
    });
  }, [activeFilter, allMatches, now]);

  const matchCountSummary = useMemo(() => {
    const todayCount = allMatches.filter((match) => getDerivedStatus(match, now) === "Today").length;
    const upcomingCount = allMatches.filter((match) => getDerivedStatus(match, now) === "Upcoming").length;
    return { todayCount, upcomingCount };
  }, [allMatches, now]);

  const calendarDays = useMemo(() => {
    const start = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const end = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const leadDays = start.getDay();
    const totalDays = end.getDate();
    const days: Date[] = [];

    for (let index = 0; index < leadDays; index += 1) {
      const date = new Date(start);
      date.setDate(start.getDate() - (leadDays - index));
      days.push(date);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      days.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
    }

    while (days.length < 42) {
      const last = days[days.length - 1];
      const next = new Date(last);
      next.setDate(last.getDate() + 1);
      days.push(next);
    }

    return days;
  }, [calendarMonth]);

  const matchesByDay = useMemo(() => {
    return filteredMatches.reduce<Record<string, MatchItem[]>>((accumulator, match) => {
      const key = match.date;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(match);
      return accumulator;
    }, {});
  }, [filteredMatches]);

  const selectedMonthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "long",
        year: "numeric",
      }).format(calendarMonth),
    [calendarMonth]
  );

  const handleFormChange = <K extends keyof MatchFormState>(key: K, value: MatchFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleScheduleMatch = () => {
    if (!form.opponent || !form.date || !form.time || !form.venue || !form.role) {
      return;
    }

    const createdMatch: MatchItem = {
      id: `custom-${Date.now()}`,
      opponent: form.opponent,
      date: form.date,
      time: form.time,
      venue: form.venue,
      matchType: form.matchType,
      role: form.role,
      notes: form.notes,
      locationType: getLocationType(form.venue),
      isUserCreated: true,
    };

    setCustomMatches((current) => [createdMatch, ...current]);
    setCalendarMonth(new Date(`${createdMatch.date}T12:00:00`));
    setForm(DEFAULT_FORM);
    setIsModalOpen(false);
  };

  const setReminder = (matchId: string, option: ReminderOption) => {
    setReminders((current) => ({ ...current, [matchId]: option }));
    setOpenReminderId(null);
  };

  return (
    <div className="text-white">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass rounded-3xl p-6 mb-8 border border-white/20"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <Calendar className="w-8 h-8 text-blue-400" />
              Upcoming Matches
            </h1>
            <p className="text-white/70 mt-2 text-sm">
              Matches scheduled in the future
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-2xl bg-white/5 border border-white/10 text-sm text-white/70">
              <span className="text-white font-semibold">{matchCountSummary.upcomingCount}</span> upcoming
            </div>
            <div className="px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-400/20 text-sm text-emerald-200">
              <span className="text-white font-semibold">{matchCountSummary.todayCount}</span> today
            </div>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 shadow-[0_0_35px_rgba(99,102,241,0.35)] hover:shadow-[0_0_45px_rgba(99,102,241,0.45)]"
            >
              <Plus className="w-4 h-4" />
              Schedule Match
            </motion.button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="glass rounded-[30px] border border-white/15 overflow-hidden shadow-[0_25px_80px_rgba(5,10,25,0.45)]"
        >
          <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_38%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.12),transparent_36%)] p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-white/55">
                  <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                  Match Management Module
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setActiveFilter(filter.id)}
                      className={`rounded-full px-4 py-2 text-sm border transition-all duration-300 ${
                        activeFilter === filter.id
                          ? "border-blue-400/40 bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white shadow-[0_0_25px_rgba(99,102,241,0.18)]"
                          : "border-white/10 bg-white/5 text-white/65 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-flex items-center rounded-2xl border border-white/10 bg-black/20 p-1">
                {(["list", "calendar"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm transition-all ${
                      viewMode === mode
                        ? "bg-gradient-to-r from-blue-500/25 to-violet-500/25 text-white shadow-[0_0_20px_rgba(99,102,241,0.2)]"
                        : "text-white/60 hover:text-white"
                    }`}
                  >
                    {mode === "list" ? <CalendarDays className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
                    {mode === "list" ? "List View" : "Calendar View"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6">
            {viewMode === "list" ? (
              filteredMatches.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-white/15 bg-white/[0.03] py-16 px-6 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20">
                    <CalendarDays className="w-7 h-7 text-blue-300" />
                  </div>
                  <p className="text-xl font-semibold">No matches found for this filter</p>
                  <p className="mt-2 text-sm text-white/55">
                    Adjust the pills above or schedule a new fixture to populate this view.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 lg:grid-cols-2 2xl:grid-cols-3">
                  {filteredMatches.map((match, index) => {
                    const status = getDerivedStatus(match, now);
                    const matchDate = combineDateTime(match.date, match.time);
                    const reminder = reminders[match.id] || match.reminder;
                    const isExpanded = expandedMatchId === match.id;

                    return (
                      <motion.article
                        key={match.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: index * 0.05 }}
                        className="group relative overflow-visible rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.05))] p-5 shadow-[0_24px_60px_rgba(7,11,24,0.36)] backdrop-blur-2xl hover:-translate-y-1 hover:border-white/20"
                      >
                        <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.2),transparent_60%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <div className="relative flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                                {status}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {match.matchType}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {match.locationType}
                              </span>
                            </div>
                            <h2 className="mt-4 text-xl font-semibold text-white">{match.opponent}</h2>
                            <p className="mt-1 text-sm text-blue-100/70">{match.role}</p>
                          </div>

                          <div className="relative">
                            <button
                              onClick={() =>
                                setOpenReminderId((current) => (current === match.id ? null : match.id))
                              }
                              className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                                reminder
                                  ? "border-blue-400/30 bg-blue-500/15 text-blue-200 shadow-[0_0_22px_rgba(59,130,246,0.2)]"
                                  : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                              }`}
                            >
                              <Bell className="w-4.5 h-4.5" />
                            </button>

                            <AnimatePresence>
                              {openReminderId === match.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                  transition={{ duration: 0.18 }}
                                  className="absolute right-0 top-14 z-20 min-w-[190px] rounded-2xl border border-white/10 bg-[#0e1628]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                                >
                                  <p className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/45">
                                    Reminder
                                  </p>
                                  {REMINDER_OPTIONS.map((option) => (
                                    <button
                                      key={option}
                                      onClick={() => setReminder(match.id, option)}
                                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                                        reminder === option
                                          ? "bg-blue-500/15 text-blue-100"
                                          : "text-white/70 hover:bg-white/5 hover:text-white"
                                      }`}
                                    >
                                      {option}
                                      {reminder === option ? <ShieldCheck className="w-4 h-4" /> : null}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        <div className="relative mt-5 grid gap-3 text-sm text-white/72">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-cyan-300" />
                            <span>{match.venue}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-violet-300" />
                            <span>
                              {formatReadableDate(matchDate)} at {formatReadableTime(matchDate)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-white">
                            <Clock3 className="w-4 h-4 text-blue-300" />
                            <div className="flex flex-col">
                              <span className="text-[11px] uppercase tracking-[0.22em] text-white/45">
                                Countdown
                              </span>
                              <span className="font-medium">{getCountdownLabel(match, now)}</span>
                            </div>
                          </div>
                          {reminder ? (
                            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-100">
                              <Bell className="w-3.5 h-3.5" />
                              Reminder active: {reminder}
                            </div>
                          ) : null}
                          {match.notes ? (
                            <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 leading-6 text-white/60">
                              {match.notes}
                            </p>
                          ) : null}
                        </div>

                        {status === "Completed" && match.stats ? (
                          <div className="relative mt-5">
                            <button
                              onClick={() =>
                                setExpandedMatchId((current) => (current === match.id ? null : match.id))
                              }
                              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/85"
                            >
                              After Match Update
                              <ChevronDown
                                className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              />
                            </button>

                            <AnimatePresence initial={false}>
                              {isExpanded ? (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <Target className="w-3.5 h-3.5 text-blue-300" />
                                        Runs
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.stats.runs}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                                        Wickets
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.stats.wickets}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                                        Catches
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.stats.catches}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <Trophy className="w-3.5 h-3.5 text-emerald-300" />
                                        Result
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.stats.result}</p>
                                    </div>
                                  </div>
                                </motion.div>
                              ) : null}
                            </AnimatePresence>
                          </div>
                        ) : null}
                      </motion.article>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setCalendarMonth(
                        (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-lg font-semibold">{selectedMonthLabel}</p>
                    <p className="text-sm text-white/55">Highlighted fixtures and reminders</p>
                  </div>
                  <button
                    onClick={() =>
                      setCalendarMonth(
                        (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs uppercase tracking-[0.24em] text-white/40">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="py-3">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const dayKey = formatDateInput(day);
                    const matches = matchesByDay[dayKey] || [];
                    const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                    const isToday = isSameDay(day, now);

                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[108px] rounded-2xl border p-2.5 sm:p-3 ${
                          isCurrentMonth
                            ? "border-white/10 bg-white/[0.04]"
                            : "border-white/5 bg-white/[0.02] text-white/30"
                        } ${isToday ? "shadow-[0_0_0_1px_rgba(96,165,250,0.45)]" : ""}`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                              isToday
                                ? "bg-blue-500/20 text-blue-100"
                                : isCurrentMonth
                                  ? "text-white/75"
                                  : "text-white/25"
                            }`}
                          >
                            {day.getDate()}
                          </span>
                          {matches.length > 0 ? (
                            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] text-violet-200">
                              {matches.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1.5">
                          {matches.slice(0, 3).map((match) => {
                            const status = getDerivedStatus(match, now);
                            return (
                              <button
                                key={match.id}
                                onClick={() => {
                                  setViewMode("list");
                                  setActiveFilter("all");
                                  setExpandedMatchId(match.id);
                                }}
                                className={`block w-full rounded-xl px-2.5 py-1.5 text-left text-[11px] leading-4 ${STATUS_STYLES[status]}`}
                              >
                                <div className="truncate font-medium">{match.opponent}</div>
                                <div className="truncate opacity-80">{formatReadableTime(combineDateTime(match.date, match.time))}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isModalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-md"
            onClick={() => setIsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,rgba(10,17,34,0.94),rgba(8,12,24,0.92))] shadow-[0_30px_120px_rgba(3,7,18,0.75)]"
            >
              <div className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_38%)] p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.22em] text-white/50">
                      <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                      Premium Scheduler
                    </p>
                    <h2 className="mt-4 text-2xl font-semibold text-white">Schedule Upcoming Match</h2>
                    <p className="mt-2 text-sm text-white/60">
                      Add the next fixture with venue, role, notes, and live reminders.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 hover:text-white"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm text-white/70">Opponent Team Name</span>
                  <input
                    value={form.opponent}
                    onChange={(event) => handleFormChange("opponent", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30"
                    placeholder="Enter opponent squad"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm text-white/70">Match Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(event) => handleFormChange("date", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm text-white/70">Time</span>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(event) => handleFormChange("time", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm text-white/70">Venue / Ground</span>
                  <input
                    value={form.venue}
                    onChange={(event) => handleFormChange("venue", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30"
                    placeholder="PitchVision Arena or away ground"
                  />
                </label>

                <label>
                  <span className="mb-2 block text-sm text-white/70">Match Type</span>
                  <select
                    value={form.matchType}
                    onChange={(event) => handleFormChange("matchType", event.target.value as MatchType)}
                    className="w-full rounded-2xl border border-white/10 bg-[#0f1729] px-4 py-3 text-white"
                  >
                    <option>Practice</option>
                    <option>Tournament</option>
                    <option>Friendly</option>
                  </select>
                </label>

                <label>
                  <span className="mb-2 block text-sm text-white/70">Role</span>
                  <input
                    value={form.role}
                    onChange={(event) => handleFormChange("role", event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30"
                    placeholder="Opening batter, captain, finisher"
                  />
                </label>

                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm text-white/70">Notes</span>
                  <textarea
                    value={form.notes}
                    onChange={(event) => handleFormChange("notes", event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-white placeholder:text-white/30"
                    placeholder="Travel notes, team meeting, warm-up focus, or anything important."
                  />
                </label>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-white/45">
                  Saved matches stay inside this dashboard for quick planning.
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/75 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleMatch}
                    className="rounded-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(99,102,241,0.35)]"
                  >
                    Add Upcoming Match
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
