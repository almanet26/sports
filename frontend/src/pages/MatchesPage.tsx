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
  Trash2,
  Edit,
  AlertCircle,
  Clock,
  MoreVertical,
  CheckCircle,
  CalendarClock,
} from "lucide-react";
import { matchesAPI, Match, CreateMatchData, UpdateMatchData } from "../lib/matchesApi";

type MatchType = "Practice" | "Tournament" | "Friendly";
type MatchStatus = "Upcoming" | "Today" | "Completed" | "Cancelled" | "Rescheduled";
type ReminderOption = "1 Day Before" | "2 Hours Before" | "30 Minutes Before";
type ViewMode = "list" | "calendar";
type FilterId = "all" | "thisWeek" | "thisMonth" | "tournament" | "practice" | "home" | "away";
type MatchLocationType = "Home" | "Away" | "Neutral";

interface MatchFormState {
  opponent: string;
  date: string;
  time: string;
  venue: string;
  matchType: MatchType;
  role: string;
  notes: string;
  locationType: MatchLocationType;
}

const DEFAULT_FORM: MatchFormState = {
  opponent: "",
  date: "",
  time: "",
  venue: "",
  matchType: "Practice",
  role: "",
  notes: "",
  locationType: "Home",
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

function convertTo12Hour(time24: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!time24) return { hour: "12", minute: "00", period: "PM" };
  
  const [hours, minutes] = time24.split(":");
  let hour = parseInt(hours, 10);
  const period: "AM" | "PM" = hour >= 12 ? "PM" : "AM";
  
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  
  return {
    hour: hour.toString(),
    minute: minutes || "00",
    period,
  };
}

