// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import "./datamonitor.scss";

import { Button } from "@/app/element/button";
import { Modal } from "@/app/modals/modal";
import { globalStore } from "@/app/store/jotaiStore";
import { makeORef } from "@/app/store/wos";
import { RpcApi } from "@/app/store/wshclientapi";
import { TabRpcClient } from "@/app/store/wshrpcutil";
import { useState } from "react";
import clsx from "clsx";
import * as jotai from "jotai";
import * as React from "react";

import type { MetaKeyAtomFnType, WaveEnv, WaveEnvSubset } from "@/app/waveenv/waveenv";
import type { DataMonitorMetric, DataMonitorSource, DataMonitorSourceState } from "./datamonitor-types";
import { emptySourcesJson, formatMetric, validateSources } from "./datamonitor-util";

// FORK: data-monitor widget — view type "datamonitor". Registered in
// frontend/app/block/blockregistry.ts. Persists per-block config in
// block.meta["monitor:sources"] (JSON-encoded DataMonitorSource[]).
export type DataMonitorEnv = WaveEnvSubset<{
    rpc: {
        SetMetaCommand: WaveEnv["rpc"]["SetMetaCommand"];
    };
    getBlockMetaKeyAtom: MetaKeyAtomFnType<"monitor:sources">;
}>;

const DEFAULT_INTERVAL_SEC = 60;

function emptyState(): DataMonitorSourceState {
    return { loading: false, error: null, lastFetchMs: null, values: {}, statuscode: null };
}

function parseSourcesFromMeta(raw: any): DataMonitorSource[] {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw as DataMonitorSource[];
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? (parsed as DataMonitorSource[]) : [];
        } catch {
            return [];
        }
    }
    return [];
}

class DataMonitorViewModel implements ViewModel {
    viewType: string;
    blockId: string;
    env: DataMonitorEnv;
    viewIcon: jotai.Atom<string>;
    viewName: jotai.Atom<string>;
    termMode: jotai.Atom<string>;
    htmlElemFocusRef: React.RefObject<HTMLInputElement>;
    endIconButtons: jotai.Atom<IconButtonDecl[]>;
    // Holds { sourceId -> DataMonitorSourceState } so a re-render fires whenever
    // any source updates. We rebuild this map on every successful or failed fetch.
    statesAtom: jotai.PrimitiveAtom<Record<string, DataMonitorSourceState>>;
    // Settings modal visibility is local to the React tree (not persisted).
    settingsModalOpenAtom: jotai.PrimitiveAtom<boolean>;
    // bumpCounter forces the polling effect to re-arm when sources change.
    configRevAtom: jotai.PrimitiveAtom<number>;
    private intervalHandles: Map<string, ReturnType<typeof setInterval>> = new Map();
    private inFlight: Map<string, boolean> = new Map();

    constructor({ blockId, waveEnv }: ViewModelInitType) {
        this.viewType = "datamonitor";
        this.blockId = blockId;
        this.env = waveEnv;
        this.termMode = jotai.atom("default");
        this.htmlElemFocusRef = React.createRef();
        this.viewIcon = jotai.atom("chart-mixed");
        this.viewName = jotai.atom("数据监控");
        this.statesAtom = jotai.atom({});
        this.settingsModalOpenAtom = jotai.atom(false);
        this.configRevAtom = jotai.atom(0);
        this.endIconButtons = jotai.atom((get): IconButtonDecl[] => {
            return [
                {
                    elemtype: "iconbutton",
                    icon: "rotate-right",
                    title: "全部刷新",
                    click: () => this.refreshAll(),
                },
                {
                    elemtype: "iconbutton",
                    icon: "gear",
                    title: "编辑配置",
                    click: () => globalStore.set(this.settingsModalOpenAtom, true),
                },
            ];
        });
    }

    get viewComponent(): ViewComponent {
        return DataMonitorView;
    }

    getSettingsMenuItems(): ContextMenuItem[] {
        return [
            {
                label: "全部刷新",
                click: () => this.refreshAll(),
            },
            {
                label: "编辑配置",
                click: () => globalStore.set(this.settingsModalOpenAtom, true),
            },
        ];
    }

