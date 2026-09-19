// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { atom, type PrimitiveAtom } from "jotai";
import { globalStore } from "@/app/store/jotaiStore";
import { useAtomValue } from "jotai";
import { messages, type MessageKey } from "./messages";

export type Locale = "en" | "zh-CN";

const STORAGE_KEY = "waveterm:locale";
export const SUPPORTED_LOCALES: Locale[] = ["en", "zh-CN"];

function isSupportedLocale(value: string | null): value is Locale {
    return value != null && (SUPPORTED_LOCALES as string[]).includes(value);
}

const localeAtom = atom<Locale>("en") as PrimitiveAtom<Locale>;

let initialized = false;

export function initLocale(): Locale {
    let stored: string | null = null;
    try {
        stored = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
    } catch {
        // localStorage may be unavailable (e.g. test environments)
    }
    const locale: Locale = isSupportedLocale(stored) ? stored : "en";
    globalStore.set(localeAtom, locale);
    if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
    }
    initialized = true;
    return locale;
}

export function setLocale(locale: Locale): void {
    globalStore.set(localeAtom, locale);
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, locale);
    } catch {
        // ignore
    }
    if (typeof document !== "undefined") {
        document.documentElement.lang = locale;
    }
}

export function getCurrentLocale(): Locale {
    return globalStore.get(localeAtom);
}

export function t(key: MessageKey | string, vars?: Record<string, string | number>): string {
    if (!initialized) {
        // best-effort: ensure locale is loaded before first translation
        initLocale();
    }
    const locale = globalStore.get(localeAtom);
    const entry = (messages as Record<string, Record<Locale, string>>)[key];
    let template: string;
    if (entry == null) {
        // fallback: return the key itself so missing translations are obvious
        template = key;
    } else {
        template = entry[locale] ?? entry["en"] ?? key;
    }
    if (vars == null) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (match, name) => {
        const v = vars[name];
        return v == null ? match : String(v);
    });
}

export function useT(): (key: MessageKey | string, vars?: Record<string, string | number>) => string {
    useAtomValue(localeAtom);
    return t;
}

export function useLocale(): Locale {
    return useAtomValue(localeAtom);
}