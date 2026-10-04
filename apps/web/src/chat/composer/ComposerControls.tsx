import { t } from "../../i18n";
import type { ComposerVariant } from "./variant";
import type { AgentOption } from "./agentOptions";
import type { ModelOption } from "./modelCatalog";
import type { ModelSwitchState } from "./ModelPicker";
import ModelPicker from "./ModelPicker";
import AgentPicker from "./AgentPicker";
import WorkspacePicker from "./WorkspacePicker";
import PermissionPicker from "./PermissionPicker";
import UploadMenu, { type UploadPanelKind } from "./UploadMenu";

export interface ComposerControlsProps {
  variant: ComposerVariant;

  agentOptions: AgentOption[];
  agentValue: string | null;
  onSelectAgent: (name: string | null) => void;
  agentDisabled?: boolean;

  workspaceOptions: string[];
  workspaceValue: string | null;
  onSelectWorkspace: (path: string | null) => void;
  workspaceDisabled?: boolean;

  modelOptions: ModelOption[];
  modelValue: string | null;
  modelCurrent: { model: string | null; provider: string | null };
  modelSwitch: ModelSwitchState;
  onSelectModel: (model: string) => void;
  onConfirmModel: () => void;
  onCancelModelConfirm: () => void;
  modelDisabled?: boolean;

  permissionValue: string;
  onSelectPermission: (mode: string) => void;
  permissionDisabled?: boolean;

  onAttachFiles: (files: File[]) => void;
  onOpenPanel: (kind: UploadPanelKind) => void;
  uploadDisabled?: boolean;

  running?: boolean;
  canSend?: boolean;
  onSend?: () => void;
  onStop?: () => void;

  /** 语音（M19）：提供时渲染 mic（按住说话 STT）。 */
  onMicToggle?: () => void;
  listening?: boolean;
}

/**
 * 对话页输入区布局壳（TASK-009 / REQ-002 / REQ-003 / REQ-016）。
 *
 * - `hero`：pill 行（`智能体 · 工作区 · 模型`）+ 底行。
 * - `docked`：仅底行。
 * - 底行：`＋ ｜ 权限模式 ｜ composer-spacer ｜ 模型 ｜ 发送/停止`。
 * - **不渲染**语音与 git 分支 pill。
 * **controlled**：所有状态与 RPC 由调用方（`useSessionControls` / `ChatPage`）持有。
 */
export default function ComposerControls(props: ComposerControlsProps) {
  const modelPicker = (
    <ModelPicker
      options={props.modelOptions}
      value={props.modelValue}
      current={props.modelCurrent}
      disabled={props.modelDisabled}
      switchState={props.modelSwitch}
      onSelect={props.onSelectModel}
      onConfirm={props.onConfirmModel}
      onCancelConfirm={props.onCancelModelConfirm}
    />
  );

  return (
    <>
      {props.variant === "hero" ? (
        <div className="chat-hero-pills" aria-label={t("composer.agent")}>
          <AgentPicker
            options={props.agentOptions}
            value={props.agentValue}
            variant="hero"
            onSelect={props.onSelectAgent}
            disabled={props.agentDisabled}
          />
          <WorkspacePicker
            options={props.workspaceOptions}
            value={props.workspaceValue}
            disabled={props.workspaceDisabled}
            onSelect={props.onSelectWorkspace}
          />
          {modelPicker}
        </div>
      ) : null}

      <div className="composer-bottom-row">
        <UploadMenu
          onAttachFiles={props.onAttachFiles}
          onOpenPanel={props.onOpenPanel}
          workspaceOptions={props.workspaceOptions}
          workspaceValue={props.workspaceValue}
          onSelectWorkspace={props.onSelectWorkspace}
          disabled={props.uploadDisabled}
        />
        <PermissionPicker
          value={props.permissionValue}
          disabled={props.permissionDisabled}
          onSelect={props.onSelectPermission}
        />
        <span className="composer-spacer" aria-hidden="true" />
        {modelPicker}
        {props.onMicToggle ? (
          <button
            type="button"
            className="icon-btn composer-mic"
            aria-label={t("composer.voice")}
            aria-pressed={props.listening === true}
            data-listening={props.listening === true}
            onClick={props.onMicToggle}
          >
            🎙
          </button>
        ) : null}
        {props.running ? (
          <button
            type="button"
            className="primary composer-stop"
            aria-label={t("composer.stop")}
            onClick={props.onStop}
          >
            {t("composer.stop")}
          </button>
        ) : (
          <button
            type="button"
            className="primary composer-send"
            aria-label={t("composer.send")}
            disabled={props.canSend === false}
            onClick={props.onSend}
          >
            {t("composer.send")}
          </button>
        )}
      </div>
    </>
  );
}