    // Single-fetch entry point. Called by setInterval AND by manual refresh.
    async fetchSource(source: DataMonitorSource): Promise<void> {
        if (this.inFlight.get(source.id)) return; // dedupe concurrent requests
        this.inFlight.set(source.id, true);
        this.patchState(source.id, (s) => ({ ...s, loading: true, error: null }));
        try {
            const headers: Record<string, string> = { ...(source.headers ?? {}) };
            const resp = await RpcApi.FetchUrlCommand(TabRpcClient, {
                url: source.url,
                method: source.method ?? "GET",
                headers,
                body: source.body ?? "",
            });
            if (resp?.error) {
                this.patchState(source.id, (s) => ({
                    ...s,
                    loading: false,
                    error: resp.error,
                    lastFetchMs: Date.now(),
                    statuscode: resp.statuscode ?? null,
                }));
                return;
            }
            if (!resp || resp.statuscode < 200 || resp.statuscode >= 300) {
                this.patchState(source.id, (s) => ({
                    ...s,
                    loading: false,
                    error: `HTTP ${resp?.statuscode ?? "?"}`,
                    lastFetchMs: Date.now(),
                    statuscode: resp?.statuscode ?? null,
                }));
                return;
            }
            let parsed: any;
            try {
                parsed = JSON.parse(resp.body);
            } catch (e) {
                this.patchState(source.id, (s) => ({
                    ...s,
                    loading: false,
                    error: "响应不是合法 JSON: " + (e as Error).message,
                    lastFetchMs: Date.now(),
                    statuscode: resp.statuscode,
                }));
                return;
            }
            const values: Record<string, any> = {};
            for (const m of source.metrics) {
                try {
                    values[m.id] = walkSelector(parsed, m.selector);
                } catch {
                    values[m.id] = undefined;
                }
            }
            this.patchState(source.id, (s) => ({
                ...s,
                loading: false,
                error: null,
                lastFetchMs: Date.now(),
                values,
                statuscode: resp.statuscode,
            }));
        } catch (e) {
            this.patchState(source.id, (s) => ({
                ...s,
                loading: false,
                error: (e as Error).message ?? String(e),
                lastFetchMs: Date.now(),
            }));
        } finally {
            this.inFlight.set(source.id, false);
        }
    }

    private patchState(sourceId: string, updater: (s: DataMonitorSourceState) => DataMonitorSourceState) {
        const map = globalStore.get(this.statesAtom);
        const prev = map[sourceId] ?? emptyState();
        globalStore.set(this.statesAtom, { ...map, [sourceId]: updater(prev) });
    }

    refreshAll() {
        const sources = this.getCurrentSources();
        for (const s of sources) {
            void this.fetchSource(s);
        }
    }

    // getCurrentSources reads the latest atom value (always up-to-date).
    private getCurrentSources(): DataMonitorSource[] {
        const raw = globalStore.get(this.env.getBlockMetaKeyAtom(this.blockId, "monitor:sources"));
        return parseSourcesFromMeta(raw);
    }

    // setSources persists the new config via SetMetaCommand and bumps the rev
    // atom so the polling effect in the React component re-arms.
    async setSources(sources: DataMonitorSource[]): Promise<void> {
        await this.env.rpc.SetMetaCommand(TabRpcClient, {
            oref: makeORef("block", this.blockId),
            meta: { "monitor:sources": JSON.stringify(sources) },
        });
        globalStore.set(this.configRevAtom, globalStore.get(this.configRevAtom) + 1);
    }

