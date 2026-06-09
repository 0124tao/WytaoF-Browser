import {
  useEffect,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpDown,
  CheckSquare,
  Copy,
  Download,
  History,
  Play,
  PlusSquare,
  Search,
  Square,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import {
  Button,
  FormItem,
  Input,
  Modal,
  Select,
  Textarea,
  toast,
} from "../../../shared/components";
import { AutomationScriptHistoryModal } from "../components/AutomationScriptHistoryModal";
import { AutomationScriptRunModal } from "../components/AutomationScriptRunModal";
import { AutomationToolboxModal } from "../components/AutomationToolboxModal";
import { fetchBrowserProfiles } from "../api";
import {
  deleteAutomationScript,
  exportAutomationScriptTemplate,
  fetchAutomationScripts,
  importAutomationScriptFromGit,
  importAutomationScriptFromLocalDirectory,
  importAutomationScriptFromLocalFile,
  importAutomationScriptFromRemote,
  importAutomationScriptFromText,
  saveAutomationScript,
} from "../automationScriptApi";
import {
  AUTOMATION_SCRIPT_TYPE_OPTIONS,
  createAutomationScriptDraft,
  duplicateAutomationScript,
  findAutomationTargetProfile,
  type AutomationScriptRecord,
  type AutomationScriptType,
} from "../automationScripts";
import { useLaunchContext } from "../hooks/useLaunchContext";
import type { BrowserProfile } from "../types";

type ImportMode = "text" | "local-file" | "local-dir" | "remote-url" | "git";
const DUAL_INSTANCE_SCRIPT_ID = "dual-instance-runtime-switch";
const NEWS_SCRIPT_ID = "news-query-txt";

type DualLaunchCodes = {
  primaryCode: string;
  secondaryCode: string;
};

type SortMode = "updated" | "name" | "type";

type AutomationCardPresentation = {
  key: string;
  title: string;
  scriptId?: string;
  modeLabel: string;
  description: string;
  codeDisplay: string;
  status: string;
  primaryActionLabel: string;
  primaryActionText: string;
  primaryActionSuccessMessage: string;
  secondaryActionLabel: string;
  secondaryActionText: string;
  secondaryActionSuccessMessage: string;
  modeToneClass: string;
};

function ScriptCardField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-muted)] px-3 py-3 shadow-[var(--shadow-sm)]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {label}
      </div>
      <div className="mt-1.5 flex-1 text-[12px] font-medium leading-4 text-[var(--color-text-primary)]">
        {children}
      </div>
    </div>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case "ready":
      return { label: "就绪", className: "bg-emerald-100 text-emerald-700 border-emerald-200" };
    case "disabled":
      return { label: "禁用", className: "bg-gray-100 text-gray-500 border-gray-200" };
    case "draft":
    default:
      return { label: "草稿", className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
}

