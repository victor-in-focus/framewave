import {
  ChangeEvent,
  CSSProperties,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  Download,
  FolderInput,
  ImagePlus,
  Pause,
  Play,
  Search,
  Star,
  Tags,
  Trash2,
  Upload,
  X
} from "lucide-react";
import "./App.css";
import {
  ConfirmOrganizationDeleteDialog,
  FolderEditorDialog,
  MoveReferenceDialog,
  ProjectEditorDialog
} from "./components/ProjectDialogs";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { trackEvent } from "./lib/analytics";
import { createBlankVoiceReference } from "./lib/processing";
import {
  formatFileSize,
  getSourceFileKind,
  isSupportedSourceFile
} from "./lib/file";
import { buildReferenceFilename, slugifyPart } from "./lib/filename";
import { captureSourceFrame } from "./lib/frameCapture";
import { getSetting, setSetting } from "./lib/settings";
import {
  getLibraryInitials,
  getLibraryDisplayTitle,
  filterLibraryClips,
  groupLibraryClips,
  sortLibraryClips,
  truncateMiddle,
  type LibrarySortMode
} from "./lib/libraryDisplay";
import {
  createFolderAndMoveReference,
  createProject,
  createProjectAndMoveReference,
  createProjectFolder,
  deleteProject,
  deleteProjectFolder,
  fetchProjectFolders,
  fetchProjects,
  initializeProjectLibrary,
  moveReference,
  renameProject,
  renameProjectFolder,
  restoreProject,
  restoreProjectFolder,
  type FolderUndoSnapshot,
  type ProjectUndoSnapshot
} from "./lib/projectApi";
import {
  filterClipsByLocation,
  getLocationLabel,
  getProjectCounts,
  type LibraryLocation,
  type Project,
  type ProjectFolder
} from "./lib/projectLibrary";
import {
  BatchClipDraft,
  LibraryClip,
  LibraryJob,
  exportLibraryArchive,
  fetchLibrary,
  importLibraryClip,
  parseTagInput,
  saveLibraryClip,
  startBatchExport,
  deleteLibraryClip,
  updateLibraryClip,
  updateLibraryClipThumbnail
} from "./lib/libraryApi";
import { clampRange, getRangeValidation } from "./lib/range";
import {
  clearWorkSession,
  loadWorkSession,
  saveSessionSource,
  saveSessionState,
  type WorkSession
} from "./lib/sessionStore";
import { formatClockTime, formatDuration } from "./lib/time";
import {
  buildThumbnailTimes,
  moveTrimSelection,
  percentToSeconds,
  resizeTrimEdge,
  secondsToPercent
} from "./lib/trimSelection";
import { computeWaveformPeaks } from "./lib/waveform";

type ExportState = "idle" | "processing" | "complete" | "error";
type TrimDragMode = "start" | "end" | "window";
type ProjectDialogState =
  | { mode: "create" }
  | { mode: "rename"; project: Project };
type FolderDialogState =
  | { mode: "create"; projectId: string }
  | { mode: "rename"; folder: ProjectFolder };
type DeleteOrganizationTarget =
  | { kind: "project"; project: Project }
  | { kind: "folder"; folder: ProjectFolder };
type OrganizationUndo =
  | { kind: "project"; label: string; snapshot: ProjectUndoSnapshot }
  | { kind: "folder"; label: string; snapshot: FolderUndoSnapshot };

const ACCEPTED_REFERENCE_TYPES = "video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm";
const ACCEPTED_SOURCE_TYPES =
  "video/mp4,video/quicktime,video/webm,audio/aac,audio/flac,audio/m4a,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/wave,audio/x-m4a,audio/x-wav,.mp4,.mov,.webm,.aac,.flac,.m4a,.mp3,.ogg,.wav";
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";
const NAMING_CONTEXT_KEY = "namingContext";
const PROJECT_SIDEBAR_KEY = "projectSidebarCollapsed";

// Creator links - update the handle/repo when they change.
const CREATOR_X_URL = "https://x.com/VictorInFocus";
const PROJECT_REPO_URL = "https://github.com/victor-in-focus/framewave";
const FEEDBACK_MAILTO =
  "mailto:victorbanya@gmail.com?subject=FrameWave%20request&body=I%20want%20voice%20isolation%20%2F%20audio%20cleanup%20in%20FrameWave%20because%3A%20";

interface NamingContext {
  character?: string;
  descriptor?: string;
  tags?: string;
}

const CLIP_MARKER_COLORS = [
  "178 48% 48%",
  "112 42% 62%",
  "203 67% 64%",
  "331 62% 68%",
  "43 85% 58%",
  "255 72% 74%"
];

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function filenameStem(filename: string): string {
  return filename.replace(/\.mp4$/i, "");
}

function reserveBatchFilename(filename: string, clips: BatchClipDraft[]): string {
  const existing = new Set(clips.map((clip) => clip.outputName));
  if (!existing.has(filename)) {
    return filename;
  }

  const stem = filenameStem(filename);
  let index = 2;
  let next = `${stem}_${String(index).padStart(2, "0")}.mp4`;
  while (existing.has(next)) {
    index += 1;
    next = `${stem}_${String(index).padStart(2, "0")}.mp4`;
  }
  return next;
}

function limitedTags(tags: string[], limit = 3): {
  visible: string[];
  hiddenCount: number;
} {
  return {
    visible: tags.slice(0, limit),
    hiddenCount: Math.max(0, tags.length - limit)
  };
}

function clipMarkerColor(index: number): string {
  return CLIP_MARKER_COLORS[index % CLIP_MARKER_COLORS.length];
}

function WaveformCanvas({
  peaks,
  withScrim
}: {
  peaks: number[];
  withScrim: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      return;
    }

    const width = peaks.length;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);

    if (withScrim) {
      context.fillStyle = "rgba(4, 5, 12, 0.5)";
      context.fillRect(0, 0, width, height);
    }

    const middle = height / 2;
    context.fillStyle = "rgba(196, 188, 255, 0.78)";
    for (let x = 0; x < width; x += 1) {
      const magnitude = Math.max(1.2, peaks[x] * (middle - 6));
      context.fillRect(x, middle - magnitude, 1, magnitude * 2);
    }
  }, [peaks, withScrim]);

  return (
    <canvas className="trim-waveform" ref={canvasRef} aria-hidden="true" />
  );
}

