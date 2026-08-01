import React, { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Trophy, Target, LogOut, Plus, ExternalLink, CheckCircle2,
  Circle, Pencil, X, Sparkles, User, Users, ChevronRight, ChevronDown,
  Link2, Trash2, LayoutDashboard, Image as ImageIcon, Code, Copy,
  Camera, Maximize2, GalleryHorizontalEnd, Rocket, ArrowLeft, GraduationCap
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
  { id: 1, title: "Intro to the Web & Setting Up", topics: ["How the web works", "VS Code", "Your first page"] },
  { id: 2, title: "Developer Workflow", topics: ["GitHub", "Repository", "Uploading code"] },
  { id: 3, title: "HTML Foundations", topics: ["HTML attributes", "Links", "Images"] },
  { id: 4, title: "Structuring a Website", topics: ["div", "Classes", "nav"] },
  { id: 5, title: "Multimedia & Tables", topics: ["Video", "tbody", "Tables"] },
  { id: 6, title: "Forms", topics: ["Placeholder", "Labels", "Email"] },
  { id: 7, title: "Accessibility & Good HTML", topics: ["Semantic review", "DevTools", "HTML validator"] },
  { id: 8, title: "HTML Final Project", topics: ["Final HTML", "Requirements", "Navigation"] },
  { id: 9, title: "CSS Basics", topics: ["External CSS", "Selectors", "Borders"] },
  { id: 10, title: "Box Model & Layout", topics: ["Margin", "Padding", "Shadows"] },
  { id: 11, title: "Flexbox", topics: ["justify-content", "align-items", "flex-wrap"] },
  { id: 12, title: "Forms, Colors & Typography", topics: ["Typography", "Google Fonts", "Hover"] },
  { id: 13, title: "Responsive Design", topics: ["Relative units", "Responsive images", "Mobile layouts"] },
  { id: 14, title: "Advanced CSS & Final Showcase", topics: ["Final polish", "freeCodeCamp certification", "Deployment"] },
];

const NAVY = "text-slate-900";
const MAX_ORIGINAL_FILE_BYTES = 12 * 1024 * 1024; // guard against absurd originals
// Firebase Auth needs an email. We derive one from the username so students
// can log in with just a username + password.
const usernameToEmail = (username) => `${username.trim().toLowerCase()}@codetocreate.local`;

