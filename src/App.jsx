import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Trophy, Target, LogOut, Plus, ExternalLink, CheckCircle2,
  Circle, Pencil, X, Sparkles, User, Users, ChevronRight, ChevronDown,
  Link2, Trash2, LayoutDashboard, Image as ImageIcon
} from "lucide-react";
import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection, addDoc, deleteDoc,
  query, orderBy, onSnapshot
} from "firebase/firestore";

const LESSONS = [
  { id: 1, title: "Intro to the Web & HTML Basics", topics: ["How the web works", "HTML tags & elements", "Your first page"] },
  { id: 2, title: "Semantic HTML & Document Structure", topics: ["Semantic tags", "Headings & landmarks", "Document outline"] },
  { id: 3, title: "CSS Fundamentals", topics: ["Selectors", "Color & typography", "The cascade"] },
  { id: 4, title: "The Box Model & Layout Basics", topics: ["Margin, border, padding", "Display types", "Positioning"] },
  { id: 5, title: "Flexbox", topics: ["Flex containers", "Aligning & justifying", "Building a nav bar"] },
  { id: 6, title: "CSS Grid", topics: ["Grid containers", "Rows & columns", "Building a gallery layout"] },
  { id: 7, title: "Responsive Design & Media Queries", topics: ["Mobile-first design", "Breakpoints", "Fluid layouts"] },
  { id: 8, title: "Forms & User Input", topics: ["Form elements", "Validation", "Accessible labels"] },
  { id: 9, title: "Accessibility Best Practices", topics: ["Alt text", "Contrast & focus states", "Keyboard navigation"] },
  { id: 10, title: "CSS Animations & Transitions", topics: ["Transitions", "Keyframes", "Micro-interactions"] },
  { id: 11, title: "Design Principles & Visual Hierarchy", topics: ["Spacing & rhythm", "Color theory basics", "Hierarchy"] },
  { id: 12, title: "Portfolio: Planning & Wireframing", topics: ["Sitemaps", "Wireframes", "Content plan"] },
  { id: 13, title: "Portfolio: Build Week", topics: ["Building your pages", "Debugging", "Getting feedback"] },
  { id: 14, title: "Portfolio Polish & Showcase", topics: ["Final polish", "freeCodeCamp certification", "Publishing your site"] },
];