function formatPlayerTime(seconds: number): string {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = Math.floor(safeSeconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function libraryEmptyCopy(location: LibraryLocation): string {
  if (location.kind === "quick") {
    return "New references save here first.";
  }
  if (location.kind === "project-unfiled") {
    return "No unfiled references in this project.";
  }
  if (location.kind === "folder") {
    return "No references in this folder yet.";
  }
  if (location.kind === "project-all") {
    return "Move references here from Quick exports.";
  }
  return "Export a reference and it will appear here.";
}

export default function App() {
  const sourceMediaRef = useRef<HTMLMediaElement | null>(null);
  const trimRailRef = useRef<HTMLDivElement | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const trimDragRef = useRef<{
    mode: TrimDragMode;
    offsetSeconds: number;
  } | null>(null);
  const pendingRangeRef = useRef<{ start: number; end: number } | null>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<string[]>([]);
  const [waveformPeaks, setWaveformPeaks] = useState<number[] | null>(null);
  const [mediaDuration, setMediaDuration] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [characterName, setCharacterName] = useState(
    () => getSetting<NamingContext>(NAMING_CONTEXT_KEY, {}).character ?? ""
  );
  const [descriptor, setDescriptor] = useState(
    () => getSetting<NamingContext>(NAMING_CONTEXT_KEY, {}).descriptor ?? ""
  );
  const [tagInput, setTagInput] = useState(
    () => getSetting<NamingContext>(NAMING_CONTEXT_KEY, {}).tags ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [exportStatus, setExportStatus] = useState("");
  const [exportProgress, setExportProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputName, setOutputName] = useState("");
  const [isRangePlaying, setIsRangePlaying] = useState(false);
  const [batchClips, setBatchClips] = useState<BatchClipDraft[]>([]);
  const [batchJob, setBatchJob] = useState<LibraryJob | null>(null);
  const [libraryClips, setLibraryClips] = useState<LibraryClip[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySortMode, setLibrarySortMode] =
    useState<LibrarySortMode>("recent");
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [libraryTagDrafts, setLibraryTagDrafts] = useState<
    Record<string, string>
  >({});
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [importTags, setImportTags] = useState("");
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [libraryPlaybackTimes, setLibraryPlaybackTimes] = useState<
    Record<string, number>
  >({});
  const [resumeSession, setResumeSession] = useState<WorkSession | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFolders, setProjectFolders] = useState<ProjectFolder[]>([]);
  const [libraryLocation, setLibraryLocation] = useState<LibraryLocation>({
    kind: "quick"
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    getSetting(PROJECT_SIDEBAR_KEY, false)
  );
  const [organizationError, setOrganizationError] = useState<string | null>(null);
  const [projectDialog, setProjectDialog] = useState<ProjectDialogState | null>(
    null
  );
  const [folderDialog, setFolderDialog] = useState<FolderDialogState | null>(null);
  const [moveClipId, setMoveClipId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<DeleteOrganizationTarget | null>(null);
  const [organizationUndo, setOrganizationUndo] =
    useState<OrganizationUndo | null>(null);
  const [lastExportClipId, setLastExportClipId] = useState<string | null>(null);

  const rangeValidation = useMemo(
    () => getRangeValidation(startTime, endTime, mediaDuration),
    [endTime, mediaDuration, startTime]
  );
  const selectedDuration = rangeValidation.duration;
  const activeTags = useMemo(() => parseTagInput(tagInput), [tagInput]);
  const exportTags = useMemo(() => {
    const characterTag = slugifyPart(characterName);
    return characterTag && !activeTags.includes(characterTag)
      ? [characterTag, ...activeTags]
      : activeTags;
  }, [activeTags, characterName]);
  const outputFilename = useMemo(
    () =>
      buildReferenceFilename({
        characterName,
        descriptor,
        durationSeconds: selectedDuration,
        separator: "_",
        includeDuration: true
      }),
    [characterName, descriptor, selectedDuration]
  );
  const rangeMax = Math.max(mediaDuration, endTime, 5);
  const canCreate =
    Boolean(sourceFile) && rangeValidation.valid && exportState !== "processing";
  const canBatchExport =
    Boolean(sourceFile) &&
    batchClips.length > 0 &&
    batchJob?.status !== "queued" &&
    batchJob?.status !== "processing";
  const sourceKind = sourceFile ? getSourceFileKind(sourceFile) : "unsupported";
  const trimStartPercent = secondsToPercent(startTime, mediaDuration);
  const trimEndPercent = secondsToPercent(endTime, mediaDuration);
  const trimWidthPercent = Math.max(0, trimEndPercent - trimStartPercent);
  const trimReady = Boolean(sourceUrl && mediaDuration > 0);
  const thumbnailSlots =
    thumbnailUrls.length > 0 ? thumbnailUrls : Array.from({ length: 14 }, () => "");
  const activeTagPreview = limitedTags(activeTags, 5);
  const batchTotalDuration = useMemo(
    () =>
      batchClips.reduce(
        (total, clip) => total + Math.max(0, clip.end - clip.start),
        0
      ),
    [batchClips]
  );
  const batchSummary =
    batchClips.length === 0
      ? "Batch: no clips yet"
      : `Batch: ${batchClips.length} clip${
          batchClips.length === 1 ? "" : "s"
        }, ${formatDuration(batchTotalDuration)} total`;
  const batchJobSummary = useMemo(() => {
    if (!batchJob) {
      return "";
    }

    const doneCount = batchJob.clips.filter((clip) => clip.status === "done").length;
    const failedCount = batchJob.clips.filter(
      (clip) => clip.status === "failed"
    ).length;

    if (batchJob.status === "done") {
      return `ZIP ready: ${doneCount} clip${doneCount === 1 ? "" : "s"} exported`;
    }

    if (batchJob.status === "failed") {
      return `Batch failed: ${failedCount || batchJob.clips.length} clip${
        failedCount === 1 ? "" : "s"
      } need attention`;
    }

    return `Batch ${batchJob.status}, ${Math.round(batchJob.progress * 100)}%`;
  }, [batchJob]);
  const locationLibraryClips = useMemo(
    () => filterClipsByLocation(libraryClips, libraryLocation),
    [libraryClips, libraryLocation]
  );
  const visibleLibraryClips = useMemo(
    () =>
      sortLibraryClips(
        filterLibraryClips(
          locationLibraryClips,
          libraryQuery,
          librarySortMode === "favorites"
        ),
        librarySortMode
      ),
    [libraryQuery, librarySortMode, locationLibraryClips]
  );
  const projectCounts = useMemo(
    () => getProjectCounts(libraryClips, projects, projectFolders),
    [libraryClips, projectFolders, projects]
  );
  const libraryLocationLabel = useMemo(
    () => getLocationLabel(libraryLocation, projects, projectFolders),
    [libraryLocation, projectFolders, projects]
  );
  const movingClip = moveClipId
    ? libraryClips.find((clip) => clip.id === moveClipId) ?? null
    : null;
  const referenceCountLabel = `${libraryClips.length} saved reference${
    libraryClips.length === 1 ? "" : "s"
  }`;
  const batchExportLabel =
    batchClips.length === 0
      ? "Export Batch"
      : `Export ${batchClips.length} Clip${
          batchClips.length === 1 ? "" : "s"
        } as ZIP`;

  useEffect(() => {
    return () => {
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
      if (playbackTimerRef.current) {
        window.clearInterval(playbackTimerRef.current);
      }
    };
  }, [sourceUrl]);

  useEffect(() => {
    return () => {
      if (outputUrl) {
        URL.revokeObjectURL(outputUrl);
      }
    };
  }, [outputUrl]);

  useEffect(() => {
    if (isRangePlaying) {
      stopSelectedRange();
    }
  }, [endTime, startTime]);

  useEffect(() => {
    let cancelled = false;
    setThumbnailUrls([]);

    if (!sourceUrl || sourceKind !== "video" || mediaDuration <= 0) {
      return () => {
        cancelled = true;
      };
    }

    const thumbnailSourceUrl = sourceUrl;

    async function generateThumbnails() {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      canvas.width = 160;
      canvas.height = 90;
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = thumbnailSourceUrl;

      try {
        await new Promise<void>((resolve, reject) => {
          video.onloadedmetadata = () => resolve();
          video.onerror = () => reject(new Error("Could not read video frames."));
          video.load();
        });

        const times = buildThumbnailTimes(mediaDuration, 18);
        const nextThumbnails: string[] = [];

        for (const time of times) {
          if (cancelled) {
            return;
          }

          await new Promise<void>((resolve) => {
            video.onseeked = () => resolve();
            video.currentTime = time;
          });

          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          nextThumbnails.push(canvas.toDataURL("image/jpeg", 0.68));
        }

        if (!cancelled) {
          setThumbnailUrls(nextThumbnails);
        }
      } catch {
        if (!cancelled) {
          setThumbnailUrls([]);
        }
      }
    }

    void generateThumbnails();

    return () => {
      cancelled = true;
    };
  }, [mediaDuration, sourceKind, sourceUrl]);

  useEffect(() => {
    let cancelled = false;
    setWaveformPeaks(null);

    if (!sourceFile) {
      return () => {
        cancelled = true;
      };
    }

    void computeWaveformPeaks(sourceFile).then((peaks) => {
      if (!cancelled && peaks && peaks.length > 0) {
        setWaveformPeaks(peaks);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sourceFile]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkSession().then((session) => {
      if (!cancelled && session) {
        setResumeSession(session);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (sourceFile) {
      void saveSessionSource(sourceFile).catch(() => undefined);
    }
  }, [sourceFile]);

  useEffect(() => {
    if (!sourceFile || mediaDuration <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      void saveSessionState({
        sourceName: sourceFile.name,
        startTime,
        endTime,
        batchClips
      }).catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [batchClips, endTime, mediaDuration, sourceFile, startTime]);

  useEffect(() => {
    setSetting<NamingContext>(NAMING_CONTEXT_KEY, {
      character: characterName,
      descriptor,
      tags: tagInput
    });
  }, [characterName, descriptor, tagInput]);

  useEffect(() => {
    void initializeWorkspaceLibrary();
    return () => {
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  async function initializeWorkspaceLibrary() {
    setLibraryLoading(true);
    setLibraryError(null);
    setOrganizationError(null);
    try {
      await initializeProjectLibrary();
    } catch (caughtError) {
      setOrganizationError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not prepare project organization."
      );
    }
    try {
      await refreshWorkspaceLibrary();
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load the library."
      );
    } finally {
      setLibraryLoading(false);
    }
  }

  async function refreshWorkspaceLibrary() {
    const [clips, nextProjects, nextFolders] = await Promise.all([
      fetchLibrary(""),
      fetchProjects(),
      fetchProjectFolders()
    ]);
    setLibraryClips(clips);
    setProjects(nextProjects);
    setProjectFolders(nextFolders);
    setLibraryTagDrafts((drafts) => {
      const nextDrafts = { ...drafts };
      for (const clip of clips) {
        if (!(clip.id in nextDrafts)) {
          nextDrafts[clip.id] = clip.tags.join(", ");
        }
      }
      return nextDrafts;
    });
  }

  async function loadLibrary() {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const clips = await fetchLibrary("");
      setLibraryClips(clips);
      setLibraryTagDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        for (const clip of clips) {
          if (!(clip.id in nextDrafts)) {
            nextDrafts[clip.id] = clip.tags.join(", ");
          }
        }
        return nextDrafts;
      });
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not load the library."
      );
    } finally {
      setLibraryLoading(false);
    }
  }

  function handleFile(file: File) {
    if (!isSupportedSourceFile(file)) {
      setError("Upload an MP4, MOV, WEBM, MP3, WAV, M4A, AAC, FLAC, or OGG file.");
      return;
    }

    stopSelectedRange();

    if (sourceUrl) {
      URL.revokeObjectURL(sourceUrl);
    }

    setError(null);
    trackEvent("source_loaded");
    setSourceFile(file);
    setSourceUrl(URL.createObjectURL(file));
    setThumbnailUrls([]);
    setMediaDuration(0);
    setStartTime(0);
    setEndTime(0);
    setBatchClips([]);
    setBatchJob(null);
    setExportState("idle");
    setExportStatus("");
    setExportProgress(0);
    setOutputName("");
    setLastExportClipId(null);
    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleLoadedMetadata(event: SyntheticEvent<HTMLMediaElement>) {
    const duration = event.currentTarget.duration ?? 0;
    const safeDuration = Number.isFinite(duration) ? duration : 0;
    setMediaDuration(safeDuration);

    const pending = pendingRangeRef.current;
    pendingRangeRef.current = null;
    if (pending && safeDuration > 0 && pending.end > pending.start) {
      const clamped = clampRange(
        pending.start,
        Math.min(pending.end, safeDuration),
        Math.max(safeDuration, 5)
      );
      setStartTime(clamped.start);
      setEndTime(clamped.end);
      return;
    }

    setStartTime(0);
    setEndTime(safeDuration);
  }

  function resumeWorkSession() {
    if (!resumeSession) {
      return;
    }

    pendingRangeRef.current = {
      start: resumeSession.startTime,
      end: resumeSession.endTime
    };
    handleFile(resumeSession.file);
    setBatchClips(resumeSession.batchClips);
    setResumeSession(null);
  }

  function dismissWorkSession() {
    setResumeSession(null);
    void clearWorkSession();
  }

  function updateRange(nextStart: number, nextEnd: number) {
    const clamped = clampRange(nextStart, nextEnd, rangeMax);
    setStartTime(clamped.start);
    setEndTime(clamped.end);
  }

  function secondsFromTrimPointer(event: ReactPointerEvent): number {
    const rail = trimRailRef.current;
    if (!rail) {
      return 0;
    }

    const bounds = rail.getBoundingClientRect();
    const percent = ((event.clientX - bounds.left) / bounds.width) * 100;
    return percentToSeconds(percent, mediaDuration);
  }

  function handleTrimPointerDown(
    mode: TrimDragMode,
    event: ReactPointerEvent<HTMLElement>
  ) {
    if (!trimReady) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const pointerSeconds = secondsFromTrimPointer(event);
    trimDragRef.current = {
      mode,
      offsetSeconds: mode === "window" ? pointerSeconds - startTime : 0
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleTrimPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = trimDragRef.current;
    if (!drag || !trimReady) {
      return;
    }

    event.preventDefault();
    const pointerSeconds = secondsFromTrimPointer(event);
    const currentSelection = { start: startTime, end: endTime };
    const nextSelection =
      drag.mode === "window"
        ? moveTrimSelection(
            pointerSeconds - drag.offsetSeconds,
            currentSelection,
            mediaDuration
          )
        : resizeTrimEdge(
            drag.mode,
            pointerSeconds,
            currentSelection,
            mediaDuration
          );

    updateRange(nextSelection.start, nextSelection.end);
  }

  function handleTrimKeyDown(
    mode: TrimDragMode,
    event: ReactKeyboardEvent<HTMLElement>
  ) {
    if (!trimReady) {
      return;
    }

    const step = event.shiftKey ? 1 : 0.1;
    let delta = 0;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      delta = -step;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      delta = step;
    } else {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const currentSelection = { start: startTime, end: endTime };
    const nextSelection =
      mode === "window"
        ? moveTrimSelection(startTime + delta, currentSelection, mediaDuration)
        : resizeTrimEdge(
            mode,
            (mode === "start" ? startTime : endTime) + delta,
            currentSelection,
            mediaDuration
          );
    updateRange(nextSelection.start, nextSelection.end);
  }

  function handleTrimPointerEnd(event: ReactPointerEvent<HTMLElement>) {
    trimDragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function clearPlaybackTimer() {
    if (playbackTimerRef.current) {
      window.clearInterval(playbackTimerRef.current);
      playbackTimerRef.current = null;
    }
  }

  function stopSelectedRange() {
    clearPlaybackTimer();
    sourceMediaRef.current?.pause();
    setIsRangePlaying(false);
  }

  function playSelectedRange() {
    const media = sourceMediaRef.current;
    if (!media || !rangeValidation.valid) {
      return;
    }

    if (isRangePlaying) {
      stopSelectedRange();
      return;
    }

    clearPlaybackTimer();
    media.currentTime = startTime;
    setIsRangePlaying(true);
    void media.play().catch(() => {
      setIsRangePlaying(false);
    });

    playbackTimerRef.current = window.setInterval(() => {
      if (!sourceMediaRef.current) {
        return;
      }

      if (sourceMediaRef.current.currentTime >= endTime) {
        sourceMediaRef.current.pause();
        clearPlaybackTimer();
        setIsRangePlaying(false);
      }
    }, 80);
  }

  function addCurrentClipToBatch() {
    if (!rangeValidation.valid) {
      setError(rangeValidation.message);
      return;
    }

    const outputName = reserveBatchFilename(outputFilename, batchClips);
    const titleParts = [characterName.trim(), descriptor.trim()].filter(Boolean);
    const baseTitle =
      titleParts.length > 0
        ? titleParts.join(" / ")
        : `Clip ${batchClips.length + 1}`;
    const sameTitleCount = batchClips.filter(
      (clip) => clip.title === baseTitle || clip.title.startsWith(`${baseTitle} `)
    ).length;
    const title =
      sameTitleCount > 0
        ? `${baseTitle} ${String(sameTitleCount + 1).padStart(2, "0")}`
        : baseTitle;

    setBatchClips((clips) => [
      ...clips,
      {
        id: createId(),
        title,
        characterName: characterName.trim(),
        descriptor,
        start: startTime,
        end: endTime,
        outputName,
        tags: exportTags
      }
    ]);
    setBatchJob(null);
  }

  function loadBatchClip(clip: BatchClipDraft) {
    updateRange(clip.start, clip.end);
    setCharacterName(clip.characterName ?? "");
    setDescriptor(clip.descriptor);
    setTagInput(clip.tags.join(", "));
  }

  function removeBatchClip(clipId: string) {
    setBatchClips((clips) => clips.filter((clip) => clip.id !== clipId));
    setBatchJob(null);
  }

  async function handleCreateReference() {
    if (!sourceFile || !rangeValidation.valid) {
      return;
    }

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }

    setError(null);
    setExportState("processing");
    setExportStatus("Preparing export...");
    setExportProgress(0);

    try {
      const blob = await createBlankVoiceReference({
        sourceFile,
        startTime,
        duration: selectedDuration,
        onProgress: setExportProgress,
        onStatus: setExportStatus
      });
      trackEvent("clip_exported");
      const nextOutputUrl = URL.createObjectURL(blob);
      setOutputUrl(nextOutputUrl);
      setOutputName(outputFilename);
      setExportStatus("Saving to local library...");
      const thumbnailBlob =
        sourceKind === "video" && sourceUrl
          ? await captureSourceFrame(sourceUrl, startTime)
          : null;
      const savedClip = await saveLibraryClip({
        blob,
        filename: outputFilename,
        sourceName: sourceFile.name,
        thumbnailBlob,
        title: characterName.trim() || filenameStem(outputFilename),
        descriptor,
        tags: exportTags,
        startTime,
        endTime,
        duration: selectedDuration
      });
      setLastExportClipId(savedClip.id);
      setExportState("complete");
      setExportStatus("Reference video ready.");
      setExportProgress(1);
      await loadLibrary();
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Local processing failed.";
      setExportState("error");
      setError(message);
      setExportStatus("");
      setExportProgress(0);
    }
  }

  async function handleBatchExport() {
    if (!sourceFile || batchClips.length === 0) {
      return;
    }

    setError(null);
    setBatchJob(null);

    try {
      let thumbnails: (Blob | null)[] | undefined;
      if (sourceKind === "video" && sourceUrl) {
        thumbnails = [];
        for (const clip of batchClips) {
          thumbnails.push(await captureSourceFrame(sourceUrl, clip.start));
        }
      }

      const job = await startBatchExport(
        sourceFile,
        batchClips,
        setBatchJob,
        thumbnails
      );
      if (job.clips.some((clip) => clip.status === "done")) {
        trackEvent("batch_exported");
      }
      setBatchJob(job);
      await loadLibrary();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not start batch export."
      );
    }
  }

  async function handleThumbnailInput(
    clip: LibraryClip,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    setThumbnailError(null);
    try {
      const updated = await updateLibraryClipThumbnail(clip.id, file);
      setLibraryClips((clips) =>
        clips.map((current) => (current.id === clip.id ? updated : current))
      );
    } catch (caughtError) {
      setThumbnailError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save that thumbnail."
      );
    }
  }

  async function removeClipThumbnail(clip: LibraryClip) {
    setThumbnailError(null);
    try {
      const updated = await updateLibraryClipThumbnail(clip.id, null);
      setLibraryClips((clips) =>
        clips.map((current) => (current.id === clip.id ? updated : current))
      );
    } catch (caughtError) {
      setThumbnailError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not remove that thumbnail."
      );
    }
  }

  async function toggleFavorite(clip: LibraryClip) {
    setLibraryError(null);
    try {
      const updated = await updateLibraryClip(clip.id, {
        favorite: !clip.favorite
      });
      setLibraryClips((clips) =>
        clips.map((current) => (current.id === clip.id ? updated : current))
      );
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not update that reference."
      );
    }
  }

  async function saveClipTags(clip: LibraryClip) {
    setLibraryError(null);
    try {
      const tags = parseTagInput(
        libraryTagDrafts[clip.id] ?? clip.tags.join(", ")
      );
      const updated = await updateLibraryClip(clip.id, { tags });
      setLibraryClips((clips) =>
        clips.map((current) => (current.id === clip.id ? updated : current))
      );
      setLibraryTagDrafts((drafts) => ({
        ...drafts,
        [clip.id]: updated.tags.join(", ")
      }));
      setEditingClipId(null);
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save those tags."
      );
    }
  }

  async function removeLibraryClip(clip: LibraryClip) {
    setLibraryError(null);
    try {
      await deleteLibraryClip(clip.id);
      setLibraryClips((clips) =>
        clips.filter((current) => current.id !== clip.id)
      );
      setLibraryTagDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[clip.id];
        return nextDrafts;
      });
      setPlayingClipId((current) => (current === clip.id ? null : current));
      setEditingClipId((current) => (current === clip.id ? null : current));
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not delete that reference."
      );
    }
  }

  async function handleLibraryImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const clip = await importLibraryClip(file, parseTagInput(importTags));
      setLibraryClips((clips) => [clip, ...clips]);
      setLibraryTagDrafts((drafts) => ({
        ...drafts,
        [clip.id]: clip.tags.join(", ")
      }));
      event.target.value = "";
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not import this reference."
      );
    }
  }

  async function handleLibraryArchiveExport() {
    setLibraryError(null);
    try {
      const archive = await exportLibraryArchive();
      const url = URL.createObjectURL(archive);
      const link = document.createElement("a");
      link.href = url;
      link.download = "framewave_library.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (caughtError) {
      setLibraryError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not export the library."
      );
    }
  }

  function handleLibraryAudioPlay(clipId: string) {
    document
      .querySelectorAll<HTMLAudioElement>(".library-audio")
      .forEach((audio) => {
        if (audio.dataset.clipId !== clipId) {
          audio.pause();
        }
      });
    setPlayingClipId(clipId);
  }

  function toggleLibraryPlayback(clipId: string) {
    const audioElements = Array.from(
      document.querySelectorAll<HTMLAudioElement>(".library-audio")
    );
    const target = audioElements.find((audio) => audio.dataset.clipId === clipId);

    if (!target) {
      return;
    }

    audioElements.forEach((audio) => {
      if (audio.dataset.clipId !== clipId) {
        audio.pause();
      }
    });

    if (target.paused) {
      void target.play().catch(() => setPlayingClipId(null));
    } else {
      target.pause();
      setPlayingClipId(null);
    }
  }

  function updateLibraryPlaybackTime(clipId: string, currentTime: number) {
    setLibraryPlaybackTimes((times) => ({
      ...times,
      [clipId]: currentTime
    }));
  }

  function showOrganizationError(caughtError: unknown, fallback: string) {
    setOrganizationError(
      caughtError instanceof Error ? caughtError.message : fallback
    );
  }

  function showUndo(undo: OrganizationUndo) {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setOrganizationUndo(undo);
    undoTimerRef.current = window.setTimeout(() => {
      setOrganizationUndo(null);
      undoTimerRef.current = null;
    }, 5000);
  }

  async function submitProjectDialog(input: {
    name: string;
    useStarterFolders: boolean;
  }) {
    if (!projectDialog) {
      return;
    }
    setOrganizationError(null);
    try {
      if (projectDialog.mode === "create") {
        const result = await createProject(input);
        setLibraryLocation({ kind: "project-all", projectId: result.project.id });
      } else {
        await renameProject(projectDialog.project.id, input.name);
      }
      await refreshWorkspaceLibrary();
      setProjectDialog(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not save that project.");
    }
  }

  async function submitFolderDialog(name: string) {
    if (!folderDialog) {
      return;
    }
    setOrganizationError(null);
    try {
      if (folderDialog.mode === "create") {
        const folder = await createProjectFolder(folderDialog.projectId, name);
        setLibraryLocation({
          kind: "folder",
          projectId: folder.projectId,
          folderId: folder.id
        });
      } else {
        await renameProjectFolder(folderDialog.folder.id, name);
      }
      await refreshWorkspaceLibrary();
      setFolderDialog(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not save that folder.");
    }
  }

  async function submitMove(destination: Parameters<typeof moveReference>[1]) {
    if (!moveClipId) {
      return;
    }
    setOrganizationError(null);
    try {
      await moveReference(moveClipId, destination);
      await refreshWorkspaceLibrary();
      setMoveClipId(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not move that reference.");
    }
  }

  async function submitInlineProject(input: {
    name: string;
    useStarterFolders: boolean;
  }) {
    if (!moveClipId) {
      return;
    }
    setOrganizationError(null);
    try {
      const result = await createProjectAndMoveReference(moveClipId, input);
      await refreshWorkspaceLibrary();
      setLibraryLocation({
        kind: "project-unfiled",
        projectId: result.project.id
      });
      setMoveClipId(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not create that project.");
    }
  }

  async function submitInlineFolder(projectId: string, name: string) {
    if (!moveClipId) {
      return;
    }
    setOrganizationError(null);
    try {
      const result = await createFolderAndMoveReference(
        moveClipId,
        projectId,
        name
      );
      await refreshWorkspaceLibrary();
      setLibraryLocation({
        kind: "folder",
        projectId,
        folderId: result.folder.id
      });
      setMoveClipId(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not create that folder.");
    }
  }

  async function confirmOrganizationDelete() {
    if (!deleteTarget) {
      return;
    }
    setOrganizationError(null);
    try {
      if (deleteTarget.kind === "project") {
        const snapshot = await deleteProject(deleteTarget.project.id);
        showUndo({
          kind: "project",
          label: `${deleteTarget.project.name} deleted`,
          snapshot
        });
        if (
          "projectId" in libraryLocation &&
          libraryLocation.projectId === deleteTarget.project.id
        ) {
          setLibraryLocation({ kind: "quick" });
        }
      } else {
        const snapshot = await deleteProjectFolder(deleteTarget.folder.id);
        showUndo({
          kind: "folder",
          label: `${deleteTarget.folder.name} deleted`,
          snapshot
        });
        if (
          libraryLocation.kind === "folder" &&
          libraryLocation.folderId === deleteTarget.folder.id
        ) {
          setLibraryLocation({
            kind: "project-unfiled",
            projectId: deleteTarget.folder.projectId
          });
        }
      }
      await refreshWorkspaceLibrary();
      setDeleteTarget(null);
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not update organization.");
    }
  }

  async function undoOrganizationDelete() {
    if (!organizationUndo) {
      return;
    }
    setOrganizationError(null);
    try {
      if (organizationUndo.kind === "project") {
        await restoreProject(organizationUndo.snapshot);
      } else {
        await restoreProjectFolder(organizationUndo.snapshot);
      }
      await refreshWorkspaceLibrary();
      setOrganizationUndo(null);
      if (undoTimerRef.current) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    } catch (caughtError) {
      showOrganizationError(caughtError, "Could not restore that item.");
    }
  }

  return (
    <main
      className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
    >
      <ProjectSidebar
        projects={projects}
        folders={projectFolders}
        counts={projectCounts}
        location={libraryLocation}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onLocationChange={setLibraryLocation}
        onCreateProject={() => setProjectDialog({ mode: "create" })}
        onCreateFolder={(projectId) =>
          setFolderDialog({ mode: "create", projectId })
        }
        onRenameProject={(project) =>
          setProjectDialog({ mode: "rename", project })
        }
        onDeleteProject={(project) =>
          setDeleteTarget({ kind: "project", project })
        }
        onRenameFolder={(folder) =>
          setFolderDialog({ mode: "rename", folder })
        }
        onDeleteFolder={(folder) =>
          setDeleteTarget({ kind: "folder", folder })
        }
      />
      <section className="workspace">
        <header className="command-bar" aria-label="FrameWave workspace">
          <div className="search-display">
            <span className="search-mark" aria-hidden="true">
              FW
            </span>
            <div>
              <strong>FrameWave</strong>
              <span>{referenceCountLabel}</span>
            </div>
            <span className="privacy-pill">Processed locally</span>
          </div>
        </header>

        <section className="work-card" aria-label="Create Reference">
            <div className="work-row source-row">
              <div className="row-meta">
                <span>
                  {sourceFile ? formatFileSize(sourceFile.size) : "media"}
                </span>
                <strong>Create Reference</strong>
              </div>
              <div className="row-main">
                {!sourceFile ? (
                  <div className="landing">
                    <h1 className="landing-headline">
                      Voice references, stripped to signal.
                    </h1>
                    <p className="landing-copy">
                      Trim a voice from any clip, export a blank MP4 reference
                      for AI video tools. Nothing leaves your browser.
                    </p>
                  </div>
                ) : null}
                {resumeSession && !sourceFile ? (
                  <div className="resume-card">
                    <div className="resume-copy">
                      <strong>Resume where you left off</strong>
                      <span>
                        {truncateMiddle(resumeSession.file.name, 34)}
                        {resumeSession.batchClips.length > 0
                          ? `, ${resumeSession.batchClips.length} batch clip${
                              resumeSession.batchClips.length === 1 ? "" : "s"
                            }`
                          : ""}
                      </span>
                    </div>
                    <div className="resume-actions">
                      <button
                        className="primary-button"
                        type="button"
                        onClick={resumeWorkSession}
                      >
                        Resume
                      </button>
                      <button
                        className="subtle-button"
                        type="button"
                        onClick={dismissWorkSession}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ) : null}
                <label
                  className={`dropzone${sourceFile ? " has-file" : ""}`}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept={ACCEPTED_SOURCE_TYPES}
                    onChange={handleFileInput}
                  />
                  <span className="dropzone-kicker">Input</span>
                  <span className="dropzone-title">
                    {sourceFile
                      ? truncateMiddle(sourceFile.name, 44)
                      : "Drop video or audio here"}
                  </span>
                  <span className="dropzone-note">
                    {sourceFile
                      ? `${formatFileSize(sourceFile.size)} selected`
                      : "MP4, MOV, WEBM, MP3, WAV, M4A"}
                  </span>
                </label>

                {!sourceFile ? (
                  <ol className="landing-steps" aria-label="How it works">
                    <li>Drop in a clip</li>
                    <li>Trim to the voice</li>
                    <li>Export a blank MP4</li>
                  </ol>
                ) : null}

                {error ? <p className="message error">{error}</p> : null}
                {sourceFile && sourceFile.size > 250 * 1024 * 1024 ? (
                  <p className="message">
                    Large file selected. In-browser processing may take longer.
                  </p>
                ) : null}

                {sourceUrl ? (
                  <div className="preview-frame">
                    {sourceKind === "video" ? (
                      <video
                        ref={(element) => {
                          sourceMediaRef.current = element;
                        }}
                        playsInline
                        src={sourceUrl}
                        onLoadedMetadata={handleLoadedMetadata}
                        onClick={playSelectedRange}
                      />
                    ) : (
                      <>
                        <audio
                          className="source-audio"
                          ref={(element) => {
                            sourceMediaRef.current = element;
                          }}
                          src={sourceUrl}
                          onLoadedMetadata={handleLoadedMetadata}
                        />
                        <button
                          className="audio-preview"
                          type="button"
                          onClick={playSelectedRange}
                        >
                          <span>Audio source</span>
                          <strong>Blank video output</strong>
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>

            {sourceFile ? (
            <div className="work-row range-row">
              <div className="row-main">
                <div className="trim-console">
                  <div className="trim-stack">
                    <div
                      className={`trim-rail${trimReady ? "" : " is-empty"}`}
                      ref={trimRailRef}
                      onPointerMove={handleTrimPointerMove}
                      onPointerUp={handleTrimPointerEnd}
                      onPointerCancel={handleTrimPointerEnd}
                      aria-label="Trim selection"
                    >
                      {sourceKind === "video" || !waveformPeaks ? (
                        <div className="thumbnail-strip" aria-hidden="true">
                          {thumbnailSlots.map((thumbnailUrl, index) =>
                            thumbnailUrl ? (
                              <img
                                alt=""
                                draggable="false"
                                key={`${thumbnailUrl}-${index}`}
                                src={thumbnailUrl}
                              />
                            ) : (
                              <span key={index} />
                            )
                          )}
                        </div>
                      ) : null}
                      {waveformPeaks ? (
                        <WaveformCanvas
                          peaks={waveformPeaks}
                          withScrim={sourceKind === "video"}
                        />
                      ) : null}
                      {trimReady
                        ? batchClips.map((clip, index) => (
                            <button
                              className="saved-trim-segment"
                              data-label={clip.title || clip.outputName}
                              key={clip.id}
                              style={{
                                left: `${secondsToPercent(clip.start, mediaDuration)}%`,
                                width: `${Math.max(
                                  1,
                                  secondsToPercent(clip.end, mediaDuration) -
                                    secondsToPercent(clip.start, mediaDuration)
                                )}%`,
                                "--clip-color": clipMarkerColor(index)
                              } as CSSProperties}
                              type="button"
                              title={clip.title}
                              aria-label={`Edit ${clip.title || clip.outputName}`}
                              onClick={() => loadBatchClip(clip)}
                            />
                          ))
                        : null}
                      {trimReady ? (
                        <>
                          <div
                            className="trim-mask trim-mask-left"
                            style={{ width: `${trimStartPercent}%` }}
                          />
                          <div
                            className="trim-mask trim-mask-right"
                            style={{
                              left: `${trimEndPercent}%`,
                              width: `${Math.max(0, 100 - trimEndPercent)}%`
                            }}
                          />
                          <div
                            className="trim-selection"
                            role="slider"
                            aria-label="Selected trim range"
                            aria-valuemin={0}
                            aria-valuemax={Number(mediaDuration.toFixed(1))}
                            aria-valuetext={`${formatClockTime(startTime)} to ${formatClockTime(endTime)}`}
                            tabIndex={0}
                            style={{
                              left: `${trimStartPercent}%`,
                              width: `${trimWidthPercent}%`
                            }}
                            onPointerDown={(event) =>
                              handleTrimPointerDown("window", event)
                            }
                            onKeyDown={(event) =>
                              handleTrimKeyDown("window", event)
                            }
                          >
                            <button
                              className="trim-handle trim-handle-start"
                              type="button"
                              aria-label="Adjust trim start"
                              onPointerDown={(event) =>
                                handleTrimPointerDown("start", event)
                              }
                              onKeyDown={(event) =>
                                handleTrimKeyDown("start", event)
                              }
                            />
                            <button
                              className="trim-handle trim-handle-end"
                              type="button"
                              aria-label="Adjust trim end"
                              onPointerDown={(event) =>
                                handleTrimPointerDown("end", event)
                              }
                              onKeyDown={(event) =>
                                handleTrimKeyDown("end", event)
                              }
                            />
                          </div>
                        </>
                      ) : null}
                    </div>

                    <div className="trim-readout">
                      <span>{formatClockTime(startTime)}</span>
                      <button
                        className={`trim-play-pill${isRangePlaying ? " is-playing" : ""}`}
                        disabled={!sourceFile || !rangeValidation.valid}
                        type="button"
                        onClick={playSelectedRange}
                        aria-label={
                          isRangePlaying
                            ? "Stop selected range"
                            : "Play selected range"
                        }
                        aria-pressed={isRangePlaying}
                      >
                        <span className="trim-play-glyph" aria-hidden="true" />
                      </button>
                      <span>{formatClockTime(endTime)}</span>
                    </div>
                  </div>
                </div>

                {rangeValidation.message ? (
                  <p className="message">{rangeValidation.message}</p>
                ) : null}
              </div>
            </div>
            ) : null}

        </section>

        {sourceFile ? (
        <section className="work-card work-card-light" aria-label="Name and export">
            <div className="work-row work-row-light work-row-light-start">
              <div className="row-meta">
                <span>{formatDuration(selectedDuration)}</span>
                <strong>Name This Clip</strong>
              </div>
              <div className="row-main">
                <div className="section-line">
                  <strong>Name This Clip</strong>
                  <span>{formatDuration(selectedDuration)} selected</span>
                </div>
                <div className="name-grid">
                  <label className="field-label">
                    <span>Character name</span>
                    <input
                      placeholder="e.g. Emily"
                      type="text"
                      value={characterName}
                      onChange={(event) => setCharacterName(event.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    <span>Take or descriptor</span>
                    <input
                      placeholder="e.g. calm take"
                      type="text"
                      value={descriptor}
                      onChange={(event) => setDescriptor(event.target.value)}
                    />
                  </label>
                </div>

                <label className="field-label">
                  <span>Tags</span>
                  <input
                    placeholder="e.g. lead, interview"
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                  />
                </label>

                {activeTags.length > 0 ? (
                  <div className="tag-preview" aria-label="Current tags">
                    {activeTagPreview.visible.map((tag) => (
                      <span className="tag-chip tag-chip-accent" key={tag}>
                        {tag}
                      </span>
                    ))}
                    {activeTagPreview.hiddenCount > 0 ? (
                      <span className="tag-chip tag-chip-muted">
                        +{activeTagPreview.hiddenCount}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                <div className="filename-preview">
                  <span>Filename</span>
                  <strong>{outputFilename}</strong>
                </div>

                <div className="composer-actions">
                  <button
                    className="primary-button"
                    disabled={!canCreate}
                    type="button"
                    onClick={handleCreateReference}
                  >
                    {exportState === "processing"
                      ? "Exporting This Clip..."
                      : "Export This Clip"}
                  </button>
                  <button
                    className="secondary-button current-export-button"
                    disabled={!sourceFile || !rangeValidation.valid}
                    type="button"
                    onClick={addCurrentClipToBatch}
                  >
                    Add Clip to Batch
                  </button>
                </div>

                {exportState === "processing" ? (
                  <div className="progress-panel" aria-live="polite">
                    <span>{exportStatus}</span>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.round(exportProgress * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                {outputUrl ? (
                  <section className="output-panel" aria-label="Generated reference">
                    <div className="preview-frame output-preview">
                      <video controls src={outputUrl} />
                    </div>
                    <div className="download-row">
                      <div>
                        <span>MP4 ready</span>
                        <strong>{outputName}</strong>
                      </div>
                      <a
                        className="download-button"
                        href={outputUrl}
                        download={outputName}
                      >
                        Download MP4
                      </a>
                    </div>
                    <div className="post-export-organize">
                      <p className="prompt-helper">Saved to Quick exports.</p>
                      {lastExportClipId ? (
                        <button
                          className="subtle-button"
                          type="button"
                          onClick={() => setMoveClipId(lastExportClipId)}
                        >
                          Organize
                        </button>
                      ) : null}
                    </div>
                  </section>
                ) : null}
              </div>
            </div>

            <div className="work-row work-row-light work-row-light-end">
              <div className="row-meta">
                <span>{batchClips.length}</span>
                <strong>Batch</strong>
              </div>
              <div className="row-main">
                <div className="batch-heading">
                  <span>{batchSummary}</span>
                  <button
                    className="subtle-button"
                    disabled={batchClips.length === 0}
                    type="button"
                    onClick={() => setBatchClips([])}
                  >
                    Clear Batch
                  </button>
                </div>

                {batchClips.length === 0 ? (
                  <p className="empty-state">
                    <strong>The batch is empty</strong>
                    <span>
                      Set a range on the rail, then Add Clip to Batch. Clips
                      collect here and export together as one ZIP.
                    </span>
                  </p>
                ) : (
                  <div className="batch-list">
                    {batchClips.map((clip, index) => (
                      <div
                        className="batch-item"
                        key={clip.id}
                        style={
                          { "--clip-color": clipMarkerColor(index) } as CSSProperties
                        }
                      >
                        <div className="batch-time">
                          <span>{formatDuration(clip.end - clip.start)}</span>
                          <small>{String(index + 1).padStart(2, "0")}</small>
                        </div>
                        <div className="batch-copy">
                          <div className="batch-title-line">
                            <span className="batch-color-dot" aria-hidden="true" />
                            <strong>{clip.title || `Clip ${index + 1}`}</strong>
                          </div>
                          <small>
                            {formatClockTime(clip.start)} -{" "}
                            {formatClockTime(clip.end)}
                          </small>
                          <div className="batch-tags">
                            {clip.descriptor ? (
                              <span className="tag-chip tag-chip-secondary">
                                {clip.descriptor}
                              </span>
                            ) : null}
                            {limitedTags(clip.tags).visible.map((tag) => (
                              <span className="tag-chip tag-chip-accent" key={tag}>
                                {tag}
                              </span>
                            ))}
                            {limitedTags(clip.tags).hiddenCount > 0 ? (
                              <span className="tag-chip tag-chip-muted">
                                +{limitedTags(clip.tags).hiddenCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="batch-actions">
                          <button type="button" onClick={() => loadBatchClip(clip)}>
                            Edit
                          </button>
                          <button type="button" onClick={() => removeBatchClip(clip.id)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="action-row export-actions">
                  <button
                    className="primary-button"
                    disabled={!canBatchExport}
                    type="button"
                    onClick={handleBatchExport}
                  >
                    {batchExportLabel}
                  </button>
                </div>

                {batchJob ? (
                  <div
                    className={`progress-panel${
                      batchJob.status === "done" ? " is-done" : ""
                    }`}
                    aria-live="polite"
                  >
                    <span>{batchJobSummary}</span>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${Math.round(batchJob.progress * 100)}%` }}
                      />
                    </div>
                    {batchJob.clips.length > 0 ? (
                      <details className="job-details">
                        <summary>Details</summary>
                        <div className="job-list">
                          {batchJob.clips.map((clip) => (
                            <span key={clip.index}>
                              {clip.filename}: {clip.status}
                              {clip.error ? ` - ${clip.error}` : ""}
                            </span>
                          ))}
                        </div>
                      </details>
                    ) : null}
                    {batchJob.downloadUrl ? (
                      <a className="download-button" href={batchJob.downloadUrl}>
                        Download ZIP
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
        </section>
        ) : null}

        <section className="library-card" aria-label="References">
            <div className="library-section-heading">
              <div>
                <strong>{libraryLocationLabel}</strong>
                <span>{visibleLibraryClips.length} shown</span>
              </div>
            </div>
            <div className="library-toolbar">
              <label className="library-search">
                <span>Search</span>
                <div className="library-search-box">
                  <Search size={15} strokeWidth={1.8} aria-hidden="true" />
                  <input
                    placeholder="Search references..."
                    type="search"
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                  />
                </div>
              </label>
              <div className="library-toolbar-actions">
                <button
                  className="library-import-toggle"
                  type="button"
                  onClick={() => setShowImportPanel((current) => !current)}
                  aria-expanded={showImportPanel}
                >
                  <Upload size={15} strokeWidth={1.9} aria-hidden="true" />
                  Add Existing Clip
                </button>
                <button
                  className="library-import-toggle"
                  type="button"
                  disabled={libraryClips.length === 0}
                  onClick={handleLibraryArchiveExport}
                >
                  <Download size={15} strokeWidth={1.9} aria-hidden="true" />
                  Export All
                </button>
              </div>
            </div>

            <div className="reference-filter-tabs" aria-label="Reference filter">
              {[
                ["recent", "Latest"],
                ["characters", "Characters"],
                ["favorites", "Starred"]
              ].map(([mode, label]) => (
                <button
                  className={librarySortMode === mode ? "is-active" : ""}
                  key={mode}
                  type="button"
                  onClick={() => setLibrarySortMode(mode as LibrarySortMode)}
                >
                  {label}
                </button>
              ))}
            </div>

            {showImportPanel ? (
              <div className="import-panel">
                <label className="field-label">
                  <span>Import tags</span>
                  <input
                    placeholder="archive, imported"
                    value={importTags}
                    onChange={(event) => setImportTags(event.target.value)}
                  />
                </label>
                <label className="import-button">
                  <Upload size={15} strokeWidth={1.9} aria-hidden="true" />
                  Choose Reference File
                    <input
                      type="file"
                      accept={ACCEPTED_REFERENCE_TYPES}
                      onChange={handleLibraryImport}
                    />
                </label>
              </div>
            ) : null}

            {libraryError ? <p className="message error">{libraryError}</p> : null}
            {organizationError ? (
              <div className="organization-error" role="alert">
                <span>{organizationError}</span>
                <button type="button" onClick={initializeWorkspaceLibrary}>
                  Retry
                </button>
              </div>
            ) : null}
            {thumbnailError ? (
              <p className="message error">{thumbnailError}</p>
            ) : null}
            {libraryLoading ? <p className="library-empty">Loading library...</p> : null}

            <div className="library-list">
              {(librarySortMode === "characters"
                ? groupLibraryClips(visibleLibraryClips)
                : [null]
              ).map((group) => (
                <div
                  className={group ? "library-group" : "library-flat"}
                  key={group?.key ?? "flat"}
                >
                  {group ? (
                    <div className="library-group-heading">
                      <strong>{group.label}</strong>
                      <span>
                        {group.clips.length} clip
                        {group.clips.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  ) : null}
                  {(group ? group.clips : visibleLibraryClips).map((clip) => {
                const displayTitle = getLibraryDisplayTitle(clip);
                const descriptor = clip.descriptor.trim();
                const showDescriptorChip =
                  Boolean(descriptor) &&
                  !displayTitle.toLowerCase().includes(descriptor.toLowerCase());
                const currentPlaybackTime = libraryPlaybackTimes[clip.id] ?? 0;
                const playbackProgress =
                  clip.duration > 0
                    ? Math.min(100, (currentPlaybackTime / clip.duration) * 100)
                    : 0;
                const isClipPlaying = playingClipId === clip.id;
                return (
                  <article
                    className={`library-item${clip.thumbnailUrl ? " has-thumbnail" : ""}${
                      isClipPlaying ? " is-playing" : ""
                    }`}
                    key={clip.id}
                  >
                  <div className="library-thumbnail">
                    {clip.thumbnailUrl ? (
                      <img
                        alt={`${displayTitle} thumbnail`}
                        src={clip.thumbnailUrl}
                      />
                    ) : (
                      <span aria-hidden="true">{getLibraryInitials(clip)}</span>
                    )}
                    <div className="thumbnail-actions">
                      <label
                        className="thumbnail-action"
                        aria-label={`Add thumbnail for ${displayTitle}`}
                      >
                        <ImagePlus size={14} strokeWidth={2} aria-hidden="true" />
                        <input
                          type="file"
                          accept={ACCEPTED_IMAGE_TYPES}
                          onChange={(event) => handleThumbnailInput(clip, event)}
                        />
                      </label>
                      {clip.thumbnailUrl ? (
                        <button
                          className="thumbnail-action"
                          type="button"
                          onClick={() => removeClipThumbnail(clip)}
                          aria-label={`Remove thumbnail for ${displayTitle}`}
                        >
                          <X size={14} strokeWidth={2} aria-hidden="true" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="library-item-main">
                    <div className="library-title-row">
                      <div className="library-title-copy">
                        <strong>{displayTitle}</strong>
                        <p className="library-filename">
                          {clip.filename}
                          {clip.sourceId
                            ? ` · from ${truncateMiddle(clip.sourceId, 28)}`
                            : ""}
                        </p>
                      </div>
                      <div className="library-actions">
                        <button
                          className={`library-icon-action${
                            clip.favorite ? " is-active" : ""
                          }`}
                          type="button"
                          onClick={() => toggleFavorite(clip)}
                          aria-label={
                            clip.favorite
                              ? `Remove ${displayTitle} from starred`
                              : `Star ${displayTitle}`
                          }
                        >
                          <Star
                            size={15}
                            strokeWidth={2}
                            fill={clip.favorite ? "currentColor" : "none"}
                            aria-hidden="true"
                          />
                        </button>
                        <a
                          className="library-icon-action"
                          href={clip.downloadUrl}
                          download={clip.filename}
                          aria-label={`Download ${displayTitle}`}
                        >
                          <Download
                            size={15}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </a>
                        <button
                          className={`library-icon-action${
                            editingClipId === clip.id ? " is-active" : ""
                          }`}
                          type="button"
                          onClick={() =>
                            setEditingClipId((current) =>
                              current === clip.id ? null : clip.id
                            )
                          }
                          aria-label={`Edit tags for ${displayTitle}`}
                        >
                          <Tags size={15} strokeWidth={2} aria-hidden="true" />
                        </button>
                        <button
                          className="library-icon-action"
                          type="button"
                          title="Move reference"
                          onClick={() => setMoveClipId(clip.id)}
                          aria-label={`Move reference: ${displayTitle}`}
                        >
                          <FolderInput
                            size={15}
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          className="library-icon-action"
                          type="button"
                          onClick={() => removeLibraryClip(clip)}
                          aria-label={`Delete ${displayTitle}`}
                        >
                          <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <div className="library-tags">
                      {showDescriptorChip ? (
                        <span className="tag-chip tag-chip-secondary">
                          {descriptor}
                        </span>
                      ) : null}
                      {limitedTags(clip.tags).visible.map((tag) => (
                        <span className="tag-chip tag-chip-accent" key={tag}>
                          {tag}
                        </span>
                      ))}
                      {limitedTags(clip.tags).hiddenCount > 0 ? (
                        <span className="tag-chip tag-chip-muted">
                          +{limitedTags(clip.tags).hiddenCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="library-row-meta">
                      <div className="library-player">
                        <button
                          className="library-player-button"
                          type="button"
                          onClick={() => toggleLibraryPlayback(clip.id)}
                          aria-label={
                            isClipPlaying
                              ? `Pause ${displayTitle}`
                              : `Play ${displayTitle}`
                          }
                        >
                          {isClipPlaying ? (
                            <Pause size={13} strokeWidth={2.3} aria-hidden="true" />
                          ) : (
                            <Play size={13} strokeWidth={2.3} aria-hidden="true" />
                          )}
                        </button>
                        <span className="library-player-time">
                          {formatPlayerTime(currentPlaybackTime)} /{" "}
                          {formatPlayerTime(clip.duration)}
                        </span>
                        <div
                          className="library-player-progress"
                          aria-hidden="true"
                        >
                          <span style={{ width: `${playbackProgress}%` }} />
                        </div>
                      </div>
                      <audio
                        className="library-audio"
                        data-clip-id={clip.id}
                        preload="metadata"
                        src={clip.mediaUrl}
                        onPlay={() => handleLibraryAudioPlay(clip.id)}
                        onPause={() =>
                          setPlayingClipId((current) =>
                            current === clip.id ? null : current
                          )
                        }
                        onTimeUpdate={(event) =>
                          updateLibraryPlaybackTime(
                            clip.id,
                            event.currentTarget.currentTime
                          )
                        }
                        onEnded={() => {
                          setPlayingClipId((current) =>
                            current === clip.id ? null : current
                          );
                          updateLibraryPlaybackTime(clip.id, 0);
                        }}
                      />
                    </div>
                    {editingClipId === clip.id ? (
                      <div className="library-edit-row">
                        <input
                          type="text"
                          value={libraryTagDrafts[clip.id] ?? clip.tags.join(", ")}
                          onChange={(event) =>
                            setLibraryTagDrafts((drafts) => ({
                              ...drafts,
                              [clip.id]: event.target.value
                            }))
                          }
                          placeholder="Tags"
                          aria-label={`Tags for ${displayTitle}`}
                        />
                        <button
                          type="button"
                          onClick={() => saveClipTags(clip)}
                        >
                          Save
                        </button>
                      </div>
                    ) : null}
                  </div>
                  </article>
                );
              })}
                </div>
              ))}
            </div>

            {!libraryLoading && visibleLibraryClips.length === 0 ? (
              <p className="empty-state">
                <strong>No references yet</strong>
                <span>{libraryEmptyCopy(libraryLocation)}</span>
              </p>
            ) : null}
        </section>
      </section>

      <ProjectEditorDialog
        open={Boolean(projectDialog)}
        title={projectDialog?.mode === "rename" ? "Rename project" : "New project"}
        projects={projects}
        initialName={
          projectDialog?.mode === "rename" ? projectDialog.project.name : ""
        }
        onClose={() => setProjectDialog(null)}
        onSubmit={(input) => void submitProjectDialog(input)}
      />
      <FolderEditorDialog
        open={Boolean(folderDialog)}
        title={folderDialog?.mode === "rename" ? "Rename folder" : "New folder"}
        projectId={
          folderDialog?.mode === "rename"
            ? folderDialog.folder.projectId
            : folderDialog?.projectId ?? ""
        }
        folders={projectFolders}
        initialName={
          folderDialog?.mode === "rename" ? folderDialog.folder.name : ""
        }
        onClose={() => setFolderDialog(null)}
        onSubmit={(name) => void submitFolderDialog(name)}
      />
      <MoveReferenceDialog
        open={Boolean(movingClip)}
        clipTitle={movingClip ? getLibraryDisplayTitle(movingClip) : "Reference"}
        projects={projects}
        folders={projectFolders}
        onClose={() => setMoveClipId(null)}
        onMove={(destination) => void submitMove(destination)}
        onCreateProject={(input) => void submitInlineProject(input)}
        onCreateFolder={(projectId, name) =>
          void submitInlineFolder(projectId, name)
        }
      />
      <ConfirmOrganizationDeleteDialog
        open={Boolean(deleteTarget)}
        kind={deleteTarget?.kind ?? "project"}
        name={
          deleteTarget?.kind === "project"
            ? deleteTarget.project.name
            : deleteTarget?.folder.name ?? ""
        }
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmOrganizationDelete()}
      />
      {organizationUndo ? (
        <div className="organization-undo" role="status">
          <span>{organizationUndo.label}</span>
          <button type="button" onClick={() => void undoOrganizationDelete()}>
            Undo
          </button>
        </div>
      ) : null}
      <footer className="creator-footer">
        <span>
          Built by{" "}
          <a href={CREATOR_X_URL} target="_blank" rel="noreferrer">
            VictorInFocus
          </a>{" "}
          - AI video tools &amp; cinematic AI film.
        </span>
        <span className="creator-footer-links">
          <a href={CREATOR_X_URL} target="_blank" rel="noreferrer">
            Follow on X
          </a>
          <a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer">
            Open source
          </a>
          <a href={FEEDBACK_MAILTO}>Want voice isolation? Tell me</a>
        </span>
      </footer>
    </main>
  );
}