function AutomationScriptSummaryCard({
  card,
  onOpen,
  onRun,
  onDuplicate,
  onDelete,
  onExport,
}: {
  card: AutomationCardPresentation;
  onOpen?: () => void;
  onRun?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onExport?: () => void;
}) {
  const interactive = typeof onOpen === "function";
  const actionCount = 2 + (interactive ? 1 : 0) + (onRun ? 1 : 0) + (onDuplicate ? 1 : 0) + (onExport ? 1 : 0) + (onDelete ? 1 : 0);
  const badge = getStatusBadge(card.status);
  const headerPrimaryButtonClassName =
    "!h-8 !w-full whitespace-nowrap !rounded-xl !border !border-[var(--color-accent)] !bg-[var(--color-accent)] !px-2 !text-[11px] !font-semibold !text-[var(--color-text-inverse)] !shadow-[var(--shadow-sm)] hover:!bg-[var(--color-accent-hover)] hover:!border-[var(--color-accent-hover)] focus-visible:!ring-[var(--color-accent)]";
  const headerSecondaryCopyButtonClassName =
    "!h-8 !w-full whitespace-nowrap !rounded-xl !border !border-[#cbd5e1] !bg-[#e2e8f0] !px-2 !text-[11px] !font-semibold !text-[#243b63] !shadow-[var(--shadow-sm)] hover:!border-[#b8c4d6] hover:!bg-[#d9e2f1] focus-visible:!ring-[#243b63]";
  const headerActionGroupClassName =
    "grid max-w-full flex-shrink-0 gap-1.5";
  const headerActionButtonClassName =
    "!h-8 !w-full whitespace-nowrap !rounded-xl !border !border-[#d8c28a] !bg-[#f6e7be] !px-2 !text-[11px] !font-semibold !text-[#6f5314] !shadow-[var(--shadow-sm)] hover:!border-[#cfb575] hover:!bg-[#f1dfad] focus-visible:!ring-[#d8c28a]";
  const headerRunButtonClassName =
    "!h-8 !w-full whitespace-nowrap !rounded-xl !border !border-[#166534] !bg-[#166534] !px-2 !text-[11px] !font-semibold !text-white !shadow-[var(--shadow-sm)] hover:!border-[#14532d] hover:!bg-[#14532d] focus-visible:!ring-[#166534]";

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || !onOpen) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onOpen : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      className={`group flex h-full flex-col rounded-[22px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3.5 pb-3 pt-4 text-left shadow-[var(--shadow-xs)] transition-all duration-200 md:h-[194px] ${
        interactive
          ? "cursor-pointer hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-md)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
          : ""
      }`}
    >
      <div className="flex min-h-[64px] flex-col gap-2.5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="min-h-[32px] pt-0.5 text-[16px] font-semibold leading-5 text-[var(--color-text-primary)]">
              {card.title}
            </div>
            <div className="mt-1 truncate text-[13px] leading-5 text-[var(--color-text-secondary)]">
              {card.description}
            </div>
          </div>

          <div
            className={headerActionGroupClassName}
            style={{
              gridTemplateColumns: `repeat(${actionCount}, minmax(0, 1fr))`,
              width: `min(100%, ${actionCount * 104}px)`,
            }}
          >
            <Button
              type="button"
              size="sm"
              className={headerPrimaryButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                void copyToClipboard(
                  card.primaryActionText,
                  card.primaryActionSuccessMessage,
                );
              }}
            >
              {card.primaryActionLabel}
            </Button>
            <Button
              type="button"
              size="sm"
              className={headerSecondaryCopyButtonClassName}
              onClick={(event) => {
                event.stopPropagation();
                void copyToClipboard(
                  card.secondaryActionText,
                  card.secondaryActionSuccessMessage,
                );
              }}
            >
              {card.secondaryActionLabel}
            </Button>
            {interactive ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={headerActionButtonClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
              >
                详情
              </Button>
            ) : null}
            {typeof onRun === "function" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={headerRunButtonClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  onRun();
                }}
                aria-label={`执行 ${card.title}`}
                title="快速执行"
              >
                执行
              </Button>
            ) : null}
            {typeof onDuplicate === "function" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={headerSecondaryCopyButtonClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  onDuplicate();
                }}
                aria-label={`复制 ${card.title}`}
                title="复制脚本"
              >
                <Copy className="mr-0.5 h-3 w-3" />
                复制
              </Button>
            ) : null}
            {typeof onExport === "function" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={headerSecondaryCopyButtonClassName}
                onClick={(event) => {
                  event.stopPropagation();
                  onExport();
                }}
                aria-label={`导出 ${card.title}`}
                title="导出脚本模板"
              >
                <Download className="mr-0.5 h-3 w-3" />
                导出
              </Button>
            ) : null}
            {typeof onDelete === "function" ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="!h-8 !w-full whitespace-nowrap !rounded-xl !border !border-red-300 !bg-red-50 !px-2 !text-[11px] !font-semibold !text-red-700 !shadow-[var(--shadow-sm)] hover:!border-red-400 hover:!bg-red-100 focus-visible:!ring-red-400"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete();
                }}
                aria-label={`删除 ${card.title}`}
                title="删除脚本"
              >
                <Trash2 className="mr-0.5 h-3 w-3" />
                删除
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-3 grid items-stretch grid-cols-1 gap-2.5 md:grid-cols-[80px_80px_minmax(0,1fr)]">
        <ScriptCardField label="状态">
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${badge.className}`}>
            {badge.label}
          </span>
        </ScriptCardField>
        <ScriptCardField label="类型">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${card.modeToneClass}`} />
            <span>{card.modeLabel}</span>
          </span>
        </ScriptCardField>
        <ScriptCardField label="Code 码">
          <code className="block truncate whitespace-nowrap font-mono text-[10.5px] leading-4 tracking-[0.04em] text-[var(--color-text-primary)]">
            {card.codeDisplay}
          </code>
        </ScriptCardField>
      </div>
    </div>
  );
}

function normalizeText(value?: string): string {
  return String(value || "").trim();
}

function normalizeCode(value?: string): string {
  return normalizeText(value).toUpperCase();
}

function resolveTargetCode(
  selector: AutomationScriptRecord["targetConfig"]["selector"],
  profiles: BrowserProfile[],
): string {
  const matched = findAutomationTargetProfile(selector, profiles);
  return normalizeCode(matched?.launchCode || selector.code);
}