    // ensurePolling is called from the React FC. Starts an interval per source;
    // kills any intervals for sources that were removed. Re-invoked when the
    // config changes (we detect that via configRevAtom).
    ensurePolling(sources: DataMonitorSource[]) {
        const wanted = new Set(sources.map((s) => s.id));
        for (const [id, handle] of this.intervalHandles) {
            if (!wanted.has(id)) {
                clearInterval(handle);
                this.intervalHandles.delete(id);
            }
        }
        for (const s of sources) {
            if (this.intervalHandles.has(s.id)) continue;
            const intervalMs = Math.max(5, s.intervalSec ?? DEFAULT_INTERVAL_SEC) * 1000;
            // Kick off an immediate fetch so the UI isn't blank on first render.
            void this.fetchSource(s);
            const handle = setInterval(() => void this.fetchSource(s), intervalMs);
            this.intervalHandles.set(s.id, handle);
        }
    }

    dispose() {
        for (const handle of this.intervalHandles.values()) clearInterval(handle);
        this.intervalHandles.clear();
    }
}

// walkSelector lives here too (not in util.ts) to keep one import — avoids
// pulling in the util module from the React tree twice. Keep in sync with
// datamonitor-util.ts.
function walkSelector(root: any, selector: string): any {
    if (root == null || selector == null || selector === "") return root;
    const parts = selector.split(".").filter((p) => p !== "");
    let cur: any = root;
    for (const part of parts) {
        if (cur == null) return undefined;
        if (/^\d+$/.test(part)) {
            const idx = parseInt(part, 10);
            if (!Array.isArray(cur) || idx < 0 || idx >= cur.length) return undefined;
            cur = cur[idx];
        } else {
            if (typeof cur !== "object" || Array.isArray(cur)) return undefined;
            cur = cur[part];
        }
    }
    return cur;
}

type DataMonitorViewProps = {
    blockId: string;
    model: DataMonitorViewModel;
};