// Images are compressed in the browser and stored directly inside Firestore
// documents as base64 data URLs — no third-party image service needed.
// Firestore caps a document at 1MB total, so we keep each image small.
function resizeImageToDataURL(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height >= width && height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => reject(new Error("Couldn't read that image."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

async function processImages(files, { maxDim = 900, quality = 0.65, maxBytes = 700 * 1024 } = {}) {
  const results = [];
  const errors = [];
  for (const file of files) {
    if (!file) continue;
    if (file.size > MAX_ORIGINAL_FILE_BYTES) {
      errors.push(`${file.name} is too large to process.`);
      continue;
    }
    try {
      let dataUrl = await resizeImageToDataURL(file, maxDim, quality);
      // If it's still too big for a comfortable Firestore doc, compress harder.
      if (dataUrl.length * 0.75 > maxBytes) {
        dataUrl = await resizeImageToDataURL(file, Math.round(maxDim * 0.65), 0.45);
      }
      results.push({ url: dataUrl, path: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    } catch (e) {
      console.error("image processing error", e);
      errors.push(`${file.name} couldn't be processed.`);
    }
  }
  if (errors.length) {
    alert("Some images had a problem:\n\n" + errors.join("\n"));
  }
  return results;
}

function Card({ children, className = "", ...rest }) {
  return (
    <div className={`bg-white border-2 border-slate-900 rounded-2xl ${className}`} {...rest}>
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

function Avatar({ url, name, size = 8 }) {
  const sizeClass = { 8: "w-8 h-8 text-xs", 10: "w-10 h-10 text-sm", 16: "w-16 h-16 text-lg", 24: "w-24 h-24 text-2xl" }[size] || "w-8 h-8 text-xs";
  if (url) {
    return <img src={url} alt={name} className={`${sizeClass} rounded-full object-cover border-2 border-slate-900 shrink-0`} />;
  }
  const initial = (name || "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`${sizeClass} rounded-full bg-slate-900 text-white flex items-center justify-center font-extrabold shrink-0`}>
      {initial}
    </div>
  );
}

function ImagePicker({ existingImages = [], onRemoveExisting, pendingPreviews, onAddFiles, onRemovePending, label = "Screenshots (optional)" }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-2 mt-1.5">
        {existingImages.map((img, i) => (
          <div key={img.path || i} className="relative">
            <img src={img.url} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-300" />
            {onRemoveExisting && (
              <button
                type="button"
                onClick={() => onRemoveExisting(i)}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        {pendingPreviews.map((src, i) => (
          <div key={`pending-${i}`} className="relative">
            <img src={src} alt="" className="w-16 h-16 object-cover rounded-lg border-2 border-amber-400" />
            <button
              type="button"
              onClick={() => onRemovePending(i)}
              className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full w-5 h-5 flex items-center justify-center"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <label className="w-16 h-16 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-slate-500 text-slate-400 hover:text-slate-600">
          <Camera className="w-5 h-5" />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              onAddFiles(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}

function CodeField({ value, onChange, label = "Paste your code (optional)" }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste your HTML/CSS/JS here..."
        rows={5}
        spellCheck={false}
        className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-xs font-mono bg-slate-50"
      />
    </div>
  );
}

// Side-by-side preview shown on feed cards: bigger photo(s) on the left,
// a truncated code snippet on the right. Click the card to see it in full.
function PreviewRow({ images, code }) {
  if ((!images || images.length === 0) && !code) return null;
  return (
    <div className="flex gap-3 mt-3">
      {images && images.length > 0 && (
        <div className="flex gap-1.5 shrink-0">
          {images.slice(0, 2).map((img, i) => (
            <img key={img.path || i} src={img.url} alt="" className="w-24 h-24 object-cover rounded-lg border border-slate-200" />
          ))}
          {images.length > 2 && (
            <div className="w-24 h-24 rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500 shrink-0">
              +{images.length - 2}
            </div>
          )}
        </div>
      )}
      {code && (
        <div className="flex-1 min-w-0 bg-slate-900 rounded-lg p-2.5 overflow-hidden">
          <pre className="text-slate-100 text-[10px] leading-snug font-mono whitespace-pre-wrap line-clamp-4">{code}</pre>
        </div>
      )}
    </div>
  );
}

function SubmissionModal({ item, onClose }) {
  if (!item) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl border-2 border-slate-900 max-w-2xl w-full max-h-[85vh] overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <Avatar url={item.photoURL} name={item.displayName} size={10} />
            <div>
              <h3 className={`font-extrabold text-lg ${NAVY}`}>{item.title || "Untitled"}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">by {item.displayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {(item.content || item.description) && (
          <p className="text-slate-700 text-sm whitespace-pre-wrap mb-3">{item.content || item.description}</p>
        )}

        {item.link && (
          <a href={item.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline mb-3">
            <ExternalLink className="w-3.5 h-3.5" /> Open link
          </a>
        )}

        {item.images?.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {item.images.map((img, i) => (
              <img key={img.path || i} src={img.url} alt="" className="rounded-lg border border-slate-200 w-full h-32 object-cover" />
            ))}
          </div>
        )}

        {item.code && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
                <Code className="w-3.5 h-3.5" /> Code
              </span>
              <button
                onClick={() => navigator.clipboard?.writeText(item.code)}
                className="text-xs font-bold text-amber-700 hover:underline flex items-center gap-1"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <pre className="bg-slate-900 text-slate-100 text-xs rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono">{item.code}</pre>
          </div>
        )}
      </div>
    </div>
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

function completedCountFor(studentItems) {
  return Object.values(studentItems || {}).filter((i) => i.status === "complete").length;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [lessonLinks, setLessonLinks] = useState({});
  const [posts, setPosts] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [lessonSubmissions, setLessonSubmissions] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  const [studentData, setStudentData] = useState({
    goal: "",
    displayName: "",
    username: "",
    role: "student",
    photoURL: "",
    items: {}
  });
  const isAdmin = studentData.role === "admin";
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "", displayName: "" });
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);

  const [view, setView] = useState("dashboard");
  const [galleryTab, setGalleryTab] = useState("progress"); // "progress" | "portfolios"
  const [classroomSelectedUid, setClassroomSelectedUid] = useState(null);
  const [expandedLesson, setExpandedLesson] = useState(null);
  const [lessonDraft, setLessonDraft] = useState({ note: "", link: "", code: "", images: [], pendingFiles: [], pendingPreviews: [] });
  const [editingLinkFor, setEditingLinkFor] = useState(null);
  const [linkDraft, setLinkDraft] = useState("");

  const [goalDraft, setGoalDraft] = useState("");
  const [postDraft, setPostDraft] = useState({ title: "", content: "", link: "", code: "", pendingFiles: [], pendingPreviews: [] });
  const [galleryDraft, setGalleryDraft] = useState({ title: "", link: "", description: "", code: "", pendingFiles: [], pendingPreviews: [] });
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [modalItem, setModalItem] = useState(null);
  const [savingLesson, setSavingLesson] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);

  // Auth state + student profile
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const snap = await getDoc(doc(db, "students", user.uid));
          if (snap.exists()) {
            const data = snap.data();
            setStudentData(data);
            setGoalDraft(data.goal || "");
          }
        } catch (e) {
          console.error("load profile error", e);
          alert("Couldn't load your profile: " + e.message);
        }
      } else {
        setStudentData({ goal: "", displayName: "", username: "", role: "student", photoURL: "", items: {} });
      }
      setBooting(false);
    });
    return unsub;
  }, []);

  // Shared config + live feeds
  useEffect(() => {
    getDoc(doc(db, "config", "lessonLinks")).then((snap) => {
      if (snap.exists()) setLessonLinks(snap.data());
    }).catch((e) => console.error("load lesson links error", e));

    const unsubPosts = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc")),
      (qs) => setPosts(qs.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("posts listener error", e)
    );
    const unsubGallery = onSnapshot(
      query(collection(db, "gallery"), orderBy("createdAt", "desc")),
      (qs) => setGallery(qs.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("gallery listener error", e)
    );
    const unsubLessonSubs = onSnapshot(
      query(collection(db, "lessonSubmissions"), orderBy("updatedAt", "desc")),
      (qs) => setLessonSubmissions(qs.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("lesson submissions listener error", e)
    );
    const unsubStudents = onSnapshot(
      collection(db, "students"),
      (qs) => setAllStudents(qs.docs.map((d) => ({ uid: d.id, ...d.data() }))),
      (e) => console.error("students listener error", e)
    );
    return () => { unsubPosts(); unsubGallery(); unsubLessonSubs(); unsubStudents(); };
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
          photoURL: "",
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
      else setAuthError("Something went wrong: " + err.message);
    }
    setAuthBusy(false);
  };

  const logout = async () => {
    await signOut(auth);
    setView("dashboard");
  };

  const saveStudentData = async (next) => {
    setStudentData(next);
    if (firebaseUser) {
      try {
        await setDoc(doc(db, "students", firebaseUser.uid), next);
      } catch (e) {
        console.error("save student data error", e);
        alert("Couldn't save: " + e.message);
        throw e;
      }
    }
  };

  const saveGoal = async () => {
    try {
      await saveStudentData({ ...studentData, goal: goalDraft });
    } catch (e) { /* already alerted */ }
  };

  const handleAvatarChange = async (file) => {
    if (!file || !firebaseUser) return;
    setAvatarBusy(true);
    try {
      const [processed] = await processImages([file], { maxDim: 400, quality: 0.7, maxBytes: 250 * 1024 });
      if (processed) {
        await saveStudentData({ ...studentData, photoURL: processed.url });
      }
    } catch (e) {
      console.error("avatar error", e);
    }
    setAvatarBusy(false);
  };

  const toggleLessonExpand = (id) => {
    if (expandedLesson === id) {
      setExpandedLesson(null);
      return;
    }
    setExpandedLesson(id);
    const existing = studentData.items?.[id] || {};
    setLessonDraft({
      note: existing.note || "",
      link: existing.link || "",
      code: existing.code || "",
      images: existing.images || [],
      pendingFiles: [],
      pendingPreviews: [],
    });
  };

  const addLessonFiles = (files) => {
    const previews = files.map((f) => URL.createObjectURL(f));
    setLessonDraft((d) => ({
      ...d,
      pendingFiles: [...d.pendingFiles, ...files],
      pendingPreviews: [...d.pendingPreviews, ...previews],
    }));
  };
  const removeLessonPending = (i) => {
    setLessonDraft((d) => ({
      ...d,
      pendingFiles: d.pendingFiles.filter((_, idx) => idx !== i),
      pendingPreviews: d.pendingPreviews.filter((_, idx) => idx !== i),
    }));
  };
  const removeLessonExisting = (i) => {
    setLessonDraft((d) => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }));
  };

  const saveLessonProgress = async (id, markComplete) => {
    setSavingLesson(true);
    try {
      const processed = await processImages(lessonDraft.pendingFiles);
      const finalImages = [...lessonDraft.images, ...processed];
      const hasContent = !!(lessonDraft.note || lessonDraft.link || lessonDraft.code || finalImages.length || markComplete);
      const status = markComplete ? "complete" : (hasContent ? "in_progress" : "not_started");

      const next = {
        ...studentData,
        items: {
          ...studentData.items,
          [id]: {
            status,
            note: lessonDraft.note || "",
            link: lessonDraft.link || "",
            code: lessonDraft.code || "",
            images: finalImages,
            updatedAt: new Date().toISOString(),
          },
        },
      };
      await saveStudentData(next);

      // Mirror into the shared, class-visible feed so it shows up in
      // Gallery -> Lesson Progress and on the Classroom page.
      const subRef = doc(db, "lessonSubmissions", `${firebaseUser.uid}_${id}`);
      if (hasContent) {
        await setDoc(subRef, {
          uid: firebaseUser.uid,
          displayName: studentData.displayName || studentData.username,
          photoURL: studentData.photoURL || "",
          lessonId: id,
          lessonTitle: LESSONS.find((l) => l.id === id)?.title || `Week ${id}`,
          status,
          note: lessonDraft.note || "",
          code: lessonDraft.code || "",
          link: lessonDraft.link || "",
          images: finalImages,
          updatedAt: new Date().toISOString(),
        });
      } else {
        await deleteDoc(subRef).catch(() => {});
      }

      setExpandedLesson(null);
    } catch (e) {
      console.error("save lesson progress error", e);
      alert("Couldn't save your progress: " + e.message);
    }
    setSavingLesson(false);
  };

  const saveLessonLink = async (id) => {
    if (!isAdmin) return;
    try {
      const next = { ...lessonLinks, [id]: linkDraft };
      setLessonLinks(next);
      await setDoc(doc(db, "config", "lessonLinks"), next);
      setEditingLinkFor(null);
      setLinkDraft("");
    } catch (e) {
      console.error("save lesson link error", e);
      alert("Couldn't save the link: " + e.message);
    }
  };

  const addPostFiles = (files) => {
    const previews = files.map((f) => URL.createObjectURL(f));
    setPostDraft((d) => ({ ...d, pendingFiles: [...d.pendingFiles, ...files], pendingPreviews: [...d.pendingPreviews, ...previews] }));
  };
  const removePostPending = (i) => {
    setPostDraft((d) => ({
      ...d,
      pendingFiles: d.pendingFiles.filter((_, idx) => idx !== i),
      pendingPreviews: d.pendingPreviews.filter((_, idx) => idx !== i),
    }));
  };

  const submitPost = async (e) => {
    e.preventDefault();
    if (!postDraft.title.trim() && !postDraft.content.trim() && !postDraft.code.trim() && postDraft.pendingFiles.length === 0) return;
    setPostBusy(true);
    try {
      const images = await processImages(postDraft.pendingFiles);
      await addDoc(collection(db, "posts"), {
        uid: firebaseUser.uid,
        displayName: studentData.displayName || studentData.username,
        photoURL: studentData.photoURL || "",
        title: postDraft.title,
        content: postDraft.content,
        link: postDraft.link,
        code: postDraft.code,
        images,
        createdAt: new Date().toISOString(),
      });
      setPostDraft({ title: "", content: "", link: "", code: "", pendingFiles: [], pendingPreviews: [] });
    } catch (e) {
      console.error("submit post error", e);
      alert("Couldn't post: " + e.message);
    }
    setPostBusy(false);
  };

  const deletePost = async (post) => {
    try {
      await deleteDoc(doc(db, "posts", post.id));
    } catch (e) {
      console.error("delete post error", e);
      alert("Couldn't delete: " + e.message);
    }
  };

  const addGalleryFiles = (files) => {
    const previews = files.map((f) => URL.createObjectURL(f));
    setGalleryDraft((d) => ({ ...d, pendingFiles: [...d.pendingFiles, ...files], pendingPreviews: [...d.pendingPreviews, ...previews] }));
  };
  const removeGalleryPending = (i) => {
    setGalleryDraft((d) => ({
      ...d,
      pendingFiles: d.pendingFiles.filter((_, idx) => idx !== i),
      pendingPreviews: d.pendingPreviews.filter((_, idx) => idx !== i),
    }));
  };

  const submitGallery = async (e) => {
    e.preventDefault();
    if (!galleryDraft.title.trim() || !galleryDraft.link.trim()) return;
    setGalleryBusy(true);
    try {
      const images = await processImages(galleryDraft.pendingFiles);
      await addDoc(collection(db, "gallery"), {
        uid: firebaseUser.uid,
        displayName: studentData.displayName || studentData.username,
        photoURL: studentData.photoURL || "",
        title: galleryDraft.title,
        link: galleryDraft.link,
        description: galleryDraft.description,
        code: galleryDraft.code,
        images,
        createdAt: new Date().toISOString(),
      });
      setGalleryDraft({ title: "", link: "", description: "", code: "", pendingFiles: [], pendingPreviews: [] });
    } catch (e) {
      console.error("submit gallery error", e);
      alert("Couldn't add to gallery: " + e.message);
    }
    setGalleryBusy(false);
  };

  const deleteGalleryItem = async (item) => {
    try {
      await deleteDoc(doc(db, "gallery", item.id));
    } catch (e) {
      console.error("delete gallery item error", e);
      alert("Couldn't delete: " + e.message);
    }
  };

  const completedCount = completedCountFor(studentData.items);

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
      onClick={() => { setView(id); setClassroomSelectedUid(null); }}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${
        view === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );

  const selectedStudent = allStudents.find((s) => s.uid === classroomSelectedUid);
  const selectedStudentLessonSubs = classroomSelectedUid
    ? lessonSubmissions.filter((s) => s.uid === classroomSelectedUid).sort((a, b) => a.lessonId - b.lessonId)
    : [];
  const selectedStudentPosts = classroomSelectedUid ? posts.filter((p) => p.uid === classroomSelectedUid) : [];
  const selectedStudentGallery = classroomSelectedUid ? gallery.filter((g) => g.uid === classroomSelectedUid) : [];

  return (
    <div className="min-h-screen bg-slate-100">
      <SubmissionModal item={modalItem} onClose={() => setModalItem(null)} />

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
            <NavButton id="classroom" icon={GraduationCap} label="Classroom" />
            <NavButton id="profile" icon={User} label="Profile" />
            {isAdmin && (
              <NavButton id="admin" icon={User} label="Admin" />
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
                <div className="flex items-center gap-3 justify-center sm:justify-start">
                  <Avatar url={studentData.photoURL} name={studentData.displayName || studentData.username} size={10} />
                  <h2 className={`text-2xl font-extrabold ${NAVY}`}>
                    Welcome back, {studentData.displayName || studentData.username}
                  </h2>
                </div>
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
                            {isAdmin && (
                              <button
                                onClick={() => { setEditingLinkFor(lesson.id); setLinkDraft(link); }}
                                className="text-slate-400 hover:text-slate-700"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          isAdmin && (
                            <button
                              onClick={() => { setEditingLinkFor(lesson.id); setLinkDraft(""); }}
                              className="mt-1 flex items-center gap-1 text-sm font-medium text-slate-400 hover:text-slate-700"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              No slides added yet — add link
                            </button>
                          )
                        )}
                      </div>

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Your progress notes</span>
                        <textarea
                          value={lessonDraft.note || ""}
                          onChange={(e) => setLessonDraft({ ...lessonDraft, note: e.target.value })}
                          placeholder="What did you build or learn this week?"
                          rows={3}
                          className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                        />
                      </div>

                      <CodeField
                        value={lessonDraft.code || ""}
                        onChange={(v) => setLessonDraft({ ...lessonDraft, code: v })}
                      />

                      <ImagePicker
                        label="Photos of your progress (optional)"
                        existingImages={lessonDraft.images}
                        onRemoveExisting={removeLessonExisting}
                        pendingPreviews={lessonDraft.pendingPreviews}
                        onAddFiles={addLessonFiles}
                        onRemovePending={removeLessonPending}
                      />

                      <div>
                        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Link to your code (optional)</span>
                        <input
                          value={lessonDraft.link || ""}
                          onChange={(e) => setLessonDraft({ ...lessonDraft, link: e.target.value })}
                          placeholder="CodePen / Replit / GitHub repo link"
                          className="w-full mt-1 border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          disabled={savingLesson}
                          onClick={() => saveLessonProgress(lesson.id, false)}
                          className="flex-1 border-2 border-slate-900 text-slate-900 font-bold text-sm py-2 rounded-lg hover:bg-slate-100 disabled:opacity-60"
                        >
                          {savingLesson ? "Saving…" : "Save progress"}
                        </button>
                        <button
                          disabled={savingLesson}
                          onClick={() => saveLessonProgress(lesson.id, true)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm py-2 rounded-lg disabled:opacity-60"
                        >
                          {savingLesson ? "Saving…" : "Mark complete"}
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
              <form onSubmit={submitPost} className="space-y-3">
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
                <CodeField value={postDraft.code} onChange={(v) => setPostDraft({ ...postDraft, code: v })} />
                <ImagePicker
                  pendingPreviews={postDraft.pendingPreviews}
                  onAddFiles={addPostFiles}
                  onRemovePending={removePostPending}
                />
                <input
                  value={postDraft.link}
                  onChange={(e) => setPostDraft({ ...postDraft, link: e.target.value })}
                  placeholder="Link (optional)"
                  className="w-full border-2 border-slate-300 focus:border-slate-900 outline-none rounded-lg px-3 py-2 text-sm"
                />
                <button disabled={postBusy} type="submit" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-60">
                  <Plus className="w-4 h-4" /> {postBusy ? "Posting…" : "Post"}
                </button>
              </form>
            </Card>

            <div className="space-y-3">
              {posts.length === 0 && (
                <p className="text-center text-slate-400 font-medium py-8">Nothing here yet — be the first to post.</p>
              )}
              {posts.map((p) => (
                <Card key={p.id} className="p-4 cursor-pointer hover:border-amber-500 transition" onClick={() => setModalItem(p)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar url={p.photoURL} name={p.displayName} />
                      <div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{p.displayName}</div>
                        {p.title && <h3 className={`font-extrabold ${NAVY}`}>{p.title}</h3>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
                      {p.uid === firebaseUser.uid && (
                        <button onClick={(e) => { e.stopPropagation(); deletePost(p); }} className="text-slate-300 hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {p.content && <p className="text-slate-700 text-sm mt-2 whitespace-pre-wrap line-clamp-3">{p.content}</p>}
                  <PreviewRow images={p.images} code={p.code} />
                  {p.link && (
                    <a href={p.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline mt-2">
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
              <h2 className={`text-2xl font-extrabold ${NAVY}`}>Gallery</h2>
              <p className="text-slate-500 font-medium">See what the whole class is building.</p>
            </div>

            <div className="flex gap-2 bg-white rounded-xl p-1 border-2 border-slate-900 w-fit">
              <button
                onClick={() => setGalleryTab("progress")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${galleryTab === "progress" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <GalleryHorizontalEnd className="w-4 h-4" /> Lesson Progress
              </button>
              <button
                onClick={() => setGalleryTab("portfolios")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition ${galleryTab === "portfolios" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}
              >
                <Rocket className="w-4 h-4" /> Finished Portfolios
              </button>
            </div>

            {galleryTab === "progress" && (
              <div className="grid sm:grid-cols-2 gap-4">
                {lessonSubmissions.length === 0 && (
                  <p className="text-center text-slate-400 font-medium py-8 sm:col-span-2">
                    No lesson progress shared yet — it'll show up here as soon as someone saves a lesson.
                  </p>
                )}
                {lessonSubmissions.map((s) => (
                  <Card
                    key={s.id}
                    className="p-4 cursor-pointer hover:border-amber-500 transition"
                    onClick={() => setModalItem({ ...s, title: s.lessonTitle, content: s.note })}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar url={s.photoURL} name={s.displayName} />
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">{s.displayName}</div>
                          <h3 className={`font-extrabold ${NAVY}`}>Week {s.lessonId}: {s.lessonTitle}</h3>
                        </div>
                      </div>
                      <Maximize2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </div>
                    <div className="mt-2">
                      {s.status === "complete" ? <Badge tone="green">Complete</Badge> : <Badge tone="amber">In progress</Badge>}
                    </div>
                    {s.note && <p className="text-slate-700 text-sm mt-2 line-clamp-2">{s.note}</p>}
                    <PreviewRow images={s.images} code={s.code} />
                  </Card>
                ))}
              </div>
            )}

            {galleryTab === "portfolios" && (
              <div className="space-y-5">
                <Card className="p-4">
                  <form onSubmit={submitGallery} className="space-y-3">
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
                    <CodeField value={galleryDraft.code} onChange={(v) => setGalleryDraft({ ...galleryDraft, code: v })} />
                    <ImagePicker
                      pendingPreviews={galleryDraft.pendingPreviews}
                      onAddFiles={addGalleryFiles}
                      onRemovePending={removeGalleryPending}
                    />
                    <button disabled={galleryBusy} type="submit" className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-4 py-2 rounded-lg disabled:opacity-60">
                      <Plus className="w-4 h-4" /> {galleryBusy ? "Adding…" : "Add to gallery"}
                    </button>
                  </form>
                </Card>
                <div className="grid sm:grid-cols-2 gap-4">
                  {gallery.length === 0 && (
                    <p className="text-center text-slate-400 font-medium py-8 sm:col-span-2">No portfolios yet — finish Lesson 14 and add yours!</p>
                  )}
                  {gallery.map((g) => (
                    <Card key={g.id} className="p-4 cursor-pointer hover:border-amber-500 transition" onClick={() => setModalItem(g)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <Avatar url={g.photoURL} name={g.displayName} />
                          <h3 className={`font-extrabold ${NAVY}`}>{g.title}</h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Maximize2 className="w-3.5 h-3.5 text-slate-300" />
                          {g.uid === firebaseUser.uid && (
                            <button onClick={(e) => { e.stopPropagation(); deleteGalleryItem(g); }} className="text-slate-300 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5 ml-[42px]">by {g.displayName}</p>
                      {g.description && <p className="text-slate-700 text-sm mt-2 line-clamp-2">{g.description}</p>}
                      <PreviewRow images={g.images} code={g.code} />
                      <a href={g.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-sm font-bold text-amber-700 hover:underline mt-2">
                        <ExternalLink className="w-3.5 h-3.5" /> Visit site
                      </a>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === "classroom" && !selectedStudent && (
          <div className="space-y-5">
            <div>
              <h2 className={`text-2xl font-extrabold ${NAVY}`}>Classroom</h2>
              <p className="text-slate-500 font-medium">Everyone in the program. Click a profile to see their work.</p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {allStudents.length === 0 && (
                <p className="text-center text-slate-400 font-medium py-8 sm:col-span-3">No students yet.</p>
              )}
              {allStudents.map((s) => {
                const count = completedCountFor(s.items);
                return (
                  <Card
                    key={s.uid}
                    className="p-4 cursor-pointer hover:border-amber-500 transition text-center"
                    onClick={() => setClassroomSelectedUid(s.uid)}
                  >
                    <div className="flex justify-center">
                      <Avatar url={s.photoURL} name={s.displayName || s.username} size={16} />
                    </div>
                    <h3 className={`font-extrabold ${NAVY} mt-2`}>{s.displayName || s.username}</h3>
                    {s.goal && <p className="text-slate-500 text-xs mt-1 line-clamp-2">{s.goal}</p>}
                    <div className="mt-2 flex justify-center gap-1.5 flex-wrap">
                      {count === 14 ? (
                        <Badge tone="green">🎓 Certified</Badge>
                      ) : (
                        <Badge tone="amber">{count}/14 lessons</Badge>
                      )}
                      {s.role === "admin" && <Badge tone="slate">Admin</Badge>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {view === "classroom" && selectedStudent && (
          <div className="space-y-5">
            <button
              onClick={() => setClassroomSelectedUid(null)}
              className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Classroom
            </button>

            <Card className="p-5 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <Avatar url={selectedStudent.photoURL} name={selectedStudent.displayName || selectedStudent.username} size={24} />
              <div className="flex-1">
                <h2 className={`text-2xl font-extrabold ${NAVY}`}>{selectedStudent.displayName || selectedStudent.username}</h2>
                {selectedStudent.goal && <p className="text-slate-600 font-medium mt-1">🎯 {selectedStudent.goal}</p>}
                <div className="mt-2 flex justify-center sm:justify-start gap-1.5 flex-wrap">
                  {completedCountFor(selectedStudent.items) === 14 ? (
                    <Badge tone="green">🎓 Certified — 14/14</Badge>
                  ) : (
                    <Badge tone="amber">{completedCountFor(selectedStudent.items)}/14 lessons complete</Badge>
                  )}
                </div>
              </div>
            </Card>

            <div>
              <h3 className={`font-extrabold text-lg ${NAVY} mb-2 flex items-center gap-2`}>
                <GalleryHorizontalEnd className="w-5 h-5 text-amber-600" /> Lesson Progress
              </h3>
              {selectedStudentLessonSubs.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium">No lessons shared yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {selectedStudentLessonSubs.map((s) => (
                    <Card
                      key={s.id}
                      className="p-4 cursor-pointer hover:border-amber-500 transition"
                      onClick={() => setModalItem({ ...s, title: s.lessonTitle, content: s.note })}
                    >
                      <div className="flex items-center justify-between">
                        <h4 className={`font-bold ${NAVY}`}>Week {s.lessonId}: {s.lessonTitle}</h4>
                        <Maximize2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </div>
                      <div className="mt-1">
                        {s.status === "complete" ? <Badge tone="green">Complete</Badge> : <Badge tone="amber">In progress</Badge>}
                      </div>
                      <PreviewRow images={s.images} code={s.code} />
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className={`font-extrabold text-lg ${NAVY} mb-2 flex items-center gap-2`}>
                <Sparkles className="w-5 h-5 text-amber-600" /> Creator Space Posts
              </h3>
              {selectedStudentPosts.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium">No posts yet.</p>
              ) : (
                <div className="space-y-3">
                  {selectedStudentPosts.map((p) => (
                    <Card key={p.id} className="p-4 cursor-pointer hover:border-amber-500 transition" onClick={() => setModalItem(p)}>
                      <div className="flex items-center justify-between">
                        {p.title && <h4 className={`font-bold ${NAVY}`}>{p.title}</h4>}
                        <Maximize2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </div>
                      {p.content && <p className="text-slate-700 text-sm mt-1 line-clamp-2">{p.content}</p>}
                      <PreviewRow images={p.images} code={p.code} />
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className={`font-extrabold text-lg ${NAVY} mb-2 flex items-center gap-2`}>
                <Rocket className="w-5 h-5 text-amber-600" /> Finished Portfolios
              </h3>
              {selectedStudentGallery.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium">No portfolio submitted yet.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {selectedStudentGallery.map((g) => (
                    <Card key={g.id} className="p-4 cursor-pointer hover:border-amber-500 transition" onClick={() => setModalItem(g)}>
                      <div className="flex items-center justify-between">
                        <h4 className={`font-bold ${NAVY}`}>{g.title}</h4>
                        <Maximize2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </div>
                      {g.description && <p className="text-slate-700 text-sm mt-1 line-clamp-2">{g.description}</p>}
                      <PreviewRow images={g.images} code={g.code} />
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "profile" && (
          <div className="space-y-5 max-w-lg">
            <h2 className={`text-2xl font-extrabold ${NAVY}`}>Profile</h2>
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                <Avatar url={studentData.photoURL} name={studentData.displayName || studentData.username} size={24} />
                <div>
                  <label className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 hover:underline cursor-pointer">
                    <Camera className="w-4 h-4" />
                    {avatarBusy ? "Uploading…" : "Change profile picture"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={avatarBusy}
                      onChange={(e) => handleAvatarChange(e.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>

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
                <button className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100">
                  📚 Manage Lessons
                </button>
                <button className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100">
                  📢 Announcements
                </button>
                <button className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100">
                  👩‍🎓 Students
                </button>
                <button className="border-2 border-slate-900 rounded-xl p-4 text-left hover:bg-slate-100">
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