# Frontend Components Documentation

Guide to React components, state management, and UI structure.

---

## 📑 Table of Contents

1. Component Architecture
2. Key Components
3. State Management
4. Styling System
5. API Integration

---

## 1. Component Architecture

### Directory Structure

```
frontend/src/
├── pages/          # Full-page components (route-based)
│   ├── Home.tsx
│   ├── BattingAnalysis.tsx
│   ├── BowlingAnalysis.tsx
│   ├── Dashboard.tsx
│   ├── CoachDashboard.tsx
|   ├── AdminDashboard.tsx
│   └── ...
│
├── components/     # Reusable UI components
│   ├── VideoPlayer.tsx
│   ├── UploadForm.tsx
│   ├── EventList.tsx
│   ├── AnalysisReport.tsx
│   ├── Navigation.tsx
│   └── ...
│
├── lib/           # Utility functions and API clients
│   ├── api.ts     # API calls
│   └── utils.ts   # Helper functions
│
├── store/         # Zustand state management
│   ├── authStore.ts
│   └── themeStore.ts
│
├── utils/         # TypeScript interfaces
│   └── auth.ts
│
└── routes.tsx        # Root component
```

---

## 2. Key Components

### AnalysisReport Component

**Purpose:** Display batting/bowling analysis results with visualizations.

```tsx
interface AnalysisReportProps {
  analysis: BattingAnalysis | BowlingAnalysis;
  type: 'batting' | 'bowling';
}

export const AnalysisReport: React.FC<AnalysisReportProps> = ({
  analysis,
  type,
}) => {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold">Key Metrics</h2>
        <BiometricsTable metrics={analysis.biometrics} />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold">Detected Flaws</h2>
        <FlawsList flaws={analysis.detected_flaws} />
      </section>
      
      <section>
        <h2 className="text-2xl font-bold">Drill Recommendations</h2>
        <DrillList drills={analysis.drill_recommendations} />
      </section>
      
      <section>
        <button onClick={() => downloadPDF(analysis)}>
          Download PDF Report
        </button>
      </section>
    </div>
  );
};
```

---

### EventList Component

**Purpose:** Display detected highlight events (4s, 6s, Wickets).

```tsx
interface EventListProps {
  events: HighlightEvent[];
  filter?: 'FOUR' | 'SIX' | 'WICKET' | null;
  onEventSelect: (event: HighlightEvent) => void;
}

export const EventList: React.FC<EventListProps> = ({
  events,
  filter,
  onEventSelect,
}) => {
  const filtered = filter 
    ? events.filter(e => e.event_type === filter) 
    : events;
  
  return (
    <div className="space-y-2">
      {filtered.map((event) => (
        <div 
          key={event.id}
          onClick={() => onEventSelect(event)}
          className="p-3 border rounded cursor-pointer hover:bg-gray-100"
        >
          <div className="font-bold">
            {event.event_type} at {Math.floor(event.timestamp_seconds)}s
          </div>
          <div className="text-sm text-gray-600">
            Score: {event.score_before} → {event.score_after}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 3. State Management (Zustand)

### Auth Store

```tsx
// store/authStore.ts
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    set({
      user: response.data.user,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
    });
  },
  
  logout: () => {
    set({ user: null, accessToken: null, refreshToken: null });
  },
  
  refreshAccessToken: async () => {
    const response = await api.post('/auth/refresh');
    set({ accessToken: response.data.access_token });
  },
}));
```

**Usage:**
```tsx
const { login, logout, user } = useAuthStore();

// Login
await login('user@example.com', 'password');

// Check if logged in
if (user) {
  console.log(`Logged in as ${user.name}`);
}
```

---

### Upload Store

```tsx
// store/uploadStore.ts
interface UploadState {
  currentUpload: UploadProgress | null;
  uploadHistory: UploadResult[];
  
  startUpload: (videoId: string, fileName: string) => void;
  updateProgress: (percentage: number) => void;
  completeUpload: (result: UploadResult) => void;
  clearHistory: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  currentUpload: null,
  uploadHistory: [],
  
  startUpload: (videoId, fileName) => {
    set({
      currentUpload: { videoId, fileName, progress: 0 },
    });
  },
  
  updateProgress: (percentage) => {
    set((state) => ({
      currentUpload: state.currentUpload 
        ? { ...state.currentUpload, progress: percentage }
        : null,
    }));
  },
  
  completeUpload: (result) => {
    set((state) => ({
      currentUpload: null,
      uploadHistory: [result, ...state.uploadHistory],
    }));
  },
  
  clearHistory: () => {
    set({ uploadHistory: [] });
  },
}));
```

---

## 4. Styling System

### TailwindCSS Configuration

```jsx
// tailwind.config.cjs
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cricket: {
          green: "#1F7B34",
          gold: "#FFB81C",
          dark: "#1A1A1A",
        },
      },
      spacing: {
        '128': '32rem',
      },
    },
  },
  plugins: [],
};
```

### Utility Classes

```tsx
// Common component classes
const buttonClasses = "px-4 py-2 rounded-lg font-semibold transition hover:shadow-lg";
const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cricket-green";
const cardClasses = "bg-white rounded-lg shadow-md p-6";

<button className={`${buttonClasses} bg-cricket-green text-white`}>
  Upload
</button>
```

---

## 5. API Integration

### API Client (`lib/api.ts`)

```tsx
import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, refresh it
      const { refreshAccessToken } = useAuthStore.getState();
      await refreshAccessToken();
      // Retry request
      return api(error.config);
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Usage Examples

```tsx
// GET request
const getVideo = async (videoId: string) => {
  const response = await api.get(`/videos/${videoId}`);
  return response.data;
};

// POST request with file
const uploadVideo = async (file: File, title: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  
  const response = await api.post('/videos/upload', formData);
  return response.data;
};

// POST request with JSON
const triggerOCR = async (videoId: string) => {
  const response = await api.post('/jobs/trigger', {
    video_id: videoId,
  });
  return response.data;
};
```

---

## 6. TypeScript Interfaces

```tsx
// types/video.ts
export interface Video {
  id: string;
  title: string;
  description?: string;
  file_path: string;
  status: 'pending' | 'processing' | 'failed' | 'completed';
  visibility: 'public' | 'private';
  total_fours: number;
  total_sixes: number;
  total_wickets: number;
  uploaded_by: string;
  created_at: string;
}

export interface HighlightEvent {
  id: string;
  video_id: string;
  event_type: 'FOUR' | 'SIX' | 'WICKET';
  timestamp_seconds: number;
  score_before: number;
  score_after: number;
  clip_path: string;
}

export interface BattingAnalysis {
  id: string;
  user_id: string;
  biometrics: {
    stance_angle: number;
    bat_lift_height: number;
    follow_through_quality: string;
  };
  detected_flaws: DetectedFlaw[];
  drill_recommendations: string[];
  pdf_report_url: string;
}
```

---

**Last Updated:** March 16, 2026