async function copyToClipboard(text: string, successMessage: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("复制失败");
  }
}

function parseJSONObjectText(text?: string): Record<string, unknown> | null {
  const normalized = normalizeText(text);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = JSON.parse(normalized);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function buildSelectorPayload(
  selector: AutomationScriptRecord["targetConfig"]["selector"],
  profiles: BrowserProfile[],
): Record<string, unknown> | null {
  const matched = findAutomationTargetProfile(selector, profiles);
  const payload: Record<string, unknown> = {};

  const code = normalizeCode(matched?.launchCode || selector.code);
  const profileId = normalizeText(matched?.profileId || selector.profileId);
  const profileName = normalizeText(
    matched?.profileName || selector.profileName,
  );
  const groupId = normalizeText(selector.groupId);

  if (code) {
    payload.code = code;
  }
  if (profileId) {
    payload.profileId = profileId;
  }
  if (profileName) {
    payload.profileName = profileName;
  }
  if (groupId) {
    payload.groupId = groupId;
  }
  if (selector.keywords.length > 0) {
    payload.keywords = [...selector.keywords];
  }
  if (selector.tags.length > 0) {
    payload.tags = [...selector.tags];
  }

  return Object.keys(payload).length > 0 ? payload : null;
}

function buildAutomationRequestPayload(
  script: AutomationScriptRecord,
  profiles: BrowserProfile[],
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    scriptId: script.id,
  };
  const params = parseJSONObjectText(script.paramsText);

  switch (script.targetConfig.mode) {
    case "existing":
    case "rotate": {
      const selector = buildSelectorPayload(script.targetConfig.selector, profiles);
      if (selector) {
        payload.selector = selector;
      }
      break;
    }
    case "create":
      payload.useScriptSelector = true;
      break;
    default: {
      const selector = parseJSONObjectText(script.selectorText);
      if (selector && Object.keys(selector).length > 0) {
        payload.selector = selector;
      } else if (script.type === "playwright-cdp") {
        payload.selector = { code: "YOUR_CODE" };
      }
      break;
    }
  }

  if (params && Object.keys(params).length > 0) {
    payload.params = params;
  } else {
    payload.useScriptParams = true;
  }

  return payload;
}

function buildAutomationRequestPayloadText(
  payload: Record<string, unknown>,
): string {
  return JSON.stringify(payload, null, 2);
}

function buildAutomationRunCurlDemo(options: {
  launchBaseUrl: string;
  apiAuthEnabled: boolean;
  apiAuthHeader: string;
  payload: Record<string, unknown>;
}): string {
  const authHeader = buildCurlAuthHeaderLine(
    options.apiAuthEnabled,
    options.apiAuthHeader,
  );
  return `curl -X POST ${options.launchBaseUrl}/api/automation/scripts/run \\
  -H "Content-Type: application/json" \\
${authHeader}  -d '${buildAutomationRequestPayloadText(options.payload)}'`;
}

function buildAutomationCardMode(
  script: AutomationScriptRecord,
): "skill" | "api-sim" {
  return script.type === "playwright-cdp" ? "skill" : "api-sim";
}

function getAutomationModeLabel(type: AutomationScriptType): string {
  return type === "playwright-cdp" ? "脚本模式" : "接口模式";
}

function getAutomationModeToneClass(type: AutomationScriptType): string {
  return type === "playwright-cdp"
    ? "bg-[var(--color-info)]"
    : "bg-[var(--color-success)]";
}

function buildAutomationSkillPrompt(
  script: AutomationScriptRecord,
  payload: Record<string, unknown>,
) {
  const lines = [
    "使用 ant-chrome-openclaw skill。",
    `执行预置脚本 ${script.id}（${script.name}）。`,
  ];

  if (Object.prototype.hasOwnProperty.call(payload, "selector")) {
    lines.push(`selector: ${JSON.stringify(payload.selector)}`);
  } else if (payload.useScriptSelector) {
    lines.push("selector: 使用脚本默认值。");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "params")) {
    lines.push(`params: ${JSON.stringify(payload.params)}`);
  } else if (payload.useScriptParams) {
    lines.push("params: 使用脚本默认值。");
  }

  return lines.join("\n");
}