const NAVY = "text-slate-900";
// Firebase Auth needs an email. We derive one from the username so students
// can log in with just a username + password.
const usernameToEmail = (username) => `${username.trim().toLowerCase()}@codetocreate.local`;

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white border-2 border-slate-900 rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "slate" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 border-slate-300",
    amber: "bg-amber-100 text-amber-800 border-amber-300",
    green: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function ProgressRing({ completed, total = 14 }) {
  const size = 128;
  const center = size / 2;
  const radius = 52;
  const ticks = Array.from({ length: total });
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        {ticks.map((_, i) => {
          const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
          const x1 = center + Math.cos(angle) * (radius - 6);
          const y1 = center + Math.sin(angle) * (radius - 6);
          const x2 = center + Math.cos(angle) * (radius + 6);
          const y2 = center + Math.sin(angle) * (radius + 6);
          const filled = i < completed;
          return (
            <line
              key={i}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={filled ? "#d97706" : "#cbd5e1"}
              strokeWidth={filled ? 4 : 3}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="flex flex-col items-center">
        <span className="text-2xl font-extrabold text-slate-900">{completed}/{total}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">lessons</span>
      </div>
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [lessonLinks, setLessonLinks] = useState({});
  const [posts, setPosts] = useState([]);
  const [gallery, setGallery] = useState([]);

const [studentData, setStudentData] = useState({
  goal: "",
  displayName: "",
  username: "",
  role: "student",
  items: {}
});
const isAdmin = studentData.role === "admin";
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", displayName: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [view, setView] = useState("dashboard");
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [lessonDraft, setLessonDraft] = useState({});
  const [editingLinkFor, setEditingLinkFor] = useState(null);
  const [linkDraft, setLinkDraft] = useState("");

  const [goalDraft, setGoalDraft] = useState("");
  const [postDraft, setPostDraft] = useState({ title: "", content: "", link: "" });
  const [galleryDraft, setGalleryDraft] = useState({ title: "", link: "", description: "" });

  // Auth state + student profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const snap = await getDoc(doc(db, "students", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setStudentData(data);
          setGoalDraft(data.goal || "");
        }
      } else {
setStudentData({
  goal: "",
  displayName: "",
  username: "",
  role: "student",
  items: {}
});      }
      setBooting(false);
    });
    return unsub;
  }, []);

  // Shared config + live feeds
  useEffect(() => {
    getDoc(doc(db, "config", "lessonLinks")).then((snap) => {
      if (snap.exists()) setLessonLinks(snap.data());
    });
    const unsubPosts = onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc")), (qs) => {
      setPosts(qs.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const unsubGallery = onSnapshot(query(collection(db, "gallery"), orderBy("createdAt", "desc")), (qs) => {
      setGallery(qs.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubPosts(); unsubGallery(); };
  }, []);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    const uname = authForm.username.trim().toLowerCase();
    if (!uname || !authForm.password) {
      setAuthError("Enter a username and password.");
      return;
    }
    setAuthBusy(true);
    try {
      if (authMode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, usernameToEmail(uname), authForm.password);
        const fresh = {
          username: uname,
          displayName: authForm.displayName || uname,
          role: "student",
          goal: "",
          items: {},
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "students", cred.user.uid), fresh);
        setStudentData(fresh);
        setGoalDraft("");
      } else {
        await signInWithEmailAndPassword(auth, usernameToEmail(uname), authForm.password);
      }
      setView("dashboard");
      setAuthForm({ username: "", password: "", displayName: "" });
    } catch (err) {
      if (err.code === "auth/email-already-in-use") setAuthError("That username is taken. Try logging in instead.");
      else if (err.code === "auth/weak-password") setAuthError("Password should be at least 6 characters.");
      else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") setAuthError("Username or password doesn't match.");
      else setAuthError("Something went wrong. Try again.");
    }
    setAuthBusy(false);
  };

  const logout = async () => {
    await signOut(auth);
    setView("dashboard");
  };

  const saveStudentData = async (next) => {
    setStudentData(next);
    if (firebaseUser) await setDoc(doc(db, "students", firebaseUser.uid), next);
  };

  const saveGoal = async () => {
    await saveStudentData({ ...studentData, goal: goalDraft });
  };

  const toggleLessonExpand = (id) => {
    setExpandedLesson(expandedLesson === id ? null : id);
    const existing = studentData.items?.[id] || { status: "not_started", note: "", link: "" };
    setLessonDraft({ ...existing });
  };

  const saveLessonProgress = async (id, markComplete) => {
    const next = {
      ...studentData,
      items: {
        ...studentData.items,
        [id]: {
          status: markComplete ? "complete" : (lessonDraft.note || lessonDraft.link ? "in_progress" : "not_started"),
          note: lessonDraft.note || "",
          link: lessonDraft.link || "",
          updatedAt: new Date().toISOString(),
        },
      },
    };
    await saveStudentData(next);
    setExpandedLesson(null);
  };

  const saveLessonLink = async (id) => {
    const next = { ...lessonLinks, [id]: linkDraft };
    setLessonLinks(next);
    await setDoc(doc(db, "config", "lessonLinks"), next);
    setEditingLinkFor(null);
    setLinkDraft("");
  };

  const submitPost = async (e) => {
    e.preventDefault();
    if (!postDraft.title.trim() && !postDraft.content.trim()) return;
    await addDoc(collection(db, "posts"), {
      uid: firebaseUser.uid,
      displayName: studentData.displayName || studentData.username,
      title: postDraft.title,
      content: postDraft.content,
      link: postDraft.link,
      createdAt: new Date().toISOString(),
    });
    setPostDraft({ title: "", content: "", link: "" });
  };

  const deletePost = async (id) => {
    await deleteDoc(doc(db, "posts", id));
  };

  const submitGallery = async (e) => {
    e.preventDefault();
    if (!galleryDraft.title.trim() || !galleryDraft.link.trim()) return;
    await addDoc(collection(db, "gallery"), {
      uid: firebaseUser.uid,
      displayName: studentData.displayName || studentData.username,
      title: galleryDraft.title,
      link: galleryDraft.link,
      description: galleryDraft.description,
      createdAt: new Date().toISOString(),
    });
    setGalleryDraft({ title: "", link: "", description: "" });
  };

  const deleteGalleryItem = async (id) => {
    await deleteDoc(doc(db, "gallery", id));
  };

  const completedCount = Object.values(studentData.items || {}).filter((i) => i.status === "complete").length;

  if (booting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-2 text-slate-500 font-medium">
          <Sparkles className="w-5 h-5 animate-pulse" />
          Loading Code-to-Create…
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className={`text-4xl font-extrabold ${NAVY} tracking-tight`}>Code-to-Create</h1>
            <p className="text-slate-500 font-medium mt-1">Your web development learning platform</p>
          </div>
          <Card className="p-6">
            <div className="flex gap-2 mb-5 bg-slate-100 rounded-xl p-1 border border-slate-200">
              <button
                onClick={() => { setAuthMode("login"); setAuthError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${authMode === "login" ? "bg-white text-slate-900 shadow-sm border border-slate-900" : "text-slate-500"}`}
              >
                Log in
              </button>
              <button
                onClick={() => { setAuthMode("signup"); setAuthError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${authMode === "signup" ? "bg-white text-slate-900 shadow-sm border border-slate-900" : "text-slate-500"}`}
              >
                Create account
              </button>
            </div>
            <form onSubmit={handleAuth} className="space-y-3">
              {authMode === "signup" && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Display name</label>
                  <input
                    value={authForm.displayName}
                    onChange={(e) => setAuthForm({ ...authForm, displayName: e.target.value })}
                    className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2"
                    placeholder="e.g. Amina K."
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</label>
                <input
                  value={authForm.username}
                  onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                  className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2"
                  placeholder="username"
                  autoCapitalize="none"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</label>
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                  className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2"
                  placeholder="At least 6 characters"
                />
              </div>
              {authError && <p className="text-sm font-medium text-red-600">{authError}</p>}
              <button disabled={authBusy} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-lg transition disabled:opacity-60">
                {authBusy ? "Please wait…" : authMode === "login" ? "Log in" : "Create account"}
              </button>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  const NavButton = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => setView(id)}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${
        view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b-2 border-slate-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-amber-400" />
            </div>
            <span className={`font-extrabold text-lg ${NAVY}`}>Code-to-Create</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <NavButton id="dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavButton id="lessons" icon={BookOpen} label="Lessons" />
            <NavButton id="creator" icon={Sparkles} label="Creator Space" />
            <NavButton id="gallery" icon={ImageIcon} label="Gallery" />
            <NavButton id="profile" icon={User} label="Profile" />
            {isAdmin && (
            <NavButton
              id="admin"
              icon={User}
              label="Admin"
            />
          )}
          </div>
          <button onClick={logout} className="flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-slate-900">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {view === "dashboard" && (
          <div className="space-y-5">
            <Card className="p-5 flex flex-col sm:flex-row items-center gap-6">
              <ProgressRing completed={completedCount} />
              <div className="flex-1 text-center sm:text-left">
                <h2 className={`text-2xl font-extrabold ${NAVY}`}>
                  Welcome back, {studentData.displayName || studentData.username}
                </h2>
                <p className="text-slate-500 font-medium mt-1">
                  {completedCount === 14
                    ? "All 14 lessons complete — nice work! Check your certification steps in Lesson 14."
                    : `${14 - completedCount} lesson${14 - completedCount === 1 ? "" : "s"} to go. Keep building.`}
                </p>
                <div className="mt-3">
                  <div className="w-full bg-slate-200 rounded-full h-2.5 border border-slate-300 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all"
                      style={{ width: `${(completedCount / 14) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className={`font-extrabold text-lg ${NAVY} flex items-center gap-2`}>
                  <Target className="w-5 h-5 text-amber-600" /> Your goal
                </h3>
              </div>
              {studentData.goal ? (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-slate-700 font-medium">{studentData.goal}</p>
                  <button onClick={() => setView("profile")} className="text-slate-400 hover:text-slate-900 shrink-0">
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setView("profile")}
                  className="text-amber-700 font-bold text-sm hover:underline"
                >
                  Set a goal for the program →
                </button>
              )}
            </Card>

            <div className="grid sm:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className={`font-extrabold ${NAVY} mb-2 flex items-center gap-2`}>
                  <BookOpen className="w-5 h-5 text-amber-600" /> Continue learning
                </h3>
                <p className="text-slate-500 text-sm font-medium mb-3">Jump back into your next lesson.</p>
                <button
                  onClick={() => setView("lessons")}
                  className="inline-flex items-center gap-1 text-sm font-bold bg-slate-900 text-white px-3 py-2 rounded-lg"
                >
                  Go to lessons <ChevronRight className="w-4 h-4" />
                </button>
              </Card>
              <Card className="p-5">
                <h3 className={`font-extrabold ${NAVY} mb-2 flex items-center gap-2`}>
                  <Sparkles className="w-5 h-5 text-amber-600" /> Creator Space
                </h3>
                <p className="text-slate-500 text-sm font-medium mb-3">Share anything you're working on — no lesson required.</p>
                <button
                  onClick={() => setView("creator")}
                  className="inline-flex items-center gap-1 text-sm font-bold bg-slate-900 text-white px-3 py-2 rounded-lg"
                >
                  Open Creator Space <ChevronRight className="w-4 h-4" />
                </button>
              </Card>
            </div>
          </div>
        )}

        {view === "lessons" && (
          <div className="space-y-3">
            <div className="flex items-baseline justify-between mb-1">
              <h2 className={`text-2xl font-extrabold ${NAVY}`}>Lessons</h2>
              <span className="text-sm font-bold text-slate-500">{completedCount}/14 complete</span>
            </div>
            {LESSONS.map((lesson) => {
              const item = studentData.items?.[lesson.id] || { status: "not_started" };
              const isOpen = expandedLesson === lesson.id;
              const link = lessonLinks[lesson.id];
              return (
                <Card key={lesson.id} className="overflow-hidden">
                  <button
                    onClick={() => toggleLessonExpand(lesson.id)}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <span className="shrink-0">
                      {item.status === "complete" ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300" />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-amber-700">WEEK {lesson.id}</span>
                        {item.status === "in_progress" && <Badge tone="amber">In progress</Badge>}
                        {item.status === "complete" && <Badge tone="green">Complete</Badge>}
                      </div>
                      <h3 className={`font-bold ${NAVY} truncate`}>{lesson.title}</h3>
                    </div>
                    {isOpen ? <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" /> : <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 border-t-2 border-slate-100 pt-4 space-y-4">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Topics</span>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {lesson.topics.map((t) => (
                            <li key={t} className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{t}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Slides</span>
                        {editingLinkFor === lesson.id ? (
                          <div className="flex gap-2 mt-1">
                            <input
                              value={linkDraft}
                              onChange={(e) => setLinkDraft(e.target.value)}
                              placeholder="Paste the PPT / Google Slides link"
                              className="flex-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-2 py-1.5 text-sm"
                            />
                            <button onClick={() => saveLessonLink(lesson.id)} className="bg-slate-900 text-white text-sm font-bold px-3 rounded-lg">Save</button>
                            <button onClick={() => setEditingLinkFor(null)} className="text-slate-400"><X className="w-5 h-5" /></button>
                          </div>
                        ) : link ? (
                          <div className="flex items-center gap-2 mt-1">
                            <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" /> Open Week {lesson.id} slides
                            </a>
                            <button onClick={() => { setEditingLinkFor(lesson.id); setLinkDraft(link); }} className="text-slate-400 hover:text-slate-700">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingLinkFor(lesson.id); setLinkDraft(""); }}
                            className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-700"
                          >
                            <Link2 className="w-3.5 h-3.5" /> No slides added yet — add link
                          </button>
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Your progress</span>
                        <textarea
                          value={lessonDraft.note || ""}
                          onChange={(e) => setLessonDraft({ ...lessonDraft, note: e.target.value })}
                          placeholder="What did you build or learn this week?"
                          rows={3}
                          className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                        />
                        <input
                          value={lessonDraft.link || ""}
                          onChange={(e) => setLessonDraft({ ...lessonDraft, link: e.target.value })}
                          placeholder="Link to your code / CodePen / repo (optional)"
                          className="w-full mt-2 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveLessonProgress(lesson.id, false)}
                          className="flex-1 border-2 border-slate-900 text-slate-900 font-bold text-sm py-2 rounded-lg hover:bg-slate-100"
                        >
                          Save progress
                        </button>
                        <button
                          onClick={() => saveLessonProgress(lesson.id, true)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2 rounded-lg"
                        >
                          Mark complete
                        </button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {view === "creator" && (
          <div className="space-y-5">
            <div>
              <h2 className={`text-2xl font-extrabold ${NAVY}`}>Creator Space</h2>
              <p className="text-slate-500 font-medium">Post anything you're making — side projects, experiments, questions, wins.</p>
            </div>
            <Card className="p-4">
              <form onSubmit={submitPost} className="space-y-2">
                <input
                  value={postDraft.title}
                  onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value })}
                  placeholder="Title"
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 font-bold"
                />
                <textarea
                  value={postDraft.content}
                  onChange={(e) => setPostDraft({ ...postDraft, content: e.target.value })}
                  placeholder="What's on your mind?"
                  rows={3}
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <input
                  value={postDraft.link}
                  onChange={(e) => setPostDraft({ ...postDraft, link: e.target.value })}
                  placeholder="Link (optional)"
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg">
                  <Plus className="w-4 h-4" /> Post
                </button>
              </form>
            </Card>

            <div className="space-y-3">
              {posts.length === 0 && (
                <p className="text-center text-slate-400 font-medium py-8">Nothing here yet — be the first to post.</p>
              )}
              {posts.map((p) => (
                <Card key={p.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wide">
                        <Users className="w-3.5 h-3.5" /> {p.displayName}
                      </div>
                      {p.title && <h3 className={`font-extrabold ${NAVY} mt-1`}>{p.title}</h3>}
                    </div>
                    {p.uid === firebaseUser.uid && (
                      <button onClick={() => deletePost(p.id)} className="text-slate-300 hover:text-red-600 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {p.content && <p className="text-slate-700 text-sm mt-1 whitespace-pre-wrap">{p.content}</p>}
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline mt-2">
                      <ExternalLink className="w-3.5 h-3.5" /> View link
                    </a>
                  )}
                </Card>
              ))}
            </div>
          </div>
        )}

        {view === "gallery" && (
          <div className="space-y-5">
            <div>
              <h2 className={`text-2xl font-extrabold ${NAVY}`}>Student Gallery</h2>
              <p className="text-slate-500 font-medium">Finished portfolio sites, shared for the whole class to see.</p>
            </div>
            <Card className="p-4">
              <form onSubmit={submitGallery} className="space-y-2">
                <input
                  value={galleryDraft.title}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, title: e.target.value })}
                  placeholder="Project title"
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 font-bold"
                />
                <input
                  value={galleryDraft.link}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, link: e.target.value })}
                  placeholder="Live site link"
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <textarea
                  value={galleryDraft.description}
                  onChange={(e) => setGalleryDraft({ ...galleryDraft, description: e.target.value })}
                  placeholder="Tell us about it"
                  rows={2}
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <button type="submit" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg">
                  <Plus className="w-4 h-4" /> Add to gallery
                </button>
              </form>
            </Card>
            <div className="grid sm:grid-cols-2 gap-4">
              {gallery.length === 0 && (
                <p className="text-center text-slate-400 font-medium py-8 sm:col-span-2">No portfolios yet — finish Lesson 14 and add yours!</p>
              )}
              {gallery.map((g) => (
                <Card key={g.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-extrabold ${NAVY}`}>{g.title}</h3>
                    {g.uid === firebaseUser.uid && (
                      <button onClick={() => deleteGalleryItem(g.id)} className="text-slate-300 hover:text-red-600 shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">by {g.displayName}</p>
                  {g.description && <p className="text-slate-700 text-sm mt-2">{g.description}</p>}
                  <a href={g.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline mt-2">
                    <ExternalLink className="w-3.5 h-3.5" /> Visit site
                  </a>
                </Card>
              ))}
            </div>
          </div>
        )}

        {view === "profile" && (
          <div className="space-y-5 max-w-lg">
            <h2 className={`text-2xl font-extrabold ${NAVY}`}>Profile</h2>
            <Card className="p-5 space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Name</span>
                <p className={`font-bold ${NAVY}`}>{studentData.displayName || studentData.username}</p>
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Username</span>
                <p className="font-medium text-slate-600">{studentData.username}</p>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-slate-400">Your goal for this program</label>
                <textarea
                  value={goalDraft}
                  onChange={(e) => setGoalDraft(e.target.value)}
                  placeholder="e.g. Build and publish my portfolio site by week 14"
                  rows={3}
                  className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <button onClick={saveGoal} className="mt-2 bg-slate-900 text-white font-bold text-sm px-4 py-2 rounded-lg">
                  Save goal
                </button>
              </div>
              <div className="pt-3 border-t border-slate-200 flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-amber-600" />
                <span className="font-medium text-slate-600">{completedCount} of 14 lessons complete</span>
              </div>
            </Card>
          </div>
        )}
        {view === "admin" && isAdmin && (
  <div className="space-y-6">
    <h2 className="text-3xl font-extrabold text-slate-900">
      Admin Dashboard
    </h2>

    <Card className="p-5">
      <h3 className="font-bold text-xl mb-3">
        Welcome, Admin
      </h3>

      <p className="text-slate-600 mb-4">
        This is where you'll manage the platform.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">

        <button
          className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100"
        >
          📚 Manage Lessons
        </button>

        <button
          className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100"
        >
          📢 Announcements
        </button>

        <button
          className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100"
        >
          👩‍🎓 Students
        </button>

        <button
          className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100"
        >
          🖼 Gallery
        </button>

      </div>
    </Card>
  </div>
)}
      </main>
    </div>
  );
}
