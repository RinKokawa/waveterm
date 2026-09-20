// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// Selector / formatting helpers for the Data Monitor widget.
// FORK: see frontend/app/view/datamonitor/datamonitor.tsx for usage.

import type { DataMonitorMetric, DataMonitorSource } from "./datamonitor-types";

// walkSelector resolves a simple dot-path against a parsed JSON value.
// Supports: dot access (`a.b.c`), numeric segments as array indices (`a.0.b`).
// Returns undefined if any segment is missing. Intentionally NOT a full JSONPath
// implementation — just enough for typical API responses.
export function walkSelector(root: any, selector: string): any {
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

// parsePercentString handles values that come back as "8%", "8.5 %",
// or already-numeric. Returns null if the input doesn't look like a usable
// percentage.
export function parsePercentString(v: any): number | null {
    if (typeof v === "number" && isFinite(v)) {
        // API sometimes returns 8.0 meaning "8.0%"; clamp to 0..100.
        return Math.max(0, Math.min(100, v));
    }
    if (typeof v !== "string") return null;
    const m = /^\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/.exec(v);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    return Math.max(0, Math.min(100, n));
}

// formatDurationMs converts a millisecond count to a compact human label
// like "2h 36m" or "11h 37m". Picks the largest sensible unit and only adds a
// second unit if non-zero. Negative or non-finite inputs return null.
export function formatDurationMs(v: any): string | null {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    if (!isFinite(n) || n <= 0) return null;
    const totalSec = Math.floor(n / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
}

// formatNumber renders a metric of type "number" with thousands separators.
// Returns the raw string if it isn't parseable, so the user sees *something*.
export function formatNumber(v: any): string {
    if (typeof v === "number") {
        if (!isFinite(v)) return String(v);
        return v.toLocaleString();
    }
    if (typeof v === "string") return v;
    if (v == null) return "—";
    try {
        return JSON.stringify(v);
    } catch {
        return String(v);
    }
}

// formatMetric picks the right formatter for a metric based on its `display` field.
// Returns { text, numericValue, hasError }.
//   - text: what to show to the user
//   - numericValue: 0..100 if display=="percent", else null (drives the progress bar)
//   - hasError: true when the value is missing or unparseable
export function formatMetric(value: any, metric: DataMonitorMetric): { text: string; numericValue: number | null; hasError: boolean } {
    if (value === undefined) {
        return { text: "—", numericValue: null, hasError: false };
    }
    switch (metric.display) {
        case "percent": {
            const n = parsePercentString(value);
            if (n == null) return { text: String(value), numericValue: null, hasError: true };
            return { text: `${n.toFixed(1)}%`, numericValue: n, hasError: false };
        }
        case "duration_ms": {
            const label = formatDurationMs(value);
            if (label == null) return { text: String(value), numericValue: null, hasError: true };
            return { text: label, numericValue: null, hasError: false };
        }
        case "number":
            return { text: formatNumber(value), numericValue: null, hasError: false };
        case "text":
        default: {
            if (typeof value === "string") return { text: value, numericValue: null, hasError: false };
            if (value == null) return { text: "—", numericValue: null, hasError: false };
            try {
                return { text: JSON.stringify(value), numericValue: null, hasError: false };
            } catch {
                return { text: String(value), numericValue: null, hasError: false };
            }
        }
    }
}

// validateSources performs a lightweight shape check on the user-edited JSON.
// Returns { ok, sources?, error? }. The intent is to catch typos and missing
// required fields before persisting, not to enforce a strict schema.
export function validateSources(raw: string): { ok: boolean; sources?: DataMonitorSource[]; error?: string } {
    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        return { ok: false, error: "JSON 解析失败: " + (e as Error).message };
    }
    if (!Array.isArray(parsed)) {
        return { ok: false, error: "根节点必须是数组" };
    }
    const seenIds = new Set<string>();
    for (let i = 0; i < parsed.length; i++) {
        const s = parsed[i];
        if (s == null || typeof s !== "object") {
            return { ok: false, error: `第 ${i + 1} 项不是对象` };
        }
        if (typeof s.id !== "string" || s.id.length === 0) {
            return { ok: false, error: `第 ${i + 1} 项缺少 id` };
        }
        if (seenIds.has(s.id)) {
            return { ok: false, error: `id 重复: "${s.id}"` };
        }
        seenIds.add(s.id);
        if (typeof s.title !== "string" || s.title.length === 0) {
            return { ok: false, error: `第 ${i + 1} 项缺少 title` };
        }
        if (typeof s.url !== "string" || !/^https?:\/\//i.test(s.url)) {
            return { ok: false, error: `第 ${i + 1} 项 url 必须是 http(s):// 开头` };
        }
        if (!Array.isArray(s.metrics) || s.metrics.length === 0) {
            return { ok: false, error: `第 ${i + 1} 项 metrics 必须是非空数组` };
        }
        for (let j = 0; j < s.metrics.length; j++) {
            const m = s.metrics[j];
            if (m == null || typeof m !== "object") {
                return { ok: false, error: `第 ${i + 1} 项 metrics[${j}] 不是对象` };
            }
            if (typeof m.id !== "string" || m.id.length === 0) {
                return { ok: false, error: `第 ${i + 1} 项 metrics[${j}] 缺少 id` };
            }
            if (typeof m.label !== "string" || m.label.length === 0) {
                return { ok: false, error: `第 ${i + 1} 项 metrics[${j}] 缺少 label` };
            }
            if (typeof m.selector !== "string" || m.selector.length === 0) {
                return { ok: false, error: `第 ${i + 1} 项 metrics[${j}] 缺少 selector` };
            }
        }
    }
    return { ok: true, sources: parsed as DataMonitorSource[] };
}

// miniMaxTemplate is what we drop into the editor the first time a user opens
// the widget with no config. cookie/x-group-id are intentionally left empty as
// placeholders so the user knows where to paste their own values.
export const miniMaxTemplate: DataMonitorSource[] = [
    {
        id: "minimax-tokens",
        title: "MiniMax Token 余额",
        url: "https://www.minimax.cn/backend/account/token_plan/remains_percent",
        method: "GET",
        headers: {
            "x-group-id": "",
            cookie: "",
            Referer: "https://platform.minimax.cn/",
        },
        intervalSec: 60,
        metrics: [
            {
                id: "5h",
                label: "5h 用量",
                selector: "model_remains.0.current_interval_used_percent",
                display: "percent",
                color: "#f97316",
            },
            {
                id: "week",
                label: "周用量",
                selector: "model_remains.0.current_weekly_used_percent",
                display: "percent",
                color: "#a855f7",
            },
            {
                id: "5h-remains",
                label: "5h 剩余",
                selector: "model_remains.0.remains_time",
                display: "duration_ms",
            },
            {
                id: "week-remains",
                label: "周剩余",
                selector: "model_remains.0.weekly_remains_time",
                display: "duration_ms",
            },
        ],
    },
];

export function emptySourcesJson(): string {
    return JSON.stringify(miniMaxTemplate, null, 4);
}