function buildAutomationShortDescription(
  script: AutomationScriptRecord,
): string {
  switch (script.id) {
    case DUAL_INSTANCE_SCRIPT_ID:
      return "启动双实例并切换 Runtime";
    case NEWS_SCRIPT_ID:
      return "搜索新闻并写入 TXT";
    default:
      break;
  }

  const source = normalizeText(script.description || script.name);
  const firstSentence = source.split(/[。！？\n]/)[0]?.trim() || "按预置流程执行自动化";
  const compact = firstSentence
    .replace(/^通过/, "")
    .replace(/^使用/, "")
    .replace(/^基于/, "")
    .replace(/浏览器实例/g, "实例")
    .replace(/本地 txt/gi, "TXT")
    .replace(/\s+/g, " ");

  return compact.length > 30 ? `${compact.slice(0, 28).trim()}...` : compact;
}

function buildAutomationCodeDisplay(
  script: AutomationScriptRecord,
  profiles: BrowserProfile[],
  dualLaunchCodes: DualLaunchCodes,
): string {
  if (script.id === DUAL_INSTANCE_SCRIPT_ID) {
    return `${dualLaunchCodes.primaryCode} / ${dualLaunchCodes.secondaryCode}`;
  }

  switch (script.targetConfig.mode) {
    case "existing": {
      return resolveTargetCode(script.targetConfig.selector, profiles) || "运行时传入";
    }
    case "create": {
      return (
        resolveTargetCode(script.targetConfig.templateSelector, profiles) ||
        "运行时传入"
      );
    }
    case "rotate": {
      const code = resolveTargetCode(script.targetConfig.selector, profiles);
      if (code) {
        return code;
      }
      const selector = script.targetConfig.selector;
      const hasFilter = Boolean(
        normalizeText(selector.profileId) ||
          normalizeText(selector.profileName) ||
          normalizeText(selector.groupId) ||
          selector.keywords.length > 0 ||
          selector.tags.length > 0,
      );
      return hasFilter ? "条件匹配" : "运行时传入";
    }
    default: {
      const selector = parseJSONObjectText(script.selectorText);
      const directCode = normalizeCode(
        typeof selector?.code === "string" ? selector.code : "",
      );
      const launchCode = normalizeCode(
        typeof selector?.launchCode === "string" ? selector.launchCode : "",
      );
      return directCode || launchCode || "运行时传入";
    }
  }
}

function buildAutomationCardPresentation(options: {
  script: AutomationScriptRecord;
  profiles: BrowserProfile[];
  launchBaseUrl: string;
  apiAuthEnabled: boolean;
  apiAuthHeader: string;
  dualLaunchCodes: DualLaunchCodes;
  dualInstanceRunPayload: Record<string, unknown>;
  dualInstanceRunPayloadText: string;
  dualInstanceRunCurlDemo: string;
}): AutomationCardPresentation {
  const { script } = options;
  const isDualInstanceScript = script.id === DUAL_INSTANCE_SCRIPT_ID;
  const requestPayload = isDualInstanceScript
    ? options.dualInstanceRunPayload
    : buildAutomationRequestPayload(script, options.profiles);
  const requestPayloadText = isDualInstanceScript
    ? options.dualInstanceRunPayloadText
    : buildAutomationRequestPayloadText(requestPayload);
  const requestCurlDemo = isDualInstanceScript
    ? options.dualInstanceRunCurlDemo
    : buildAutomationRunCurlDemo({
        launchBaseUrl: options.launchBaseUrl,
        apiAuthEnabled: options.apiAuthEnabled,
        apiAuthHeader: options.apiAuthHeader,
        payload: requestPayload,
      });
  const cardMode = buildAutomationCardMode(script);

  return {
    key: script.id,
    title: script.name,
    scriptId: script.id,
    modeLabel: getAutomationModeLabel(script.type),
    description: buildAutomationShortDescription(script),
    codeDisplay: buildAutomationCodeDisplay(
      script,
      options.profiles,
      options.dualLaunchCodes,
    ),
    status: script.status,
    primaryActionLabel:
      cardMode === "skill" ? "复制Skill提示词" : "复制模拟cURL",
    primaryActionText:
      cardMode === "skill"
        ? buildAutomationSkillPrompt(script, requestPayload)
        : requestCurlDemo,
    primaryActionSuccessMessage:
      cardMode === "skill" ? "Skill 提示词已复制" : "模拟 cURL 已复制",
    secondaryActionLabel: "复制请求JSON",
    secondaryActionText: requestPayloadText,
    secondaryActionSuccessMessage: "请求 JSON 已复制",
    modeToneClass: getAutomationModeToneClass(script.type),
  };
}

