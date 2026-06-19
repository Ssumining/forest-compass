const Icon = ({ size = 18, stroke = 1.75, className = '', children, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
    className={className} {...rest}
  >
    {children}
  </svg>
);

export const I = {
  Trees:         (p) => (<Icon {...p}><path d="M10 10v.2A3 3 0 0 1 8.9 16v0H5v0h0a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6-3"/><path d="M7 16v6"/><path d="M13 19h6"/><path d="M16 19v3"/><path d="M16 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M20 13a3 3 0 1 0-3-5"/></Icon>),
  Bot:           (p) => (<Icon {...p}><rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 3v3"/><circle cx="9" cy="14" r="1.2"/><circle cx="15" cy="14" r="1.2"/><path d="M8 18h8"/></Icon>),
  Search:        (p) => (<Icon {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Icon>),
  Camera:        (p) => (<Icon {...p}><path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2Z"/><circle cx="12" cy="13" r="3.5"/></Icon>),
  Calc:          (p) => (<Icon {...p}><rect x="4" y="3" width="16" height="18" rx="2"/><rect x="7" y="6" width="10" height="4" rx="1"/><circle cx="8.5" cy="14" r=".7"/><circle cx="12" cy="14" r=".7"/><circle cx="15.5" cy="14" r=".7"/><circle cx="8.5" cy="17.5" r=".7"/><circle cx="12" cy="17.5" r=".7"/><circle cx="15.5" cy="17.5" r=".7"/></Icon>),
  Map:           (p) => (<Icon {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14"/><path d="M15 6v14"/></Icon>),
  Layers:        (p) => (<Icon {...p}><path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 14 9 5 9-5"/></Icon>),
  Compass:       (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m14.5 9.5-2.5 5-5 2.5 2.5-5 5-2.5Z"/></Icon>),
  Sliders:       (p) => (<Icon {...p}><path d="M4 6h10"/><path d="M18 6h2"/><path d="M4 12h4"/><path d="M12 12h8"/><path d="M4 18h12"/><path d="M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></Icon>),
  Doc:           (p) => (<Icon {...p}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h6"/></Icon>),
  Download:      (p) => (<Icon {...p}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></Icon>),
  Check:         (p) => (<Icon {...p}><path d="m5 12 5 5L20 7"/></Icon>),
  CheckCircle:   (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></Icon>),
  X:             (p) => (<Icon {...p}><path d="m6 6 12 12"/><path d="m6 18 12-12"/></Icon>),
  ChevDown:      (p) => (<Icon {...p}><path d="m6 9 6 6 6-6"/></Icon>),
  ChevRight:     (p) => (<Icon {...p}><path d="m9 6 6 6-6 6"/></Icon>),
  ChevUp:        (p) => (<Icon {...p}><path d="m6 15 6-6 6 6"/></Icon>),
  Info:          (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8h.01"/><path d="M11 12h1v4h1"/></Icon>),
  Sparkles:      (p) => (<Icon {...p}><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/><path d="m5.6 5.6 2.1 2.1"/><path d="m16.3 16.3 2.1 2.1"/><path d="m16.3 7.7 2.1-2.1"/><path d="m5.6 18.4 2.1-2.1"/></Icon>),
  Flame:         (p) => (<Icon {...p}><path d="M12 22c4 0 7-3 7-7 0-3-2-5-3-6-1 2-2 3-4 3 0-3 1-5 3-8-6 1-10 6-10 11 0 4 3 7 7 7Z"/></Icon>),
  Robot:         (p) => (<Icon {...p}><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M8 17h8"/><path d="M12 3v4"/><circle cx="12" cy="3" r="1"/></Icon>),
  Send:          (p) => (<Icon {...p}><path d="m4 12 16-8-6 18-2-8-8-2Z"/></Icon>),
  Mic:           (p) => (<Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></Icon>),
  Paperclip:     (p) => (<Icon {...p}><path d="m21 12-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/></Icon>),
  TriangleAlert: (p) => (<Icon {...p}><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4"/><path d="M12 17h.01"/></Icon>),
  Mountain:      (p) => (<Icon {...p}><path d="m3 20 6-10 4 5 3-3 5 8H3Z"/></Icon>),
  Zap:           (p) => (<Icon {...p}><path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z"/></Icon>),
  Leaf:          (p) => (<Icon {...p}><path d="M4 20c8 0 16-8 16-16-4 0-13 1-15 9-1.5 6 2 7 2 7"/><path d="M4 20c2-6 7-10 12-12"/></Icon>),
  Coins:         (p) => (<Icon {...p}><ellipse cx="9" cy="8" rx="6" ry="3"/><path d="M3 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8"/><ellipse cx="15" cy="14" rx="6" ry="3"/><path d="M9 14v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4"/></Icon>),
  ShieldCheck:   (p) => (<Icon {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></Icon>),
  Pin:           (p) => (<Icon {...p}><path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></Icon>),
  Settings:      (p) => (<Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></Icon>),
  Loader:        (p) => (<Icon {...p}><path d="M12 3v4"/><path d="M12 17v4"/><path d="m4.9 4.9 2.8 2.8"/><path d="m16.3 16.3 2.8 2.8"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m4.9 19.1 2.8-2.8"/><path d="m16.3 7.7 2.8-2.8"/></Icon>),
  Clock:         (p) => (<Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>),
  Pencil:        (p) => (<Icon {...p}><path d="M4 20h4l11-11-4-4L4 16Z"/><path d="m13 6 4 4"/></Icon>),
  Eye:           (p) => (<Icon {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></Icon>),
  MessageSquare: (p) => (<Icon {...p}><path d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-9l-5 4V5Z"/></Icon>),
  Activity:      (p) => (<Icon {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Icon>),
  History:       (p) => (<Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v5l3 2"/></Icon>),
  PanelLeft:     (p) => (<Icon {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></Icon>),
  Plus:          (p) => (<Icon {...p}><path d="M12 5v14"/><path d="M5 12h14"/></Icon>),
  Star:          (p) => (<Icon {...p}><path d="m12 3 2.7 5.6 6.2.9-4.5 4.3 1.1 6.1L12 17l-5.5 2.9 1.1-6.1L3.1 9.5l6.2-.9L12 3Z"/></Icon>),
};