function convertTo24Hour(hour: string, minute: string, period: "AM" | "PM"): string {
  let hour24 = parseInt(hour, 10);
  
  if (period === "AM" && hour24 === 12) hour24 = 0;
  else if (period === "PM" && hour24 !== 12) hour24 += 12;
  
  return `${pad(hour24)}:${minute}`;
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

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function getDerivedStatus(match: Match, now: Date): MatchStatus {
  if (match.match_status === "Cancelled" || match.match_status === "Rescheduled") {
    return match.match_status;
  }

  const matchDate = combineDateTime(match.match_date, match.match_time);
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

function getCountdownLabel(match: Match, now: Date) {
  const status = getDerivedStatus(match, now);
  if (status === "Completed") return "Match completed";
  if (status === "Cancelled") return "Cancelled by organiser";
  if (status === "Rescheduled") return "Rescheduled fixture";

  const matchDate = combineDateTime(match.match_date, match.match_time);
  const dayDiff = Math.ceil(
    (startOfDay(matchDate).getTime() - startOfDay(now).getTime()) / 86400000
  );
  const timeLabel = formatReadableTime(matchDate);

  if (dayDiff <= 0) return `Today at ${timeLabel}`;
  if (dayDiff === 1) return `Tomorrow at ${timeLabel}`;
  return `Starts in ${dayDiff} Days`;
}



export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [form, setForm] = useState<MatchFormState>(DEFAULT_FORM);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [now, setNow] = useState(() => new Date());
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [openReminderId, setOpenReminderId] = useState<number | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [tempTime, setTempTime] = useState({ hour: "12", minute: "00", period: "PM" as "AM" | "PM" });
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const current = new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  const fetchMatches = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await matchesAPI.getAllMatches();
      setMatches(data);
    } catch (err: any) {
      console.error("Failed to fetch matches:", err);
      setError(err.response?.data?.detail || "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const allMatches = useMemo(() => {
    return matches.sort(
      (left, right) =>
        combineDateTime(left.match_date, left.match_time).getTime() -
        combineDateTime(right.match_date, right.match_time).getTime()
    );
  }, [matches]);

  const filteredMatches = useMemo(() => {
    const currentWeekStart = startOfDay(now);
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 7);

    return allMatches.filter((match) => {
      const matchDate = combineDateTime(match.match_date, match.match_time);

      switch (activeFilter) {
        case "thisWeek":
          return matchDate >= currentWeekStart && matchDate < currentWeekEnd;
        case "thisMonth":
          return (
            matchDate.getMonth() === now.getMonth() &&
            matchDate.getFullYear() === now.getFullYear()
          );
        case "tournament":
          return match.match_type === "Tournament";
        case "practice":
          return match.match_type === "Practice";
        case "home":
          return match.location_type === "Home";
        case "away":
          return match.location_type === "Away";
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
    return filteredMatches.reduce<Record<string, Match[]>>((accumulator, match) => {
      const key = match.match_date;
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

  const handleScheduleMatch = async () => {
    if (!form.opponent || !form.date || !form.time || !form.venue || !form.role) {
      return;
    }

    try {
      const matchData: CreateMatchData = {
        opponent: form.opponent,
        match_type: form.matchType,
        match_date: form.date,
        match_time: form.time,
        venue: form.venue,
        location_type: form.locationType,
        player_role: form.role,
        notes: form.notes,
      };

      if (editingMatch) {
        await matchesAPI.updateMatch(editingMatch.id, matchData);
      } else {
        await matchesAPI.createMatch(matchData);
      }

      await fetchMatches();
      setCalendarMonth(new Date(`${form.date}T12:00:00`));
      setForm(DEFAULT_FORM);
      setEditingMatch(null);
      setIsModalOpen(false);
    } catch (err: any) {
      console.error("Failed to save match:", err);
      alert(err.response?.data?.detail || "Failed to save match");
    }
  };

  const handleUpdateReminder = async (matchId: number, reminder: ReminderOption) => {
    try {
      await matchesAPI.updateMatch(matchId, { reminder });
      await fetchMatches();
      setOpenReminderId(null);
    } catch (err: any) {
      console.error("Failed to update reminder:", err);
    }
  };

  const handleTimeChange = (field: "hour" | "minute" | "period", value: string) => {
    const newTime = { ...tempTime, [field]: value };
    setTempTime(newTime);
    const time24 = convertTo24Hour(newTime.hour, newTime.minute, newTime.period);
    handleFormChange("time", time24);
  };

  const handleModalOpen = () => {
    setIsModalOpen(true);
    const time12 = convertTo12Hour(form.time || "12:00");
    setTempTime(time12);
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatch(match);
    const time12 = convertTo12Hour(match.match_time);
    setTempTime(time12);
    setForm({
      opponent: match.opponent,
      date: match.match_date,
      time: match.match_time,
      venue: match.venue,
      matchType: match.match_type,
      role: match.player_role || "",
      notes: match.notes || "",
      locationType: match.location_type,
    });
    setIsModalOpen(true);
    setOpenActionMenuId(null);
  };

  const handleDeleteMatch = async (matchId: number) => {
    try {
      await matchesAPI.deleteMatch(matchId);
      await fetchMatches();
      setDeleteConfirmId(null);
      setOpenActionMenuId(null);
    } catch (err: any) {
      console.error("Failed to delete match:", err);
      alert(err.response?.data?.detail || "Failed to delete match");
    }
  };

  const handleMarkCompleted = async (matchId: number) => {
    try {
      await matchesAPI.updateMatch(matchId, { match_status: "Completed" });
      await fetchMatches();
      setOpenActionMenuId(null);
    } catch (err: any) {
      console.error("Failed to mark match as completed:", err);
      alert(err.response?.data?.detail || "Failed to update match");
    }
  };

  const handleRescheduleMatch = async (matchId: number) => {
    try {
      await matchesAPI.updateMatch(matchId, { match_status: "Rescheduled" });
      await fetchMatches();
      setOpenActionMenuId(null);
    } catch (err: any) {
      console.error("Failed to reschedule match:", err);
      alert(err.response?.data?.detail || "Failed to update match");
    }
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
              onClick={handleModalOpen}
              className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 shadow-[0_0_35px_rgba(99,102,241,0.35)] hover:shadow-[0_0_45px_rgba(99,102,241,0.45)]"
            >
              <Plus className="w-4 h-4" />
              Schedule Match
            </motion.button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="mt-4 text-white/60">Loading matches...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <AlertCircle className="w-16 h-16 text-rose-400 mb-4" />
          <p className="text-xl font-semibold text-white mb-2">Failed to load matches</p>
          <p className="text-white/60 mb-4">{error}</p>
          <button
            onClick={fetchMatches}
            className="rounded-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 px-5 py-3 text-sm font-semibold text-white"
          >
            Try Again
          </button>
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
                    const matchDate = combineDateTime(match.match_date, match.match_time);
                    const reminder = match.reminder;
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
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}>
                                {status}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {match.match_type}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                                {match.location_type}
                              </span>
                            </div>
                            <h2 className="mt-4 text-xl font-semibold text-white">{match.opponent}</h2>
                            <p className="mt-1 text-sm text-blue-100/70">{match.player_role}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Reminder Button */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenReminderId((current) => (current === match.id ? null : match.id))
                                }
                                className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
                                  reminder
                                    ? "border-blue-400/30 bg-blue-500/15 text-blue-200 shadow-[0_0_22px_rgba(59,130,246,0.2)]"
                                    : "border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10"
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
                                        onClick={() => handleUpdateReminder(match.id, option)}
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

                            {/* Action Menu Button */}
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setOpenActionMenuId((current) => (current === match.id ? null : match.id))
                                }
                                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70 hover:text-white hover:bg-white/10 transition-all"
                              >
                                <MoreVertical className="w-4.5 h-4.5" />
                              </button>

                              <AnimatePresence>
                                {openActionMenuId === match.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    transition={{ duration: 0.18 }}
                                    className="absolute right-0 top-14 z-20 min-w-[180px] rounded-2xl border border-white/10 bg-[#0e1628]/95 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
                                  >
                                    <p className="px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/45">
                                      Actions
                                    </p>
                                    
                                    <button
                                      onClick={() => handleEditMatch(match)}
                                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                    >
                                      <Edit className="w-4 h-4 text-blue-300" />
                                      Edit Match
                                    </button>

                                    {status !== "Completed" && (
                                      <button
                                        onClick={() => handleMarkCompleted(match.id)}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                      >
                                        <CheckCircle className="w-4 h-4 text-emerald-300" />
                                        Mark Completed
                                      </button>
                                    )}

                                    {status !== "Rescheduled" && status !== "Completed" && (
                                      <button
                                        onClick={() => handleRescheduleMatch(match.id)}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors"
                                      >
                                        <CalendarClock className="w-4 h-4 text-orange-300" />
                                        Reschedule
                                      </button>
                                    )}

                                    <div className="my-1 h-px bg-white/10" />

                                    <button
                                      onClick={() => {
                                        setDeleteConfirmId(match.id);
                                        setOpenActionMenuId(null);
                                      }}
                                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete Match
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
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

                        {match.match_status === "Completed" && match.statistics ? (
                          <div className="relative mt-5">
                            <button
                              onClick={() =>
                                setExpandedMatchId((current) => (current === match.id ? null : match.id))
                              }
                              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/85"
                            >
                              Match Stats
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
                                      <p className="mt-3 text-2xl font-semibold">{match.statistics.runs}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                                        Wickets
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.statistics.wickets}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-300" />
                                        Catches
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.statistics.catches}</p>
                                    </div>
                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-4">
                                      <div className="flex items-center gap-2 text-white/55 text-xs uppercase tracking-[0.2em]">
                                        <Trophy className="w-3.5 h-3.5 text-emerald-300" />
                                        Result
                                      </div>
                                      <p className="mt-3 text-2xl font-semibold">{match.statistics.result}</p>
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
                                <div className="truncate opacity-80">{formatReadableTime(combineDateTime(match.match_date, match.match_time))}</div>
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
            onClick={() => {
              setIsModalOpen(false);
              setEditingMatch(null);
              setForm(DEFAULT_FORM);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-3xl max-h-[90vh] overflow-y-auto overflow-hidden rounded-[32px] border border-white/15 bg-[linear-gradient(180deg,rgba(10,17,34,0.98),rgba(8,12,24,0.96))] shadow-[0_30px_120px_rgba(3,7,18,0.75)]"
            >
              {/* Header */}
              <div className="sticky top-0 z-10 border-b border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.22),transparent_42%),radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_38%)] backdrop-blur-xl p-8">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs uppercase tracking-[0.22em] text-white/50 mb-4">
                      <Sparkles className="w-3.5 h-3.5 text-violet-300" />
                      {editingMatch ? "Edit Match" : "New Match"}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Schedule Upcoming Match</h2>
                    <p className="text-sm text-white/60">
                      Add the next fixture with venue, role, notes, and live reminders.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingMatch(null);
                      setForm(DEFAULT_FORM);
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/65 hover:text-white hover:bg-white/10 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-8">
                <div className="space-y-6">
                  {/* Opponent Name - Full Width */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2.5">
                      Opponent Team Name
                    </label>
                    <input
                      value={form.opponent}
                      onChange={(event) => handleFormChange("opponent", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white placeholder:text-white/30 focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                      placeholder="Enter opponent squad name"
                    />
                  </div>

                  {/* Date and Time - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2.5">
                        Match Date
                      </label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(event) => handleFormChange("date", event.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2.5">
                        Match Time
                      </label>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setTimePickerOpen(!timePickerOpen)}
                          className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all flex items-center justify-between"
                        >
                          <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-blue-300" />
                            {tempTime.hour}:{tempTime.minute} {tempTime.period}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform ${timePickerOpen ? "rotate-180" : ""}`} />
                        </button>

                        <AnimatePresence>
                          {timePickerOpen && (
                            <motion.div
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="absolute z-20 mt-2 w-full rounded-2xl border border-white/10 bg-[#0e1628]/98 backdrop-blur-xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                            >
                              <div className="flex gap-3">
                                {/* Hour */}
                                <div className="flex-1">
                                  <label className="block text-xs text-white/50 mb-2">Hour</label>
                                  <select
                                    value={tempTime.hour}
                                    onChange={(e) => handleTimeChange("hour", e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-400/50 focus:outline-none"
                                  >
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                                      <option key={h} value={h}>
                                        {h}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Minute */}
                                <div className="flex-1">
                                  <label className="block text-xs text-white/50 mb-2">Minute</label>
                                  <select
                                    value={tempTime.minute}
                                    onChange={(e) => handleTimeChange("minute", e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white focus:border-blue-400/50 focus:outline-none"
                                  >
                                    {Array.from({ length: 60 }, (_, i) => pad(i)).map((m) => (
                                      <option key={m} value={m}>
                                        {m}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* AM/PM */}
                                <div className="flex-1">
                                  <label className="block text-xs text-white/50 mb-2">Period</label>
                                  <div className="flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleTimeChange("period", "AM")}
                                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                                        tempTime.period === "AM"
                                          ? "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                      }`}
                                    >
                                      AM
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTimeChange("period", "PM")}
                                      className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                                        tempTime.period === "PM"
                                          ? "bg-blue-500/20 text-blue-200 border border-blue-400/30"
                                          : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
                                      }`}
                                    >
                                      PM
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setTimePickerOpen(false)}
                                className="mt-3 w-full rounded-xl bg-blue-500/10 border border-blue-400/20 px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/20 transition-all"
                              >
                                Done
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>

                  {/* Venue - Full Width */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2.5">
                      Venue / Ground
                    </label>
                    <input
                      value={form.venue}
                      onChange={(event) => handleFormChange("venue", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white placeholder:text-white/30 focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                      placeholder="PitchVision Arena or away ground"
                    />
                  </div>

                  {/* Match Type and Location Type - Side by Side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2.5">
                        Match Type
                      </label>
                      <select
                        value={form.matchType}
                        onChange={(event) => handleFormChange("matchType", event.target.value as MatchType)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0f1729] px-5 py-3.5 text-white focus:border-blue-400/50 focus:outline-none transition-all cursor-pointer"
                      >
                        <option>Practice</option>
                        <option>Tournament</option>
                        <option>Friendly</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-white/80 mb-2.5">
                        Location Type
                      </label>
                      <select
                        value={form.locationType}
                        onChange={(event) => handleFormChange("locationType", event.target.value as MatchLocationType)}
                        className="w-full rounded-2xl border border-white/10 bg-[#0f1729] px-5 py-3.5 text-white focus:border-blue-400/50 focus:outline-none transition-all cursor-pointer"
                      >
                        <option>Home</option>
                        <option>Away</option>
                        <option>Neutral</option>
                      </select>
                    </div>
                  </div>

                  {/* Role - Full Width */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2.5">
                      Your Role
                    </label>
                    <input
                      value={form.role}
                      onChange={(event) => handleFormChange("role", event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white placeholder:text-white/30 focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                      placeholder="Opening batter, captain, finisher"
                    />
                  </div>

                  {/* Notes - Full Width */}
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2.5">
                      Notes (Optional)
                    </label>
                    <textarea
                      value={form.notes}
                      onChange={(event) => handleFormChange("notes", event.target.value)}
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3.5 text-white placeholder:text-white/30 focus:border-blue-400/50 focus:bg-white/[0.08] focus:outline-none transition-all"
                      placeholder="Travel notes, team meeting, warm-up focus, or anything important."
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="sticky bottom-0 flex flex-col-reverse gap-3 border-t border-white/10 bg-[rgba(8,12,24,0.95)] backdrop-blur-xl p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-white/45">
                  Saved matches stay inside this dashboard for quick planning.
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setIsModalOpen(false);
                      setEditingMatch(null);
                      setForm(DEFAULT_FORM);
                    }}
                    className="flex-1 sm:flex-none rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-white/75 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleScheduleMatch}
                    disabled={!form.opponent || !form.date || !form.time || !form.venue || !form.role}
                    className="flex-1 sm:flex-none rounded-2xl bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(99,102,241,0.35)] hover:shadow-[0_0_45px_rgba(99,102,241,0.5)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {editingMatch ? "Update Match" : "Add Upcoming Match"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId !== null ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
            onClick={() => setDeleteConfirmId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[28px] border border-white/15 bg-[linear-gradient(180deg,rgba(10,17,34,0.98),rgba(8,12,24,0.96))] p-6 shadow-[0_30px_120px_rgba(3,7,18,0.75)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-400/20">
                  <AlertCircle className="w-6 h-6 text-rose-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Delete Match?</h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Are you sure you want to delete this match? This action cannot be undone and all match data will be permanently removed.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white/75 hover:text-white hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteMatch(deleteConfirmId)}
                  className="flex-1 rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_35px_rgba(244,63,94,0.35)] hover:shadow-[0_0_45px_rgba(244,63,94,0.5)] transition-all"
                >
                  Delete Match
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