function buildDualInstanceFallbackPresentation(options: {
  dualLaunchCodes: DualLaunchCodes;
  dualInstanceRunPayloadText: string;
  dualInstanceRunCurlDemo: string;
}): AutomationCardPresentation {
  return {
    key: `${DUAL_INSTANCE_SCRIPT_ID}-fallback`,
    title: "双实例启动与 Runtime 切换",
    modeLabel: "接口模式",
    description: "启动双实例并切换 Runtime",
    codeDisplay: `${options.dualLaunchCodes.primaryCode} / ${options.dualLaunchCodes.secondaryCode}`,
    status: "ready",
    primaryActionLabel: "复制模拟cURL",
    primaryActionText: options.dualInstanceRunCurlDemo,
    primaryActionSuccessMessage: "模拟 cURL 已复制",
    secondaryActionLabel: "复制请求JSON",
    secondaryActionText: options.dualInstanceRunPayloadText,
    secondaryActionSuccessMessage: "请求 JSON 已复制",
    modeToneClass: getAutomationModeToneClass("launch-api"),
  };
}

function collectAvailableLaunchCodes(profiles: BrowserProfile[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const profile of profiles) {
    const code = normalizeCode(profile.launchCode);
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    result.push(code);
  }

  return result;
}

function resolveDualLaunchCodes(profiles: BrowserProfile[]): DualLaunchCodes {
  const availableCodes = collectAvailableLaunchCodes(profiles);
  if (availableCodes.length >= 2) {
    return {
      primaryCode: availableCodes[0],
      secondaryCode: availableCodes[1],
    };
  }
  if (availableCodes.length === 1) {
    return {
      primaryCode: availableCodes[0],
      secondaryCode: "BUYER_002",
    };
  }

  return {
    primaryCode: "BUYER_001",
    secondaryCode: "BUYER_002",
  };
}

function buildCurlAuthHeaderLine(
  apiAuthEnabled: boolean,
  apiAuthHeader: string,
): string {
  if (!apiAuthEnabled) {
    return "";
  }
  return `  -H "${apiAuthHeader}: <YOUR_API_KEY>" \\\n`;
}