const DataMonitorView: React.FC<DataMonitorViewProps> = ({ model }) => {
    const sources = useSources(model);
    const states = jotai.useAtomValue(model.statesAtom);
    const settingsOpen = jotai.useAtomValue(model.settingsModalOpenAtom);

    // (Re-)arm polling whenever the source list changes. We key on a serialized
    // id+interval pair so re-renders that don't change the polling config don't
    // reset every interval.
    const pollKey = React.useMemo(
        () => sources.map((s) => `${s.id}:${s.intervalSec}`).join("|"),
        [sources]
    );

    React.useEffect(() => {
        model.ensurePolling(sources);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [model, pollKey]);

    React.useEffect(() => {
        return () => model.dispose();
    }, [model]);

    return (
        <div className="datamonitor-view">
            {sources.length === 0 ? (
                <EmptyState onAdd={() => globalStore.set(model.settingsModalOpenAtom, true)} />
            ) : (
                <div className="datamonitor-cards">
                    {sources.map((s) => (
                        <SourceCard key={s.id} source={s} state={states[s.id] ?? emptyState()} onRefresh={() => void model.fetchSource(s)} />
                    ))}
                </div>
            )}
            {settingsOpen ? <SettingsModal model={model} /> : null}
        </div>
    );
};

function useSources(model: DataMonitorViewModel): DataMonitorSource[] {
    const atom = React.useMemo(
        () => model.env.getBlockMetaKeyAtom(model.blockId, "monitor:sources"),
        [model]
    );
    const raw = jotai.useAtomValue(atom) as unknown;
    return React.useMemo(() => parseSourcesFromMeta(raw), [raw]);
}

const EmptyState: React.FC<{ onAdd: () => void }> = ({ onAdd }) => (
    <div className="datamonitor-empty">
        <div className="datamonitor-empty-icon">📊</div>
        <div className="datamonitor-empty-title">还没有数据源</div>
        <div className="datamonitor-empty-subtitle">点下面按钮添加,粘贴 JSON 配置 + 凭证</div>
        <Button className="secondary" onClick={onAdd}>
            + 添加数据源
        </Button>
    </div>
);

const SourceCard: React.FC<{
    source: DataMonitorSource;
    state: DataMonitorSourceState;
    onRefresh: () => void;
}> = ({ source, state, onRefresh }) => {
    const lastStr = state.lastFetchMs ? relativeTime(state.lastFetchMs) : "从未";
    const hasError = !!state.error;
    return (
        <div className={clsx("datamonitor-card", { "datamonitor-card-error": hasError })}>
            <div className="datamonitor-card-header">
                <div className="datamonitor-card-title">
                    <span className="datamonitor-card-icon">📊</span>
                    {source.title}
                </div>
                <div className="datamonitor-card-meta">
                    <span className={clsx("datamonitor-card-time", { loading: state.loading })}>
                        ↻ {lastStr}
                    </span>
                    <span className="datamonitor-card-refresh" onClick={onRefresh} title="刷新">
                        ↻
                    </span>
                </div>
            </div>
            {hasError ? (
                <div className="datamonitor-card-error-msg">⚠ {state.error}</div>
            ) : (
                <div className="datamonitor-card-metrics">
                    {source.metrics.map((m) => (
                        <MetricRow key={m.id} metric={m} value={state.values[m.id]} />
                    ))}
                </div>
            )}
        </div>
    );
};

const MetricRow: React.FC<{ metric: DataMonitorMetric; value: any }> = ({ metric, value }) => {
    const fmt = formatMetric(value, metric);
    const showBar = metric.display === "percent" && fmt.numericValue != null;
    return (
        <div className="datamonitor-metric">
            <div className="datamonitor-metric-header">
                <span className="datamonitor-metric-label">{metric.label}</span>
                <span className={clsx("datamonitor-metric-value", { error: fmt.hasError })}>{fmt.text}</span>
            </div>
            {showBar ? (
                <div className="datamonitor-metric-bar">
                    <div
                        className="datamonitor-metric-bar-fill"
                        style={{ width: `${fmt.numericValue}%`, background: metric.color ?? "var(--accent-color, #3b82f6)" }}
                    />
                </div>
            ) : null}
        </div>
    );
};

const SettingsModal: React.FC<{ model: DataMonitorViewModel }> = ({ model }) => {
    const initial = React.useMemo(() => {
        const raw = globalStore.get(model.env.getBlockMetaKeyAtom(model.blockId, "monitor:sources"));
        const parsed = parseSourcesFromMeta(raw);
        if (parsed.length > 0) return JSON.stringify(parsed, null, 4);
        return emptySourcesJson();
    }, [model]);

    const [text, setText] = useState(initial);
    const [valid, setValid] = useState<{ ok: boolean; error?: string }>({ ok: true });

    React.useEffect(() => {
        if (text.trim() === "") {
            setValid({ ok: false, error: "内容为空" });
            return;
        }
        const r = validateSources(text);
        setValid({ ok: r.ok, error: r.error });
    }, [text]);

    const close = () => globalStore.set(model.settingsModalOpenAtom, false);
    const save = async () => {
        if (!valid.ok) return;
        const r = validateSources(text);
        if (!r.ok || !r.sources) return;
        await model.setSources(r.sources);
        close();
    };

    return (
        <Modal
            onCancel={close}
            onClose={close}
            onOk={save}
            okLabel="保存"
            cancelLabel="取消"
            okDisabled={!valid.ok}
        >
            <div className="datamonitor-settings">
                <div className={clsx("datamonitor-settings-status", { ok: valid.ok, err: !valid.ok })}>
                    {valid.ok ? "✓ JSON 合法" : `✗ ${valid.error}`}
                </div>
                <textarea
                    className="datamonitor-settings-textarea"
                    value={text}
                    spellCheck={false}
                    onChange={(e) => setText(e.target.value)}
                />
                <div className="datamonitor-settings-help">
                    每个 source 有 url / headers(cookie 在这) / intervalSec / metrics[]。selector
                    支持点路径和数组下标,例如 <code>model_remains.0.current_interval_used_percent</code>。
                </div>
            </div>
        </Modal>
    );
};

function relativeTime(ms: number): string {
    const delta = Date.now() - ms;
    if (delta < 0) return "刚刚";
    const sec = Math.floor(delta / 1000);
    if (sec < 5) return "刚刚";
    if (sec < 60) return `${sec}s 前`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m 前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h 前`;
    const day = Math.floor(hr / 24);
    return `${day}d 前`;
}

export { DataMonitorViewModel };
