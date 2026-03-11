# 🎨 Visual Feature Guide

## 1. Password Toggle Feature

### Login Page
```
┌─────────────────────────────────────┐
│  Password                           │
│  ┌───────────────────────────────┐ │
│  │ ••••••••              👁️      │ │
│  └───────────────────────────────┘ │
│  Click eye icon to show/hide       │
└─────────────────────────────────────┘
```

**States**:
- 🔒 Hidden: Shows `fa-eye` icon, password as dots
- 👁️ Visible: Shows `fa-eye-slash` icon, password as text

**Styling**:
- Icon positioned on the right side
- Hover effect: opacity changes
- Smooth transitions
- Vertically centered in input box

---

## 2. Landing Page Update

### Before
```
┌─────────────────────────────────────┐
│  [Get Started Button]               │
│  AI-powered sports analysis         │
│  platform for athletes and coaches  │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│  [Get Started Button]               │
│  Cricket specialist is ready and    │
│  many more games are coming soon    │
└─────────────────────────────────────┘
```

---

## 3. Subscription Page

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ⭐ Subscription Plans                                        │
│  Choose the perfect plan for your needs                      │
├──────────────────────────────────────────────────────────────┤
│  ✅ Current Plan: BASIC Plan [Active]                        │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   BASIC     │  │   SILVER    │  │    GOLD     │         │
│  │   [Gray]    │  │  [Silver]   │  │   [Gold]    │         │
│  │             │  │ Most Popular│  │             │         │
│  │   Free      │  │   $19/mo    │  │   $49/mo    │         │
│  │             │  │             │  │             │         │
│  │ ✓ Feature 1 │  │ ✓ Feature 1 │  │ ✓ Feature 1 │         │
│  │ ✓ Feature 2 │  │ ✓ Feature 2 │  │ ✓ Feature 2 │         │
│  │ ✗ Feature 3 │  │ ✓ Feature 3 │  │ ✓ Feature 3 │         │
│  │             │  │             │  │             │         │
│  │ [Active]    │  │  [Upgrade]  │  │  [Upgrade]  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└──────────────────────────────────────────────────────────────┘
```

### Card Designs

**Basic Card**:
- Simple gray gradient
- User icon
- "Current Plan" badge (green)
- Disabled button

**Silver Card**:
- Metallic silver gradient (gray-300 to gray-400)
- Medal icon
- "Most Popular" badge (blue)
- Upgrade button (blue-purple gradient)
- Subtle shadow effect

**Gold Card**:
- Premium gold gradient (yellow-400 to yellow-600)
- Crown icon
- Upgrade button (gold gradient)
- Glowing shadow effect

---

## 4. Coach Pending Page

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│                    🕐 (Large Clock Icon)                     │
│                                                              │
│           Account Pending Verification                       │
│                                                              │
│  Your coach account is currently under review.              │
│  Please wait until the Admin reviews your documents.        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ℹ️  What happens next?                                │ │
│  │     Admin reviews in 24-48 hours                       │ │
│  │                                                        │ │
│  │  ✅  Once approved                                     │ │
│  │     You'll receive email notification                 │ │
│  │                                                        │ │
│  │  📧  Need help?                                        │ │
│  │     Contact support@sportvision.ai                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│         🟡 Status: Pending Review (animated pulse)          │
│                                                              │
│     [Back to Home]        [Try Login Again]                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Design Elements**:
- Glass morphism background
- Animated gradient blobs
- Pulsing status indicator
- Modern card with info boxes
- Smooth animations

---

## 5. Admin Coach Approval Page

### Layout
```
┌──────────────────────────────────────────────────────────────┐
│  ✅ Coach Approvals                                          │
│  Review and approve pending coach applications               │
├──────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ 🕐 3     │  │ ✅ 0     │  │ ❌ 0     │                  │
│  │ Pending  │  │ Approved │  │ Rejected │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
├──────────────────────────────────────────────────────────────┤
│  Pending Applications                                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [JD] John Doe                                         │ │
│  │       📧 john@email.com                                │ │
│  │       📱 +1234567890                                   │ │
│  │       👥 Team Alpha                                    │ │
│  │       📅 Applied: Jan 15, 2024                         │ │
│  │                                                        │ │
│  │  [View Document]  [✅ Approve]  [❌ Reject]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  [SM] Sarah Miller                                     │ │
│  │       📧 sarah@email.com                               │ │
│  │       ...                                              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Features**:
- Stats cards at top (pending, approved, rejected)
- Coach cards with avatar initials
- Contact information display
- Action buttons (View Document, Approve, Reject)
- Hover effects on cards
- Loading states during processing

---

## Color Scheme

### Subscription Plans
- **Basic**: `from-gray-500 to-gray-600`
- **Silver**: `from-gray-400 via-gray-300 to-gray-400` (metallic shine)
- **Gold**: `from-yellow-400 via-yellow-500 to-yellow-600` (premium gold)

### Status Indicators
- **Active**: Green (`green-500`)
- **Pending**: Yellow (`yellow-500`)
- **Approved**: Green (`green-500`)
- **Rejected**: Red (`red-500`)

### Buttons
- **Primary**: Blue-Purple gradient (`from-blue-500 to-purple-600`)
- **Success**: Green gradient (`from-green-500 to-emerald-600`)
- **Danger**: Red gradient (`from-red-500 to-red-600`)
- **Secondary**: Glass with white border

---

## Animations

### Password Toggle
- Smooth icon transition (200ms)
- Hover opacity change
- Click scale effect

### Subscription Cards
- Hover: Scale up (1.02) and lift (-5px)
- Border glow on hover
- Smooth transitions (300ms)

### Coach Pending Page
- Floating gradient blobs (20-25s loop)
- Pulsing status indicator
- Fade-in animations on load
- Decorative blur elements

### Admin Approval
- Card slide-in on load (staggered)
- Hover lift effect
- Button loading states
- Smooth removal on approve/reject

---

## Responsive Design

All features are fully responsive:
- **Mobile**: Single column layout, stacked cards
- **Tablet**: 2-column grid for cards
- **Desktop**: 3-column grid, full sidebar

### Breakpoints
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

---

## Accessibility

- ✅ Keyboard navigation support
- ✅ ARIA labels on interactive elements
- ✅ High contrast text
- ✅ Focus indicators
- ✅ Screen reader friendly
- ✅ Semantic HTML

---

## Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)

---

**All designs follow modern UI/UX best practices with glass morphism, smooth animations, and intuitive interactions!** 🎨