export function AutomationPage() {
  const navigate = useNavigate();
  const { launchBaseUrl, apiAuth } = useLaunchContext();
  const [scripts, setScripts] = useState<AutomationScriptRecord[]>([]);
  const [profiles, setProfiles] = useState<BrowserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toolboxOpen, setToolboxOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [activeRunScript, setActiveRunScript] =
    useState<AutomationScriptRecord | null>(null);
  const [createType, setCreateType] =
    useState<AutomationScriptType>("playwright-cdp");
  const [createName, setCreateName] = useState("");
  const [importMode, setImportMode] = useState<ImportMode>("text");
  const [importText, setImportText] = useState("");
  const [remoteURL, setRemoteURL] = useState("");
  const [gitURL, setGitURL] = useState("");
  const [gitRef, setGitRef] = useState("");
  const [gitScriptPath, setGitScriptPath] = useState("");
  const [busyAction, setBusyAction] = useState<"none" | "create" | "import">(
    "none",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);

  useEffect(() => {
    let disposed = false;

    void fetchAutomationScripts()
      .then((items) => {
        if (!disposed) {
          setScripts(items);
        }
      })
      .catch(() => {
        toast.error("脚本列表加载失败");
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;

    void fetchBrowserProfiles()
      .then((items) => {
        if (!disposed) {
          setProfiles(items || []);
        }
      })
      .catch(() => {
        if (!disposed) {
          setProfiles([]);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  const openScript = (scriptId: string) => {
    navigate(`/browser/automation/${scriptId}`);
  };

  const handleOpenRunModal = (script: AutomationScriptRecord) => {
    setActiveRunScript(script);
    setRunModalOpen(true);
  };

  const handleDuplicate = async (script: AutomationScriptRecord) => {
    try {
      const draft = duplicateAutomationScript(script);
      const saved = await saveAutomationScript(draft);
      setScripts((current) => [saved, ...current]);
      toast.success(`脚本「${script.name}」已复制`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "复制失败";
      toast.error(message);
    }
  };

  const handleDelete = async (script: AutomationScriptRecord) => {
    if (!window.confirm(`确认删除脚本「${script.name}」？此操作不可撤销。`)) {
      return;
    }
    try {
      await deleteAutomationScript(script.id);
      setScripts((current) => current.filter((item) => item.id !== script.id));
      toast.success(`脚本「${script.name}」已删除`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "删除失败";
      toast.error(message);
    }
  };

  const handleExport = async (script: AutomationScriptRecord) => {
    try {
      const result = await exportAutomationScriptTemplate(script.id, script);
      if (!result.cancelled) {
        toast.success(result.message || "脚本模板已导出");
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "导出失败";
      toast.error(message);
    }
  };

  const toggleSelect = (scriptId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    const runnableIds = filteredScripts.map((s) => s.id);
    const allSelected = runnableIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(runnableIds));
    }
  };

  const handleBatchRun = async () => {
    const targets = scripts.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;
    if (!window.confirm(`确认批量执行 ${targets.length} 个脚本？`)) return;
    setBatchRunning(true);
    let successCount = 0;
    let failCount = 0;
    for (const script of targets) {
      try {
        const { runAutomationScript } = await import("../automationScriptApi");
        await runAutomationScript({
          scriptId: script.id,
          selectorText: "",
          paramsText: "",
          useScriptSelector: true,
          useScriptParams: true,
          timeoutMs: 0,
          launchCode: "",
          startByCodeBeforeRun: false,
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    setBatchRunning(false);
    setSelectedIds(new Set());
    if (failCount === 0) {
      toast.success(`批量执行完成：${successCount} 个全部成功`);
    } else {
      toast.error(`批量执行完成：${successCount} 成功，${failCount} 失败`);
    }
  };

  const handleBatchDelete = async () => {
    const targets = scripts.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;
    if (!window.confirm(`确认批量删除 ${targets.length} 个脚本？此操作不可撤销。`)) return;
    let deleted = 0;
    for (const script of targets) {
      try {
        await deleteAutomationScript(script.id);
        deleted++;
      } catch { /* continue */ }
    }
    setScripts((current) => current.filter((item) => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
    toast.success(`已删除 ${deleted} 个脚本`);
  };

  const resetCreateModal = () => {
    setCreateType("playwright-cdp");
    setCreateName("");
  };

  const closeCreateModal = () => {
    if (busyAction !== "none") {
      return;
    }
    setCreateOpen(false);
    resetCreateModal();
  };

  const resetImportModal = () => {
    setImportMode("text");
    setImportText("");
    setRemoteURL("");
    setGitURL("");
    setGitRef("");
    setGitScriptPath("");
  };

  const closeImportModal = () => {
    if (busyAction !== "none") {
      return;
    }
    setImportOpen(false);
    resetImportModal();
  };

  const handleCreate = async () => {
    setBusyAction("create");
    try {
      const draft = createAutomationScriptDraft(createType);
      if (createName.trim()) {
        draft.name = createName.trim();
      }

      const saved = await saveAutomationScript(draft);
      setScripts((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setCreateOpen(false);
      resetCreateModal();
      toast.success("脚本已创建");
      openScript(saved.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "脚本创建失败";
      toast.error(message);
    } finally {
      setBusyAction("none");
    }
  };

  const handleImport = async () => {
    setBusyAction("import");
    try {
      let saved: AutomationScriptRecord;

      switch (importMode) {
        case "text": {
          saved = await importAutomationScriptFromText(importText);
          break;
        }
        case "local-file":
          saved = await importAutomationScriptFromLocalFile();
          break;
        case "local-dir":
          saved = await importAutomationScriptFromLocalDirectory();
          break;
        case "remote-url":
          saved = await importAutomationScriptFromRemote(remoteURL);
          break;
        case "git":
          saved = await importAutomationScriptFromGit(
            gitURL,
            gitRef,
            gitScriptPath,
          );
          break;
        default:
          throw new Error("不支持的导入方式");
      }

      setScripts((current) => [
        saved,
        ...current.filter((item) => item.id !== saved.id),
      ]);
      setImportOpen(false);
      resetImportModal();
      toast.success("脚本已导入");
      openScript(saved.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "脚本导入失败";
      toast.error(message);
    } finally {
      setBusyAction("none");
    }
  };

  const dualLaunchCodes = resolveDualLaunchCodes(profiles);
  const dualInstanceRunPayload = {
    scriptId: DUAL_INSTANCE_SCRIPT_ID,
    params: {
      browsers: [
        {
          code: dualLaunchCodes.primaryCode,
          skipDefaultStartUrls: true,
        },
        {
          code: dualLaunchCodes.secondaryCode,
          skipDefaultStartUrls: true,
        },
      ],
      timeoutMs: 45000,
    },
  };
  const dualInstanceRunPayloadText = buildAutomationRequestPayloadText(
    dualInstanceRunPayload,
  );
  const dualInstanceRunCurlDemo = buildAutomationRunCurlDemo({
    launchBaseUrl,
    apiAuthEnabled: apiAuth.enabled,
    apiAuthHeader: apiAuth.header,
    payload: dualInstanceRunPayload,
  });
  const hasDualInstanceBaseline = scripts.some(
    (item) => item.id === DUAL_INSTANCE_SCRIPT_ID,
  );
  const filteredScripts = scripts.filter((script) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      script.name.toLowerCase().includes(q) ||
      script.description.toLowerCase().includes(q) ||
      script.id.toLowerCase().includes(q) ||
      script.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  const orderedScripts = [...filteredScripts].sort((left, right) => {
    if (left.id === DUAL_INSTANCE_SCRIPT_ID) return -1;
    if (right.id === DUAL_INSTANCE_SCRIPT_ID) return 1;
    switch (sortMode) {
      case "name":
        return left.name.localeCompare(right.name, "zh-CN");
      case "type":
        return left.type.localeCompare(right.type);
      case "updated":
      default:
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    }
  });
  const scriptCards = orderedScripts.map((script) =>
    buildAutomationCardPresentation({
      script,
      profiles,
      launchBaseUrl,
      apiAuthEnabled: apiAuth.enabled,
      apiAuthHeader: apiAuth.header,
      dualLaunchCodes,
      dualInstanceRunPayload,
      dualInstanceRunPayloadText,
      dualInstanceRunCurlDemo,
    }),
  );
  const cards: AutomationCardPresentation[] = hasDualInstanceBaseline
    ? scriptCards
    : [
        buildDualInstanceFallbackPresentation({
          dualLaunchCodes,
          dualInstanceRunPayloadText,
          dualInstanceRunCurlDemo,
        }),
        ...scriptCards,
      ];
  const scriptMap = new Map(scripts.map((script) => [script.id, script]));

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          脚本管理
        </h1>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <PlusSquare className="h-4 w-4" />
            新建脚本
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" />
            导入脚本
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            调用记录
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setToolboxOpen(true)}
          >
            <Wrench className="h-4 w-4" />
            工具箱
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-[320px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索脚本名称、描述、标签…"
            className="h-8 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] pl-8 pr-3 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
            className="h-8 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-2 text-[12px] text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          >
            <option value="updated">最近更新</option>
            <option value="name">按名称</option>
            <option value="type">按类型</option>
          </select>
        </div>
        {scripts.length > 0 && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            共 {scripts.length} 个{searchQuery.trim() ? `，匹配 ${filteredScripts.length} 个` : ""}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={toggleSelectAll}
            className="!h-7 !px-2 !text-[11px]"
          >
            {filteredScripts.length > 0 && filteredScripts.every((s) => selectedIds.has(s.id))
              ? <><CheckSquare className="h-3 w-3" /> 取消全选</>
              : <><Square className="h-3 w-3" /> 全选</>}
          </Button>
          {selectedIds.size > 0 && (
            <>
              <span className="text-[11px] font-medium text-[var(--color-accent)]">
                已选 {selectedIds.size}
              </span>
              <Button
                size="sm"
                onClick={() => void handleBatchRun()}
                disabled={batchRunning}
                loading={batchRunning}
                className="!h-7 !px-2 !text-[11px]"
              >
                <Play className="h-3 w-3" />
                批量执行
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleBatchDelete()}
                disabled={batchRunning}
                className="!h-7 !px-2 !text-[11px] !border-red-300 !text-red-700 hover:!bg-red-50"
              >
                <Trash2 className="h-3 w-3" />
                批量删除
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="rounded-[28px] border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3 shadow-[var(--shadow-sm)] md:p-4">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-12 text-center text-sm text-[var(--color-text-muted)]">
            正在加载脚本列表...
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-6 py-14 text-center">
            <div className="text-base font-medium text-[var(--color-text-primary)]">
              还没有脚本
            </div>
            <div className="mt-2 text-sm text-[var(--color-text-muted)]">
              先新建一套脚本，或者导入已有脚本。
            </div>
            <div className="mt-5 flex justify-center gap-2">
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <PlusSquare className="h-4 w-4" />
                新建
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                导入
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2">
            {cards.map((card) => {
              const scriptId = card.scriptId;
              const onOpen = scriptId ? () => openScript(scriptId) : undefined;
              const script = scriptId ? scriptMap.get(scriptId) : undefined;
              const onRun = script ? () => handleOpenRunModal(script) : undefined;

              const onDuplicate = script
                ? () => void handleDuplicate(script)
                : undefined;
              const onExport = script
                ? () => void handleExport(script)
                : undefined;
              const onDelete = script
                ? () => void handleDelete(script)
                : undefined;
              const isSelected = scriptId ? selectedIds.has(scriptId) : false;

              return (
                <div key={card.key} className="relative">
                  {scriptId && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleSelect(scriptId); }}
                      className={`absolute left-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                        isSelected
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                          : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)] text-transparent hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-muted)]"
                      }`}
                      aria-label={isSelected ? "取消选中" : "选中"}
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <AutomationScriptSummaryCard
                    card={card}
                    onOpen={onOpen}
                    onRun={onRun}
                    onDuplicate={onDuplicate}
                    onExport={onExport}
                    onDelete={onDelete}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title="新建脚本"
        width="460px"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeCreateModal}
              disabled={busyAction !== "none"}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleCreate()}
              loading={busyAction === "create"}
            >
              创建
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormItem label="脚本名称">
            <Input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder="例如：接管页面并截图"
            />
          </FormItem>
          <FormItem label="脚本类型">
            <Select
              value={createType}
              options={AUTOMATION_SCRIPT_TYPE_OPTIONS}
              onChange={(event) =>
                setCreateType(event.target.value as AutomationScriptType)
              }
            />
          </FormItem>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={closeImportModal}
        title="导入脚本"
        width="720px"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={closeImportModal}
              disabled={busyAction !== "none"}
            >
              取消
            </Button>
            <Button
              onClick={() => void handleImport()}
              loading={busyAction === "import"}
            >
              导入
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { value: "text", label: "文本" },
              { value: "local-file", label: "本地文件" },
              { value: "local-dir", label: "本地目录" },
              { value: "remote-url", label: "远程 URL" },
              { value: "git", label: "Git" },
            ].map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={importMode === item.value ? "primary" : "secondary"}
                onClick={() => setImportMode(item.value as ImportMode)}
                disabled={busyAction !== "none"}
              >
                {item.label}
              </Button>
            ))}
          </div>

          {importMode === "text" ? (
            <>
              <div className="text-sm text-[var(--color-text-secondary)]">
                支持导入导出的脚本 JSON，导入后会按草稿保存。
              </div>
              <FormItem label="脚本 JSON">
                <Textarea
                  rows={18}
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  className="font-mono"
                  placeholder='{"manifest":{"name":"示例脚本"}}'
                />
              </FormItem>
            </>
          ) : null}

          {importMode === "local-file" ? (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-4 text-sm text-[var(--color-text-secondary)]">
              导入时会弹出文件选择框。支持单个 `.js/.cjs/.mjs` 脚本文件、导出的
              `.json` 模板，或标准 `.zip` 脚本包。`.ts/.cts/.mts` 仅在设置页开启 TypeScript 导入构建后支持。
            </div>
          ) : null}

          {importMode === "local-dir" ? (
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-4 py-4 text-sm text-[var(--color-text-secondary)]">
              导入时会弹出目录选择框。适合导入一整套本地脚本目录，或 Git 拉下来的脚本包目录。目录里的 `.ts/.cts/.mts` 入口也需要先在设置页开启 TypeScript 导入构建。
            </div>
          ) : null}

          {importMode === "remote-url" ? (
            <div className="space-y-4">
              <div className="text-sm text-[var(--color-text-secondary)]">
                适合导入单个远程脚本文件、导出的脚本 JSON，或标准脚本 ZIP。多文件仓库也可以继续使用 Git 导入；远程 `.ts/.cts/.mts` 同样要求设置页已开启 TypeScript 导入构建。
              </div>
              <FormItem label="远程地址">
                <Input
                  value={remoteURL}
                  onChange={(event) => setRemoteURL(event.target.value)}
                  placeholder="https://example.com/script.cjs"
                />
              </FormItem>
            </div>
          ) : null}

          {importMode === "git" ? (
            <div className="space-y-4">
              <div className="text-sm text-[var(--color-text-secondary)]">
                会先拉取仓库，再把脚本快照导入当前项目。支持仓库根目录或指定子目录；若入口是 `.ts/.cts/.mts`，需要设置页已开启 TypeScript 导入构建。
              </div>
              <FormItem label="仓库地址">
                <Input
                  value={gitURL}
                  onChange={(event) => setGitURL(event.target.value)}
                  placeholder="https://github.com/example/automation-scripts.git"
                />
              </FormItem>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FormItem label="分支 / Tag / Commit">
                  <Input
                    value={gitRef}
                    onChange={(event) => setGitRef(event.target.value)}
                    placeholder="main"
                  />
                </FormItem>
                <FormItem label="脚本路径">
                  <Input
                    value={gitScriptPath}
                    onChange={(event) => setGitScriptPath(event.target.value)}
                    placeholder="scripts/demo"
                  />
                </FormItem>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      <AutomationToolboxModal
        open={toolboxOpen}
        onClose={() => setToolboxOpen(false)}
      />
      <AutomationScriptRunModal
        open={runModalOpen}
        script={activeRunScript}
        dirty={false}
        onClose={() => {
          setRunModalOpen(false);
          setActiveRunScript(null);
        }}
      />
      <AutomationScriptHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
}
