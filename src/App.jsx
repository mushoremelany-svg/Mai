import { useState, useEffect, useRef, useContext, createContext } from "react";
import {
  Flame, Sparkles, Check, Camera, X, Palette, Trophy, Award, Share2, Trash2,
  Plus, Calendar as CalendarIcon, List, Play, Pause, RotateCcw, Repeat,
  ChevronLeft, ChevronRight, ChevronDown, Clock, Bell, BellOff, Pencil,
  Target, Flag, Image as ImageIcon, Download, BookOpen, Droplet, TrendingUp,
  TrendingDown, Smile, Wallet, PiggyBank, Receipt, RefreshCw, ListChecks,
  Settings, Search, Globe, DollarSign, Home,
} from "lucide-react";

// Live cross-tab sync via React state/context, independent of window.storage.
// Each tab pushes a lightweight summary of its own data here whenever it
// changes; Today reads directly from this instead of round-tripping through
// storage — this works even while the storage backend is having issues,
// since it's all in-memory during a session.
const LiveSyncContext = createContext(null);

// ============================================================================
// SUPABASE SETUP — fill these in after creating your free project at
// supabase.com (see the deployment guide for exact steps).
// Project Settings → API → Project URL, and the "anon / public" key.
// ============================================================================
const SUPABASE_URL = "https://qjrujqkqiyupyguwxzvw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFqcnVqcWtxaXl1cHlndXd4enZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMDA1ODMsImV4cCI6MjEwMTc3NjU4M30.ZdRPVBOfEqFsoy3u_TkDDWxGEXJZ0_zOVM6YtA-vSrU";

// Current session, held in memory. Set once on login/signup, cleared on logout.
// (Not persisted to localStorage inside this preview per Claude's artifact
// rules — but this pattern works fine as-is once deployed for real.)
let SESSION = { accessToken: null, userId: null };
const sessionListeners = new Set();
function setSession(next) {
  SESSION = next;
  sessionListeners.forEach((fn) => fn(SESSION));
}
function useSession() {
  const [session, setLocalSession] = useState(SESSION);
  useEffect(() => {
    sessionListeners.add(setLocalSession);
    return () => sessionListeners.delete(setLocalSession);
  }, []);
  return session;
}

// Drop-in replacements for window.storage.get/set, backed by a single
// generic key-value table in Supabase (see deployment guide for the SQL to
// create it). Same call signature and return shape as the old API, so every
// existing `window.storage.get/set` call site keeps working untouched —
// only the function name changes (see the replacements throughout the file).
async function supaGet(key) {
  if (!SESSION.accessToken) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/app_kv?user_id=eq.${SESSION.userId}&key=eq.${encodeURIComponent(key)}&select=value`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SESSION.accessToken}` } }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  if (!rows.length) return null;
  return { key, value: JSON.stringify(rows[0].value) };
}
async function supaSet(key, valueString) {
  if (!SESSION.accessToken) return null;
  await fetch(`${SUPABASE_URL}/rest/v1/app_kv`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SESSION.accessToken}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ user_id: SESSION.userId, key, value: JSON.parse(valueString) }),
  });
  return { key, value: valueString };
}

async function supabaseSignUp({ email, password, firstName, lastName, location, age }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email, password,
      data: { first_name: firstName, last_name: lastName, location, age },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.msg || data?.error_description || "Sign up failed");
  if (data.access_token) setSession({ accessToken: data.access_token, userId: data.user?.id });
  return data;
}
async function supabaseLogin({ email, password }) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.msg || data?.error_description || "Login failed");
  setSession({ accessToken: data.access_token, userId: data.user?.id });
  return data;
}
function supabaseLogout() {
  setSession({ accessToken: null, userId: null });
}


// ============================================================================
// SHARED APP-WIDE SETTINGS: theme, language, currency.
// Every tab below receives these as props (globalTheme / globalLang /
// currency) instead of managing its own — this file is the single source of
// truth, persisted once under "app-settings-v1".
// ============================================================================

// Used everywhere a date, month name, or currency needs to render in the
// selected language — replaces scattered "lang === 'de' ? ... : 'en-US'"
// ternaries (which silently fell back to English for every other language)
// and calls that used the browser's default locale instead of the app's.
const LOCALE_MAP = { en: "en-US", de: "de-DE", es: "es-ES", fr: "fr-FR", it: "it-IT", pt: "pt-PT", tr: "tr-TR", ar: "ar-SA" };
function localeFor(lang) { return LOCALE_MAP[lang] || "en-US"; }

const THEMES = {
  midnight: { name: "Midnight Gold", bg: "#0b0b0d", panel: "#151417", panelSoft: "#1c1b1f", accent: "#c9a961", accentSoft: "#e3cd94", text: "#f2ede2", muted: "#8b8a86", line: "#2a292e" },
  cream: { name: "Soft Cream", bg: "#faf7f0", panel: "#ffffff", panelSoft: "#f2ede1", accent: "#a67c52", accentSoft: "#c9a875", text: "#2b2621", muted: "#8a8178", line: "#e6ddcd" },
  ocean: { name: "Deep Ocean", bg: "#0a1420", panel: "#101f30", panelSoft: "#152840", accent: "#5fb4c9", accentSoft: "#9adce8", text: "#e8f2f5", muted: "#7c93a3", line: "#1c3348" },
  blush: { name: "Blush", bg: "#fdf5f5", panel: "#ffffff", panelSoft: "#fbe9e9", accent: "#c76b7a", accentSoft: "#e3a3ac", text: "#3a2b2d", muted: "#a08789", line: "#f0d9db" },
};

// APP_NAME is a placeholder — swap for the real name once it's decided.
// Used on Reflect's and Finance's Wrapped closing cards / share images.
const APP_NAME = "Mai";

// The 9 currencies covering most of what people will actually need.
const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "INR", "BRL"];

const SETTINGS_STRINGS = {
  en: { settings: "Settings", theme: "Look", themeHint: "Applies across the whole app.", language: "Language", languageHint: "One setting, every tab.", currency: "Currency", currencyHint: "Used in the Finance tab.", changeLang: "Change", noMatches: "No matches", enInterfaceOnly: "This tab isn't translated into this language yet — showing English.", done: "Done" },
  de: { settings: "Einstellungen", theme: "Aussehen", themeHint: "Gilt für die ganze App.", language: "Sprache", languageHint: "Eine Einstellung, alle Tabs.", currency: "Währung", currencyHint: "Wird im Finanzen-Tab verwendet.", changeLang: "Ändern", noMatches: "Keine Treffer", enInterfaceOnly: "Dieser Tab ist noch nicht in diese Sprache übersetzt — zeigt Englisch.", done: "Fertig" },
  es: { settings: "Ajustes", theme: "Estilo", themeHint: "Se aplica a toda la app.", language: "Idioma", languageHint: "Un ajuste, todas las pestañas.", currency: "Moneda", currencyHint: "Se usa en la pestaña Finanzas.", changeLang: "Cambiar", noMatches: "Sin resultados", enInterfaceOnly: "Esta pestaña aún no está traducida a este idioma — se muestra en inglés.", done: "Listo" },
  fr: { settings: "Paramètres", theme: "Apparence", themeHint: "S'applique à toute l'app.", language: "Langue", languageHint: "Un seul réglage, tous les onglets.", currency: "Devise", currencyHint: "Utilisée dans l'onglet Finances.", changeLang: "Changer", noMatches: "Aucun résultat", enInterfaceOnly: "Cet onglet n'est pas encore traduit dans cette langue — affiché en anglais.", done: "Terminé" },
  it: { settings: "Impostazioni", theme: "Aspetto", themeHint: "Si applica a tutta l'app.", language: "Lingua", languageHint: "Un'impostazione, tutte le schede.", currency: "Valuta", currencyHint: "Usata nella scheda Finanze.", changeLang: "Cambia", noMatches: "Nessun risultato", enInterfaceOnly: "Questa scheda non è ancora tradotta in questa lingua — mostrata in inglese.", done: "Fatto" },
  pt: { settings: "Configurações", theme: "Aparência", themeHint: "Aplica-se a todo o app.", language: "Idioma", languageHint: "Uma configuração, todas as abas.", currency: "Moeda", currencyHint: "Usada na aba Finanças.", changeLang: "Alterar", noMatches: "Nenhum resultado", enInterfaceOnly: "Esta aba ainda não foi traduzida para este idioma — mostrando em inglês.", done: "Concluído" },
  tr: { settings: "Ayarlar", theme: "Görünüm", themeHint: "Tüm uygulamaya uygulanır.", language: "Dil", languageHint: "Tek ayar, tüm sekmeler.", currency: "Para birimi", currencyHint: "Finans sekmesinde kullanılır.", changeLang: "Değiştir", noMatches: "Sonuç yok", enInterfaceOnly: "Bu sekme henüz bu dile çevrilmedi — İngilizce gösteriliyor.", done: "Bitti" },
  ar: { settings: "الإعدادات", theme: "المظهر", themeHint: "ينطبق على التطبيق بأكمله.", language: "اللغة", languageHint: "إعداد واحد لكل التبويبات.", currency: "العملة", currencyHint: "تُستخدم في تبويب المالية.", changeLang: "تغيير", noMatches: "لا نتائج", enInterfaceOnly: "لم تتم ترجمة هذا التبويب إلى هذه اللغة بعد — يظهر بالإنجليزية.", done: "تم" },
};

// ---------------------------------------------------------------------------
// Deduped helpers shared across tabs (previously copy-pasted into each file)
// ---------------------------------------------------------------------------
let sharedAudioCtx = null;
function getAudioCtx() {
  try { if (!sharedAudioCtx) sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)(); return sharedAudioCtx; }
  catch (e) { return null; }
}
function playTick(volume = 0.12) {
  const ctx = getAudioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = "square"; osc.frequency.value = 900;
  const start = ctx.currentTime;
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
  osc.start(start); osc.stop(start + 0.05);
}
function playChime() {
  const ctx = getAudioCtx(); if (!ctx) return;
  [523.25, 659.25, 783.99].forEach((freq, i) => {
    const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = freq;
    const start = ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.15, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc.start(start); osc.stop(start + 0.4);
  });
}
function vibrate(pattern) { if (navigator.vibrate) navigator.vibrate(pattern); }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function dateKeyFor(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- THEME SYSTEM ----------

// ---------- LANGUAGES ----------
// UI chrome is translated for all of these. Quest text itself is written in
// English + German for now; other languages fall back to English quest text
// until we translate the quest pool (flagged clearly in the UI as "EN").
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "tr", label: "Türkçe" },
  { code: "ar", label: "العربية" },
];
const QUEST_TEXT_LANGS = ["en", "de", "es", "fr", "it", "pt", "tr", "ar"]; // all 8 languages now have full quest translations

const QUEST_STRINGS = {
  en: { tagline: "One small quest a day.", spin: "Spin the wheel", spinning: "Spinning…", todaysQuest: "Today's quest", howFeeling: "How are you feeling right now?", feelingPlaceholder: "e.g. zero energy, stressed, bored…", clearFilter: "Clear filter", complete: "Mark complete", reflectionPlaceholder: "One sentence about it (optional)…", addPhoto: "Add photo", removePhoto: "Remove", save: "Save", streak: "Day streak", level: "Level", xp: "XP", scrapbook: "Your scrapbook", noEntries: "Nothing logged yet — spin the wheel to start.", theme: "Look", language: "Language", difficulty: "Difficulty", any: "Any", category: "Category", categories: { exploration: "Exploration", social: "Social", health: "Health", creativity: "Creativity" }, badges: "Badges", badgeLocked: "Not yet unlocked", shareStreak: "Share streak card", download: "Download image", allCats: "All categories" },
  de: { tagline: "Eine kleine Aufgabe pro Tag.", spin: "Rad drehen", spinning: "Dreht sich…", todaysQuest: "Heutige Aufgabe", howFeeling: "Wie fühlst du dich gerade?", feelingPlaceholder: "z.B. keine Energie, gestresst, gelangweilt…", clearFilter: "Filter entfernen", complete: "Als erledigt markieren", reflectionPlaceholder: "Ein Satz dazu (optional)…", addPhoto: "Foto hinzufügen", removePhoto: "Entfernen", save: "Speichern", streak: "Tage-Serie", level: "Level", xp: "XP", scrapbook: "Dein Erinnerungsbuch", noEntries: "Noch nichts eingetragen — dreh das Rad, um zu starten.", theme: "Aussehen", language: "Sprache", difficulty: "Schwierigkeit", any: "Alle", category: "Kategorie", categories: { exploration: "Entdeckung", social: "Sozial", health: "Gesundheit", creativity: "Kreativität" }, badges: "Abzeichen", badgeLocked: "Noch nicht freigeschaltet", shareStreak: "Serie teilen", download: "Bild herunterladen", allCats: "Alle Kategorien" },
  es: { tagline: "Una pequeña misión al día.", spin: "Girar la rueda", spinning: "Girando…", todaysQuest: "Misión de hoy", howFeeling: "¿Cómo te sientes ahora mismo?", feelingPlaceholder: "p. ej. sin energía, estresado, aburrido…", clearFilter: "Quitar filtro", complete: "Marcar como hecho", reflectionPlaceholder: "Una frase al respecto (opcional)…", addPhoto: "Añadir foto", removePhoto: "Quitar", save: "Guardar", streak: "Racha", level: "Nivel", xp: "XP", scrapbook: "Tu álbum", noEntries: "Nada registrado todavía — gira la rueda.", theme: "Estilo", language: "Idioma", difficulty: "Dificultad", any: "Cualquiera", category: "Categoría", categories: { exploration: "Exploración", social: "Social", health: "Salud", creativity: "Creatividad" }, badges: "Insignias", badgeLocked: "Aún no desbloqueada", shareStreak: "Compartir racha", download: "Descargar imagen", allCats: "Todas las categorías" },
  fr: { tagline: "Une petite quête par jour.", spin: "Tourner la roue", spinning: "Ça tourne…", todaysQuest: "Quête du jour", howFeeling: "Comment te sens-tu là, maintenant ?", feelingPlaceholder: "ex. sans énergie, stressé, ennuyé…", clearFilter: "Retirer le filtre", complete: "Marquer comme fait", reflectionPlaceholder: "Une phrase à ce sujet (facultatif)…", addPhoto: "Ajouter une photo", removePhoto: "Retirer", save: "Enregistrer", streak: "Série", level: "Niveau", xp: "XP", scrapbook: "Ton album", noEntries: "Rien pour l'instant — tourne la roue.", theme: "Apparence", language: "Langue", difficulty: "Difficulté", any: "Toutes", category: "Catégorie", categories: { exploration: "Exploration", social: "Social", health: "Santé", creativity: "Créativité" }, badges: "Badges", badgeLocked: "Pas encore débloqué", shareStreak: "Partager la série", download: "Télécharger l'image", allCats: "Toutes les catégories" },
  it: { tagline: "Una piccola missione al giorno.", spin: "Gira la ruota", spinning: "Girando…", todaysQuest: "Missione di oggi", howFeeling: "Come ti senti in questo momento?", feelingPlaceholder: "es. zero energia, stressato, annoiato…", clearFilter: "Rimuovi filtro", complete: "Segna come completato", reflectionPlaceholder: "Una frase a riguardo (facoltativo)…", addPhoto: "Aggiungi foto", removePhoto: "Rimuovi", save: "Salva", streak: "Serie", level: "Livello", xp: "XP", scrapbook: "Il tuo album", noEntries: "Ancora nulla — gira la ruota.", theme: "Aspetto", language: "Lingua", difficulty: "Difficoltà", any: "Qualsiasi", category: "Categoria", categories: { exploration: "Esplorazione", social: "Sociale", health: "Salute", creativity: "Creatività" }, badges: "Distintivi", badgeLocked: "Non ancora sbloccato", shareStreak: "Condividi la serie", download: "Scarica immagine", allCats: "Tutte le categorie" },
  pt: { tagline: "Uma pequena missão por dia.", spin: "Girar a roda", spinning: "Girando…", todaysQuest: "Missão de hoje", howFeeling: "Como você está se sentindo agora?", feelingPlaceholder: "ex. sem energia, estressado, entediado…", clearFilter: "Remover filtro", complete: "Marcar como feito", reflectionPlaceholder: "Uma frase sobre isso (opcional)…", addPhoto: "Adicionar foto", removePhoto: "Remover", save: "Salvar", streak: "Sequência", level: "Nível", xp: "XP", scrapbook: "Seu álbum", noEntries: "Nada ainda — gire a roda.", theme: "Aparência", language: "Idioma", difficulty: "Dificuldade", any: "Qualquer", category: "Categoria", categories: { exploration: "Exploração", social: "Social", health: "Saúde", creativity: "Criatividade" }, badges: "Emblemas", badgeLocked: "Ainda não desbloqueado", shareStreak: "Compartilhar sequência", download: "Baixar imagem", allCats: "Todas as categorias" },
  tr: { tagline: "Günde bir küçük görev.", spin: "Çarkı çevir", spinning: "Dönüyor…", todaysQuest: "Bugünün görevi", howFeeling: "Şu an nasıl hissediyorsun?", feelingPlaceholder: "örn. enerjisiz, stresli, sıkılmış…", clearFilter: "Filtreyi kaldır", complete: "Tamamlandı olarak işaretle", reflectionPlaceholder: "Bununla ilgili bir cümle (isteğe bağlı)…", addPhoto: "Fotoğraf ekle", removePhoto: "Kaldır", save: "Kaydet", streak: "Seri", level: "Seviye", xp: "XP", scrapbook: "Anı defterin", noEntries: "Henüz kayıt yok — çarkı çevir.", theme: "Görünüm", language: "Dil", difficulty: "Zorluk", any: "Herhangi", category: "Kategori", categories: { exploration: "Keşif", social: "Sosyal", health: "Sağlık", creativity: "Yaratıcılık" }, badges: "Rozetler", badgeLocked: "Henüz açılmadı", shareStreak: "Seriyi paylaş", download: "Görseli indir", allCats: "Tüm kategoriler" },
  ar: { tagline: "مهمة صغيرة كل يوم.", spin: "أدر العجلة", spinning: "تدور…", todaysQuest: "مهمة اليوم", howFeeling: "كيف تشعر الآن؟", feelingPlaceholder: "مثال: بلا طاقة، متوتر، ملل…", clearFilter: "إزالة الفلتر", complete: "وضع علامة مكتمل", reflectionPlaceholder: "جملة واحدة عن ذلك (اختياري)…", addPhoto: "إضافة صورة", removePhoto: "إزالة", save: "حفظ", streak: "تتابع الأيام", level: "المستوى", xp: "نقاط الخبرة", scrapbook: "دفتر ذكرياتك", noEntries: "لا شيء بعد — أدر العجلة.", theme: "المظهر", language: "اللغة", difficulty: "الصعوبة", any: "أي", category: "الفئة", categories: { exploration: "استكشاف", social: "اجتماعي", health: "صحة", creativity: "إبداع" }, badges: "الشارات", badgeLocked: "لم يُفتح بعد", shareStreak: "مشاركة التتابع", download: "تحميل الصورة", allCats: "كل الفئات" },
};
// Languages with a real hand-translated interface — every entry in LANGUAGES now.

// ---------- QUEST POOL (difficulty 1-5) ----------
const QUESTS = [
  { id: 1, category: "exploration", difficulty: 1, mood: ["low-energy", "bored"], en: "Notice one piece of nature you've never really looked at before.", de: "Achte auf ein Stück Natur, das du noch nie wirklich beachtet hast.", es: "Fíjate en un elemento de la naturaleza que nunca hayas mirado de verdad.", fr: "Remarque un élément de la nature que tu n'as jamais vraiment regardé.", it: "Nota un elemento della natura che non hai mai davvero osservato.", pt: "Repare em um elemento da natureza que você nunca observou de verdade.", tr: "Daha önce hiç dikkatlice bakmadığın bir doğa parçasını fark et.", ar: "لاحظ عنصرًا من الطبيعة لم تنتبه إليه حقًا من قبل." },
  { id: 2, category: "exploration", difficulty: 2, mood: ["bored"], en: "Walk a completely new route home, even if it's longer.", de: "Geh einen völlig neuen Weg nach Hause, auch wenn er länger ist.", es: "Camina a casa por una ruta completamente nueva, aunque sea más larga.", fr: "Rentre chez toi par un chemin totalement nouveau, même s'il est plus long.", it: "Torna a casa da un percorso completamente nuovo, anche se più lungo.", pt: "Volte para casa por um caminho totalmente novo, mesmo que seja mais longo.", tr: "Eve tamamen farklı bir yoldan yürü, daha uzun olsa bile.", ar: "اذهب إلى المنزل عبر طريق جديد تمامًا، حتى لو كان أطول." },
  { id: 3, category: "exploration", difficulty: 3, mood: ["adventurous"], en: "Go to a coffee shop you've never been to and order something blind.", de: "Geh in ein Café, in dem du noch nie warst, und bestell blind etwas.", es: "Ve a una cafetería en la que nunca hayas estado y pide algo a ciegas.", fr: "Va dans un café où tu n'es jamais allé(e) et commande quelque chose au hasard.", it: "Vai in un bar dove non sei mai stato e ordina qualcosa a caso.", pt: "Vá a uma cafeteria onde nunca esteve e peça algo às cegas.", tr: "Hiç gitmediğin bir kafeye git ve rastgele bir şey sipariş et.", ar: "اذهب إلى مقهى لم تزره من قبل واطلب شيئًا عشوائيًا." },
  { id: 4, category: "social", difficulty: 2, mood: ["lonely"], en: "Send a voice note to someone you haven't spoken to in a while.", de: "Schick jemandem eine Sprachnachricht, mit dem du lange nicht gesprochen hast.", es: "Envía una nota de voz a alguien con quien no hables desde hace tiempo.", fr: "Envoie un message vocal à quelqu'un à qui tu n'as pas parlé depuis longtemps.", it: "Manda un messaggio vocale a qualcuno con cui non parli da un po'.", pt: "Envie um áudio para alguém com quem você não fala há um tempo.", tr: "Uzun zamandır konuşmadığın birine sesli mesaj gönder.", ar: "أرسل رسالة صوتية لشخص لم تتحدث معه منذ فترة." },
  { id: 5, category: "social", difficulty: 1, mood: ["low-energy"], en: "Compliment a stranger — a cashier, a classmate, anyone.", de: "Mach einem Fremden ein Kompliment — Kassierer, Kommilitone, egal.", es: "Halaga a un desconocido — un cajero, un compañero de clase, cualquiera.", fr: "Fais un compliment à un inconnu — un caissier, un camarade de classe, n'importe qui.", it: "Fai un complimento a uno sconosciuto — un cassiere, un compagno di classe, chiunque.", pt: "Elogie um estranho — um caixa, um colega de classe, qualquer um.", tr: "Bir yabancıya iltifat et — kasiyer, sınıf arkadaşı, kim olursa olsun.", ar: "امدح شخصًا غريبًا — كاشير، زميل دراسة، أي شخص." },
  { id: 6, category: "health", difficulty: 1, mood: ["stressed", "low-energy"], en: "Sit in a green space with your phone off for 15 minutes.", de: "Setz dich 15 Minuten in eine Grünfläche, Handy aus.", es: "Siéntate en un espacio verde con el móvil apagado durante 15 minutos.", fr: "Assieds-toi dans un espace vert, téléphone éteint, pendant 15 minutes.", it: "Siediti in uno spazio verde con il telefono spento per 15 minuti.", pt: "Sente-se em um espaço verde com o celular desligado por 15 minutos.", tr: "Telefonunu kapatıp 15 dakika yeşil bir alanda otur.", ar: "اجلس في مساحة خضراء مع إغلاق هاتفك لمدة 15 دقيقة." },
  { id: 7, category: "health", difficulty: 2, mood: ["stressed"], en: "Do a 10-minute stretch or walk, no music, just breathing.", de: "Mach 10 Minuten Dehnen oder Spazieren, keine Musik, nur atmen.", es: "Haz 10 minutos de estiramientos o camina, sin música, solo respirando.", fr: "Fais 10 minutes d'étirements ou de marche, sans musique, juste en respirant.", it: "Fai 10 minuti di stretching o cammina, senza musica, solo respirando.", pt: "Faça 10 minutos de alongamento ou caminhada, sem música, só respirando.", tr: "10 dakika müziksiz, sadece nefes alarak esne ya da yürü.", ar: "مارس تمدداً أو امشِ لمدة 10 دقائق دون موسيقى، فقط تنفس." },
  { id: 8, category: "creativity", difficulty: 1, mood: ["bored", "low-energy"], en: "Doodle whatever's in your head for 5 minutes, no judging it.", de: "Kritzle 5 Minuten, was dir in den Kopf kommt, ohne es zu bewerten.", es: "Garabatea lo que se te pase por la cabeza durante 5 minutos, sin juzgarlo.", fr: "Griffonne tout ce qui te passe par la tête pendant 5 minutes, sans te juger.", it: "Scarabocchia quello che ti passa per la testa per 5 minuti, senza giudicarlo.", pt: "Rabisque o que vier à mente por 5 minutos, sem julgar.", tr: "Aklına geleni yargılamadan 5 dakika karala.", ar: "ارسم بشكل عشوائي ما يخطر ببالك لمدة 5 دقائق، دون حكم." },
  { id: 9, category: "creativity", difficulty: 3, mood: ["adventurous"], en: "Rearrange one small corner of your room differently.", de: "Räum eine kleine Ecke deines Zimmers anders ein.", es: "Reorganiza de otra forma un pequeño rincón de tu habitación.", fr: "Réorganise différemment un petit coin de ta chambre.", it: "Riorganizza in modo diverso un piccolo angolo della tua stanza.", pt: "Reorganize de forma diferente um pequeno canto do seu quarto.", tr: "Odandaki küçük bir köşeyi farklı şekilde düzenle.", ar: "أعد ترتيب زاوية صغيرة من غرفتك بشكل مختلف." },
  { id: 10, category: "health", difficulty: 3, mood: ["stressed"], en: "Go to a café alone, order something, and read a physical book for 20 minutes — no phone.", de: "Geh allein ins Café, bestell etwas und lies 20 Minuten ein echtes Buch — kein Handy.", es: "Ve solo a una cafetería, pide algo y lee un libro físico durante 20 minutos — sin móvil.", fr: "Va seul(e) dans un café, commande quelque chose et lis un livre papier pendant 20 minutes — sans téléphone.", it: "Vai da solo in un bar, ordina qualcosa e leggi un libro cartaceo per 20 minuti — niente telefono.", pt: "Vá sozinho a um café, peça algo e leia um livro físico por 20 minutos — sem celular.", tr: "Tek başına bir kafeye git, bir şey sipariş et ve telefon olmadan 20 dakika gerçek bir kitap oku.", ar: "اذهب بمفردك إلى مقهى، اطلب شيئًا، واقرأ كتابًا ورقيًا لمدة 20 دقيقة — دون هاتف." },
  { id: 11, category: "social", difficulty: 4, mood: ["adventurous", "lonely"], en: "Invite someone to do something this week — even just a walk.", de: "Lad diese Woche jemanden zu etwas ein — und sei es nur ein Spaziergang.", es: "Invita a alguien a hacer algo esta semana — aunque sea solo caminar.", fr: "Invite quelqu'un à faire quelque chose cette semaine — même juste une balade.", it: "Invita qualcuno a fare qualcosa questa settimana — anche solo una passeggiata.", pt: "Convide alguém para fazer algo esta semana — nem que seja só uma caminhada.", tr: "Bu hafta birini bir şey yapmaya davet et — sadece yürüyüş bile olsa.", ar: "ادعُ شخصًا لفعل شيء هذا الأسبوع — ولو مجرد نزهة." },
  { id: 12, category: "exploration", difficulty: 5, mood: ["adventurous"], en: "Take a day trip to a nearby town you've never visited.", de: "Mach einen Tagesausflug in eine nahe Stadt, die du noch nie besucht hast.", es: "Haz una excursión de un día a un pueblo cercano que nunca hayas visitado.", fr: "Fais une excursion d'une journée dans une ville voisine que tu n'as jamais visitée.", it: "Fai una gita di un giorno in una città vicina che non hai mai visitato.", pt: "Faça um bate-volta para uma cidade próxima que você nunca visitou.", tr: "Daha önce hiç gitmediğin yakın bir kasabaya günübirlik gez.", ar: "قم برحلة ليوم واحد إلى بلدة قريبة لم تزرها من قبل." },
  { id: 13, category: "creativity", difficulty: 4, mood: ["bored"], en: "Make something with your hands today — no screens involved at all.", de: "Bastle heute etwas mit deinen Händen — komplett ohne Bildschirm.", es: "Haz algo con tus manos hoy — sin pantallas de por medio.", fr: "Fabrique quelque chose de tes mains aujourd'hui — sans aucun écran.", it: "Crea qualcosa con le tue mani oggi — senza schermi coinvolti.", pt: "Faça algo com as mãos hoje — sem nenhuma tela envolvida.", tr: "Bugün elinle bir şey yap — hiç ekran kullanmadan.", ar: "اصنع شيئًا بيديك اليوم — دون أي شاشات." },
  { id: 14, category: "health", difficulty: 5, mood: ["stressed", "adventurous"], en: "Try a completely new form of movement you've never done — a class, a sport, anything.", de: "Probier eine völlig neue Bewegungsform aus, die du noch nie gemacht hast.", es: "Prueba una forma de movimiento completamente nueva que nunca hayas hecho — una clase, un deporte, lo que sea.", fr: "Essaie une forme de mouvement totalement nouvelle — un cours, un sport, n'importe quoi.", it: "Prova una forma di movimento completamente nuova — un corso, uno sport, qualsiasi cosa.", pt: "Experimente uma forma de movimento totalmente nova — uma aula, um esporte, qualquer coisa.", tr: "Hiç yapmadığın tamamen yeni bir hareket biçimi dene — bir ders, bir spor, ne olursa olsun.", ar: "جرّب شكلاً جديدًا تمامًا من الحركة لم تجربه من قبل — حصة، رياضة، أي شيء." },

  // ---- Exploration ----
  { id: 15, category: "exploration", difficulty: 1, mood: ["bored", "low-energy"], en: "Find and look closely at the oldest building on your street.", de: "Finde das älteste Gebäude in deiner Straße und schau es dir genau an.", es: "Encuentra y observa de cerca el edificio más antiguo de tu calle.", fr: "Trouve et observe de près le bâtiment le plus ancien de ta rue.", it: "Trova e osserva da vicino l'edificio più antico della tua strada.", pt: "Encontre e observe de perto o prédio mais antigo da sua rua.", tr: "Sokağındaki en eski binayı bul ve yakından incele.", ar: "ابحث عن أقدم مبنى في شارعك وتأمّله عن قرب." },
  { id: 16, category: "exploration", difficulty: 1, mood: ["bored"], en: "Look up one surprising fact about your own neighborhood.", de: "Suche eine überraschende Tatsache über deine eigene Nachbarschaft.", es: "Busca un dato sorprendente sobre tu propio barrio.", fr: "Cherche un fait surprenant sur ton propre quartier.", it: "Cerca un fatto sorprendente sul tuo quartiere.", pt: "Pesquise um fato surpreendente sobre o seu bairro.", tr: "Kendi mahallen hakkında şaşırtıcı bir bilgi araştır.", ar: "ابحث عن حقيقة مفاجئة عن حيّك." },
  { id: 17, category: "exploration", difficulty: 2, mood: ["bored", "adventurous"], en: "Explore a park or green space you've never set foot in, even a small one.", de: "Erkunde einen Park oder eine Grünfläche, die du noch nie betreten hast, auch wenn er klein ist.", es: "Explora un parque o espacio verde en el que nunca hayas estado, aunque sea pequeño.", fr: "Explore un parc ou un espace vert où tu n'as jamais mis les pieds, même petit.", it: "Esplora un parco o uno spazio verde in cui non sei mai stato, anche piccolo.", pt: "Explore um parque ou espaço verde onde nunca esteve, mesmo que pequeno.", tr: "Daha önce hiç gitmediğin bir parkı ya da yeşil alanı keşfet, küçük olsa bile.", ar: "استكشف حديقة أو مساحة خضراء لم تطأها قدمك من قبل، حتى لو كانت صغيرة." },
  { id: 18, category: "exploration", difficulty: 2, mood: ["bored"], en: "Find a piece of local public art or a mural and go see it in person.", de: "Finde ein öffentliches Kunstwerk oder Wandbild in deiner Nähe und schau es dir persönlich an.", es: "Busca una obra de arte público o un mural local y ve a verlo en persona.", fr: "Trouve une œuvre d'art public ou une fresque locale et va la voir en personne.", it: "Trova un'opera d'arte pubblica o un murale locale e vai a vederlo di persona.", pt: "Encontre uma obra de arte pública ou um mural local e vá vê-lo pessoalmente.", tr: "Yerel bir kamu sanatı eseri ya da duvar resmi bul ve gidip yerinde gör.", ar: "ابحث عن عمل فني عام أو جدارية محلية واذهب لرؤيتها شخصيًا." },
  { id: 19, category: "exploration", difficulty: 3, mood: ["adventurous"], en: "Try a form of transport you rarely use to get somewhere today — bike, bus, ferry, on foot.", de: "Nutze heute ein Verkehrsmittel, das du selten benutzt, um irgendwohin zu kommen — Fahrrad, Bus, Fähre, zu Fuß.", es: "Prueba hoy un medio de transporte que rara vez uses — bici, bus, ferry, a pie.", fr: "Essaie aujourd'hui un moyen de transport que tu utilises rarement — vélo, bus, ferry, à pied.", it: "Prova oggi un mezzo di trasporto che usi raramente — bici, bus, traghetto, a piedi.", pt: "Experimente hoje um meio de transporte que você raramente usa — bicicleta, ônibus, balsa, a pé.", tr: "Bugün nadiren kullandığın bir ulaşım şekli dene — bisiklet, otobüs, feribot, yürüyerek.", ar: "جرّب اليوم وسيلة نقل نادرًا ما تستخدمها — دراجة، حافلة، عبّارة، أو سيرًا على الأقدام." },
  { id: 20, category: "exploration", difficulty: 3, mood: ["adventurous", "bored"], en: "Visit a museum, gallery, or exhibit you've been meaning to check out.", de: "Besuche ein Museum, eine Galerie oder eine Ausstellung, die du schon lange sehen wolltest.", es: "Visita un museo, galería o exposición que llevas tiempo queriendo ver.", fr: "Visite un musée, une galerie ou une exposition que tu voulais voir depuis longtemps.", it: "Visita un museo, una galleria o una mostra che volevi vedere da tempo.", pt: "Visite um museu, galeria ou exposição que você queria conhecer há um tempo.", tr: "Uzun zamandır görmek istediğin bir müze, galeri ya da sergiyi ziyaret et.", ar: "قم بزيارة متحف أو معرض كنت تنوي زيارته منذ فترة." },
  { id: 21, category: "exploration", difficulty: 4, mood: ["adventurous"], en: "Spend a full afternoon exploring a part of your city you rarely go to.", de: "Verbringe einen ganzen Nachmittag damit, einen Teil deiner Stadt zu erkunden, in dem du selten bist.", es: "Pasa toda una tarde explorando una zona de tu ciudad a la que rara vez vas.", fr: "Passe tout un après-midi à explorer une partie de ta ville où tu vas rarement.", it: "Passa un intero pomeriggio a esplorare una zona della tua città in cui vai raramente.", pt: "Passe uma tarde inteira explorando uma parte da sua cidade que você raramente visita.", tr: "Bütün bir öğleden sonrayı şehrinin nadiren gittiğin bir bölgesini keşfederek geçir.", ar: "اقضِ بعد ظهر كاملاً في استكشاف جزء من مدينتك نادرًا ما تزوره." },
  { id: 22, category: "exploration", difficulty: 4, mood: ["adventurous"], en: "Get intentionally a little lost on foot in a new area, then find your way back without a map app.", de: "Verlauf dich absichtlich ein wenig zu Fuß in einer neuen Gegend und finde ohne Karten-App zurück.", es: "Piérdete un poco a propósito a pie en una zona nueva y encuentra el camino de vuelta sin usar el mapa.", fr: "Perds-toi volontairement un peu à pied dans un nouveau quartier, puis retrouve ton chemin sans appli de carte.", it: "Perditi un po' intenzionalmente a piedi in una zona nuova, poi ritrova la strada senza app di mappe.", pt: "Perca-se de propósito a pé em uma área nova e encontre o caminho de volta sem usar um app de mapas.", tr: "Yeni bir bölgede kasıtlı olarak biraz kaybol, sonra harita uygulaması kullanmadan yolunu bul.", ar: "تُه قليلاً عن قصد سيرًا على الأقدام في منطقة جديدة، ثم اعثر على طريق العودة دون تطبيق خرائط." },
  { id: 23, category: "exploration", difficulty: 5, mood: ["adventurous"], en: "Plan and take a solo day trip somewhere at least an hour away you've never been.", de: "Plane und mache einen Tagesausflug allein an einen Ort, der mindestens eine Stunde entfernt ist und den du noch nie besucht hast.", es: "Planea y haz una excursión de un día en solitario a un lugar a al menos una hora de distancia que nunca hayas visitado.", fr: "Planifie et fais un voyage d'une journée en solo dans un endroit à au moins une heure que tu n'as jamais visité.", it: "Pianifica e fai una gita di un giorno da solo in un posto ad almeno un'ora di distanza che non hai mai visitato.", pt: "Planeje e faça uma viagem de um dia sozinho a um lugar a pelo menos uma hora de distância que nunca visitou.", tr: "En az bir saat uzaklıkta, hiç gitmediğin bir yere tek başına günübirlik bir gezi planla ve yap.", ar: "خطط وقم برحلة نهارية منفردة إلى مكان يبعد ساعة على الأقل لم تزره من قبل." },
  { id: 24, category: "exploration", difficulty: 5, mood: ["adventurous"], en: "Spend a whole day exploring somewhere new with no plan or itinerary at all.", de: "Verbringe einen ganzen Tag damit, etwas Neues zu erkunden — ganz ohne Plan oder Route.", es: "Pasa un día entero explorando un lugar nuevo sin ningún plan ni itinerario.", fr: "Passe une journée entière à explorer un nouvel endroit sans aucun plan ni itinéraire.", it: "Passa un'intera giornata a esplorare un posto nuovo senza alcun piano o itinerario.", pt: "Passe um dia inteiro explorando um lugar novo sem nenhum plano ou roteiro.", tr: "Hiçbir plan ya da rota olmadan yeni bir yeri keşfederek bütün bir gün geçir.", ar: "اقضِ يومًا كاملاً في استكشاف مكان جديد دون أي خطة أو مسار محدد." },

  // ---- Social ----
  { id: 25, category: "social", difficulty: 1, mood: ["lonely", "low-energy"], en: "Send a genuine compliment to a friend, no occasion needed.", de: "Schick einem Freund ein ehrliches Kompliment, ganz ohne Anlass.", es: "Envía un cumplido sincero a un amigo, sin necesidad de motivo.", fr: "Envoie un compliment sincère à un(e) ami(e), sans occasion particulière.", it: "Manda un complimento sincero a un amico, senza bisogno di un'occasione.", pt: "Envie um elogio sincero a um amigo, sem precisar de motivo.", tr: "Bir arkadaşına, hiçbir sebep olmadan içten bir iltifat gönder.", ar: "أرسل مجاملة صادقة لصديق، دون الحاجة لمناسبة." },
  { id: 26, category: "social", difficulty: 1, mood: ["lonely"], en: "Ask a coworker or classmate a real question about their life.", de: "Stell einem Kollegen oder Klassenkameraden eine echte Frage zu seinem Leben.", es: "Hazle a un compañero de trabajo o clase una pregunta real sobre su vida.", fr: "Pose une vraie question à un(e) collègue ou camarade sur sa vie.", it: "Fai a un collega o compagno di classe una domanda vera sulla sua vita.", pt: "Faça uma pergunta real sobre a vida de um colega de trabalho ou classe.", tr: "Bir iş arkadaşına ya da sınıf arkadaşına hayatı hakkında gerçek bir soru sor.", ar: "اطرح على زميل عمل أو دراسة سؤالاً حقيقيًا عن حياته." },
  { id: 27, category: "social", difficulty: 2, mood: ["lonely"], en: "Call, don't text, someone you usually only text.", de: "Ruf jemanden an, dem du sonst nur schreibst, statt zu texten.", es: "Llama, en vez de escribir, a alguien a quien normalmente solo le mandas mensajes.", fr: "Appelle, au lieu d'écrire, quelqu'un à qui tu envoies d'habitude seulement des messages.", it: "Chiama, invece di scrivere, qualcuno a cui di solito mandi solo messaggi.", pt: "Ligue, em vez de mandar mensagem, para alguém com quem você normalmente só troca texto.", tr: "Genelde sadece mesajlaştığın birini yazmak yerine ara.", ar: "اتصل بدلاً من إرسال رسالة نصية لشخص عادة ما تراسله فقط." },
  { id: 28, category: "social", difficulty: 2, mood: ["lonely", "adventurous"], en: "Introduce yourself to a neighbor you've never actually spoken to.", de: "Stell dich einem Nachbarn vor, mit dem du noch nie wirklich gesprochen hast.", es: "Preséntate a un vecino con quien nunca hayas hablado realmente.", fr: "Présente-toi à un voisin à qui tu n'as jamais vraiment parlé.", it: "Presentati a un vicino con cui non hai mai davvero parlato.", pt: "Apresente-se a um vizinho com quem você nunca conversou de verdade.", tr: "Gerçekten hiç konuşmadığın bir komşuna kendini tanıt.", ar: "عرّف عن نفسك لجار لم تتحدث معه فعليًا من قبل." },
  { id: 29, category: "social", difficulty: 3, mood: ["lonely"], en: "Reach out to an old friend you've lost touch with.", de: "Melde dich bei einem alten Freund, zu dem du den Kontakt verloren hast.", es: "Ponte en contacto con un viejo amigo con el que hayas perdido contacto.", fr: "Recontacte un(e) ancien(ne) ami(e) que tu as perdu(e) de vue.", it: "Contatta un vecchio amico con cui hai perso i contatti.", pt: "Entre em contato com um amigo antigo com quem perdeu o contato.", tr: "İletişimini kaybettiğin eski bir arkadaşına ulaş.", ar: "تواصل مع صديق قديم فقدت التواصل معه." },
  { id: 30, category: "social", difficulty: 3, mood: ["lonely"], en: "Plan a small hangout with a friend for later this week.", de: "Plane für später diese Woche ein kleines Treffen mit einem Freund.", es: "Planea una pequeña quedada con un amigo para esta semana.", fr: "Prévois une petite sortie avec un(e) ami(e) plus tard cette semaine.", it: "Pianifica un piccolo incontro con un amico per questa settimana.", pt: "Planeje um encontro pequeno com um amigo para esta semana.", tr: "Bu hafta içinde bir arkadaşınla küçük bir buluşma planla.", ar: "خطط للقاء بسيط مع صديق لاحقًا هذا الأسبوع." },
  { id: 31, category: "social", difficulty: 4, mood: ["adventurous", "lonely"], en: "Host something small this week — dinner, a game night, or coffee — at your place.", de: "Veranstalte diese Woche etwas Kleines bei dir — Abendessen, Spieleabend oder Kaffee.", es: "Organiza algo pequeño esta semana en tu casa — cena, noche de juegos o café.", fr: "Organise quelque chose de simple chez toi cette semaine — dîner, soirée jeux ou café.", it: "Organizza qualcosa di piccolo questa settimana a casa tua — cena, serata giochi o caffè.", pt: "Organize algo pequeno na sua casa esta semana — jantar, noite de jogos ou café.", tr: "Bu hafta evinde küçük bir şey düzenle — yemek, oyun gecesi ya da kahve.", ar: "نظّم شيئًا بسيطًا هذا الأسبوع في منزلك — عشاء، أمسية ألعاب، أو قهوة." },
  { id: 32, category: "social", difficulty: 4, mood: ["adventurous", "lonely"], en: "Join a group activity or class where you don't know anyone yet.", de: "Nimm an einer Gruppenaktivität oder einem Kurs teil, wo du noch niemanden kennst.", es: "Únete a una actividad grupal o clase donde aún no conozcas a nadie.", fr: "Participe à une activité de groupe ou un cours où tu ne connais encore personne.", it: "Partecipa a un'attività di gruppo o un corso dove non conosci ancora nessuno.", pt: "Participe de uma atividade em grupo ou aula onde você ainda não conhece ninguém.", tr: "Henüz kimseyi tanımadığın bir grup etkinliğine ya da derse katıl.", ar: "انضم إلى نشاط جماعي أو حصة لا تعرف فيها أحدًا بعد." },
  { id: 33, category: "social", difficulty: 5, mood: ["adventurous"], en: "Organize a get-together for a group of people who don't all know each other.", de: "Organisiere ein Treffen für eine Gruppe von Leuten, die sich nicht alle kennen.", es: "Organiza una reunión para un grupo de personas que no se conocen todas entre sí.", fr: "Organise une rencontre pour un groupe de personnes qui ne se connaissent pas toutes.", it: "Organizza un incontro per un gruppo di persone che non si conoscono tutte tra loro.", pt: "Organize um encontro para um grupo de pessoas que não se conhecem todas entre si.", tr: "Birbirini tam olarak tanımayan bir grup insan için bir buluşma organize et.", ar: "نظّم لقاءً لمجموعة أشخاص لا يعرف بعضهم بعضًا بالكامل." },
  { id: 34, category: "social", difficulty: 5, mood: ["lonely"], en: "Have one honest, vulnerable conversation with someone close to you.", de: "Führe ein ehrliches, offenes Gespräch mit jemandem, der dir nahesteht.", es: "Ten una conversación sincera y vulnerable con alguien cercano a ti.", fr: "Aie une conversation honnête et sincère avec quelqu'un de proche.", it: "Fai una conversazione onesta e vulnerabile con qualcuno a te vicino.", pt: "Tenha uma conversa honesta e vulnerável com alguém próximo a você.", tr: "Sana yakın biriyle dürüst, içten bir sohbet yap.", ar: "أجرِ محادثة صادقة وصريحة مع شخص مقرب منك." },

  // ---- Health ----
  { id: 35, category: "health", difficulty: 1, mood: ["stressed", "low-energy"], en: "Drink a full glass of water first thing, before anything else today.", de: "Trink heute als Erstes ein volles Glas Wasser, noch bevor du etwas anderes tust.", es: "Bebe un vaso lleno de agua a primera hora, antes que nada más hoy.", fr: "Bois un grand verre d'eau en premier, avant toute autre chose aujourd'hui.", it: "Bevi un bicchiere pieno d'acqua per prima cosa, prima di ogni altra cosa oggi.", pt: "Beba um copo cheio de água antes de qualquer outra coisa hoje.", tr: "Bugün her şeyden önce büyük bir bardak su iç.", ar: "اشرب كوبًا كاملاً من الماء أول شيء تفعله اليوم قبل أي شيء آخر." },
  { id: 36, category: "health", difficulty: 1, mood: ["stressed"], en: "Step outside and take five slow, deep breaths.", de: "Geh raus und atme fünfmal langsam und tief durch.", es: "Sal afuera y respira profundamente cinco veces, despacio.", fr: "Sors et prends cinq respirations lentes et profondes.", it: "Esci fuori e fai cinque respiri lenti e profondi.", pt: "Saia e respire fundo cinco vezes, devagar.", tr: "Dışarı çık ve yavaşça beş derin nefes al.", ar: "اخرج للخارج وخذ خمسة أنفاس عميقة وبطيئة." },
  { id: 37, category: "health", difficulty: 2, mood: ["low-energy", "stressed"], en: "Cook a real meal for yourself instead of grabbing something fast.", de: "Koch dir eine richtige Mahlzeit, statt schnell etwas zu greifen.", es: "Cocina una comida de verdad para ti en lugar de comer algo rápido.", fr: "Prépare-toi un vrai repas au lieu de prendre quelque chose de rapide.", it: "Cucinati un pasto vero invece di prendere qualcosa al volo.", pt: "Cozinhe uma refeição de verdade em vez de pegar algo rápido.", tr: "Hızlıca bir şey almak yerine kendine gerçek bir yemek pişir.", ar: "اطبخ وجبة حقيقية لنفسك بدلاً من تناول شيء سريع." },
  { id: 38, category: "health", difficulty: 2, mood: ["low-energy"], en: "Go to bed 30 minutes earlier than usual tonight.", de: "Geh heute Nacht 30 Minuten früher als sonst ins Bett.", es: "Vete a dormir 30 minutos antes de lo habitual esta noche.", fr: "Couche-toi 30 minutes plus tôt que d'habitude ce soir.", it: "Vai a letto 30 minuti prima del solito stasera.", pt: "Vá para a cama 30 minutos mais cedo que o normal hoje à noite.", tr: "Bu gece her zamankinden 30 dakika erken yat.", ar: "اذهب إلى النوم الليلة قبل 30 دقيقة من موعدك المعتاد." },
  { id: 39, category: "health", difficulty: 3, mood: ["stressed"], en: "Do a full 15-minute stretch routine, no rushing it.", de: "Mach eine vollständige 15-minütige Dehnroutine, ohne dich zu beeilen.", es: "Haz una rutina completa de estiramientos de 15 minutos, sin prisas.", fr: "Fais une routine complète d'étirements de 15 minutes, sans te presser.", it: "Fai una routine completa di stretching di 15 minuti, senza fretta.", pt: "Faça uma rotina completa de alongamento de 15 minutos, sem pressa.", tr: "Acele etmeden tam 15 dakikalık bir esneme rutini yap.", ar: "قم بروتين تمدد كامل لمدة 15 دقيقة دون استعجال." },
  { id: 40, category: "health", difficulty: 3, mood: ["stressed", "low-energy"], en: "Take a walk somewhere quiet with no destination in mind.", de: "Mach einen Spaziergang an einem ruhigen Ort, ohne Ziel im Kopf.", es: "Da un paseo por un lugar tranquilo sin ningún destino en mente.", fr: "Fais une promenade dans un endroit calme, sans destination précise.", it: "Fai una passeggiata in un posto tranquillo senza una meta precisa.", pt: "Faça uma caminhada em um lugar tranquilo sem destino em mente.", tr: "Aklında bir hedef olmadan sessiz bir yerde yürüyüş yap.", ar: "تمشَّ في مكان هادئ دون وجهة محددة في ذهنك." },
  { id: 41, category: "health", difficulty: 4, mood: ["adventurous", "stressed"], en: "Try a workout style you've never done before — yoga, swimming, climbing, dance.", de: "Probier einen Trainingsstil aus, den du noch nie gemacht hast — Yoga, Schwimmen, Klettern, Tanzen.", es: "Prueba un estilo de entrenamiento que nunca hayas hecho — yoga, natación, escalada, baile.", fr: "Essaie un style d'entraînement que tu n'as jamais fait — yoga, natation, escalade, danse.", it: "Prova uno stile di allenamento che non hai mai fatto — yoga, nuoto, arrampicata, danza.", pt: "Experimente um estilo de treino que nunca fez — ioga, natação, escalada, dança.", tr: "Hiç yapmadığın bir egzersiz türü dene — yoga, yüzme, tırmanış, dans.", ar: "جرّب أسلوب تمرين لم تجربه من قبل — يوغا، سباحة، تسلق، رقص." },
  { id: 42, category: "health", difficulty: 4, mood: ["stressed"], en: "Go a full day without sugar or caffeine, just to notice how you feel.", de: "Verzichte einen ganzen Tag auf Zucker oder Koffein, um zu spüren, wie du dich fühlst.", es: "Pasa un día entero sin azúcar ni cafeína, solo para notar cómo te sientes.", fr: "Passe une journée entière sans sucre ni caféine, juste pour observer comment tu te sens.", it: "Passa un'intera giornata senza zucchero o caffeina, solo per notare come ti senti.", pt: "Passe um dia inteiro sem açúcar ou cafeína, só para notar como você se sente.", tr: "Nasıl hissettiğini fark etmek için bütün bir günü şekersiz ve kafeinsiz geçir.", ar: "اقضِ يومًا كاملاً بدون سكر أو كافيين، فقط لتلاحظ شعورك." },
  { id: 43, category: "health", difficulty: 5, mood: ["adventurous"], en: "Sign up for a recurring class or activity — something with real commitment behind it.", de: "Melde dich für einen wiederkehrenden Kurs oder eine Aktivität an — mit echter Verbindlichkeit.", es: "Apúntate a una clase o actividad recurrente — algo con un compromiso real detrás.", fr: "Inscris-toi à un cours ou une activité récurrente — quelque chose avec un vrai engagement.", it: "Iscriviti a un corso o attività ricorrente — qualcosa con un vero impegno dietro.", pt: "Inscreva-se em uma aula ou atividade recorrente — algo com compromisso real por trás.", tr: "Düzenli bir derse ya da etkinliğe kaydol — gerçek bir bağlılık gerektiren bir şey.", ar: "سجّل في حصة أو نشاط متكرر — شيء يتطلب التزامًا حقيقيًا." },
  { id: 44, category: "health", difficulty: 5, mood: ["adventurous", "stressed"], en: "Complete a physical challenge you've been putting off — a run, a hike, a distance goal.", de: "Erledige eine körperliche Herausforderung, die du aufgeschoben hast — ein Lauf, eine Wanderung, ein Distanzziel.", es: "Completa un reto físico que hayas estado posponiendo — una carrera, una caminata, una meta de distancia.", fr: "Accomplis un défi physique que tu repousses depuis longtemps — une course, une randonnée, un objectif de distance.", it: "Completa una sfida fisica che stai rimandando — una corsa, un'escursione, un obiettivo di distanza.", pt: "Complete um desafio físico que você vem adiando — uma corrida, uma trilha, uma meta de distância.", tr: "Ertelediğin fiziksel bir hedefi tamamla — bir koşu, bir yürüyüş, bir mesafe hedefi.", ar: "أكمل تحديًا جسديًا كنت تؤجله — جري، رحلة مشي، أو هدف مسافة معينة." },

  // ---- Creativity ----
  { id: 45, category: "creativity", difficulty: 1, mood: ["bored", "low-energy"], en: "Take one photo today that captures how the day feels.", de: "Mach heute ein Foto, das einfängt, wie sich der Tag anfühlt.", es: "Toma hoy una foto que capture cómo se siente el día.", fr: "Prends une photo aujourd'hui qui capture l'ambiance de la journée.", it: "Scatta oggi una foto che catturi come ti senti oggi.", pt: "Tire hoje uma foto que capture como o dia está.", tr: "Bugün, günün nasıl hissettirdiğini yakalayan bir fotoğraf çek.", ar: "التقط اليوم صورة تعبّر عن شعور هذا اليوم." },
  { id: 46, category: "creativity", difficulty: 1, mood: ["bored"], en: "Write down three random ideas, no matter how silly they seem.", de: "Schreib drei zufällige Ideen auf, egal wie albern sie klingen.", es: "Anota tres ideas al azar, por muy tontas que parezcan.", fr: "Note trois idées au hasard, aussi absurdes soient-elles.", it: "Scrivi tre idee a caso, non importa quanto sembrino sciocche.", pt: "Anote três ideias aleatórias, por mais bobas que pareçam.", tr: "Ne kadar saçma görünürse görünsün üç rastgele fikir yaz.", ar: "اكتب ثلاث أفكار عشوائية، مهما بدت سخيفة." },
  { id: 47, category: "creativity", difficulty: 2, mood: ["bored"], en: "Rearrange or redecorate one small space using only things you already own.", de: "Räume einen kleinen Bereich um oder dekoriere ihn neu — nur mit Dingen, die du schon besitzt.", es: "Reorganiza o redecora un pequeño espacio usando solo cosas que ya tengas.", fr: "Réorganise ou redécore un petit espace en utilisant seulement ce que tu possèdes déjà.", it: "Riorganizza o ridecora un piccolo spazio usando solo cose che possiedi già.", pt: "Reorganize ou redecore um pequeno espaço usando apenas coisas que você já tem.", tr: "Sadece zaten sahip olduğun eşyaları kullanarak küçük bir alanı yeniden düzenle.", ar: "أعد ترتيب أو تزيين مساحة صغيرة باستخدام أشياء تملكها بالفعل فقط." },
  { id: 48, category: "creativity", difficulty: 2, mood: ["bored", "adventurous"], en: "Cook or bake something you've never made before.", de: "Koch oder back etwas, das du noch nie gemacht hast.", es: "Cocina u hornea algo que nunca hayas hecho antes.", fr: "Cuisine ou fais cuire quelque chose que tu n'as jamais préparé.", it: "Cucina o cuoci qualcosa che non hai mai fatto prima.", pt: "Cozinhe ou asse algo que você nunca fez antes.", tr: "Daha önce hiç yapmadığın bir yemek pişir ya da bir şey fırınla.", ar: "اطبخ أو اخبز شيئًا لم تصنعه من قبل." },
  { id: 49, category: "creativity", difficulty: 3, mood: ["bored"], en: "Write a short story or poem, even if it's just a few lines.", de: "Schreib eine Kurzgeschichte oder ein Gedicht, auch wenn es nur ein paar Zeilen sind.", es: "Escribe un cuento corto o un poema, aunque sean solo unas líneas.", fr: "Écris une courte histoire ou un poème, même si ce n'est que quelques lignes.", it: "Scrivi un breve racconto o una poesia, anche solo poche righe.", pt: "Escreva um conto curto ou um poema, mesmo que sejam só algumas linhas.", tr: "Sadece birkaç satır bile olsa kısa bir hikaye ya da şiir yaz.", ar: "اكتب قصة قصيرة أو قصيدة، ولو كانت بضعة أسطر فقط." },
  { id: 50, category: "creativity", difficulty: 3, mood: ["bored", "adventurous"], en: "Learn and play one new song, chord progression, or riff on an instrument.", de: "Lern und spiel ein neues Lied, eine Akkordfolge oder ein Riff auf einem Instrument.", es: "Aprende y toca una nueva canción, progresión de acordes o riff en un instrumento.", fr: "Apprends et joue une nouvelle chanson, une suite d'accords ou un riff à un instrument.", it: "Impara e suona una nuova canzone, progressione di accordi o riff su uno strumento.", pt: "Aprenda e toque uma música nova, progressão de acordes ou riff em um instrumento.", tr: "Bir enstrümanda yeni bir şarkı, akor dizisi ya da riff öğren ve çal.", ar: "تعلّم واعزف أغنية جديدة أو تتابع أوتار على آلة موسيقية." },
  { id: 51, category: "creativity", difficulty: 4, mood: ["bored", "adventurous"], en: "Start a small creative project you can keep building on over the coming weeks.", de: "Starte ein kleines kreatives Projekt, das du in den nächsten Wochen weiter ausbauen kannst.", es: "Comienza un pequeño proyecto creativo que puedas seguir desarrollando en las próximas semanas.", fr: "Lance un petit projet créatif que tu pourras continuer à développer dans les semaines à venir.", it: "Avvia un piccolo progetto creativo che puoi continuare a sviluppare nelle prossime settimane.", pt: "Comece um pequeno projeto criativo que você possa continuar desenvolvendo nas próximas semanas.", tr: "Önümüzdeki haftalarda geliştirmeye devam edebileceğin küçük bir yaratıcı proje başlat.", ar: "ابدأ مشروعًا إبداعيًا صغيرًا يمكنك الاستمرار في تطويره خلال الأسابيع القادمة." },
  { id: 52, category: "creativity", difficulty: 4, mood: ["bored"], en: "Make something as a gift for someone, entirely from scratch.", de: "Mach etwas als Geschenk für jemanden — ganz von Grund auf selbst gemacht.", es: "Haz algo como regalo para alguien, completamente desde cero.", fr: "Fabrique quelque chose en cadeau pour quelqu'un, entièrement à partir de zéro.", it: "Crea qualcosa come regalo per qualcuno, completamente da zero.", pt: "Faça algo como presente para alguém, totalmente do zero.", tr: "Birine hediye olarak sıfırdan bir şey yap.", ar: "اصنع شيئًا كهدية لشخص ما، من الصفر تمامًا." },
  { id: 53, category: "creativity", difficulty: 5, mood: ["adventurous"], en: "Create something ambitious this week — a piece of art, a short film, a piece of writing — start to finish.", de: "Erschaffe diese Woche etwas Ambitioniertes — ein Kunstwerk, einen Kurzfilm, einen Text — von Anfang bis Ende.", es: "Crea algo ambicioso esta semana — una obra de arte, un cortometraje, un escrito — de principio a fin.", fr: "Crée quelque chose d'ambitieux cette semaine — une œuvre d'art, un court métrage, un texte — du début à la fin.", it: "Crea qualcosa di ambizioso questa settimana — un'opera d'arte, un cortometraggio, uno scritto — dall'inizio alla fine.", pt: "Crie algo ambicioso esta semana — uma obra de arte, um curta-metragem, um texto — do início ao fim.", tr: "Bu hafta iddialı bir şey yarat — bir sanat eseri, kısa film, yazı — baştan sona kadar.", ar: "أنشئ شيئًا طموحًا هذا الأسبوع — عمل فني، فيلم قصير، أو نص مكتوب — من البداية إلى النهاية." },
  { id: 54, category: "creativity", difficulty: 5, mood: ["adventurous", "bored"], en: "Teach yourself a brand new creative skill from scratch this week.", de: "Bring dir diese Woche eine völlig neue kreative Fähigkeit von Grund auf selbst bei.", es: "Enséñate a ti mismo una habilidad creativa completamente nueva desde cero esta semana.", fr: "Apprends-toi une toute nouvelle compétence créative à partir de zéro cette semaine.", it: "Insegnati da solo una nuova abilità creativa da zero questa settimana.", pt: "Ensine a si mesmo uma habilidade criativa totalmente nova do zero esta semana.", tr: "Bu hafta kendine sıfırdan yepyeni bir yaratıcı beceri öğret.", ar: "علّم نفسك مهارة إبداعية جديدة تمامًا من الصفر هذا الأسبوع." },
];

const MOOD_MAP = { "zero energy": "low-energy", "keine energie": "low-energy", tired: "low-energy", müde: "low-energy", stressed: "stressed", gestresst: "stressed", anxious: "stressed", bored: "bored", gelangweilt: "bored", lonely: "lonely", einsam: "lonely", adventurous: "adventurous", abenteuerlustig: "adventurous", excited: "adventurous" };

function detectMood(text) {
  const lower = text.toLowerCase();
  for (const key in MOOD_MAP) if (lower.includes(key)) return MOOD_MAP[key];
  return null;
}

const CATEGORY_COLORS = { exploration: "#e0b84f", social: "#4fc3e8", health: "#5fd889", creativity: "#e0708a" };
const CATEGORY_EMOJI = { exploration: "🧭", social: "💬", health: "💪", creativity: "🎨" };
const CATEGORIES = ["exploration", "social", "health", "creativity"];
const DIFFICULTY_EMOJI = ["🌱", "🙂", "🔥", "⚡", "💎"]; // index = difficulty-1

// ---------- BADGE DEFINITIONS ----------
// Tiered on purpose — early ones unlock fast (dopamine hit in the first
// session), later ones take real weeks of use. Each has a `progress` fn so
// the open panel can show "7/10" style bars, not just locked/unlocked.
const BADGE_DEFS = [
  // Quests completed
  { id: "quests_1", icon: "🌱", en: "First Steps", de: "Erste Schritte", es: "Primeros Pasos", fr: "Premiers Pas", it: "Primi Passi", pt: "Primeiros Passos", tr: "İlk Adımlar", ar: "الخطوات الأولى", group: "quests", target: 1, check: (s) => s.totalCompleted >= 1, progress: (s) => s.totalCompleted },
  { id: "quests_5", icon: "🍃", en: "Getting Going", de: "Es geht los", es: "Cogiendo Ritmo", fr: "En Route", it: "Si Parte", pt: "Pegando Ritmo", tr: "Hız Kazanıyor", ar: "البداية الجادة", group: "quests", target: 5, check: (s) => s.totalCompleted >= 5, progress: (s) => s.totalCompleted },
  { id: "quests_10", icon: "🌿", en: "10 Quests Done", de: "10 Aufgaben geschafft", es: "10 Misiones Completadas", fr: "10 Quêtes Terminées", it: "10 Missioni Completate", pt: "10 Missões Concluídas", tr: "10 Görev Tamamlandı", ar: "10 مهام مكتملة", group: "quests", target: 10, check: (s) => s.totalCompleted >= 10, progress: (s) => s.totalCompleted },
  { id: "quests_25", icon: "🌳", en: "25 Quests Done", de: "25 Aufgaben geschafft", es: "25 Misiones Completadas", fr: "25 Quêtes Terminées", it: "25 Missioni Completate", pt: "25 Missões Concluídas", tr: "25 Görev Tamamlandı", ar: "25 مهمة مكتملة", group: "quests", target: 25, check: (s) => s.totalCompleted >= 25, progress: (s) => s.totalCompleted },
  { id: "quests_50", icon: "🏔️", en: "50 Quests Done", de: "50 Aufgaben geschafft", es: "50 Misiones Completadas", fr: "50 Quêtes Terminées", it: "50 Missioni Completate", pt: "50 Missões Concluídas", tr: "50 Görev Tamamlandı", ar: "50 مهمة مكتملة", group: "quests", target: 50, check: (s) => s.totalCompleted >= 50, progress: (s) => s.totalCompleted },
  { id: "quests_100", icon: "🏆", en: "100 Quests Done", de: "100 Aufgaben geschafft", es: "100 Misiones Completadas", fr: "100 Quêtes Terminées", it: "100 Missioni Completate", pt: "100 Missões Concluídas", tr: "100 Görev Tamamlandı", ar: "100 مهمة مكتملة", group: "quests", target: 100, check: (s) => s.totalCompleted >= 100, progress: (s) => s.totalCompleted },

  // Streaks
  { id: "streak_3", icon: "✨", en: "3-Day Streak", de: "3-Tage-Serie", es: "Racha de 3 Días", fr: "Série de 3 Jours", it: "Serie di 3 Giorni", pt: "Sequência de 3 Dias", tr: "3 Günlük Seri", ar: "تتابع 3 أيام", group: "streak", target: 3, check: (s) => s.streak >= 3, progress: (s) => s.streak },
  { id: "streak_7", icon: "🔥", en: "7-Day Streak", de: "7-Tage-Serie", es: "Racha de 7 Días", fr: "Série de 7 Jours", it: "Serie di 7 Giorni", pt: "Sequência de 7 Dias", tr: "7 Günlük Seri", ar: "تتابع 7 أيام", group: "streak", target: 7, check: (s) => s.streak >= 7, progress: (s) => s.streak },
  { id: "streak_14", icon: "🔥", en: "14-Day Streak", de: "14-Tage-Serie", es: "Racha de 14 Días", fr: "Série de 14 Jours", it: "Serie di 14 Giorni", pt: "Sequência de 14 Dias", tr: "14 Günlük Seri", ar: "تتابع 14 يومًا", group: "streak", target: 14, check: (s) => s.streak >= 14, progress: (s) => s.streak },
  { id: "streak_30", icon: "💥", en: "30-Day Streak", de: "30-Tage-Serie", es: "Racha de 30 Días", fr: "Série de 30 Jours", it: "Serie di 30 Giorni", pt: "Sequência de 30 Dias", tr: "30 Günlük Seri", ar: "تتابع 30 يومًا", group: "streak", target: 30, check: (s) => s.streak >= 30, progress: (s) => s.streak },
  { id: "streak_60", icon: "🌟", en: "60-Day Streak", de: "60-Tage-Serie", es: "Racha de 60 Días", fr: "Série de 60 Jours", it: "Serie di 60 Giorni", pt: "Sequência de 60 Dias", tr: "60 Günlük Seri", ar: "تتابع 60 يومًا", group: "streak", target: 60, check: (s) => s.streak >= 60, progress: (s) => s.streak },
  { id: "streak_100", icon: "👑", en: "100-Day Streak", de: "100-Tage-Serie", es: "Racha de 100 Días", fr: "Série de 100 Jours", it: "Serie di 100 Giorni", pt: "Sequência de 100 Dias", tr: "100 Günlük Seri", ar: "تتابع 100 يوم", group: "streak", target: 100, check: (s) => s.streak >= 100, progress: (s) => s.streak },

  // Difficulty (Level 5 quests specifically)
  { id: "level5_1", icon: "⚡", en: "First Level 5 Quest", de: "Erste Level-5-Aufgabe", es: "Primera Misión Nivel 5", fr: "Première Quête Niveau 5", it: "Prima Missione Livello 5", pt: "Primeira Missão Nível 5", tr: "İlk Seviye 5 Görevi", ar: "أول مهمة من المستوى 5", group: "difficulty", target: 1, check: (s) => s.level5Count >= 1, progress: (s) => s.level5Count },
  { id: "level5_10", icon: "⚡", en: "10 Level 5 Quests", de: "10 Level-5-Aufgaben", es: "10 Misiones Nivel 5", fr: "10 Quêtes Niveau 5", it: "10 Missioni Livello 5", pt: "10 Missões Nível 5", tr: "10 Seviye 5 Görevi", ar: "10 مهام من المستوى 5", group: "difficulty", target: 10, check: (s) => s.level5Count >= 10, progress: (s) => s.level5Count },
  { id: "level5_25", icon: "💎", en: "25 Level 5 Quests", de: "25 Level-5-Aufgaben", es: "25 Misiones Nivel 5", fr: "25 Quêtes Niveau 5", it: "25 Missioni Livello 5", pt: "25 Missões Nível 5", tr: "25 Seviye 5 Görevi", ar: "25 مهمة من المستوى 5", group: "difficulty", target: 25, check: (s) => s.level5Count >= 25, progress: (s) => s.level5Count },

  // Photos
  { id: "photos_1", icon: "📷", en: "First Photo Logged", de: "Erstes Foto gespeichert", es: "Primera Foto Guardada", fr: "Première Photo Ajoutée", it: "Prima Foto Salvata", pt: "Primeira Foto Salva", tr: "İlk Fotoğraf Eklendi", ar: "أول صورة محفوظة", group: "photos", target: 1, check: (s) => s.photoCount >= 1, progress: (s) => s.photoCount },
  { id: "photos_10", icon: "📸", en: "10 Photos Logged", de: "10 Fotos gespeichert", es: "10 Fotos Guardadas", fr: "10 Photos Ajoutées", it: "10 Foto Salvate", pt: "10 Fotos Salvas", tr: "10 Fotoğraf Eklendi", ar: "10 صور محفوظة", group: "photos", target: 10, check: (s) => s.photoCount >= 10, progress: (s) => s.photoCount },
  { id: "photos_25", icon: "🖼️", en: "25 Photos Logged", de: "25 Fotos gespeichert", es: "25 Fotos Guardadas", fr: "25 Photos Ajoutées", it: "25 Foto Salvate", pt: "25 Fotos Salvas", tr: "25 Fotoğraf Eklendi", ar: "25 صورة محفوظة", group: "photos", target: 25, check: (s) => s.photoCount >= 25, progress: (s) => s.photoCount },
  { id: "photos_50", icon: "🎞️", en: "50 Photos Logged", de: "50 Fotos gespeichert", es: "50 Fotos Guardadas", fr: "50 Photos Ajoutées", it: "50 Foto Salvate", pt: "50 Fotos Salvas", tr: "50 Fotoğraf Eklendi", ar: "50 صورة محفوظة", group: "photos", target: 50, check: (s) => s.photoCount >= 50, progress: (s) => s.photoCount },

  // Categories
  { id: "all_categories", icon: "🧭", en: "Tried Every Category", de: "Alle Kategorien probiert", es: "Probaste Todas las Categorías", fr: "Toutes les Catégories Essayées", it: "Tutte le Categorie Provate", pt: "Todas as Categorias Testadas", tr: "Her Kategoriyi Denedin", ar: "جربت كل الفئات", group: "category", target: 4, check: (s) => s.categoriesUsed.size >= 4, progress: (s) => s.categoriesUsed.size },
  { id: "cat_exploration_10", icon: "🧭", en: "10 Exploration Quests", de: "10 Entdeckungs-Aufgaben", es: "10 Misiones de Exploración", fr: "10 Quêtes d'Exploration", it: "10 Missioni di Esplorazione", pt: "10 Missões de Exploração", tr: "10 Keşif Görevi", ar: "10 مهام استكشاف", group: "category", target: 10, check: (s) => (s.categoryCounts.exploration || 0) >= 10, progress: (s) => s.categoryCounts.exploration || 0 },
  { id: "cat_social_10", icon: "💬", en: "10 Social Quests", de: "10 Soziale Aufgaben", es: "10 Misiones Sociales", fr: "10 Quêtes Sociales", it: "10 Missioni Sociali", pt: "10 Missões Sociais", tr: "10 Sosyal Görev", ar: "10 مهام اجتماعية", group: "category", target: 10, check: (s) => (s.categoryCounts.social || 0) >= 10, progress: (s) => s.categoryCounts.social || 0 },
  { id: "cat_health_10", icon: "💪", en: "10 Health Quests", de: "10 Gesundheits-Aufgaben", es: "10 Misiones de Salud", fr: "10 Quêtes Santé", it: "10 Missioni di Salute", pt: "10 Missões de Saúde", tr: "10 Sağlık Görevi", ar: "10 مهام صحية", group: "category", target: 10, check: (s) => (s.categoryCounts.health || 0) >= 10, progress: (s) => s.categoryCounts.health || 0 },
  { id: "cat_creativity_10", icon: "🎨", en: "10 Creativity Quests", de: "10 Kreativ-Aufgaben", es: "10 Misiones Creativas", fr: "10 Quêtes Créatives", it: "10 Missioni Creative", pt: "10 Missões Criativas", tr: "10 Yaratıcılık Görevi", ar: "10 مهام إبداعية", group: "category", target: 10, check: (s) => (s.categoryCounts.creativity || 0) >= 10, progress: (s) => s.categoryCounts.creativity || 0 },

  // XP milestones
  { id: "xp_500", icon: "🔷", en: "500 XP", de: "500 XP", es: "500 XP", fr: "500 XP", it: "500 XP", pt: "500 XP", tr: "500 XP", ar: "500 XP", group: "xp", target: 500, check: (s) => s.xp >= 500, progress: (s) => s.xp },
  { id: "xp_1000", icon: "🔶", en: "1,000 XP", de: "1.000 XP", es: "1.000 XP", fr: "1 000 XP", it: "1.000 XP", pt: "1.000 XP", tr: "1.000 XP", ar: "1000 XP", group: "xp", target: 1000, check: (s) => s.xp >= 1000, progress: (s) => s.xp },
  { id: "xp_2500", icon: "🟣", en: "2,500 XP", de: "2.500 XP", es: "2.500 XP", fr: "2 500 XP", it: "2.500 XP", pt: "2.500 XP", tr: "2.500 XP", ar: "2500 XP", group: "xp", target: 2500, check: (s) => s.xp >= 2500, progress: (s) => s.xp },
  { id: "xp_5000", icon: "🌌", en: "5,000 XP", de: "5.000 XP", es: "5.000 XP", fr: "5 000 XP", it: "5.000 XP", pt: "5.000 XP", tr: "5.000 XP", ar: "5000 XP", group: "xp", target: 5000, check: (s) => s.xp >= 5000, progress: (s) => s.xp },
];





function playSuccessChime() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = ctx.currentTime + i * 0.1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}

const CONFETTI_EMOJI = ["🎉", "✨", "⭐", "🎊", "💫"];
function makeConfettiBurst(count = 18) {
  return Array.from({ length: count }).map((_, i) => ({
    id: `${Date.now()}-${i}`,
    emoji: CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)],
    x: (Math.random() - 0.5) * 260,
    rot: (Math.random() - 0.5) * 360,
    delay: Math.random() * 0.15,
    size: 14 + Math.random() * 14,
  }));
}



function daysBetweenKeys(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const da = new Date(ay, am - 1, ad);
  const db = new Date(by, bm - 1, bd);
  return Math.round((db - da) / 86400000);
}

function questCompressImage(file, maxSize = 400) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function QuestWheel({ globalTheme, globalLang }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [justLanded, setJustLanded] = useState(false);
  const [currentQuest, setCurrentQuest] = useState(null);
  const [moodInput, setMoodInput] = useState("");
  const [activeMoodFilter, setActiveMoodFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastCompletedDate, setLastCompletedDate] = useState(null);
  const [confetti, setConfetti] = useState([]);
  const [justSaved, setJustSaved] = useState(false);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [maxDifficultyDone, setMaxDifficultyDone] = useState(0);
  const [level5Count, setLevel5Count] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({});
  const [categoriesUsed, setCategoriesUsed] = useState([]);
  const [unlockedBadges, setUnlockedBadges] = useState([]);
  const [newBadge, setNewBadge] = useState(null);
  const [badgeConfetti, setBadgeConfetti] = useState([]);
  const [badgePanelOpen, setBadgePanelOpen] = useState(false);
  const [scrapbookOpen, setScrapbookOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);
  const [scrapbook, setScrapbook] = useState([]);
  const [reflection, setReflection] = useState("");
  const [photoData, setPhotoData] = useState([]);
  const [showLogPanel, setShowLogPanel] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const canvasRef = useRef(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const fileInputRef = useRef(null);

  const t = QUEST_STRINGS[lang] || QUEST_STRINGS.en;
  const theme = THEMES[themeKey];
  const level = Math.floor(xp / 100) + 1;
  const xpIntoLevel = xp % 100;
  const photoCount = scrapbook.reduce((sum, e) => sum + (e.photos ? e.photos.length : 0), 0);

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("quest-wheel-state-v2");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          setXp(d.xp || 0); setStreak(d.streak || 0); setScrapbook(d.scrapbook || []);
          setTotalCompleted(d.totalCompleted || 0); setMaxDifficultyDone(d.maxDifficultyDone || 0);
          setCategoriesUsed(d.categoriesUsed || []); setUnlockedBadges(d.unlockedBadges || []);
          setLastCompletedDate(d.lastCompletedDate || null);
          setLevel5Count(d.level5Count || 0); setCategoryCounts(d.categoryCounts || {});
        }
      } catch (e) {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try {
        await supaSet("quest-wheel-state-v2", JSON.stringify({ xp, streak, scrapbook, themeKey, lang, totalCompleted, maxDifficultyDone, categoriesUsed, unlockedBadges, lastCompletedDate, level5Count, categoryCounts }));
      } catch (e) { console.error(e); }
    })();
  }, [xp, streak, scrapbook, themeKey, lang, totalCompleted, maxDifficultyDone, categoriesUsed, unlockedBadges, lastCompletedDate, level5Count, categoryCounts, storageReady]);

  const liveSyncCtx = useContext(LiveSyncContext);
  useEffect(() => {
    liveSyncCtx?.updateLiveSync("quest", { scrapbook, totalCompleted, streak, unlockedBadges, lastCompletedDate });
  }, [scrapbook, totalCompleted, streak, unlockedBadges, lastCompletedDate]);

  let pool = QUESTS;
  if (activeMoodFilter) pool = pool.filter((q) => q.mood.includes(activeMoodFilter));
  if (categoryFilter !== "all") pool = pool.filter((q) => q.category === categoryFilter);
  if (difficultyFilter !== "all") pool = pool.filter((q) => q.difficulty === Number(difficultyFilter));
  if (pool.length === 0) pool = QUESTS; // filters matched nothing usable — fall back silently rather than break

  // The wheel is always a fixed 8-slice design, colored by which categories are
  // currently in play. This keeps it readable and never hints at how many
  // quests are actually behind each slice.
  const availableCategories = Array.from(new Set(pool.map((q) => q.category)));
  const wheelSlices = Array.from({ length: 8 }, (_, i) => availableCategories[i % availableCategories.length]);
  const segAngle = 360 / wheelSlices.length;

  // A quest only counts as "seen" once it's actually been completed, so quests
  // you spin but skip can still come up again right away.
  const completedIds = new Set(scrapbook.map((e) => e.questId).filter((id) => id !== undefined));

  function handleFilter() {
    setActiveMoodFilter(detectMood(moodInput));
  }
  function clearFilter() {
    setActiveMoodFilter(null); setMoodInput("");
  }

  function spin() {
    if (spinning) return;
    setSpinning(true); setJustLanded(false); setCurrentQuest(null); setShowLogPanel(false);
    setReflection(""); setPhotoData([]);
    vibrate(15);

    const winnerIndex = Math.floor(Math.random() * wheelSlices.length);
    const winnerCategory = wheelSlices[winnerIndex];
    const winnerCenter = winnerIndex * segAngle + segAngle / 2;
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = rotation + extraSpins * 360 + (360 - winnerCenter) - (rotation % 360);
    setRotation(targetRotation);

    // Pick the actual quest behind the landed slice, favoring ones not done yet
    const candidates = pool.filter((q) => q.category === winnerCategory);
    const unseen = candidates.filter((q) => !completedIds.has(q.id));
    const finalPool = unseen.length ? unseen : candidates;
    const chosenQuest = finalPool[Math.floor(Math.random() * finalPool.length)] || pool[Math.floor(Math.random() * pool.length)];

    // Ticking sound that slows down like a real wheel
    const totalTicks = 26;
    for (let i = 0; i < totalTicks; i++) {
      const progress = i / totalTicks;
      const delay = 120 * i + 900 * progress * progress; // ease-out spacing
      setTimeout(() => playTick(0.1 - progress * 0.06), delay);
    }

    setTimeout(() => {
      setSpinning(false);
      setJustLanded(true);
      setCurrentQuest(chosenQuest);
      playChime();
      vibrate([0, 40, 30, 60]);
      setTimeout(() => setJustLanded(false), 700);
    }, 4200);
  }

  async function handlePhotoUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const compressedList = await Promise.all(files.map((f) => questCompressImage(f)));
    setPhotoData((prev) => [...prev, ...compressedList]);
    e.target.value = ""; // allow re-selecting the same file(s) again later
  }

  function removePhotoAt(index) {
    setPhotoData((prev) => prev.filter((_, i) => i !== index));
  }

  function checkBadges(stats) {
    const newlyUnlocked = [];
    BADGE_DEFS.forEach((b) => {
      if (!unlockedBadges.includes(b.id) && b.check(stats)) newlyUnlocked.push(b.id);
    });
    if (newlyUnlocked.length) {
      setUnlockedBadges([...unlockedBadges, ...newlyUnlocked]);
      setNewBadge(BADGE_DEFS.find((b) => b.id === newlyUnlocked[0]));
      setBadgeConfetti(makeConfettiBurst(14));
      vibrate([0, 30, 40, 30, 40, 60]);
      setTimeout(() => setNewBadge(null), 3200);
    }
  }

  function logCompletion() {
    if (!currentQuest) return;
    const entry = { id: Date.now(), questId: currentQuest.id, questText: currentQuest[lang] || currentQuest.en, category: currentQuest.category, difficulty: currentQuest.difficulty, reflection: reflection.trim(), photos: photoData, date: new Date().toISOString() };
    const newScrapbook = [entry, ...scrapbook];
    const newTotal = totalCompleted + 1;
    const newMaxDiff = Math.max(maxDifficultyDone, currentQuest.difficulty);
    const newCats = Array.from(new Set([...categoriesUsed, currentQuest.category]));
    const newLevel5Count = currentQuest.difficulty === 5 ? level5Count + 1 : level5Count;
    const newCategoryCounts = { ...categoryCounts, [currentQuest.category]: (categoryCounts[currentQuest.category] || 0) + 1 };

    // Streak counts once per calendar day, not per quest
    const today = todayKey();
    let newStreak = streak;
    if (lastCompletedDate === today) {
      newStreak = streak; // already logged today, streak unchanged
    } else if (lastCompletedDate && daysBetweenKeys(lastCompletedDate, today) === 1) {
      newStreak = streak + 1; // consecutive day
    } else {
      newStreak = 1; // first ever, or a day was missed
    }

    setScrapbook(newScrapbook);
    setXp(xp + currentQuest.difficulty * 15);
    setStreak(newStreak);
    setLastCompletedDate(today);
    setTotalCompleted(newTotal);
    setMaxDifficultyDone(newMaxDiff);
    setCategoriesUsed(newCats);
    setLevel5Count(newLevel5Count);
    setCategoryCounts(newCategoryCounts);

    // Satisfying feedback: sound, haptics, confetti, then close the panel
    playSuccessChime();
    vibrate([0, 25, 40, 25, 40, 80]);
    setConfetti(makeConfettiBurst());
    setJustSaved(true);
    setTimeout(() => setConfetti([]), 1300);
    setTimeout(() => {
      setJustSaved(false);
      setShowLogPanel(false); setCurrentQuest(null); setReflection(""); setPhotoData([]);
    }, 900);

    checkBadges({ totalCompleted: newTotal, streak: newStreak, maxDifficultyDone: newMaxDiff, level5Count: newLevel5Count, categoryCounts: newCategoryCounts, photoCount: photoCount + photoData.length, categoriesUsed: new Set(newCats), xp: xp + currentQuest.difficulty * 15 });
  }

  function drawShareCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 540; canvas.height = 960;
    ctx.fillStyle = theme.bg; ctx.fillRect(0, 0, 540, 960);
    const grad = ctx.createRadialGradient(270, 340, 40, 270, 340, 380);
    grad.addColorStop(0, theme.accent + "33"); grad.addColorStop(1, theme.bg);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 540, 960);

    ctx.fillStyle = theme.accent;
    ctx.font = "600 22px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("🔥", 270, 300);

    ctx.fillStyle = theme.text;
    ctx.font = "700 120px Georgia";
    ctx.fillText(String(streak), 270, 440);

    ctx.font = "500 26px Georgia";
    ctx.fillStyle = theme.accentSoft;
    ctx.fillText(lang === "de" ? "TAGE-SERIE" : "DAY STREAK", 270, 490);

    ctx.font = "400 18px Georgia";
    ctx.fillStyle = theme.muted;
    ctx.fillText(`${t.level} ${level} · ${xp} XP`, 270, 560);

    ctx.font = "600 20px Georgia";
    ctx.fillStyle = theme.accent;
    ctx.fillText(`· ${APP_NAME.toLowerCase()} ·`, 270, 900);
    setCardImageUrl(canvas.toDataURL("image/png"));
  }

  function openShareCard() {
    setShowShareCard(true);
    setCardImageUrl(null);
    setTimeout(drawShareCard, 50);
  }

  function downloadShareCard() {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL("image/png");
    try {
      const link = document.createElement("a");
      link.download = "streak-card.png";
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {}
    // Sandboxed previews often block the programmatic download above — opening
    // the image directly so it can be long-pressed and saved always works.
    const win = window.open();
    if (win) win.document.write(`<body style="margin:0;background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;"><img src="${dataUrl}" style="max-width:92vw;border-radius:16px;" /><p style="color:#aaa;margin-top:16px;">Press and hold the image to save it.</p></body>`);
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.4s ease, color 0.4s ease", paddingBottom: 120 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea, select { font-family: inherit; }
        .fraunces { font-family: 'Fraunces', serif; }
        @keyframes pop { 0% { transform: scale(0.9); opacity: 0; } 60% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes glowPulse { 0%,100% { filter: drop-shadow(0 0 22px ${theme.accent}33); } 50% { filter: drop-shadow(0 0 44px ${theme.accent}88); } }
        @keyframes badgeIn { 0% { transform: translateY(30px) scale(0.9); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        @keyframes confettiBurst { 0% { transform: translate(-50%, 0) rotate(0deg); opacity: 1; } 100% { transform: translate(calc(-50% + var(--tx)), 160px) rotate(var(--rot)); opacity: 0; } }
        @keyframes badgePop { 0% { transform: scale(0.3) translateY(40px) rotate(-8deg); opacity: 0; } 55% { transform: scale(1.15) translateY(-6px) rotate(4deg); opacity: 1; } 75% { transform: scale(0.96) rotate(-2deg); } 100% { transform: scale(1) rotate(0deg); } }
        @keyframes badgeRingPulse { 0%,100% { box-shadow: 0 0 0 0 var(--ring-color); } 50% { box-shadow: 0 0 0 10px transparent; } }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "6px 12px" }}>
            <Flame size={15} color={theme.accent} /><span style={{ fontSize: 13, fontWeight: 600 }}>{streak}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "6px 12px" }}>
            <Trophy size={15} color={theme.accent} /><span style={{ fontSize: 13, fontWeight: 600 }}>{t.level} {level}</span>
          </div>
          {streak > 0 && (
            <button onClick={openShareCard} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "6px 10px", display: "flex", alignItems: "center" }}>
              <Share2 size={14} color={theme.accent} />
            </button>
          )}
        </div>
      </div>

      {/* Tagline */}
      <div style={{ textAlign: "center", marginTop: 28, padding: "0 20px" }}>
        <div className="fraunces" style={{ fontSize: 26, fontWeight: 500 }}>{t.tagline}</div>
      </div>

      {/* Mood filter */}
      <div style={{ maxWidth: 420, margin: "22px auto 0", padding: "0 20px" }}>
        <div style={{ fontSize: 12.5, color: theme.muted, marginBottom: 8 }}>{t.howFeeling}</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={moodInput} onChange={(e) => setMoodInput(e.target.value)} placeholder={t.feelingPlaceholder} style={{ flex: 1, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "10px 14px", color: theme.text, fontSize: 13.5, outline: "none" }} />
          <button onClick={handleFilter} style={{ background: theme.accent, color: theme.bg, border: "none", borderRadius: 12, padding: "0 16px" }}><Sparkles size={15} /></button>
        </div>
        {activeMoodFilter && (
          <button onClick={clearFilter} style={{ marginTop: 8, background: "none", border: "none", color: theme.accentSoft, fontSize: 12, padding: 0, textDecoration: "underline" }}>{t.clearFilter} ({activeMoodFilter})</button>
        )}

        {/* Category + difficulty pickers */}
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 10px", color: theme.text, fontSize: 12.5 }}>
            <option value="all">{t.allCats}</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{t.categories[c]}</option>)}
          </select>
          <select value={difficultyFilter} onChange={(e) => setDifficultyFilter(e.target.value)} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 10px", color: theme.text, fontSize: 12.5 }}>
            <option value="all">{t.difficulty}: {t.any}</option>
            {[1, 2, 3, 4, 5].map((d) => <option key={d} value={d}>{t.difficulty} {d}</option>)}
          </select>
        </div>
      </div>

      {/* Wheel */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 36 }}>
        <div style={{ position: "relative", width: 280, height: 280 }}>
          <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: `16px solid ${theme.accent}`, zIndex: 5 }} />
          {/* Outer wrapper owns the landing "pop" bounce (scale only) so it never fights with the wheel's own rotation transform below */}
          <div style={{ width: "100%", height: "100%", animation: justLanded ? "pop 0.5s ease" : "none" }}>
            <svg viewBox="0 0 200 200" width="280" height="280" style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? "transform 4.2s cubic-bezier(0.15, 0.85, 0.25, 1)" : "none", filter: spinning ? undefined : "none", animation: spinning ? "glowPulse 1s ease-in-out infinite" : "none" }}>
            <defs>
              {CATEGORIES.map((c) => (
                <radialGradient key={c} id={`grad-${c}`} cx="35%" cy="35%" r="75%">
                  <stop offset="0%" stopColor={CATEGORY_COLORS[c]} stopOpacity="1" />
                  <stop offset="100%" stopColor={CATEGORY_COLORS[c]} stopOpacity="0.82" />
                </radialGradient>
              ))}
            </defs>
            <circle cx="100" cy="100" r="98" fill={theme.panel} stroke={theme.line} strokeWidth="1" />
            {wheelSlices.map((cat, i) => {
              const startAngle = (i * segAngle - 90) * (Math.PI / 180);
              const endAngle = ((i + 1) * segAngle - 90) * (Math.PI / 180);
              const midAngle = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
              const x1 = 100 + 96 * Math.cos(startAngle), y1 = 100 + 96 * Math.sin(startAngle);
              const x2 = 100 + 96 * Math.cos(endAngle), y2 = 100 + 96 * Math.sin(endAngle);
              const largeArc = segAngle > 180 ? 1 : 0;
              const ex = 100 + 62 * Math.cos(midAngle), ey = 100 + 62 * Math.sin(midAngle);
              return (
                <g key={i}>
                  <path d={`M100,100 L${x1},${y1} A96,96 0 ${largeArc} 1 ${x2},${y2} Z`} fill={`url(#grad-${cat})`} stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
                  <circle cx={ex} cy={ey} r="17" fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.12)" strokeWidth="0.6" />
                  <text x={ex} y={ey} textAnchor="middle" dominantBaseline="central" fontSize="20">{CATEGORY_EMOJI[cat]}</text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="26" fill={theme.bg} stroke={theme.accent} strokeWidth="1.5" />
            <text x="100" y="105" textAnchor="middle" fontSize="20">🎯</text>
          </svg>
          </div>
        </div>
        <button onClick={spin} disabled={spinning} style={{ marginTop: 28, background: theme.accent, color: theme.bg, border: "none", borderRadius: 30, padding: "14px 36px", fontSize: 15, fontWeight: 600, opacity: spinning ? 0.6 : 1 }}>
          {spinning ? t.spinning : t.spin}
        </button>
      </div>

      {/* Quest result */}
      {currentQuest && !spinning && (
        <div style={{ maxWidth: 420, margin: "28px auto 0", padding: "0 20px", animation: "pop 0.4s ease", position: "relative" }}>
          {confetti.map((c) => (
            <span key={c.id} style={{ position: "absolute", left: "50%", top: 20, fontSize: c.size, pointerEvents: "none", animation: `confettiBurst 1.1s ease-out ${c.delay}s forwards`, "--tx": `${c.x}px`, "--rot": `${c.rot}deg`, zIndex: 40 }}>{c.emoji}</span>
          ))}
          <div style={{ background: theme.panel, border: `1px solid ${justSaved ? theme.accent : theme.accent + "55"}`, borderRadius: 18, padding: 22, transition: "all 0.3s ease", transform: justSaved ? "scale(1.02)" : "scale(1)", boxShadow: justSaved ? `0 0 40px ${theme.accent}55` : "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: theme.accentSoft, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 15 }}>{CATEGORY_EMOJI[currentQuest.category]}</span>
                {t.todaysQuest} · {t.categories[currentQuest.category]}
              </div>
              <span style={{ fontSize: 16 }}>{DIFFICULTY_EMOJI[currentQuest.difficulty - 1]}</span>
            </div>
            <div className="fraunces" style={{ fontSize: 19, lineHeight: 1.4, marginBottom: 18 }}>{currentQuest[lang] || currentQuest.en}</div>

            {justSaved ? (
              <div style={{ width: "100%", padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, animation: "badgeIn 0.35s ease" }}>
                <span style={{ fontSize: 26 }}>✅</span>
                <span style={{ fontWeight: 600, fontSize: 15, color: theme.accent }}>+{currentQuest.difficulty * 15} XP</span>
              </div>
            ) : !showLogPanel ? (
              <button onClick={() => setShowLogPanel(true)} style={{ width: "100%", background: theme.accent, color: theme.bg, border: "none", borderRadius: 12, padding: "12px 0", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Check size={16} /> {t.complete}
              </button>
            ) : (
              <div>
                <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder={t.reflectionPlaceholder} rows={2} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: 10, color: theme.text, fontSize: 13.5, resize: "none", outline: "none", marginBottom: 10 }} />
                {photoData.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
                    {photoData.map((p, i) => (
                      <div key={i} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden" }}>
                        <img src={p} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                        <button onClick={() => removePhotoAt(i)} style={{ position: "absolute", top: 3, right: 3, background: theme.bg + "cc", border: "none", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}><X size={11} color={theme.text} /></button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} style={{ display: "none" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: photoData.length ? theme.accentSoft : theme.panelSoft, color: photoData.length ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 0", fontSize: 12.5 }}>
                    <Camera size={14} /> {t.addPhoto}{photoData.length > 0 ? ` (${photoData.length})` : ""}
                  </button>
                  <button onClick={logCompletion} style={{ flex: 1, background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600 }}>{t.save}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badge unlock toast */}
      {newBadge && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, pointerEvents: "none" }}>
          <div style={{ position: "relative", background: theme.panel, border: `2px solid ${theme.accent}`, borderRadius: 22, padding: "26px 32px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, boxShadow: `0 20px 60px ${theme.accent}66`, animation: "badgePop 0.6s cubic-bezier(0.34,1.56,0.64,1)" }}>
            <span style={{ fontSize: 52, filter: `drop-shadow(0 0 14px ${theme.accent}aa)` }}>{newBadge.icon}</span>
            <div style={{ fontSize: 11, color: theme.accentSoft, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{lang === "de" ? "Abzeichen freigeschaltet!" : "Badge unlocked!"}</div>
            <div className="fraunces" style={{ fontWeight: 600, fontSize: 18 }}>{newBadge[lang] || newBadge.en}</div>
            {badgeConfetti.map((c) => (
              <span key={c.id} style={{ position: "absolute", left: "50%", top: "30%", fontSize: c.size, animation: `confettiBurst 1s ease-out ${c.delay}s forwards`, "--tx": `${c.x}px`, "--rot": `${c.rot}deg` }}>{c.emoji}</span>
            ))}
          </div>
        </div>
      )}

      {/* XP bar */}
      <div style={{ maxWidth: 420, margin: "28px auto 0", padding: "0 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: theme.muted, marginBottom: 6 }}><span>{t.level} {level}</span><span>{xpIntoLevel} / 100 {t.xp}</span></div>
        <div style={{ height: 6, background: theme.panelSoft, borderRadius: 4, overflow: "hidden" }}><div style={{ width: `${xpIntoLevel}%`, height: "100%", background: theme.accent, transition: "width 0.5s ease" }} /></div>
      </div>

      {/* Badges — collapsed by default, tap to open the full panel */}
      <div style={{ maxWidth: 420, margin: "30px auto 0", padding: "0 20px" }}>
        <button
          onClick={() => setBadgePanelOpen(!badgePanelOpen)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: "14px 16px", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={18} color={theme.accent} />
            <div>
              <div className="fraunces" style={{ fontSize: 15.5 }}>{t.badges}</div>
              <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 1 }}>{unlockedBadges.length} / {BADGE_DEFS.length}</div>
            </div>
          </div>
          <span style={{ fontSize: 18, color: theme.accentSoft, transform: badgePanelOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>⌄</span>
        </button>

        {badgePanelOpen && (
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10, animation: "pop 0.3s ease" }}>
            {BADGE_DEFS.map((b) => {
              const unlocked = unlockedBadges.includes(b.id);
              const progressVal = unlocked ? b.target : Math.min(b.progress ? b.progress({ totalCompleted, streak, level5Count, categoryCounts, photoCount, categoriesUsed: new Set(categoriesUsed), xp }) : 0, b.target);
              const pct = Math.round((progressVal / b.target) * 100);
              return (
                <div key={b.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: unlocked ? theme.panel : theme.panelSoft, border: `1px solid ${unlocked ? theme.accent + "77" : theme.line}`, borderRadius: 14, padding: "12px 8px", boxShadow: unlocked ? `0 4px 18px ${theme.accent}33` : "none" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: unlocked ? `radial-gradient(circle, ${theme.accent}33, transparent 70%)` : "transparent" }}>
                    {unlocked ? b.icon : <span style={{ opacity: 0.35 }}>🔒</span>}
                  </div>
                  <div style={{ fontSize: 9.5, textAlign: "center", lineHeight: 1.2, color: unlocked ? theme.text : theme.muted, fontWeight: unlocked ? 600 : 400, minHeight: 22 }}>
                    {unlocked ? (b[lang] || b.en) : (b[lang] || b.en)}
                  </div>
                  {!unlocked && (
                    <div style={{ width: "100%" }}>
                      <div style={{ height: 3, background: theme.line, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: theme.accent, opacity: 0.6 }} />
                      </div>
                      <div style={{ fontSize: 8.5, color: theme.muted, textAlign: "center", marginTop: 3 }}>{progressVal}/{b.target}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Scrapbook — collapsed by default, opens into a mini calendar */}
      <div style={{ maxWidth: 420, margin: "16px auto 0", padding: "0 20px" }}>
        <button
          onClick={() => { setScrapbookOpen(!scrapbookOpen); setSelectedDay(null); }}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: "14px 16px", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>📔</span>
            <div>
              <div className="fraunces" style={{ fontSize: 15.5 }}>{t.scrapbook}</div>
              <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 1 }}>{scrapbook.length}</div>
            </div>
          </div>
          <span style={{ fontSize: 18, color: theme.accentSoft, transform: scrapbookOpen ? "rotate(180deg)" : "none", transition: "transform 0.25s ease" }}>⌄</span>
        </button>

        {scrapbookOpen && (
          <div style={{ marginTop: 10, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, animation: "pop 0.3s ease" }}>
            {scrapbook.length === 0 ? (
              <div style={{ fontSize: 13, color: theme.muted }}>{t.noEntries}</div>
            ) : (
              <>
                {/* Month nav */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <button onClick={() => setCalendarMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 28, height: 28, color: theme.text, fontSize: 14 }}>‹</button>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{calendarMonth.toLocaleDateString(localeFor(lang), { month: "long", year: "numeric" })}</div>
                  <button onClick={() => setCalendarMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 28, height: 28, color: theme.text, fontSize: 14 }}>›</button>
                </div>

                {/* Weekday headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} style={{ textAlign: "center", fontSize: 10, color: theme.muted }}>{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                {(() => {
                  const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
                  const firstDayOfWeek = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const entriesByDate = {};
                  scrapbook.forEach((e) => {
                    const k = dateKeyFor(new Date(e.date));
                    if (!entriesByDate[k]) entriesByDate[k] = [];
                    entriesByDate[k].push(e);
                  });
                  const cells = [];
                  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
                  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

                  return (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                      {cells.map((day, i) => {
                        if (day === null) return <div key={i} />;
                        const cellDate = new Date(year, month, day);
                        const k = dateKeyFor(cellDate);
                        const hasEntries = !!entriesByDate[k];
                        const isToday = k === todayKey();
                        const isSelected = k === selectedDay;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedDay(isSelected ? null : k)}
                            style={{
                              aspectRatio: "1", borderRadius: 8, border: isToday ? `1px solid ${theme.accent}` : "1px solid transparent",
                              background: isSelected ? theme.accent : hasEntries ? theme.accent + "26" : "transparent",
                              color: isSelected ? theme.bg : theme.text, fontSize: 11.5, fontWeight: hasEntries ? 600 : 400,
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                            }}
                          >
                            {day}
                            {hasEntries && !isSelected && <span style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: "50%", background: theme.accent }} />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Selected day detail */}
                {selectedDay && (
                  <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    {scrapbook.filter((e) => dateKeyFor(new Date(e.date)) === selectedDay).length === 0 ? (
                      <div style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 12, padding: 14, textAlign: "center" }}>
                        <div style={{ fontSize: 12.5, color: theme.muted }}>
                          {new Date(selectedDay).toLocaleDateString(localeFor(lang), { weekday: "long", month: "long", day: "numeric" })}
                        </div>
                        <div style={{ fontSize: 12.5, color: theme.muted, marginTop: 4 }}>
                          {lang === "de" ? "Keine Aufgabe an diesem Tag." : "No quest logged this day."}
                        </div>
                      </div>
                    ) : scrapbook.filter((e) => dateKeyFor(new Date(e.date)) === selectedDay).map((entry) => (
                      <div key={entry.id} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 12, padding: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.accentSoft }}>{t.categories[entry.category]}</span>
                          <span style={{ fontSize: 11, color: theme.muted }}>{new Date(entry.date).toLocaleDateString(localeFor(lang))}</span>
                        </div>
                        <div style={{ fontSize: 13.5, marginBottom: entry.reflection || (entry.photos && entry.photos.length) ? 8 : 0 }}>{entry.questText}</div>
                        {entry.reflection && <div style={{ fontSize: 12.5, color: theme.muted, fontStyle: "italic", marginBottom: entry.photos && entry.photos.length ? 8 : 0 }}>"{entry.reflection}"</div>}
                        {entry.photos && entry.photos.length > 0 && (
                          <div style={{ display: "grid", gridTemplateColumns: entry.photos.length === 1 ? "1fr" : "repeat(2, 1fr)", gap: 6 }}>
                            {entry.photos.map((p, i) => (
                              <img key={i} src={p} alt="" style={{ width: "100%", borderRadius: 8, display: "block", aspectRatio: entry.photos.length === 1 ? "auto" : "1", objectFit: "cover" }} />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Share card modal */}
      {showShareCard && (
        <div onClick={() => setShowShareCard(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: theme.panel, borderRadius: 20, padding: 20, maxWidth: 320 }}>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            {cardImageUrl ? (
              <img src={cardImageUrl} alt="" style={{ width: "100%", borderRadius: 14, display: "block", marginBottom: 8 }} />
            ) : (
              <div style={{ width: "100%", aspectRatio: "0.5625", borderRadius: 14, background: theme.panelSoft, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center", color: theme.muted, fontSize: 12 }}>…</div>
            )}
            <div style={{ fontSize: 11, color: theme.muted, textAlign: "center", marginBottom: 12 }}>{lang === "de" ? "Zum Speichern gedrückt halten" : "Press and hold the image to save it"}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowShareCard(false)} style={{ flex: 1, background: theme.panelSoft, color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 0", fontSize: 13 }}><X size={14} style={{ verticalAlign: "middle" }} /></button>
              <button onClick={downloadShareCard} style={{ flex: 3, background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600 }}>{t.download}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


const TODO_STRINGS = {
  en: {
    todo: "To-Do", templates: "Templates",
    addTask: "Add a task…", due: "Due", noDue: "No date", repeat: "Repeat",
    none: "None", daily: "Daily", weekly: "Weekly", custom: "Custom",
    today: "Today", upcoming: "Upcoming", noTasks: "Nothing here yet.",
    listView: "List", calendarView: "Calendar",
    focusTimer: "Focus Timer", work: "Focus", short: "Break", start: "Start", pause: "Pause", reset: "Reset", sessionsToday: "focus blocks today",
    browseTemplates: "Browse templates", createCustom: "Create your own",
    templateName: "Template name…", step: "Step", addStep: "Add step", save: "Save", cancel: "Cancel",
    stepPlaceholder: "e.g. Cleanse face", deleteTemplate: "Delete",
    noStepsYet: "Add at least one step.", customLabel: "Custom",
    categories: { skincare: "Skincare", hygiene: "Hygiene", cleaning: "Cleaning", exercise: "Exercise", life: "Life Hacks", diy: "DIY", relax: "Relax", school: "Back to School" },
    date: "Date", time: "Time", noTime: "No time", remind: "Remind", noReminder: "No reminder",
    edit: "Edit", delete: "Delete", weekdaysShort: ["S", "M", "T", "W", "T", "F", "S"],
    reminderAt: "At due time", reminder10: "10 min before", reminder30: "30 min before", reminder60: "1 hour before", reminder1440: "1 day before", reminder10080: "1 week before", reminder20160: "2 weeks before",
    enableNotifs: "Reminders need notification access — tap to allow.", notifNote: "In this preview, reminders show as an in-app banner + sound + vibration (works while the tab is open). Real phone push notifications work once this is running as the deployed app.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Deep Work 50/10", presetQuick: "Quick 15/3", presetCustom: "Custom",
    focusMins: "Focus (min)", breakMins: "Break (min)", saveEdit: "Save changes",
    addForThisDay: "Add a task for this day…",
    totalSession: "Focus time (min)", numBreaks: "Number of breaks", breakLenEach: "Each break (min)",
    sessionPreview: "{work} min focus split into {segs} blocks, + {breaks} break(s) of {brk} min — {total} min total",
    addToTodo: "Add to To-Do", addedToTodo: "In your To-Do", stepsOf: "steps",
    remindUnit: { minutes: "minutes", hours: "hours", days: "days", weeks: "weeks" },
    before: "before", sessionDone: "Session complete!",
  },
  de: {
    todo: "To-Do", templates: "Vorlagen",
    addTask: "Aufgabe hinzufügen…", due: "Fällig", noDue: "Kein Datum", repeat: "Wiederholen",
    none: "Keine", daily: "Täglich", weekly: "Wöchentlich", custom: "Benutzerdefiniert",
    today: "Heute", upcoming: "Demnächst", noTasks: "Noch nichts hier.",
    listView: "Liste", calendarView: "Kalender",
    focusTimer: "Fokus-Timer", work: "Fokus", short: "Pause", start: "Start", pause: "Pause", reset: "Zurücksetzen", sessionsToday: "Fokusblöcke heute",
    browseTemplates: "Vorlagen durchsuchen", createCustom: "Eigene erstellen",
    templateName: "Name der Vorlage…", step: "Schritt", addStep: "Schritt hinzufügen", save: "Speichern", cancel: "Abbrechen",
    stepPlaceholder: "z.B. Gesicht reinigen", deleteTemplate: "Löschen",
    noStepsYet: "Füge mindestens einen Schritt hinzu.", customLabel: "Eigene",
    categories: { skincare: "Hautpflege", hygiene: "Hygiene", cleaning: "Putzen", exercise: "Sport", life: "Life Hacks", diy: "DIY", relax: "Entspannung", school: "Schulstart" },
    date: "Datum", time: "Uhrzeit", noTime: "Keine Uhrzeit", remind: "Erinnern", noReminder: "Keine Erinnerung",
    edit: "Bearbeiten", delete: "Löschen", weekdaysShort: ["S", "M", "D", "M", "D", "F", "S"],
    reminderAt: "Zur Fälligkeit", reminder10: "10 Min. vorher", reminder30: "30 Min. vorher", reminder60: "1 Std. vorher", reminder1440: "1 Tag vorher", reminder10080: "1 Woche vorher", reminder20160: "2 Wochen vorher",
    enableNotifs: "Erinnerungen brauchen Benachrichtigungszugriff — tippen zum Erlauben.", notifNote: "In dieser Vorschau erscheinen Erinnerungen als Banner + Ton + Vibration (funktioniert, solange der Tab offen ist). Echte Push-Benachrichtigungen kommen mit der veröffentlichten App.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Deep Work 50/10", presetQuick: "Schnell 15/3", presetCustom: "Eigene",
    focusMins: "Fokus (Min.)", breakMins: "Pause (Min.)", saveEdit: "Änderungen speichern",
    addForThisDay: "Aufgabe für diesen Tag hinzufügen…",
    totalSession: "Fokuszeit (Min.)", numBreaks: "Anzahl Pausen", breakLenEach: "Jede Pause (Min.)",
    sessionPreview: "{work} Min. Fokus in {segs} Blöcken, + {breaks} Pause(n) à {brk} Min. — {total} Min. gesamt",
    addToTodo: "Zur To-Do hinzufügen", addedToTodo: "In deiner To-Do", stepsOf: "Schritte",
    remindUnit: { minutes: "Minuten", hours: "Stunden", days: "Tage", weeks: "Wochen" },
    before: "vorher", sessionDone: "Sitzung abgeschlossen!",
  },
  es: {
    todo: "Tareas", templates: "Plantillas",
    addTask: "Añadir una tarea…", due: "Vence", noDue: "Sin fecha", repeat: "Repetir",
    none: "Ninguna", daily: "Diaria", weekly: "Semanal", custom: "Personalizada",
    today: "Hoy", upcoming: "Próximas", noTasks: "Nada aquí todavía.",
    listView: "Lista", calendarView: "Calendario",
    focusTimer: "Temporizador de enfoque", work: "Enfoque", short: "Descanso", start: "Iniciar", pause: "Pausar", reset: "Reiniciar", sessionsToday: "bloques de enfoque hoy",
    browseTemplates: "Explorar plantillas", createCustom: "Crear la tuya",
    templateName: "Nombre de la plantilla…", step: "Paso", addStep: "Añadir paso", save: "Guardar", cancel: "Cancelar",
    stepPlaceholder: "p. ej. Limpiar el rostro", deleteTemplate: "Eliminar",
    noStepsYet: "Añade al menos un paso.", customLabel: "Personalizada",
    categories: { skincare: "Cuidado de la piel", hygiene: "Higiene", cleaning: "Limpieza", exercise: "Ejercicio", life: "Trucos útiles", diy: "Manualidades", relax: "Relajación", school: "Vuelta al cole" },
    date: "Fecha", time: "Hora", noTime: "Sin hora", remind: "Recordar", noReminder: "Sin recordatorio",
    edit: "Editar", delete: "Eliminar", weekdaysShort: ["D", "L", "M", "X", "J", "V", "S"],
    reminderAt: "A la hora de vencimiento", reminder10: "10 min antes", reminder30: "30 min antes", reminder60: "1 hora antes", reminder1440: "1 día antes", reminder10080: "1 semana antes", reminder20160: "2 semanas antes",
    enableNotifs: "Los recordatorios necesitan acceso a notificaciones — toca para permitir.", notifNote: "En esta vista previa, los recordatorios aparecen como un aviso dentro de la app + sonido + vibración (funciona mientras la pestaña esté abierta). Las notificaciones push reales funcionarán cuando esta app esté publicada.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Trabajo profundo 50/10", presetQuick: "Rápido 15/3", presetCustom: "Personalizado",
    focusMins: "Enfoque (min)", breakMins: "Descanso (min)", saveEdit: "Guardar cambios",
    addForThisDay: "Añadir una tarea para este día…",
    totalSession: "Tiempo de enfoque (min)", numBreaks: "Número de descansos", breakLenEach: "Cada descanso (min)",
    sessionPreview: "{work} min de enfoque divididos en {segs} bloques, + {breaks} descanso(s) de {brk} min — {total} min en total",
    addToTodo: "Añadir a Tareas", addedToTodo: "En tus Tareas", stepsOf: "pasos",
    remindUnit: { minutes: "minutos", hours: "horas", days: "días", weeks: "semanas" },
    before: "antes", sessionDone: "¡Sesión completada!",
  },
  fr: {
    todo: "Tâches", templates: "Modèles",
    addTask: "Ajouter une tâche…", due: "Échéance", noDue: "Aucune date", repeat: "Répéter",
    none: "Aucune", daily: "Quotidienne", weekly: "Hebdomadaire", custom: "Personnalisée",
    today: "Aujourd'hui", upcoming: "À venir", noTasks: "Rien ici pour l'instant.",
    listView: "Liste", calendarView: "Calendrier",
    focusTimer: "Minuteur de concentration", work: "Concentration", short: "Pause", start: "Démarrer", pause: "Pause", reset: "Réinitialiser", sessionsToday: "blocs de concentration aujourd'hui",
    browseTemplates: "Parcourir les modèles", createCustom: "Créer le tien",
    templateName: "Nom du modèle…", step: "Étape", addStep: "Ajouter une étape", save: "Enregistrer", cancel: "Annuler",
    stepPlaceholder: "ex. Nettoyer le visage", deleteTemplate: "Supprimer",
    noStepsYet: "Ajoute au moins une étape.", customLabel: "Personnalisé",
    categories: { skincare: "Soins de la peau", hygiene: "Hygiène", cleaning: "Ménage", exercise: "Exercice", life: "Astuces pratiques", diy: "Bricolage", relax: "Détente", school: "Rentrée scolaire" },
    date: "Date", time: "Heure", noTime: "Aucune heure", remind: "Rappeler", noReminder: "Aucun rappel",
    edit: "Modifier", delete: "Supprimer", weekdaysShort: ["D", "L", "M", "M", "J", "V", "S"],
    reminderAt: "À l'heure d'échéance", reminder10: "10 min avant", reminder30: "30 min avant", reminder60: "1 heure avant", reminder1440: "1 jour avant", reminder10080: "1 semaine avant", reminder20160: "2 semaines avant",
    enableNotifs: "Les rappels nécessitent l'accès aux notifications — touche pour autoriser.", notifNote: "Dans cet aperçu, les rappels s'affichent comme une bannière dans l'app + son + vibration (fonctionne tant que l'onglet est ouvert). Les vraies notifications push fonctionneront une fois l'app publiée.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Travail profond 50/10", presetQuick: "Rapide 15/3", presetCustom: "Personnalisé",
    focusMins: "Concentration (min)", breakMins: "Pause (min)", saveEdit: "Enregistrer les modifications",
    addForThisDay: "Ajouter une tâche pour ce jour…",
    totalSession: "Temps de concentration (min)", numBreaks: "Nombre de pauses", breakLenEach: "Chaque pause (min)",
    sessionPreview: "{work} min de concentration divisées en {segs} blocs, + {breaks} pause(s) de {brk} min — {total} min au total",
    addToTodo: "Ajouter aux Tâches", addedToTodo: "Dans tes Tâches", stepsOf: "étapes",
    remindUnit: { minutes: "minutes", hours: "heures", days: "jours", weeks: "semaines" },
    before: "avant", sessionDone: "Session terminée !",
  },
  it: {
    todo: "Da fare", templates: "Modelli",
    addTask: "Aggiungi un'attività…", due: "Scadenza", noDue: "Nessuna data", repeat: "Ripeti",
    none: "Nessuna", daily: "Giornaliera", weekly: "Settimanale", custom: "Personalizzata",
    today: "Oggi", upcoming: "Prossime", noTasks: "Ancora nulla qui.",
    listView: "Elenco", calendarView: "Calendario",
    focusTimer: "Timer di concentrazione", work: "Concentrazione", short: "Pausa", start: "Avvia", pause: "Pausa", reset: "Reimposta", sessionsToday: "blocchi di concentrazione oggi",
    browseTemplates: "Sfoglia modelli", createCustom: "Crea il tuo",
    templateName: "Nome del modello…", step: "Passaggio", addStep: "Aggiungi passaggio", save: "Salva", cancel: "Annulla",
    stepPlaceholder: "es. Detergi il viso", deleteTemplate: "Elimina",
    noStepsYet: "Aggiungi almeno un passaggio.", customLabel: "Personalizzato",
    categories: { skincare: "Skincare", hygiene: "Igiene", cleaning: "Pulizie", exercise: "Esercizio", life: "Trucchi utili", diy: "Fai da te", relax: "Relax", school: "Ritorno a scuola" },
    date: "Data", time: "Ora", noTime: "Nessun orario", remind: "Ricorda", noReminder: "Nessun promemoria",
    edit: "Modifica", delete: "Elimina", weekdaysShort: ["D", "L", "M", "M", "G", "V", "S"],
    reminderAt: "All'orario di scadenza", reminder10: "10 min prima", reminder30: "30 min prima", reminder60: "1 ora prima", reminder1440: "1 giorno prima", reminder10080: "1 settimana prima", reminder20160: "2 settimane prima",
    enableNotifs: "I promemoria richiedono l'accesso alle notifiche — tocca per consentire.", notifNote: "In questa anteprima, i promemoria appaiono come un banner nell'app + suono + vibrazione (funziona finché la scheda è aperta). Le notifiche push reali funzioneranno una volta pubblicata l'app.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Lavoro profondo 50/10", presetQuick: "Veloce 15/3", presetCustom: "Personalizzato",
    focusMins: "Concentrazione (min)", breakMins: "Pausa (min)", saveEdit: "Salva modifiche",
    addForThisDay: "Aggiungi un'attività per questo giorno…",
    totalSession: "Tempo di concentrazione (min)", numBreaks: "Numero di pause", breakLenEach: "Ogni pausa (min)",
    sessionPreview: "{work} min di concentrazione divisi in {segs} blocchi, + {breaks} pausa/e di {brk} min — {total} min totali",
    addToTodo: "Aggiungi a Da fare", addedToTodo: "Nel tuo Da fare", stepsOf: "passaggi",
    remindUnit: { minutes: "minuti", hours: "ore", days: "giorni", weeks: "settimane" },
    before: "prima", sessionDone: "Sessione completata!",
  },
  pt: {
    todo: "Tarefas", templates: "Modelos",
    addTask: "Adicionar uma tarefa…", due: "Vencimento", noDue: "Sem data", repeat: "Repetir",
    none: "Nenhuma", daily: "Diária", weekly: "Semanal", custom: "Personalizada",
    today: "Hoje", upcoming: "Próximas", noTasks: "Nada aqui ainda.",
    listView: "Lista", calendarView: "Calendário",
    focusTimer: "Cronômetro de foco", work: "Foco", short: "Pausa", start: "Iniciar", pause: "Pausar", reset: "Reiniciar", sessionsToday: "blocos de foco hoje",
    browseTemplates: "Explorar modelos", createCustom: "Criar o seu",
    templateName: "Nome do modelo…", step: "Etapa", addStep: "Adicionar etapa", save: "Salvar", cancel: "Cancelar",
    stepPlaceholder: "ex. Limpar o rosto", deleteTemplate: "Excluir",
    noStepsYet: "Adicione pelo menos uma etapa.", customLabel: "Personalizado",
    categories: { skincare: "Cuidados com a pele", hygiene: "Higiene", cleaning: "Limpeza", exercise: "Exercício", life: "Dicas práticas", diy: "Faça você mesmo", relax: "Relaxamento", school: "Volta às aulas" },
    date: "Data", time: "Hora", noTime: "Sem horário", remind: "Lembrar", noReminder: "Sem lembrete",
    edit: "Editar", delete: "Excluir", weekdaysShort: ["D", "S", "T", "Q", "Q", "S", "S"],
    reminderAt: "No horário de vencimento", reminder10: "10 min antes", reminder30: "30 min antes", reminder60: "1 hora antes", reminder1440: "1 dia antes", reminder10080: "1 semana antes", reminder20160: "2 semanas antes",
    enableNotifs: "Os lembretes precisam de acesso a notificações — toque para permitir.", notifNote: "Nesta prévia, os lembretes aparecem como um banner no app + som + vibração (funciona enquanto a aba estiver aberta). Notificações push reais funcionarão quando este app estiver publicado.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Trabalho profundo 50/10", presetQuick: "Rápido 15/3", presetCustom: "Personalizado",
    focusMins: "Foco (min)", breakMins: "Pausa (min)", saveEdit: "Salvar alterações",
    addForThisDay: "Adicionar uma tarefa para este dia…",
    totalSession: "Tempo de foco (min)", numBreaks: "Número de pausas", breakLenEach: "Cada pausa (min)",
    sessionPreview: "{work} min de foco divididos em {segs} blocos, + {breaks} pausa(s) de {brk} min — {total} min no total",
    addToTodo: "Adicionar às Tarefas", addedToTodo: "Nas suas Tarefas", stepsOf: "etapas",
    remindUnit: { minutes: "minutos", hours: "horas", days: "dias", weeks: "semanas" },
    before: "antes", sessionDone: "Sessão concluída!",
  },
  tr: {
    todo: "Yapılacaklar", templates: "Şablonlar",
    addTask: "Görev ekle…", due: "Son tarih", noDue: "Tarih yok", repeat: "Tekrarla",
    none: "Yok", daily: "Günlük", weekly: "Haftalık", custom: "Özel",
    today: "Bugün", upcoming: "Yaklaşan", noTasks: "Burada henüz bir şey yok.",
    listView: "Liste", calendarView: "Takvim",
    focusTimer: "Odak Zamanlayıcısı", work: "Odak", short: "Mola", start: "Başlat", pause: "Duraklat", reset: "Sıfırla", sessionsToday: "bugünkü odak bloğu",
    browseTemplates: "Şablonlara göz at", createCustom: "Kendi şablonunu oluştur",
    templateName: "Şablon adı…", step: "Adım", addStep: "Adım ekle", save: "Kaydet", cancel: "İptal",
    stepPlaceholder: "örn. Yüzü temizle", deleteTemplate: "Sil",
    noStepsYet: "En az bir adım ekle.", customLabel: "Özel",
    categories: { skincare: "Cilt Bakımı", hygiene: "Hijyen", cleaning: "Temizlik", exercise: "Egzersiz", life: "Yaşam İpuçları", diy: "Kendin Yap", relax: "Rahatlama", school: "Okula Dönüş" },
    date: "Tarih", time: "Saat", noTime: "Saat yok", remind: "Hatırlat", noReminder: "Hatırlatıcı yok",
    edit: "Düzenle", delete: "Sil", weekdaysShort: ["P", "P", "S", "Ç", "P", "C", "C"],
    reminderAt: "Son tarihte", reminder10: "10 dk önce", reminder30: "30 dk önce", reminder60: "1 saat önce", reminder1440: "1 gün önce", reminder10080: "1 hafta önce", reminder20160: "2 hafta önce",
    enableNotifs: "Hatırlatıcılar bildirim erişimi gerektirir — izin vermek için dokun.", notifNote: "Bu önizlemede hatırlatıcılar uygulama içi banner + ses + titreşim olarak gösterilir (sekme açıkken çalışır). Gerçek telefon bildirimleri uygulama yayınlandığında çalışacaktır.",
    presetPomodoro: "Pomodoro 25/5", presetDeep: "Derin Çalışma 50/10", presetQuick: "Hızlı 15/3", presetCustom: "Özel",
    focusMins: "Odak (dk)", breakMins: "Mola (dk)", saveEdit: "Değişiklikleri kaydet",
    addForThisDay: "Bu gün için bir görev ekle…",
    totalSession: "Odak süresi (dk)", numBreaks: "Mola sayısı", breakLenEach: "Her mola (dk)",
    sessionPreview: "{work} dk odak, {segs} bloğa bölündü, + {brk} dk'lık {breaks} mola — toplam {total} dk",
    addToTodo: "Yapılacaklara ekle", addedToTodo: "Yapılacaklarında", stepsOf: "adım",
    remindUnit: { minutes: "dakika", hours: "saat", days: "gün", weeks: "hafta" },
    before: "önce", sessionDone: "Oturum tamamlandı!",
  },
  ar: {
    todo: "المهام", templates: "القوالب",
    addTask: "إضافة مهمة…", due: "الاستحقاق", noDue: "بدون تاريخ", repeat: "التكرار",
    none: "بدون", daily: "يومي", weekly: "أسبوعي", custom: "مخصص",
    today: "اليوم", upcoming: "القادمة", noTasks: "لا شيء هنا بعد.",
    listView: "قائمة", calendarView: "تقويم",
    focusTimer: "مؤقت التركيز", work: "تركيز", short: "استراحة", start: "بدء", pause: "إيقاف مؤقت", reset: "إعادة ضبط", sessionsToday: "فترات تركيز اليوم",
    browseTemplates: "تصفح القوالب", createCustom: "أنشئ قالبك الخاص",
    templateName: "اسم القالب…", step: "خطوة", addStep: "إضافة خطوة", save: "حفظ", cancel: "إلغاء",
    stepPlaceholder: "مثال: تنظيف الوجه", deleteTemplate: "حذف",
    noStepsYet: "أضف خطوة واحدة على الأقل.", customLabel: "مخصص",
    categories: { skincare: "العناية بالبشرة", hygiene: "النظافة", cleaning: "التنظيف", exercise: "التمارين", life: "حيل عملية", diy: "اصنع بنفسك", relax: "الاسترخاء", school: "العودة للمدرسة" },
    date: "التاريخ", time: "الوقت", noTime: "بدون وقت", remind: "تذكير", noReminder: "بدون تذكير",
    edit: "تعديل", delete: "حذف", weekdaysShort: ["ح", "ن", "ث", "ر", "خ", "ج", "س"],
    reminderAt: "في وقت الاستحقاق", reminder10: "قبل 10 دقائق", reminder30: "قبل 30 دقيقة", reminder60: "قبل ساعة", reminder1440: "قبل يوم", reminder10080: "قبل أسبوع", reminder20160: "قبل أسبوعين",
    enableNotifs: "تحتاج التذكيرات إلى إذن الإشعارات — اضغط للسماح.", notifNote: "في هذه المعاينة، تظهر التذكيرات كشريط داخل التطبيق + صوت + اهتزاز (يعمل طالما التبويب مفتوح). ستعمل إشعارات الهاتف الحقيقية عند نشر التطبيق.",
    presetPomodoro: "بومودورو 25/5", presetDeep: "عمل عميق 50/10", presetQuick: "سريع 15/3", presetCustom: "مخصص",
    focusMins: "التركيز (دقيقة)", breakMins: "الاستراحة (دقيقة)", saveEdit: "حفظ التغييرات",
    addForThisDay: "إضافة مهمة لهذا اليوم…",
    totalSession: "وقت التركيز (دقيقة)", numBreaks: "عدد الاستراحات", breakLenEach: "كل استراحة (دقيقة)",
    sessionPreview: "{work} دقيقة تركيز مقسمة إلى {segs} فترات، + {breaks} استراحة مدة كل منها {brk} دقيقة — الإجمالي {total} دقيقة",
    addToTodo: "إضافة إلى المهام", addedToTodo: "في مهامك", stepsOf: "خطوات",
    remindUnit: { minutes: "دقائق", hours: "ساعات", days: "أيام", weeks: "أسابيع" },
    before: "قبل", sessionDone: "اكتملت الجلسة!",
  },
};

const PREBUILT_TEMPLATES = [
  { id: "skincare-am", category: "skincare", icon: "☀️", en: { title: "Morning Skincare", steps: ["Cleanse face", "Apply toner", "Vitamin C serum", "Moisturizer", "SPF"] }, de: { title: "Morgen-Hautpflege", steps: ["Gesicht reinigen", "Toner auftragen", "Vitamin-C-Serum", "Feuchtigkeitscreme", "Sonnenschutz"] }, es: { title: "Rutina de Mañana", steps: ["Limpiar el rostro", "Aplicar tónico", "Sérum de vitamina C", "Hidratante", "Protector solar"] }, fr: { title: "Soin du Matin", steps: ["Nettoyer le visage", "Appliquer un tonique", "Sérum à la vitamine C", "Hydratant", "SPF"] }, it: { title: "Skincare Mattutina", steps: ["Detergere il viso", "Applicare il tonico", "Siero alla vitamina C", "Idratante", "SPF"] }, pt: { title: "Skincare da Manhã", steps: ["Limpar o rosto", "Aplicar tônico", "Sérum de vitamina C", "Hidratante", "Protetor solar"] }, tr: { title: "Sabah Cilt Bakımı", steps: ["Yüzü temizle", "Tonik uygula", "C vitamini serumu", "Nemlendirici", "Güneş kremi"] }, ar: { title: "روتين الصباح", steps: ["تنظيف الوجه", "وضع التونر", "سيروم فيتامين سي", "مرطب", "واقي شمس"] } },
  { id: "skincare-pm", category: "skincare", icon: "🌙", en: { title: "Evening Skincare", steps: ["Remove makeup", "Cleanse face", "Exfoliate (2-3x/week)", "Apply treatment serum", "Night moisturizer"] }, de: { title: "Abend-Hautpflege", steps: ["Make-up entfernen", "Gesicht reinigen", "Peeling (2-3x/Woche)", "Treatment-Serum auftragen", "Nachtcreme"] }, es: { title: "Rutina de Noche", steps: ["Quitar el maquillaje", "Limpiar el rostro", "Exfoliar (2-3x/semana)", "Aplicar sérum tratante", "Crema de noche"] }, fr: { title: "Soin du Soir", steps: ["Démaquiller", "Nettoyer le visage", "Exfolier (2-3x/semaine)", "Appliquer un sérum traitant", "Crème de nuit"] }, it: { title: "Skincare Serale", steps: ["Struccarsi", "Detergere il viso", "Esfoliare (2-3x/settimana)", "Applicare siero trattante", "Crema notte"] }, pt: { title: "Skincare da Noite", steps: ["Remover maquiagem", "Limpar o rosto", "Esfoliar (2-3x/semana)", "Aplicar sérum de tratamento", "Hidratante noturno"] }, tr: { title: "Akşam Cilt Bakımı", steps: ["Makyaj temizle", "Yüzü temizle", "Peeling (haftada 2-3x)", "Bakım serumu uygula", "Gece kremi"] }, ar: { title: "روتين المساء", steps: ["إزالة المكياج", "تنظيف الوجه", "تقشير (2-3 مرات أسبوعيًا)", "وضع سيروم علاجي", "مرطب ليلي"] } },
  { id: "teeth", category: "hygiene", icon: "🦷", en: { title: "Oral Care Routine", steps: ["Brush for 2 minutes", "Floss", "Mouthwash", "Check for any sensitivity"] }, de: { title: "Zahnpflege-Routine", steps: ["2 Minuten putzen", "Zahnseide benutzen", "Mundspülung", "Auf Empfindlichkeit achten"] }, es: { title: "Rutina de Higiene Bucal", steps: ["Cepillar 2 minutos", "Usar hilo dental", "Enjuague bucal", "Revisar sensibilidad"] }, fr: { title: "Routine Bucco-dentaire", steps: ["Brosser 2 minutes", "Fil dentaire", "Bain de bouche", "Vérifier la sensibilité"] }, it: { title: "Routine di Igiene Orale", steps: ["Spazzolare 2 minuti", "Filo interdentale", "Collutorio", "Controllare sensibilità"] }, pt: { title: "Rotina de Higiene Bucal", steps: ["Escovar por 2 minutos", "Usar fio dental", "Enxaguante bucal", "Verificar sensibilidade"] }, tr: { title: "Ağız Bakımı Rutini", steps: ["2 dakika fırçala", "Diş ipi kullan", "Ağız gargarası", "Hassasiyeti kontrol et"] }, ar: { title: "روتين العناية بالفم", steps: ["التفريش لمدة دقيقتين", "استخدام الخيط", "غسول الفم", "فحص الحساسية"] } },
  { id: "clean-kitchen", category: "cleaning", icon: "🍳", en: { title: "Kitchen Reset", steps: ["Clear counters", "Wash dishes", "Wipe surfaces", "Take out trash", "Sweep floor"] }, de: { title: "Küchen-Reset", steps: ["Arbeitsflächen freiräumen", "Geschirr spülen", "Oberflächen abwischen", "Müll rausbringen", "Boden fegen"] }, es: { title: "Reinicio de Cocina", steps: ["Despejar encimeras", "Lavar platos", "Limpiar superficies", "Sacar la basura", "Barrer el piso"] }, fr: { title: "Remise en Ordre Cuisine", steps: ["Dégager les plans de travail", "Faire la vaisselle", "Essuyer les surfaces", "Sortir les poubelles", "Balayer le sol"] }, it: { title: "Reset Cucina", steps: ["Liberare i piani", "Lavare i piatti", "Pulire le superfici", "Portare fuori la spazzatura", "Spazzare il pavimento"] }, pt: { title: "Reset da Cozinha", steps: ["Liberar bancadas", "Lavar louça", "Limpar superfícies", "Tirar o lixo", "Varrer o chão"] }, tr: { title: "Mutfak Toparlama", steps: ["Tezgahları boşalt", "Bulaşıkları yıka", "Yüzeyleri sil", "Çöpü çıkar", "Yeri süpür"] }, ar: { title: "ترتيب المطبخ", steps: ["إخلاء الأسطح", "غسل الأطباق", "مسح الأسطح", "إخراج القمامة", "كنس الأرضية"] } },
  { id: "clean-bathroom", category: "cleaning", icon: "🛁", en: { title: "Bathroom Reset", steps: ["Wipe sink & mirror", "Clean toilet", "Wipe shower/tub", "Replace towels", "Empty bin"] }, de: { title: "Bad-Reset", steps: ["Waschbecken & Spiegel", "Toilette reinigen", "Dusche/Wanne wischen", "Handtücher wechseln", "Mülleimer leeren"] }, es: { title: "Reinicio de Baño", steps: ["Limpiar lavabo y espejo", "Limpiar el inodoro", "Limpiar ducha/bañera", "Cambiar toallas", "Vaciar la papelera"] }, fr: { title: "Remise en Ordre Salle de Bain", steps: ["Nettoyer lavabo et miroir", "Nettoyer les toilettes", "Nettoyer douche/baignoire", "Changer les serviettes", "Vider la poubelle"] }, it: { title: "Reset Bagno", steps: ["Pulire lavandino e specchio", "Pulire il water", "Pulire doccia/vasca", "Cambiare gli asciugamani", "Svuotare il cestino"] }, pt: { title: "Reset do Banheiro", steps: ["Limpar pia e espelho", "Limpar vaso sanitário", "Limpar chuveiro/banheira", "Trocar toalhas", "Esvaziar lixeira"] }, tr: { title: "Banyo Toparlama", steps: ["Lavabo ve aynayı sil", "Tuvaleti temizle", "Duşu/küveti sil", "Havluları değiştir", "Çöp kutusunu boşalt"] }, ar: { title: "ترتيب الحمام", steps: ["مسح المغسلة والمرآة", "تنظيف المرحاض", "مسح الدش/البانيو", "تغيير المناشف", "إفراغ سلة المهملات"] } },
  { id: "exercise-hips", category: "exercise", icon: "🏋️", en: { title: "Hip Workout", steps: ["Hip circles x10 each side", "Glute bridges x15", "Side leg raises x12 each", "Hip thrusts x15", "Stretch"] }, de: { title: "Hüft-Workout", steps: ["Hüftkreisen 10x pro Seite", "Glute Bridges 15x", "Seitliches Beinheben 12x pro Seite", "Hip Thrusts 15x", "Dehnen"] }, es: { title: "Entrenamiento de Cadera", steps: ["Círculos de cadera x10 cada lado", "Puentes de glúteo x15", "Elevaciones laterales x12 cada una", "Hip thrusts x15", "Estirar"] }, fr: { title: "Entraînement des Hanches", steps: ["Cercles de hanches x10 par côté", "Ponts fessiers x15", "Élévations latérales x12 chaque", "Hip thrusts x15", "Étirements"] }, it: { title: "Allenamento Fianchi", steps: ["Cerchi d'anca x10 per lato", "Ponti glutei x15", "Slanci laterali x12 per lato", "Hip thrust x15", "Stretching"] }, pt: { title: "Treino de Quadril", steps: ["Círculos de quadril x10 cada lado", "Ponte de glúteo x15", "Elevação lateral de perna x12 cada", "Hip thrust x15", "Alongamento"] }, tr: { title: "Kalça Antrenmanı", steps: ["Kalça daireleri her yönde x10", "Kalça köprüsü x15", "Yan bacak kaldırma her taraf x12", "Hip thrust x15", "Esneme"] }, ar: { title: "تمرين الورك", steps: ["دوائر الورك 10 لكل جانب", "جسر الأرداف 15 مرة", "رفع الساق الجانبي 12 لكل جانب", "دفعات الورك 15 مرة", "تمدد"] } },
  { id: "back-to-school", category: "school", icon: "🎒", en: { title: "Back to School Checklist", steps: ["Notebooks & folders", "Pens & pencils", "Backpack check", "Schedule printed", "Lunch plan sorted"] }, de: { title: "Schulstart-Checkliste", steps: ["Hefte & Mappen", "Stifte", "Schulranzen prüfen", "Stundenplan ausgedruckt", "Pausenbrot geplant"] }, es: { title: "Lista de Vuelta al Cole", steps: ["Cuadernos y carpetas", "Bolígrafos y lápices", "Revisar la mochila", "Horario impreso", "Plan de almuerzo listo"] }, fr: { title: "Liste de Rentrée", steps: ["Cahiers et classeurs", "Stylos et crayons", "Vérifier le cartable", "Emploi du temps imprimé", "Plan des repas prêt"] }, it: { title: "Checklist Ritorno a Scuola", steps: ["Quaderni e cartelline", "Penne e matite", "Controllo zaino", "Orario stampato", "Piano pranzi pronto"] }, pt: { title: "Checklist Volta às Aulas", steps: ["Cadernos e pastas", "Canetas e lápis", "Verificar mochila", "Horário impresso", "Plano de lanche pronto"] }, tr: { title: "Okula Dönüş Listesi", steps: ["Defterler ve dosyalar", "Kalemler", "Çanta kontrolü", "Ders programı yazdırıldı", "Öğle yemeği planı hazır"] }, ar: { title: "قائمة العودة للمدرسة", steps: ["دفاتر وملفات", "أقلام", "فحص الحقيبة", "طباعة الجدول", "تجهيز خطة الغداء"] } },
  { id: "relax-bath", category: "relax", icon: "🕯️", en: { title: "Relaxation Bath", steps: ["Warm water + salts", "Dim the lights", "Phone away", "15+ minutes soak", "Moisturize after"] }, de: { title: "Entspannungsbad", steps: ["Warmes Wasser + Salz", "Licht dimmen", "Handy weglegen", "15+ Minuten baden", "Danach eincremen"] }, es: { title: "Baño Relajante", steps: ["Agua tibia + sales", "Bajar las luces", "Guardar el teléfono", "15+ minutos en remojo", "Hidratar después"] }, fr: { title: "Bain Relaxant", steps: ["Eau tiède + sels", "Baisser la lumière", "Ranger le téléphone", "15+ minutes de trempage", "Hydrater après"] }, it: { title: "Bagno Rilassante", steps: ["Acqua tiepida + sali", "Abbassare le luci", "Mettere via il telefono", "15+ minuti a mollo", "Idratare dopo"] }, pt: { title: "Banho Relaxante", steps: ["Água morna + sais", "Diminuir a luz", "Guardar o celular", "15+ minutos de imersão", "Hidratar depois"] }, tr: { title: "Rahatlatıcı Banyo", steps: ["Ilık su + tuz", "Işıkları kıs", "Telefonu bırak", "15+ dakika bekle", "Sonra nemlendir"] }, ar: { title: "حمام استرخاء", steps: ["ماء دافئ + أملاح", "خفض الإضاءة", "ترك الهاتف جانبًا", "النقع 15+ دقيقة", "الترطيب بعد ذلك"] } },
  { id: "diy-candle", category: "diy", icon: "🕯️", en: { title: "DIY Candle Basics", steps: ["Melt wax", "Add fragrance oil", "Set wick centered", "Pour & cool", "Trim wick before use"] }, de: { title: "DIY-Kerze Grundlagen", steps: ["Wachs schmelzen", "Duftöl hinzufügen", "Docht zentrieren", "Eingießen & abkühlen", "Docht vor Gebrauch kürzen"] }, es: { title: "Vela DIY Básica", steps: ["Derretir la cera", "Añadir aceite aromático", "Centrar la mecha", "Verter y enfriar", "Recortar la mecha antes de usar"] }, fr: { title: "Bougie DIY de Base", steps: ["Faire fondre la cire", "Ajouter l'huile parfumée", "Centrer la mèche", "Verser et refroidir", "Couper la mèche avant utilisation"] }, it: { title: "Candela DIY Base", steps: ["Sciogliere la cera", "Aggiungere olio profumato", "Centrare lo stoppino", "Versare e raffreddare", "Accorciare lo stoppino prima dell'uso"] }, pt: { title: "Vela DIY Básica", steps: ["Derreter a cera", "Adicionar óleo aromático", "Centralizar o pavio", "Despejar e esfriar", "Aparar o pavio antes de usar"] }, tr: { title: "Basit DIY Mum Yapımı", steps: ["Mumu erit", "Koku yağı ekle", "Fitili ortala", "Dökülüp soğumaya bırak", "Kullanmadan önce fitili kes"] }, ar: { title: "شمعة يدوية بسيطة", steps: ["إذابة الشمع", "إضافة زيت عطري", "توسيط الفتيل", "الصب والتبريد", "تقليم الفتيل قبل الاستخدام"] } },
  { id: "fix-darkspots", category: "life", icon: "✨", en: { title: "Fading Dark Spots", steps: ["Apply SPF daily", "Use vitamin C serum", "Try niacinamide", "Be patient — takes weeks", "See a dermatologist if needed"] }, de: { title: "Dunkle Flecken reduzieren", steps: ["Täglich SPF auftragen", "Vitamin-C-Serum nutzen", "Niacinamid probieren", "Geduldig sein — dauert Wochen", "Bei Bedarf zum Hautarzt"] }, es: { title: "Reducir Manchas Oscuras", steps: ["Aplicar SPF a diario", "Usar sérum de vitamina C", "Probar niacinamida", "Ten paciencia — toma semanas", "Consulta a un dermatólogo si es necesario"] }, fr: { title: "Atténuer les Taches Sombres", steps: ["Appliquer du SPF chaque jour", "Utiliser un sérum vitamine C", "Essayer le niacinamide", "Sois patient — cela prend des semaines", "Consulter un dermatologue si besoin"] }, it: { title: "Schiarire le Macchie Scure", steps: ["Applicare SPF ogni giorno", "Usare siero vitamina C", "Provare la niacinamide", "Sii paziente — richiede settimane", "Consulta un dermatologo se necessario"] }, pt: { title: "Reduzir Manchas Escuras", steps: ["Aplicar SPF diariamente", "Usar sérum de vitamina C", "Experimentar niacinamida", "Tenha paciência — leva semanas", "Consultar dermatologista se necessário"] }, tr: { title: "Koyu Lekeleri Azaltma", steps: ["Her gün SPF uygula", "C vitamini serumu kullan", "Niasinamid dene", "Sabırlı ol — haftalar sürer", "Gerekirse dermatoloğa görün"] }, ar: { title: "تفتيح البقع الداكنة", steps: ["استخدام واقي الشمس يوميًا", "استخدام سيروم فيتامين سي", "تجربة النياسيناميد", "كن صبورًا — يستغرق أسابيع", "استشارة طبيب جلدية عند الحاجة"] } },
];

const TIMER_PRESETS = [
  { id: "pomodoro", labelKey: "presetPomodoro", work: 25, brk: 5 },
  { id: "deep", labelKey: "presetDeep", work: 50, brk: 10 },
  { id: "quick", labelKey: "presetQuick", work: 15, brk: 3 },
  { id: "custom", labelKey: "presetCustom" },
];

const REMINDER_PRESETS = [0, 10, 30, 60, 1440, 10080, 20160];
const UNIT_TO_MINUTES = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };
const BREAK_COLOR = "#6fbfa0"; // deliberately distinct from every theme's accent so break mode is unmistakable


// ---------- Audio: one shared, reusable context ----------
async function playDing() {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    if (ctx.state !== "running") await ctx.resume();
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine"; osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(); osc.stop(ctx.currentTime + 0.6);
  } catch (e) {}
}

// Build a work/break schedule where the entered total is pure focus time —
// breaks are added on top and extend the overall session length, not carved out of it.
function buildSchedule(totalFocusMinutes, breakCount, breakLenMinutes) {
  const segs = breakCount + 1;
  const perBlock = Math.max(1, Math.round(totalFocusMinutes / segs));
  const schedule = [];
  for (let i = 0; i < segs; i++) {
    schedule.push({ type: "work", minutes: perBlock });
    if (i < segs - 1) schedule.push({ type: "break", minutes: breakLenMinutes });
  }
  return schedule;
}

const emptyDraft = { text: "", date: "", time: "", repeat: "none", customDays: [], reminderMinutes: null };

function TodoTemplates({ globalTheme, globalLang }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [section, setSection] = useState("todo");
  const [storageReady, setStorageReady] = useState(false);

  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [reminderUnit, setReminderUnit] = useState("minutes");
  const [reminderCustomVal, setReminderCustomVal] = useState("5");
  const [openField, setOpenField] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [todoView, setTodoView] = useState("list");
  const [calendarMonth, setCalendarMonth] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "unsupported");

  // Timer
  const [timerPreset, setTimerPreset] = useState("pomodoro");
  const [customTotal, setCustomTotal] = useState("120");
  const [customBreakCount, setCustomBreakCount] = useState(3);
  const [customBreakLen, setCustomBreakLen] = useState("10");
  const [timerMode, setTimerMode] = useState("work"); // used by presets only
  const [scheduleIndex, setScheduleIndex] = useState(0); // used by custom only
  const [sessionFinished, setSessionFinished] = useState(false);
  const preset = TIMER_PRESETS.find((p) => p.id === timerPreset);
  const workMins = timerPreset === "custom" ? null : preset.work;
  const breakMins = timerPreset === "custom" ? null : preset.brk;
  const schedule = timerPreset === "custom" ? buildSchedule(Number(customTotal) || 1, customBreakCount, Number(customBreakLen) || 1) : null;
  const currentSegment = timerPreset === "custom" ? schedule[Math.min(scheduleIndex, schedule.length - 1)] : { type: timerMode, minutes: timerMode === "work" ? workMins : breakMins };
  const [secondsLeft, setSecondsLeft] = useState(currentSegment.minutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [sessionsToday, setSessionsToday] = useState(0);
  const intervalRef = useRef(null);
  const reminderTimeoutsRef = useRef([]);
  const [activeReminder, setActiveReminder] = useState(null);

  // Templates
  const [customTemplates, setCustomTemplates] = useState([]);
  const [templateOverrides, setTemplateOverrides] = useState({}); // tplId -> { title, steps } — user edits layered on top of built-ins
  const [editingTemplateId, setEditingTemplateId] = useState(null); // set when the builder is editing an existing template rather than creating a new one
  const [openTemplateId, setOpenTemplateId] = useState(null);
  const [templateProgress, setTemplateProgress] = useState({});
  const [showBuilder, setShowBuilder] = useState(false);
  const [builderName, setBuilderName] = useState("");
  const [builderSteps, setBuilderSteps] = useState([""]);

  const t = TODO_STRINGS[lang] || TODO_STRINGS.en;
  const theme = THEMES[themeKey];
  const allTemplates = [...PREBUILT_TEMPLATES, ...customTemplates];

  // Keep audio unlocked: resume the shared context on any tap in the app,
  // since mobile browsers can silently re-suspend it after inactivity.
  useEffect(() => {
    const unlock = () => { const ctx = getAudioCtx(); if (ctx && ctx.state !== "running") ctx.resume().catch(() => {}); };
    document.addEventListener("click", unlock);
    document.addEventListener("touchstart", unlock);
    return () => { document.removeEventListener("click", unlock); document.removeEventListener("touchstart", unlock); };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("todo-templates-state-v3");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          setTasks(d.tasks || []);
          setCustomTemplates(d.customTemplates || []); setTemplateProgress(d.templateProgress || {});
          setTemplateOverrides(d.templateOverrides || {});
          setSessionsToday(d.sessionsToday && d.sessionsDate === todayKey() ? d.sessionsToday : 0);
          setTimerPreset(d.timerPreset || "pomodoro");
          setCustomTotal(d.customTotal || "120"); setCustomBreakCount(d.customBreakCount ?? 3); setCustomBreakLen(d.customBreakLen || "10");
        }
      } catch (e) {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try {
        await supaSet("todo-templates-state-v3", JSON.stringify({ tasks, themeKey, lang, customTemplates, templateProgress, templateOverrides, sessionsToday, sessionsDate: todayKey(), timerPreset, customTotal, customBreakCount, customBreakLen }));
      } catch (e) { console.error(e); }
    })();
  }, [tasks, themeKey, lang, customTemplates, templateProgress, templateOverrides, sessionsToday, timerPreset, customTotal, customBreakCount, customBreakLen, storageReady]);

  const liveSyncCtx = useContext(LiveSyncContext);
  useEffect(() => {
    liveSyncCtx?.updateLiveSync("todo", { tasks, setTasks });
  }, [tasks]);

  // Reset the clock whenever the plan changes and nothing is running
  useEffect(() => {
    if (!timerRunning) setSecondsLeft(currentSegment.minutes * 60);
  }, [timerPreset, workMins, breakMins, customTotal, customBreakCount, customBreakLen, timerMode, scheduleIndex]);

  useEffect(() => {
    if (timerRunning) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            playDing();
            if (timerPreset === "custom") {
              const finishedWork = schedule[scheduleIndex].type === "work";
              if (finishedWork) setSessionsToday((n) => n + 1);
              if (scheduleIndex >= schedule.length - 1) {
                // whole planned session is done
                setTimerRunning(false);
                setSessionFinished(true);
                setScheduleIndex(0);
                return schedule[0].minutes * 60;
              }
              const nextIndex = scheduleIndex + 1;
              setScheduleIndex(nextIndex);
              return schedule[nextIndex].minutes * 60;
            } else {
              if (timerMode === "work") {
                setSessionsToday((n) => n + 1);
                setTimerMode("break");
                return breakMins * 60;
              } else {
                setTimerMode("work");
                return workMins * 60;
              }
            }
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [timerRunning, timerMode, workMins, breakMins, timerPreset, scheduleIndex, schedule]);

  function resetTimer() {
    setTimerRunning(false);
    setSessionFinished(false);
    if (timerPreset === "custom") {
      setScheduleIndex(0);
      setSecondsLeft(schedule[0].minutes * 60);
    } else {
      setTimerMode("work");
      setSecondsLeft(workMins * 60);
    }
  }

  function startTimer() {
    getAudioCtx();
    setSessionFinished(false);
    setTimerRunning(!timerRunning);
  }

  // ---------- Reminders ----------
  function ensureNotifPermission() {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") Notification.requestPermission().then(setNotifPermission);
    else setNotifPermission(Notification.permission);
  }

  useEffect(() => {
    reminderTimeoutsRef.current.forEach(clearTimeout);
    reminderTimeoutsRef.current = [];

    tasks.forEach((tk) => {
      if (tk.reminderMinutes === null || tk.reminderMinutes === undefined || !tk.date) return;
      const due = new Date(`${tk.date}T${tk.time || "09:00"}:00`);
      const fireAt = new Date(due.getTime() - tk.reminderMinutes * 60000);
      const delay = fireAt.getTime() - Date.now();
      const MAX_TIMEOUT = 24 * 24 * 60 * 60 * 1000; // ~24 days — practical setTimeout ceiling
      if (delay > 0 && delay < MAX_TIMEOUT) {
        const id = setTimeout(() => {
          playDing();
          if (navigator.vibrate) navigator.vibrate([0, 60, 40, 60]);
          setActiveReminder({ text: tk.text, minutes: tk.reminderMinutes });
          setTimeout(() => setActiveReminder((cur) => (cur && cur.text === tk.text ? null : cur)), 7000);
          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            try { new Notification(tk.text, { body: tk.reminderMinutes === 0 ? "Due now" : reminderLabel({ reminderMinutes: tk.reminderMinutes }) }); } catch (e) {}
          }
        }, delay);
        reminderTimeoutsRef.current.push(id);
      }
    });
    return () => reminderTimeoutsRef.current.forEach(clearTimeout);
  }, [tasks]);

  // ---------- Tasks ----------
  function startNewDraft(prefillDate) {
    setDraft({ ...emptyDraft, date: prefillDate || "" });
    setEditingTaskId(null);
    setOpenField(null);
  }

  function saveDraft() {
    if (!draft.text.trim()) return;
    if (draft.reminderMinutes !== null) ensureNotifPermission();
    if (editingTaskId) {
      setTasks(tasks.map((tk) => tk.id === editingTaskId ? { ...tk, text: draft.text.trim(), date: draft.date || null, time: draft.time || null, repeat: draft.repeat, customDays: draft.customDays, reminderMinutes: draft.reminderMinutes } : tk));
    } else {
      const task = { id: Date.now(), text: draft.text.trim(), date: draft.date || null, time: draft.time || null, repeat: draft.repeat, customDays: draft.customDays, reminderMinutes: draft.reminderMinutes, completedDates: [] };
      setTasks([task, ...tasks]);
    }
    setDraft(emptyDraft); setEditingTaskId(null); setOpenField(null);
  }

  function beginEdit(task) {
    setDraft({ text: task.text, date: task.date || "", time: task.time || "", repeat: task.repeat, customDays: task.customDays || [], reminderMinutes: task.reminderMinutes ?? null });
    setEditingTaskId(task.id);
    setOpenField(null);
  }

  function cancelEdit() {
    setDraft(emptyDraft); setEditingTaskId(null); setOpenField(null);
  }

  function toggleTaskDone(taskId, dateKey) {
    setTasks(tasks.map((tk) => {
      if (tk.id !== taskId) return tk;
      const done = tk.completedDates.includes(dateKey);
      return { ...tk, completedDates: done ? tk.completedDates.filter((d) => d !== dateKey) : [...tk.completedDates, dateKey] };
    }));
  }

  function deleteTask(taskId) {
    setTasks(tasks.filter((tk) => tk.id !== taskId));
    if (editingTaskId === taskId) cancelEdit();
  }

  function toggleCustomDay(day) {
    setDraft((d) => ({ ...d, customDays: d.customDays.includes(day) ? d.customDays.filter((x) => x !== day) : [...d.customDays, day] }));
  }

  function tasksForDate(dateKey) {
    const targetDate = new Date(dateKey + "T00:00:00");
    return tasks.filter((tk) => {
      if (tk.repeat === "daily") return true;
      if (tk.repeat === "weekly") return tk.date && new Date(tk.date + "T00:00:00").getDay() === targetDate.getDay();
      if (tk.repeat === "custom") return (tk.customDays || []).includes(targetDate.getDay());
      return tk.date === dateKey;
    });
  }

  const todayTasks = tasksForDate(todayKey());
  const upcomingTasks = tasks.filter((tk) => tk.repeat === "none" && tk.date && tk.date > todayKey());

  function repeatLabel(d) {
    if (d.repeat === "none") return t.repeat + ": " + t.none;
    if (d.repeat === "daily") return t.daily;
    if (d.repeat === "weekly") return t.weekly;
    if (d.repeat === "custom") return d.customDays.length ? d.customDays.sort().map((x) => t.weekdaysShort[x]).join(" ") : t.custom;
    return t.repeat;
  }
  function reminderLabel(d) {
    if (d.reminderMinutes === null || d.reminderMinutes === undefined) return t.noReminder;
    const map = { 0: t.reminderAt, 10: t.reminder10, 30: t.reminder30, 60: t.reminder60, 1440: t.reminder1440, 10080: t.reminder10080, 20160: t.reminder20160 };
    if (map[d.reminderMinutes]) return map[d.reminderMinutes];
    // Express arbitrary custom values in the largest clean unit
    const m = d.reminderMinutes;
    if (m % 10080 === 0) return `${m / 10080} ${t.remindUnit.weeks} ${t.before}`;
    if (m % 1440 === 0) return `${m / 1440} ${t.remindUnit.days} ${t.before}`;
    if (m % 60 === 0) return `${m / 60} ${t.remindUnit.hours} ${t.before}`;
    return `${m} ${t.remindUnit.minutes} ${t.before}`;
  }
  function dateLabel(d) {
    if (!d.date) return t.noDue;
    const dd = new Date(d.date + "T00:00:00");
    return dd.toLocaleDateString(localeFor(lang), { month: "short", day: "numeric" }) + (d.time ? `, ${d.time}` : "");
  }

  // ---------- Templates ----------
  function openTemplate(tpl) {
    setOpenTemplateId(openTemplateId === tpl.id ? null : tpl.id);
    const existing = templateProgress[tpl.id];
    if (!existing || existing.date !== todayKey()) {
      setTemplateProgress({ ...templateProgress, [tpl.id]: { date: todayKey(), checked: new Array(tpl[lang]?.steps.length || tpl.en.steps.length).fill(false) } });
    }
  }
  function toggleStep(tplId, stepIndex) {
    const prog = templateProgress[tplId] || { date: todayKey(), checked: [] };
    const checked = [...prog.checked];
    checked[stepIndex] = !checked[stepIndex];
    setTemplateProgress({ ...templateProgress, [tplId]: { date: todayKey(), checked } });
  }
  function getTemplateContent(tpl) {
    if (templateOverrides[tpl.id]) return templateOverrides[tpl.id];
    return tpl[lang] || tpl.en;
  }
  function beginEditTemplate(tpl) {
    const content = getTemplateContent(tpl);
    setBuilderName(content.title);
    setBuilderSteps([...content.steps]);
    setEditingTemplateId(tpl.id);
    setShowBuilder(true);
    setOpenTemplateId(null);
  }
  function saveCustomTemplate() {
    const steps = builderSteps.map((s) => s.trim()).filter(Boolean);
    if (!builderName.trim() || steps.length === 0) return;
    const content = { title: builderName.trim(), steps };
    if (editingTemplateId) {
      const isCustom = customTemplates.some((tp) => tp.id === editingTemplateId);
      if (isCustom) {
        setCustomTemplates(customTemplates.map((tp) => tp.id === editingTemplateId ? { ...tp, en: content, de: content } : tp));
      } else {
        setTemplateOverrides({ ...templateOverrides, [editingTemplateId]: content });
      }
    } else {
      const tpl = { id: "custom-" + Date.now(), category: "life", icon: "📝", isCustom: true, en: content, de: content };
      setCustomTemplates([tpl, ...customTemplates]);
    }
    setBuilderName(""); setBuilderSteps([""]); setShowBuilder(false); setEditingTemplateId(null);
  }
  function resetTemplateOverride(tplId) {
    const next = { ...templateOverrides };
    delete next[tplId];
    setTemplateOverrides(next);
  }
  function deleteCustomTemplate(tplId) {
    setCustomTemplates(customTemplates.filter((tp) => tp.id !== tplId));
    if (openTemplateId === tplId) setOpenTemplateId(null);
  }

  // Add a template into the To-Do list as a repeating task with its own step checklist
  function addTemplateToTodo(tpl) {
    const content = getTemplateContent(tpl);
    const already = tasks.find((tk) => tk.templateId === tpl.id);
    if (already) { beginEdit(already); setSection("todo"); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const task = {
      id: Date.now(), text: content.title, date: null, time: "08:00", repeat: "daily", customDays: [],
      reminderMinutes: null, completedDates: [], templateId: tpl.id, steps: content.steps, stepProgress: {},
    };
    setTasks([task, ...tasks]);
    beginEdit(task); // opens the add/edit card pre-filled so time & repeat can be set right away
    setOpenField("repeat");
    setSection("todo");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleTemplateTaskStep(taskId, dateKey, stepIndex) {
    setTasks(tasks.map((tk) => {
      if (tk.id !== taskId) return tk;
      const existing = tk.stepProgress?.[dateKey] || new Array(tk.steps.length).fill(false);
      const updated = [...existing];
      updated[stepIndex] = !updated[stepIndex];
      const allDone = updated.every(Boolean);
      const completedDates = allDone
        ? Array.from(new Set([...tk.completedDates, dateKey]))
        : tk.completedDates.filter((d) => d !== dateKey);
      return { ...tk, stepProgress: { ...tk.stepProgress, [dateKey]: updated }, completedDates };
    }));
  }

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const activeMode = timerPreset === "custom" ? currentSegment.type : timerMode;
  const activeMins = timerPreset === "custom" ? currentSegment.minutes : (timerMode === "work" ? workMins : breakMins);
  const timerTotal = activeMins * 60 || 1;
  const timerPct = ((timerTotal - secondsLeft) / timerTotal) * 100;
  const totalWorkBlocks = timerPreset === "custom" ? schedule.filter((s) => s.type === "work").length : null;
  const completedWorkBlocks = timerPreset === "custom" ? schedule.slice(0, scheduleIndex).filter((s) => s.type === "work").length + (activeMode === "break" ? 1 : 0) : null;

  // Unified "whole plan" view for the ring — for presets this is just one work+break
  // cycle (since that pattern repeats every round); for custom it's the full session.
  const displaySchedule = timerPreset === "custom" ? schedule : [{ type: "work", minutes: workMins }, { type: "break", minutes: breakMins }];
  const displayTotalSeconds = displaySchedule.reduce((a, s) => a + s.minutes * 60, 0) || 1;
  const currentDisplayIndex = timerPreset === "custom" ? Math.min(scheduleIndex, displaySchedule.length - 1) : (activeMode === "work" ? 0 : 1);
  function segmentFill(idx) {
    if (sessionFinished) return 1;
    if (idx < currentDisplayIndex) return 1;
    if (idx > currentDisplayIndex) return 0;
    const segTotal = displaySchedule[idx].minutes * 60;
    return Math.max(0, Math.min(1, (segTotal - secondsLeft) / segTotal));
  }
  const RADIUS = 70, CIRC = 2 * Math.PI * RADIUS;
  let cumulativeSeconds = 0;
  const ringSegments = displaySchedule.map((seg, i) => {
    const segSeconds = seg.minutes * 60;
    const startFrac = cumulativeSeconds / displayTotalSeconds;
    const segFrac = segSeconds / displayTotalSeconds;
    cumulativeSeconds += segSeconds;
    return { ...seg, index: i, startFrac, segFrac, fill: segmentFill(i) };
  });

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 120, transition: "background 0.4s ease, color 0.4s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea, select { font-family: inherit; }
        .fraunces { font-family: 'Fraunces', serif; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes bannerIn { 0% { transform: translateY(-16px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
      `}</style>

      {activeReminder && (
        <div style={{ position: "fixed", top: "calc(14px + env(safe-area-inset-top))", left: "50%", transform: "translateX(-50%)", zIndex: 200, width: "calc(100% - 32px)", maxWidth: 420, background: theme.panel, border: `1px solid ${theme.accent}`, borderRadius: 14, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, boxShadow: `0 8px 30px ${theme.accent}55`, animation: "bannerIn 0.3s ease" }}>
          <Bell size={16} color={theme.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{activeReminder.text}</div>
            <div style={{ fontSize: 10.5, color: theme.muted }}>{activeReminder.minutes === 0 ? "Due now" : reminderLabel({ reminderMinutes: activeReminder.minutes })}</div>
          </div>
          <button onClick={() => setActiveReminder(null)} style={{ background: "none", border: "none", color: theme.muted }}><X size={16} /></button>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 0" }}>
        <div style={{ display: "flex", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: 4 }}>
          <button onClick={() => setSection("todo")} style={{ background: section === "todo" ? theme.accent : "transparent", color: section === "todo" ? theme.bg : theme.text, border: "none", borderRadius: 16, padding: "7px 16px", fontSize: 13, fontWeight: 600 }}>{t.todo}</button>
          <button onClick={() => setSection("templates")} style={{ background: section === "templates" ? theme.accent : "transparent", color: section === "templates" ? theme.bg : theme.text, border: "none", borderRadius: 16, padding: "7px 16px", fontSize: 13, fontWeight: 600 }}>{t.templates}</button>
        </div>
      </div>

      {section === "todo" && (
        <div style={{ maxWidth: 460, margin: "24px auto 0", padding: "0 20px" }}>

          {/* Focus Timer */}
          <div style={{ background: activeMode === "break" ? `linear-gradient(160deg, ${theme.panel}, ${BREAK_COLOR}18)` : `linear-gradient(160deg, ${theme.panel}, ${theme.panelSoft})`, border: `1px solid ${activeMode === "break" ? BREAK_COLOR + "66" : theme.line}`, borderRadius: 20, padding: 22, marginBottom: 22, transition: "background 0.5s ease, border-color 0.5s ease" }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
              {TIMER_PRESETS.map((p) => (
                <button key={p.id} onClick={() => { setTimerPreset(p.id); setTimerRunning(false); setTimerMode("work"); setScheduleIndex(0); setSessionFinished(false); }} style={{ background: timerPreset === p.id ? theme.accent : theme.panel, color: timerPreset === p.id ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "6px 11px", fontSize: 11, fontWeight: 600 }}>
                  {t[p.labelKey]}
                </button>
              ))}
            </div>

            {timerPreset === "custom" && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.totalSession}</div>
                    <input
                      type="text" inputMode="numeric" value={customTotal}
                      onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setCustomTotal(v); setTimerRunning(false); }}
                      onBlur={() => { const n = Math.min(600, Math.max(5, Number(customTotal) || 120)); setCustomTotal(String(n)); }}
                      style={{ width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 13 }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.breakLenEach}</div>
                    <input
                      type="text" inputMode="numeric" value={customBreakLen}
                      onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setCustomBreakLen(v); setTimerRunning(false); }}
                      onBlur={() => { const n = Math.min(120, Math.max(1, Number(customBreakLen) || 10)); setCustomBreakLen(String(n)); }}
                      style={{ width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 13 }}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.numBreaks}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <button key={n} onClick={() => { setCustomBreakCount(n); setTimerRunning(false); }} style={{ flex: 1, background: customBreakCount === n ? theme.accent : theme.panel, color: customBreakCount === n ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "7px 0", fontSize: 12.5, fontWeight: 600 }}>{n}</button>
                    ))}
                  </div>
                </div>
                {schedule && (
                  <div style={{ fontSize: 10.5, color: theme.muted, lineHeight: 1.4 }}>
                    {t.sessionPreview
                      .replace("{work}", schedule.filter((s) => s.type === "work").reduce((a, s) => a + s.minutes, 0))
                      .replace("{segs}", schedule.filter((s) => s.type === "work").length)
                      .replace("{breaks}", customBreakCount)
                      .replace("{brk}", customBreakLen)
                      .replace("{total}", schedule.reduce((a, s) => a + s.minutes, 0))}
                  </div>
                )}
              </div>
            )}

            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 11.5, letterSpacing: "0.08em", textTransform: "uppercase", color: activeMode === "break" ? BREAK_COLOR : theme.accentSoft, marginBottom: 10, fontWeight: 600 }}>
                {sessionFinished ? t.sessionDone : (activeMode === "work" ? t.work : t.short)}
                {!sessionFinished && activeMode === "work" && <span style={{ opacity: 0.65 }}> · {activeMins} min</span>}
                {timerPreset === "custom" && !sessionFinished && <span style={{ opacity: 0.5 }}> · {completedWorkBlocks}/{totalWorkBlocks}</span>}
              </div>
              <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto 16px" }}>
                <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
                  {/* Dim base ring so the block layout is visible even before any progress is made */}
                  <circle cx="80" cy="80" r={RADIUS} fill="none" stroke={theme.line} strokeWidth="9" />
                  {/* Each work/break block drawn as its own arc, dim outline + filled portion as time passes.
                      This is what makes break timing visible on the ring itself, not just in a label. */}
                  {ringSegments.map((seg) => {
                    const color = seg.type === "break" ? BREAK_COLOR : theme.accent;
                    const segLen = seg.segFrac * CIRC;
                    const gap = ringSegments.length > 1 ? 2 : 0; // small visual gap between blocks
                    return (
                      <g key={seg.index}>
                        <circle cx="80" cy="80" r={RADIUS} fill="none" stroke={color} strokeOpacity={0.22} strokeWidth="9"
                          strokeDasharray={`${Math.max(0, segLen - gap)} ${CIRC - Math.max(0, segLen - gap)}`}
                          strokeDashoffset={-(seg.startFrac * CIRC)} />
                        {seg.fill > 0 && (
                          <circle cx="80" cy="80" r={RADIUS} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={`${Math.max(0, seg.fill * segLen - gap)} ${CIRC - Math.max(0, seg.fill * segLen - gap)}`}
                            strokeDashoffset={-(seg.startFrac * CIRC)} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
                        )}
                      </g>
                    );
                  })}
                </svg>

                {/* Main clock — reserved for focus countdown only, never shows break digits */}
                <div className="fraunces" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: theme.text }}>
                  {sessionFinished ? (
                    <span style={{ fontSize: 40 }}>✓</span>
                  ) : activeMode === "work" ? (
                    <span style={{ fontSize: 34 }}>{mm}:{ss}</span>
                  ) : (
                    <>
                      <span style={{ fontSize: 26 }}>☕</span>
                      <span style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>{lang === "de" ? "Pause läuft" : "On a break"}</span>
                    </>
                  )}
                </div>

                {/* Mini corner clock — the break's own live countdown, deliberately separate from the main clock */}
                {activeMode === "break" && !sessionFinished && (
                  <div style={{ position: "absolute", top: -8, right: -8, width: 58, height: 58, animation: "pop 0.3s ease" }}>
                    <svg viewBox="0 0 58 58" width="58" height="58" style={{ transform: "rotate(-90deg)" }}>
                      <circle cx="29" cy="29" r="24" fill={theme.bg} stroke={theme.line} strokeWidth="5" />
                      <circle cx="29" cy="29" r="24" fill="none" stroke={BREAK_COLOR} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - timerPct / 100)} style={{ transition: "stroke-dashoffset 1s linear" }} />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, color: BREAK_COLOR }}>{mm}:{ss}</div>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 12 }}>
                <button onClick={startTimer} style={{ background: activeMode === "break" ? BREAK_COLOR : theme.accent, color: theme.bg, border: "none", borderRadius: 12, padding: "11px 26px", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {timerRunning ? <Pause size={14} /> : <Play size={14} />} {timerRunning ? t.pause : t.start}
                </button>
                <button onClick={resetTimer} style={{ background: theme.panelSoft, color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "11px 14px" }}><RotateCcw size={14} /></button>
              </div>
              <div style={{ fontSize: 10.5, color: theme.muted }}>{sessionsToday} {t.sessionsToday}</div>
            </div>
          </div>

          {/* Add / Edit task */}
          <div style={{ background: theme.panel, border: `1px solid ${editingTaskId ? theme.accent : theme.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} onKeyDown={(e) => e.key === "Enter" && saveDraft()} placeholder={t.addTask} style={{ flex: 1, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", color: theme.text, fontSize: 13.5, outline: "none" }} />
              <button onClick={saveDraft} style={{ background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "0 14px" }}>{editingTaskId ? <Check size={16} /> : <Plus size={16} />}</button>
              {editingTaskId && <button onClick={cancelEdit} style={{ background: theme.panelSoft, color: theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "0 12px" }}><X size={15} /></button>}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setOpenField(openField === "date" ? null : "date")} style={{ display: "flex", alignItems: "center", gap: 6, background: draft.date ? theme.accentSoft : theme.panelSoft, color: draft.date ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                <CalendarIcon size={13} /> {dateLabel(draft)}
              </button>
              <button onClick={() => setOpenField(openField === "repeat" ? null : "repeat")} style={{ display: "flex", alignItems: "center", gap: 6, background: draft.repeat !== "none" ? theme.accentSoft : theme.panelSoft, color: draft.repeat !== "none" ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                <Repeat size={13} /> {repeatLabel(draft)}
              </button>
              <button onClick={() => setOpenField(openField === "reminder" ? null : "reminder")} style={{ display: "flex", alignItems: "center", gap: 6, background: draft.reminderMinutes !== null ? theme.accentSoft : theme.panelSoft, color: draft.reminderMinutes !== null ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 12 }}>
                {draft.reminderMinutes !== null ? <Bell size={13} /> : <BellOff size={13} />} {reminderLabel(draft)}
              </button>
            </div>

            {openField === "date" && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, animation: "pop 0.2s ease" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.date}</div>
                  <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 12.5, colorScheme: themeKey === "midnight" || themeKey === "ocean" ? "dark" : "light" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.time}</div>
                  <input type="time" value={draft.time} onChange={(e) => setDraft({ ...draft, time: e.target.value })} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 12.5, colorScheme: themeKey === "midnight" || themeKey === "ocean" ? "dark" : "light" }} />
                </div>
              </div>
            )}

            {openField === "repeat" && (
              <div style={{ marginTop: 12, animation: "pop 0.2s ease" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                  {["none", "daily", "weekly", "custom"].map((r) => (
                    <button key={r} onClick={() => setDraft({ ...draft, repeat: r })} style={{ background: draft.repeat === r ? theme.accent : theme.panelSoft, color: draft.repeat === r ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 600 }}>
                      {r === "none" ? t.none : r === "daily" ? t.daily : r === "weekly" ? t.weekly : t.custom}
                    </button>
                  ))}
                </div>
                {draft.repeat === "custom" && (
                  <div style={{ display: "flex", gap: 5 }}>
                    {t.weekdaysShort.map((wd, i) => (
                      <button key={i} onClick={() => toggleCustomDay(i)} style={{ width: 30, height: 30, borderRadius: "50%", background: draft.customDays.includes(i) ? theme.accent : theme.panelSoft, color: draft.customDays.includes(i) ? theme.bg : theme.muted, border: `1px solid ${theme.line}`, fontSize: 11, fontWeight: 600 }}>
                        {wd}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {openField === "reminder" && (
              <div style={{ marginTop: 12, animation: "pop 0.2s ease" }}>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                  <button onClick={() => setDraft({ ...draft, reminderMinutes: null })} style={{ background: draft.reminderMinutes === null ? theme.accent : theme.panelSoft, color: draft.reminderMinutes === null ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 600 }}>{t.noReminder}</button>
                  {REMINDER_PRESETS.map((m) => (
                    <button key={m} onClick={() => setDraft({ ...draft, reminderMinutes: m })} style={{ background: draft.reminderMinutes === m ? theme.accent : theme.panelSoft, color: draft.reminderMinutes === m ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 600 }}>
                      {reminderLabel({ reminderMinutes: m })}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <input
                    type="text" inputMode="numeric" value={reminderCustomVal}
                    onChange={(e) => setReminderCustomVal(e.target.value.replace(/[^0-9]/g, ""))}
                    style={{ width: 56, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "7px 8px", color: theme.text, fontSize: 13 }}
                  />
                  <select value={reminderUnit} onChange={(e) => setReminderUnit(e.target.value)} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "7px 8px", color: theme.text, fontSize: 12 }}>
                    {Object.keys(UNIT_TO_MINUTES).map((u) => <option key={u} value={u}>{t.remindUnit[u]}</option>)}
                  </select>
                  <span style={{ fontSize: 11.5, color: theme.muted }}>{t.before}</span>
                  <button onClick={() => setDraft({ ...draft, reminderMinutes: (Number(reminderCustomVal) || 1) * UNIT_TO_MINUTES[reminderUnit] })} style={{ background: theme.accent, color: theme.bg, border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11.5, fontWeight: 600 }}>{t.save}</button>
                </div>
                {draft.reminderMinutes !== null && notifPermission !== "granted" && typeof Notification !== "undefined" && (
                  <button onClick={ensureNotifPermission} style={{ fontSize: 11, color: theme.accentSoft, background: "none", border: "none", padding: 0, textDecoration: "underline", display: "block", marginBottom: 4 }}>{t.enableNotifs}</button>
                )}
                <div style={{ fontSize: 10, color: theme.muted, lineHeight: 1.4 }}>{t.notifNote}</div>
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <button onClick={() => setTodoView("list")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: todoView === "list" ? theme.accent : theme.panel, color: todoView === "list" ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 600 }}><List size={14} /> {t.listView}</button>
            <button onClick={() => setTodoView("calendar")} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: todoView === "calendar" ? theme.accent : theme.panel, color: todoView === "calendar" ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 600 }}><CalendarIcon size={14} /> {t.calendarView}</button>
          </div>

          {todoView === "list" ? (
            <>
              <div className="fraunces" style={{ fontSize: 16, marginBottom: 10 }}>{t.today}</div>
              {todayTasks.length === 0 ? <div style={{ fontSize: 13, color: theme.muted, marginBottom: 20 }}>{t.noTasks}</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
                  {todayTasks.map((tk) => (
                    <TaskRow key={tk.id} task={tk} dateKey={todayKey()} theme={theme} t={t} onToggle={toggleTaskDone} onDelete={deleteTask} onEdit={beginEdit} onToggleStep={toggleTemplateTaskStep} expanded={expandedTaskId === tk.id} onExpand={() => setExpandedTaskId(expandedTaskId === tk.id ? null : tk.id)} />
                  ))}
                </div>
              )}
              <div className="fraunces" style={{ fontSize: 16, marginBottom: 10 }}>{t.upcoming}</div>
              {upcomingTasks.length === 0 ? <div style={{ fontSize: 13, color: theme.muted }}>{t.noTasks}</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {upcomingTasks.sort((a, b) => a.date.localeCompare(b.date)).map((tk) => (
                    <TaskRow key={tk.id} task={tk} dateKey={tk.date} theme={theme} t={t} onToggle={toggleTaskDone} onDelete={deleteTask} onEdit={beginEdit} onToggleStep={toggleTemplateTaskStep} expanded={expandedTaskId === tk.id} onExpand={() => setExpandedTaskId(expandedTaskId === tk.id ? null : tk.id)} showDate />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <button onClick={() => setCalendarMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 28, height: 28, color: theme.text }}><ChevronLeft size={14} /></button>
                <div style={{ fontSize: 13.5, fontWeight: 600 }}>{calendarMonth.toLocaleDateString(localeFor(lang), { month: "long", year: "numeric" })}</div>
                <button onClick={() => setCalendarMonth((m) => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 28, height: 28, color: theme.text }}><ChevronRight size={14} /></button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                {t.weekdaysShort.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: theme.muted }}>{d}</div>)}
              </div>
              {(() => {
                const year = calendarMonth.getFullYear(), month = calendarMonth.getMonth();
                const firstDayOfWeek = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
                for (let day = 1; day <= daysInMonth; day++) cells.push(day);
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                    {cells.map((day, i) => {
                      if (day === null) return <div key={i} />;
                      const cellDate = new Date(year, month, day);
                      const k = dateKeyFor(cellDate);
                      const dayTasks = tasksForDate(k);
                      const isToday = k === todayKey();
                      const isSelected = k === selectedDay;
                      return (
                        <button key={i} onClick={() => setSelectedDay(isSelected ? null : k)} style={{ aspectRatio: "1", borderRadius: 8, border: isToday ? `1px solid ${theme.accent}` : "1px solid transparent", background: isSelected ? theme.accent : dayTasks.length ? theme.accent + "26" : "transparent", color: isSelected ? theme.bg : theme.text, fontSize: 11.5, fontWeight: dayTasks.length ? 600 : 400, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {day}
                          {dayTasks.length > 0 && !isSelected && <span style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: "50%", background: theme.accent }} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
              {selectedDay && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {tasksForDate(selectedDay).length === 0 ? (
                      <div style={{ fontSize: 12.5, color: theme.muted, textAlign: "center" }}>{t.noTasks}</div>
                    ) : tasksForDate(selectedDay).map((tk) => (
                      <TaskRow key={tk.id} task={tk} dateKey={selectedDay} theme={theme} t={t} onToggle={toggleTaskDone} onDelete={deleteTask} onEdit={beginEdit} onToggleStep={toggleTemplateTaskStep} expanded={expandedTaskId === tk.id} onExpand={() => setExpandedTaskId(expandedTaskId === tk.id ? null : tk.id)} />
                    ))}
                  </div>
                  <button onClick={() => { startNewDraft(selectedDay); setTodoView("list"); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: theme.panelSoft, border: `1px dashed ${theme.line}`, borderRadius: 10, padding: "9px 0", fontSize: 12, color: theme.accentSoft }}>
                    <Plus size={13} /> {t.addForThisDay}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {section === "templates" && (
        <div style={{ maxWidth: 460, margin: "24px auto 0", padding: "0 20px" }}>
          <button onClick={() => { setEditingTemplateId(null); setBuilderName(""); setBuilderSteps([""]); setShowBuilder(!showBuilder); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: theme.accent, color: theme.bg, border: "none", borderRadius: 14, padding: "13px 0", fontSize: 13.5, fontWeight: 600, marginBottom: 16 }}>
            <Sparkles size={15} /> {t.createCustom}
          </button>

          {showBuilder && (
            <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, marginBottom: 16, animation: "pop 0.25s ease" }}>
              <input value={builderName} onChange={(e) => setBuilderName(e.target.value)} placeholder={t.templateName} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", color: theme.text, fontSize: 13.5, outline: "none", marginBottom: 10 }} />
              {builderSteps.map((s, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <input value={s} onChange={(e) => setBuilderSteps(builderSteps.map((v, j) => j === i ? e.target.value : v))} placeholder={`${t.step} ${i + 1}: ${t.stepPlaceholder}`} style={{ flex: 1, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 12.5, outline: "none" }} />
                  {builderSteps.length > 1 && (
                    <button onClick={() => setBuilderSteps(builderSteps.filter((_, j) => j !== i))} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 32, color: theme.muted }}><X size={13} /></button>
                  )}
                </div>
              ))}
              <button onClick={() => setBuilderSteps([...builderSteps, ""])} style={{ background: "none", border: "none", color: theme.accentSoft, fontSize: 12.5, padding: "4px 0 12px", display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /> {t.addStep}</button>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => { setShowBuilder(false); setBuilderName(""); setBuilderSteps([""]); setEditingTemplateId(null); }} style={{ flex: 1, background: theme.panelSoft, color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 0", fontSize: 13 }}>{t.cancel}</button>
                <button onClick={saveCustomTemplate} style={{ flex: 1, background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600 }}>{t.save}</button>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {allTemplates.map((tpl) => {
              const content = getTemplateContent(tpl);
              const isOverridden = !tpl.isCustom && !!templateOverrides[tpl.id];
              const isOpen = openTemplateId === tpl.id;
              const prog = templateProgress[tpl.id];
              const checkedCount = prog && prog.date === todayKey() ? prog.checked.filter(Boolean).length : 0;
              const inTodo = tasks.some((tk) => tk.templateId === tpl.id);
              return (
                <div key={tpl.id} style={{ gridColumn: isOpen ? "1 / -1" : "auto" }}>
                  <button onClick={() => openTemplate(tpl)} style={{ width: "100%", background: isOpen ? theme.accent : theme.panel, color: isOpen ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 14, textAlign: "left" }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{tpl.icon}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{content.title}</div>
                    <div style={{ fontSize: 10.5, opacity: 0.7, marginTop: 4 }}>{checkedCount}/{content.steps.length} {tpl.isCustom ? `· ${t.customLabel}` : isOverridden ? `· ${lang === "de" ? "Angepasst" : "Edited"}` : ""}</div>
                  </button>
                  {isOpen && (
                    <div style={{ background: theme.panel, border: `1px solid ${theme.accent}55`, borderRadius: 14, padding: 16, marginTop: 8, animation: "pop 0.25s ease" }}>
                      {content.steps.map((step, i) => {
                        const checked = prog && prog.date === todayKey() ? prog.checked[i] : false;
                        return (
                          <button key={i} onClick={() => toggleStep(tpl.id, i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "8px 0", textAlign: "left", borderBottom: i < content.steps.length - 1 ? `1px solid ${theme.line}` : "none" }}>
                            <div style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${checked ? theme.accent : theme.line}`, background: checked ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {checked && <Check size={13} color={theme.bg} />}
                            </div>
                            <span style={{ fontSize: 13, color: theme.text, textDecoration: checked ? "line-through" : "none", opacity: checked ? 0.6 : 1 }}>{step}</span>
                          </button>
                        );
                      })}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button onClick={() => addTemplateToTodo(tpl)} disabled={inTodo} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: inTodo ? theme.panelSoft : theme.accent, color: inTodo ? theme.muted : theme.bg, border: "none", borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 600 }}>
                          <Plus size={13} /> {inTodo ? t.addedToTodo : t.addToTodo}
                        </button>
                        <button onClick={() => beginEditTemplate(tpl)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: theme.muted }}><Pencil size={13} /></button>
                        {tpl.isCustom && (
                          <button onClick={() => deleteCustomTemplate(tpl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: theme.muted }}><Trash2 size={13} /></button>
                        )}
                        {isOverridden && (
                          <button onClick={() => resetTemplateOverride(tpl.id)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 12px", fontSize: 11, color: theme.muted }}><RotateCcw size={12} /></button>
                        )}
                        <button onClick={() => setOpenTemplateId(null)} style={{ flex: 1, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "8px 0", fontSize: 12.5, color: theme.text }}>{t.cancel}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, dateKey, theme, t, onToggle, onDelete, onEdit, onToggleStep, expanded, onExpand, showDate }) {
  const isTemplateTask = !!task.steps;
  const stepState = isTemplateTask ? (task.stepProgress?.[dateKey] || new Array(task.steps.length).fill(false)) : null;
  const done = isTemplateTask ? stepState.every(Boolean) : task.completedDates.includes(dateKey);
  const doneCount = isTemplateTask ? stepState.filter(Boolean).length : null;

  return (
    <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
        {isTemplateTask ? (
          <button onClick={onExpand} style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${done ? theme.accent : theme.line}`, background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, color: done ? theme.bg : theme.muted, fontWeight: 700 }}>
            {done ? <Check size={14} color={theme.bg} /> : doneCount}
          </button>
        ) : (
          <button onClick={() => onToggle(task.id, dateKey)} style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${done ? theme.accent : theme.line}`, background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {done && <Check size={14} color={theme.bg} />}
          </button>
        )}
        <button onClick={() => isTemplateTask ? onExpand() : onEdit(task)} style={{ flex: 1, background: "none", border: "none", textAlign: "left", padding: 0 }}>
          <div style={{ fontSize: 13.5, color: theme.text, textDecoration: done ? "line-through" : "none", opacity: done ? 0.55 : 1 }}>{task.text}</div>
          <div style={{ fontSize: 10.5, color: theme.muted, display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "wrap" }}>
            {task.repeat !== "none" && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Repeat size={10} /> {task.repeat === "custom" ? (task.customDays || []).sort().map((x) => t.weekdaysShort[x]).join("") : task.repeat}</span>}
            {showDate && task.date && <span>{task.date}{task.time ? `, ${task.time}` : ""}</span>}
            {task.time && !showDate && <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Clock size={10} /> {task.time}</span>}
            {task.reminderMinutes !== null && task.reminderMinutes !== undefined && <Bell size={10} />}
            {isTemplateTask && <span>{doneCount}/{task.steps.length} {t.stepsOf}</span>}
          </div>
        </button>
        {isTemplateTask && <ChevronDown size={15} color={theme.muted} style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }} onClick={onExpand} />}
        <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", color: theme.muted, padding: 4 }}><Pencil size={13} /></button>
        <button onClick={() => onDelete(task.id)} style={{ background: "none", border: "none", color: theme.muted, padding: 4 }}><Trash2 size={14} /></button>
      </div>
      {isTemplateTask && expanded && (
        <div style={{ padding: "0 12px 12px", borderTop: `1px solid ${theme.line}` }}>
          {task.steps.map((step, i) => (
            <button key={i} onClick={() => onToggleStep(task.id, dateKey, i)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "9px 0", textAlign: "left" }}>
              <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${stepState[i] ? theme.accent : theme.line}`, background: stepState[i] ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {stepState[i] && <Check size={12} color={theme.bg} />}
              </div>
              <span style={{ fontSize: 12.5, color: theme.text, textDecoration: stepState[i] ? "line-through" : "none", opacity: stepState[i] ? 0.55 : 1 }}>{step}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


const CHALLENGES_STRINGS = {
  en: {
    title: "Challenges", newChallenge: "New Challenge", noChallenges: "No challenges yet — start one below.",
    manualName: "Challenge name…", manualDays: "Duration (days)",
    dayPlanTitle: "Daily checklists (optional)", dayPlanHint: "Give a day its own checklist — one task per line. Days you skip just get a simple tap-to-complete. You can always add or edit these later.",
    dayNum: "Day", tasksPlaceholder: "One task per line…", addDayActivity: "Add a day",
    create: "Create challenge", cancel: "Cancel", save: "Save changes", delete: "Delete this challenge?",
    dayLabel: "Day", of: "of", milestones: "Milestones", dailyFocus: "Overview",
    startedOn: "Started", disclaimer: "This is a general plan, not medical or professional advice — check with a doctor before starting any new diet, fasting, or exercise routine.",
    back: "Back", day: "Day", tapToCheck: "Tap a day to mark it complete", dailyPlan: "Daily Plan",
    tasksOf: "tasks", addPhoto: "Add photo", gallery: "Progress Gallery", before: "Before", after: "Latest", noPhotosYet: "Add a photo when you check off a day to build your before/after gallery.",
    editPlan: "Edit plan", editingPlan: "Edit Plan", noDayPlan: "No daily checklists yet — add one below.",
  },
  de: {
    title: "Challenges", newChallenge: "Neue Challenge", noChallenges: "Noch keine Challenges — starte unten eine.",
    manualName: "Name der Challenge…", manualDays: "Dauer (Tage)",
    dayPlanTitle: "Tages-Checklisten (optional)", dayPlanHint: "Gib einem Tag seine eigene Checkliste — eine Aufgabe pro Zeile. Ausgelassene Tage bekommen ein einfaches Tap-to-complete. Du kannst das später jederzeit ergänzen oder ändern.",
    dayNum: "Tag", tasksPlaceholder: "Eine Aufgabe pro Zeile…", addDayActivity: "Tag hinzufügen",
    create: "Challenge erstellen", cancel: "Abbrechen", save: "Änderungen speichern", delete: "Diese Challenge löschen?",
    dayLabel: "Tag", of: "von", milestones: "Meilensteine", dailyFocus: "Überblick",
    startedOn: "Gestartet", disclaimer: "Das ist ein allgemeiner Plan, keine medizinische oder professionelle Beratung — sprich mit einem Arzt, bevor du eine neue Diät-, Fasten- oder Sportroutine beginnst.",
    back: "Zurück", day: "Tag", tapToCheck: "Tippe einen Tag an, um ihn abzuhaken", dailyPlan: "Tagesplan",
    tasksOf: "Aufgaben", addPhoto: "Foto hinzufügen", gallery: "Fortschrittsgalerie", before: "Vorher", after: "Aktuell", noPhotosYet: "Füge beim Abhaken eines Tages ein Foto hinzu, um deine Vorher/Nachher-Galerie aufzubauen.",
    editPlan: "Plan bearbeiten", editingPlan: "Plan bearbeiten", noDayPlan: "Noch keine Tages-Checklisten — füge unten eine hinzu.",
  },
  es: {
    title: "Desafíos", newChallenge: "Nuevo desafío", noChallenges: "Aún no hay desafíos — empieza uno abajo.",
    manualName: "Nombre del desafío…", manualDays: "Duración (días)",
    dayPlanTitle: "Listas diarias (opcional)", dayPlanHint: "Dale a un día su propia lista — una tarea por línea. Los días que te saltes solo tendrán un simple toque para completar. Siempre puedes añadir o editar esto más tarde.",
    dayNum: "Día", tasksPlaceholder: "Una tarea por línea…", addDayActivity: "Añadir un día",
    create: "Crear desafío", cancel: "Cancelar", save: "Guardar cambios", delete: "¿Eliminar este desafío?",
    dayLabel: "Día", of: "de", milestones: "Hitos", dailyFocus: "Resumen",
    startedOn: "Comenzado", disclaimer: "Este es un plan general, no un consejo médico o profesional — consulta a un médico antes de empezar cualquier dieta, ayuno o rutina de ejercicio nueva.",
    back: "Atrás", day: "Día", tapToCheck: "Toca un día para marcarlo como completado", dailyPlan: "Plan diario",
    tasksOf: "tareas", addPhoto: "Añadir foto", gallery: "Galería de progreso", before: "Antes", after: "Más reciente", noPhotosYet: "Añade una foto al marcar un día para crear tu galería de antes/después.",
    editPlan: "Editar plan", editingPlan: "Editar plan", noDayPlan: "Aún no hay listas diarias — añade una abajo.",
  },
  fr: {
    title: "Défis", newChallenge: "Nouveau défi", noChallenges: "Pas encore de défi — lance-en un ci-dessous.",
    manualName: "Nom du défi…", manualDays: "Durée (jours)",
    dayPlanTitle: "Listes quotidiennes (facultatif)", dayPlanHint: "Donne à un jour sa propre liste — une tâche par ligne. Les jours que tu sautes n'auront qu'un simple bouton à cocher. Tu pourras toujours ajouter ou modifier cela plus tard.",
    dayNum: "Jour", tasksPlaceholder: "Une tâche par ligne…", addDayActivity: "Ajouter un jour",
    create: "Créer le défi", cancel: "Annuler", save: "Enregistrer les modifications", delete: "Supprimer ce défi ?",
    dayLabel: "Jour", of: "sur", milestones: "Étapes clés", dailyFocus: "Aperçu",
    startedOn: "Commencé", disclaimer: "Ceci est un plan général, pas un avis médical ou professionnel — consulte un médecin avant de commencer un nouveau régime, jeûne ou programme d'exercice.",
    back: "Retour", day: "Jour", tapToCheck: "Touche un jour pour le marquer comme terminé", dailyPlan: "Plan quotidien",
    tasksOf: "tâches", addPhoto: "Ajouter une photo", gallery: "Galerie de progression", before: "Avant", after: "Le plus récent", noPhotosYet: "Ajoute une photo en cochant un jour pour construire ta galerie avant/après.",
    editPlan: "Modifier le plan", editingPlan: "Modifier le plan", noDayPlan: "Pas encore de liste quotidienne — ajoute-en une ci-dessous.",
  },
  it: {
    title: "Sfide", newChallenge: "Nuova sfida", noChallenges: "Nessuna sfida ancora — iniziane una qui sotto.",
    manualName: "Nome della sfida…", manualDays: "Durata (giorni)",
    dayPlanTitle: "Liste giornaliere (facoltativo)", dayPlanHint: "Dai a un giorno la sua lista — un compito per riga. I giorni che salti avranno solo un semplice tocco per completare. Puoi sempre aggiungere o modificare in seguito.",
    dayNum: "Giorno", tasksPlaceholder: "Un compito per riga…", addDayActivity: "Aggiungi un giorno",
    create: "Crea sfida", cancel: "Annulla", save: "Salva modifiche", delete: "Eliminare questa sfida?",
    dayLabel: "Giorno", of: "di", milestones: "Traguardi", dailyFocus: "Panoramica",
    startedOn: "Iniziata", disclaimer: "Questo è un piano generale, non un consiglio medico o professionale — consulta un medico prima di iniziare qualsiasi nuova dieta, digiuno o routine di esercizio.",
    back: "Indietro", day: "Giorno", tapToCheck: "Tocca un giorno per segnarlo come completato", dailyPlan: "Piano giornaliero",
    tasksOf: "attività", addPhoto: "Aggiungi foto", gallery: "Galleria progressi", before: "Prima", after: "Più recente", noPhotosYet: "Aggiungi una foto quando segni un giorno per creare la tua galleria prima/dopo.",
    editPlan: "Modifica piano", editingPlan: "Modifica piano", noDayPlan: "Ancora nessuna lista giornaliera — aggiungine una qui sotto.",
  },
  pt: {
    title: "Desafios", newChallenge: "Novo desafio", noChallenges: "Ainda sem desafios — comece um abaixo.",
    manualName: "Nome do desafio…", manualDays: "Duração (dias)",
    dayPlanTitle: "Listas diárias (opcional)", dayPlanHint: "Dê a um dia sua própria lista — uma tarefa por linha. Os dias que você pular terão apenas um toque simples para concluir. Você sempre pode adicionar ou editar isso depois.",
    dayNum: "Dia", tasksPlaceholder: "Uma tarefa por linha…", addDayActivity: "Adicionar um dia",
    create: "Criar desafio", cancel: "Cancelar", save: "Salvar alterações", delete: "Excluir este desafio?",
    dayLabel: "Dia", of: "de", milestones: "Marcos", dailyFocus: "Visão geral",
    startedOn: "Iniciado", disclaimer: "Este é um plano geral, não um conselho médico ou profissional — consulte um médico antes de começar qualquer nova dieta, jejum ou rotina de exercícios.",
    back: "Voltar", day: "Dia", tapToCheck: "Toque em um dia para marcá-lo como concluído", dailyPlan: "Plano diário",
    tasksOf: "tarefas", addPhoto: "Adicionar foto", gallery: "Galeria de progresso", before: "Antes", after: "Mais recente", noPhotosYet: "Adicione uma foto ao marcar um dia para criar sua galeria de antes/depois.",
    editPlan: "Editar plano", editingPlan: "Editar plano", noDayPlan: "Ainda sem listas diárias — adicione uma abaixo.",
  },
  tr: {
    title: "Hedefler", newChallenge: "Yeni Hedef", noChallenges: "Henüz hedef yok — aşağıdan bir tane başlat.",
    manualName: "Hedef adı…", manualDays: "Süre (gün)",
    dayPlanTitle: "Günlük listeler (isteğe bağlı)", dayPlanHint: "Bir güne kendi listesini ver — satır başına bir görev. Atladığın günler basit bir dokunuşla tamamlanır. Bunu daha sonra her zaman ekleyebilir veya düzenleyebilirsin.",
    dayNum: "Gün", tasksPlaceholder: "Satır başına bir görev…", addDayActivity: "Gün ekle",
    create: "Hedef oluştur", cancel: "İptal", save: "Değişiklikleri kaydet", delete: "Bu hedef silinsin mi?",
    dayLabel: "Gün", of: "/", milestones: "Kilometre taşları", dailyFocus: "Genel bakış",
    startedOn: "Başlangıç", disclaimer: "Bu genel bir plandır, tıbbi veya profesyonel tavsiye değildir — yeni bir diyete, oruca veya egzersiz rutinine başlamadan önce bir doktora danış.",
    back: "Geri", day: "Gün", tapToCheck: "Tamamlandı olarak işaretlemek için bir güne dokun", dailyPlan: "Günlük Plan",
    tasksOf: "görev", addPhoto: "Fotoğraf ekle", gallery: "İlerleme Galerisi", before: "Önce", after: "En son", noPhotosYet: "Öncesi/sonrası galerini oluşturmak için bir günü işaretlerken fotoğraf ekle.",
    editPlan: "Planı düzenle", editingPlan: "Planı Düzenle", noDayPlan: "Henüz günlük liste yok — aşağıdan bir tane ekle.",
  },
  ar: {
    title: "التحديات", newChallenge: "تحدٍ جديد", noChallenges: "لا توجد تحديات بعد — ابدأ واحدًا أدناه.",
    manualName: "اسم التحدي…", manualDays: "المدة (أيام)",
    dayPlanTitle: "قوائم يومية (اختياري)", dayPlanHint: "امنح كل يوم قائمته الخاصة — مهمة واحدة في كل سطر. الأيام التي تتخطاها ستحصل فقط على علامة إتمام بسيطة. يمكنك دائمًا الإضافة أو التعديل لاحقًا.",
    dayNum: "اليوم", tasksPlaceholder: "مهمة واحدة في كل سطر…", addDayActivity: "إضافة يوم",
    create: "إنشاء تحدٍ", cancel: "إلغاء", save: "حفظ التغييرات", delete: "حذف هذا التحدي؟",
    dayLabel: "اليوم", of: "من", milestones: "الإنجازات", dailyFocus: "نظرة عامة",
    startedOn: "بدأ في", disclaimer: "هذه خطة عامة وليست نصيحة طبية أو مهنية — استشر طبيبًا قبل بدء أي نظام غذائي أو صيام أو روتين تمارين جديد.",
    back: "رجوع", day: "اليوم", tapToCheck: "اضغط على يوم لتحديده كمكتمل", dailyPlan: "الخطة اليومية",
    tasksOf: "مهام", addPhoto: "إضافة صورة", gallery: "معرض التقدم", before: "قبل", after: "الأحدث", noPhotosYet: "أضف صورة عند تحديد يوم لبناء معرض قبل/بعد الخاص بك.",
    editPlan: "تعديل الخطة", editingPlan: "تعديل الخطة", noDayPlan: "لا توجد قوائم يومية بعد — أضف واحدة أدناه.",
  },
};

const CATEGORY_ICON = { fitness: "💪", diet: "🥗", faith: "🙏", habit: "✨", study: "📚", other: "🎯" };

function challengesTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

function compressImage(file, maxSize = 500) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height && width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
        else if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Turn a challenge's `days` array into editable text rows: [{ day, tasksText }]
function daysToRows(days) {
  return (days || []).map((d) => ({ day: String(d.day), tasksText: d.tasks.join("\n") }));
}
// Turn edited rows back into a `days` array, capped to totalDays
function rowsToDays(rows, totalDays) {
  return rows
    .filter((r) => r.day && r.tasksText.trim())
    .map((r) => ({ day: Math.min(totalDays, Math.max(1, Number(r.day) || 1)), tasks: r.tasksText.split("\n").map((s) => s.trim()).filter(Boolean) }))
    .filter((r) => r.tasks.length > 0);
}
// When a day's task list changes shape, keep as much existing progress as still applies
function reconcileProgress(oldProgress, newDays) {
  const next = {};
  newDays.forEach((d) => {
    const old = oldProgress?.[d.day] || [];
    next[d.day] = d.tasks.map((_, i) => !!old[i]);
  });
  return next;
}

function Challenges({ globalTheme, globalLang }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [challenges, setChallenges] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualDays, setManualDays] = useState("21");
  const [dayPlanRows, setDayPlanRows] = useState([]);

  const [openChallengeId, setOpenChallengeId] = useState(null);

  const t = CHALLENGES_STRINGS[lang] || CHALLENGES_STRINGS.en;
  const theme = THEMES[themeKey];

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("challenges-state-v3");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          setChallenges(d.challenges || []);
        }
      } catch (e) {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try { await supaSet("challenges-state-v3", JSON.stringify({ challenges, themeKey, lang })); }
      catch (e) { console.error(e); }
    })();
  }, [challenges, themeKey, lang, storageReady]);

  const liveSyncCtx = useContext(LiveSyncContext);
  useEffect(() => {
    liveSyncCtx?.updateLiveSync("challenges", { challenges, setChallenges });
  }, [challenges]);

  function createManualChallenge() {
    if (!manualName.trim()) return;
    const totalDays = Math.min(365, Math.max(1, Number(manualDays) || 21));
    const days = rowsToDays(dayPlanRows, totalDays);
    const challenge = {
      id: Date.now(),
      title: manualName.trim(),
      totalDays,
      dailyFocus: "",
      days,
      dayTasksProgress: {},
      dayPhotos: {},
      category: "other",
      needsDisclaimer: false,
      milestones: [{ day: totalDays, label: lang === "de" ? "Geschafft!" : "Goal reached!" }],
      startDate: challengesTodayISO(),
      checkedDays: [],
      source: "manual",
    };
    setChallenges([challenge, ...challenges]);
    resetCreateForm();
  }

  function resetCreateForm() {
    setShowCreate(false); setDayPlanRows([]);
    setManualName(""); setManualDays("21");
  }

  function toggleSimpleDay(challengeId, day) {
    setChallenges(challenges.map((c) => {
      if (c.id !== challengeId) return c;
      const has = c.checkedDays.includes(day);
      return { ...c, checkedDays: has ? c.checkedDays.filter((d) => d !== day) : [...c.checkedDays, day] };
    }));
  }

  function toggleDayTask(challengeId, day, taskIndex, taskCount) {
    setChallenges(challenges.map((c) => {
      if (c.id !== challengeId) return c;
      const existing = c.dayTasksProgress?.[day] || new Array(taskCount).fill(false);
      const updated = [...existing];
      updated[taskIndex] = !updated[taskIndex];
      return { ...c, dayTasksProgress: { ...c.dayTasksProgress, [day]: updated } };
    }));
  }

  async function addDayPhoto(challengeId, day, file) {
    const compressed = await compressImage(file);
    setChallenges((prev) => prev.map((c) => c.id !== challengeId ? c : { ...c, dayPhotos: { ...c.dayPhotos, [day]: compressed } }));
  }

  function updateChallengePlan(challengeId, newTotalDays, newDays, newTitle) {
    setChallenges(challenges.map((c) => {
      if (c.id !== challengeId) return c;
      const reconciled = reconcileProgress(c.dayTasksProgress, newDays);
      const cappedMilestones = (c.milestones || []).map((m) => ({ ...m, day: Math.min(m.day, newTotalDays) }));
      return { ...c, title: newTitle, totalDays: newTotalDays, days: newDays, dayTasksProgress: reconciled, milestones: cappedMilestones };
    }));
  }

  function deleteChallenge(id) {
    setChallenges(challenges.filter((c) => c.id !== id));
    if (openChallengeId === id) setOpenChallengeId(null);
  }

  const openChallenge = challenges.find((c) => c.id === openChallengeId);

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 120, transition: "background 0.4s ease, color 0.4s ease" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        button { font-family: inherit; cursor: pointer; }
        input, textarea, select { font-family: inherit; }
        .fraunces { font-family: 'Fraunces', serif; }
        @keyframes pop { 0% { transform: scale(0.95); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 0" }}>
        {openChallenge ? (
          <button onClick={() => setOpenChallengeId(null)} style={{ display: "flex", alignItems: "center", gap: 6, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "8px 14px", color: theme.text, fontSize: 13 }}>
            <ChevronLeft size={15} /> {t.back}
          </button>
        ) : (
          <div className="fraunces" style={{ fontSize: 20 }}>{t.title}</div>
        )}
      </div>

      <div style={{ maxWidth: 460, margin: "20px auto 0", padding: "0 20px" }}>

        {openChallenge ? (
          <ChallengeDetail challenge={openChallenge} theme={theme} t={t} lang={lang} onToggleSimpleDay={toggleSimpleDay} onToggleDayTask={toggleDayTask} onAddPhoto={addDayPhoto} onDelete={deleteChallenge} onUpdatePlan={updateChallengePlan} />
        ) : (
          <>
            {!showCreate && (
              <button onClick={() => setShowCreate(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: theme.accent, color: theme.bg, border: "none", borderRadius: 14, padding: "13px 0", fontSize: 13.5, fontWeight: 600, marginBottom: 20 }}>
                <Plus size={15} /> {t.newChallenge}
              </button>
            )}

            {showCreate && (
              <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 18, padding: 18, marginBottom: 20, animation: "pop 0.25s ease" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                  <Target size={15} color={theme.accent} />
                  <div className="fraunces" style={{ fontSize: 15 }}>{t.newChallenge}</div>
                </div>

                <input value={manualName} onChange={(e) => setManualName(e.target.value)} placeholder={t.manualName} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", color: theme.text, fontSize: 13.5, outline: "none", marginBottom: 10 }} />
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.manualDays}</div>
                  <input type="text" inputMode="numeric" value={manualDays} onChange={(e) => setManualDays(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 100, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 13 }} />
                </div>

                <DayPlanEditor rows={dayPlanRows} setRows={setDayPlanRows} theme={theme} t={t} />

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={resetCreateForm} style={{ flex: 1, background: theme.panelSoft, color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 0", fontSize: 13 }}>{t.cancel}</button>
                  <button onClick={createManualChallenge} disabled={!manualName.trim()} style={{ flex: 2, background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600, opacity: manualName.trim() ? 1 : 0.6 }}>{t.create}</button>
                </div>
              </div>
            )}

            {challenges.length === 0 ? (
              <div style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginTop: 30 }}>{t.noChallenges}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {challenges.map((c) => {
                  const pct = computePct(c);
                  return (
                    <button key={c.id} onClick={() => setOpenChallengeId(c.id)} style={{ display: "flex", alignItems: "center", gap: 14, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 14, textAlign: "left" }}>
                      <MiniRing pct={pct} theme={theme} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{CATEGORY_ICON[c.category] || "🎯"} {c.title}</div>
                        <div style={{ fontSize: 11.5, color: theme.muted, marginTop: 2 }}>{pct}% · {c.totalDays} {t.day.toLowerCase()}s</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Reusable day-by-day checklist builder — used both at creation and when editing later
function DayPlanEditor({ rows, setRows, theme, t }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.accentSoft, marginBottom: 4 }}>{t.dayPlanTitle}</div>
      <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 10, lineHeight: 1.4 }}>{t.dayPlanHint}</div>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "0 6px", flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: theme.muted, whiteSpace: "nowrap" }}>{t.dayNum}</span>
            <input type="text" inputMode="numeric" value={row.day}
              onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setRows(rows.map((r, j) => j === i ? { ...r, day: v } : r)); }}
              style={{ width: 32, background: "transparent", border: "none", padding: "8px 2px", color: theme.text, fontSize: 12.5, textAlign: "center" }} />
          </div>
          <textarea value={row.tasksText} onChange={(e) => setRows(rows.map((r, j) => j === i ? { ...r, tasksText: e.target.value } : r))}
            placeholder={t.tasksPlaceholder} rows={2}
            style={{ flex: 1, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 12.5, outline: "none", resize: "vertical" }} />
          <button onClick={() => setRows(rows.filter((_, j) => j !== i))} style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, width: 30, height: 34, color: theme.muted, flexShrink: 0 }}><X size={13} /></button>
        </div>
      ))}
      <button onClick={() => setRows([...rows, { day: String(rows.length + 1), tasksText: "" }])} style={{ background: "none", border: "none", color: theme.accentSoft, fontSize: 12.5, padding: "2px 0 14px", display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /> {t.addDayActivity}</button>
    </div>
  );
}

function isDayDone(challenge, day) {
  const dayPlan = (challenge.days || []).find((d) => d.day === day);
  if (dayPlan) {
    const progress = challenge.dayTasksProgress?.[day];
    return !!progress && progress.length === dayPlan.tasks.length && progress.every(Boolean);
  }
  return challenge.checkedDays.includes(day);
}
function computePct(challenge) {
  let done = 0;
  for (let d = 1; d <= challenge.totalDays; d++) if (isDayDone(challenge, d)) done++;
  return Math.round((done / challenge.totalDays) * 100);
}

function MiniRing({ pct, theme }) {
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: 52, height: 52, flexShrink: 0 }}>
      <svg viewBox="0 0 52 52" width="52" height="52" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke={theme.line} strokeWidth="5" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={theme.accent} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: theme.text }}>{pct}%</div>
    </div>
  );
}

function ChallengeDetail({ challenge, theme, t, lang, onToggleSimpleDay, onToggleDayTask, onAddPhoto, onDelete, onUpdatePlan }) {
  const pct = computePct(challenge);
  const r = 70, circ = 2 * Math.PI * r;
  const days = Array.from({ length: challenge.totalDays }, (_, i) => i + 1);
  const [expandedDay, setExpandedDay] = useState(null);
  const fileInputRefs = useRef({});

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(challenge.title);
  const [editTotalDays, setEditTotalDays] = useState(String(challenge.totalDays));
  const [editRows, setEditRows] = useState(() => daysToRows(challenge.days));

  const photoEntries = Object.entries(challenge.dayPhotos || {}).map(([d, url]) => ({ day: Number(d), url })).sort((a, b) => a.day - b.day);
  const beforePhoto = photoEntries[0];
  const afterPhoto = photoEntries[photoEntries.length - 1];

  function triggerPhotoInput(day) {
    fileInputRefs.current[day]?.click();
  }

  function openEditor() {
    setEditTitle(challenge.title);
    setEditTotalDays(String(challenge.totalDays));
    setEditRows(daysToRows(challenge.days));
    setEditing(true);
  }

  function saveEdits() {
    const totalDays = Math.min(365, Math.max(1, Number(editTotalDays) || challenge.totalDays));
    const newDays = rowsToDays(editRows, totalDays);
    onUpdatePlan(challenge.id, totalDays, newDays, editTitle.trim() || challenge.title);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ animation: "pop 0.25s ease" }}>
        <div style={{ background: theme.panel, border: `1px solid ${theme.accent}`, borderRadius: 18, padding: 18, marginBottom: 18 }}>
          <div className="fraunces" style={{ fontSize: 16, marginBottom: 14 }}>{t.editingPlan}</div>
          <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder={t.manualName} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", color: theme.text, fontSize: 13.5, outline: "none", marginBottom: 10 }} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{t.manualDays}</div>
            <input type="text" inputMode="numeric" value={editTotalDays} onChange={(e) => setEditTotalDays(e.target.value.replace(/[^0-9]/g, ""))} style={{ width: 100, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 8, padding: "8px 10px", color: theme.text, fontSize: 13 }} />
          </div>
          {editRows.length === 0 && <div style={{ fontSize: 12, color: theme.muted, marginBottom: 10 }}>{t.noDayPlan}</div>}
          <DayPlanEditor rows={editRows} setRows={setEditRows} theme={theme} t={t} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, background: theme.panelSoft, color: theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 0", fontSize: 13 }}>{t.cancel}</button>
            <button onClick={saveEdits} style={{ flex: 2, background: theme.accent, color: theme.bg, border: "none", borderRadius: 10, padding: "10px 0", fontSize: 13, fontWeight: 600 }}>{t.save}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "pop 0.25s ease" }}>
      <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: 22, marginBottom: 18, textAlign: "center", position: "relative" }}>
        <button onClick={openEditor} style={{ position: "absolute", top: 16, right: 16, display: "flex", alignItems: "center", gap: 5, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "6px 10px", fontSize: 11, color: theme.accentSoft }}>
          <Pencil size={11} /> {t.editPlan}
        </button>
        <div style={{ fontSize: 26, marginBottom: 6 }}>{CATEGORY_ICON[challenge.category] || "🎯"}</div>
        <div className="fraunces" style={{ fontSize: 19, marginBottom: 4 }}>{challenge.title}</div>
        <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 18 }}>{t.startedOn} {challenge.startDate}</div>

        <div style={{ position: "relative", width: 160, height: 160, margin: "0 auto 14px" }}>
          <svg viewBox="0 0 160 160" width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="80" cy="80" r={r} fill="none" stroke={theme.line} strokeWidth="10" />
            <circle cx="80" cy="80" r={r} fill="none" stroke={theme.accent} strokeWidth="10" strokeLinecap="round"
              strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
          </svg>
          <div className="fraunces" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 32 }}>{pct}%</span>
            <span style={{ fontSize: 11, color: theme.muted, fontFamily: "'Inter', sans-serif" }}>{challenge.totalDays} {t.day.toLowerCase()}s {lang === "de" ? "gesamt" : "total"}</span>
          </div>
        </div>

        {challenge.needsDisclaimer && (
          <div style={{ fontSize: 10, color: theme.muted, lineHeight: 1.4, marginTop: 10, fontStyle: "italic" }}>{t.disclaimer}</div>
        )}
      </div>

      <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
        <div className="fraunces" style={{ fontSize: 15, marginBottom: 10 }}>{t.gallery}</div>
        {photoEntries.length === 0 ? (
          <div style={{ fontSize: 12, color: theme.muted, lineHeight: 1.4 }}>{t.noPhotosYet}</div>
        ) : (
          <>
            {photoEntries.length > 1 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <img src={beforePhoto.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, display: "block" }} />
                  <div style={{ fontSize: 10, color: theme.muted, textAlign: "center", marginTop: 4 }}>{t.before} · {t.day} {beforePhoto.day}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <img src={afterPhoto.url} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 10, display: "block" }} />
                  <div style={{ fontSize: 10, color: theme.muted, textAlign: "center", marginTop: 4 }}>{t.after} · {t.day} {afterPhoto.day}</div>
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
              {photoEntries.map((p) => (
                <img key={p.day} src={p.url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
              ))}
            </div>
          </>
        )}
      </div>

      {challenge.milestones && challenge.milestones.length > 0 && (
        <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
          <div className="fraunces" style={{ fontSize: 15, marginBottom: 10 }}>{t.milestones}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {challenge.milestones.map((m, i) => {
              let doneCount = 0;
              for (let d = 1; d <= m.day; d++) if (isDayDone(challenge, d)) doneCount++;
              const reached = doneCount >= m.day;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: reached ? theme.accent : theme.panelSoft, border: `1px solid ${reached ? theme.accent : theme.line}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {reached ? <Check size={12} color={theme.bg} /> : <Flag size={10} color={theme.muted} />}
                  </div>
                  <span style={{ fontSize: 12.5, color: reached ? theme.text : theme.muted }}>{t.day} {m.day} — {m.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {challenge.days && challenge.days.length > 0 && (
        <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
          <div className="fraunces" style={{ fontSize: 15, marginBottom: 10 }}>{t.dailyPlan}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...challenge.days].sort((a, b) => a.day - b.day).map((dayPlan) => {
              const progress = challenge.dayTasksProgress?.[dayPlan.day] || new Array(dayPlan.tasks.length).fill(false);
              const doneCount = progress.filter(Boolean).length;
              const allDone = doneCount === dayPlan.tasks.length;
              const isExpanded = expandedDay === dayPlan.day;
              const photo = challenge.dayPhotos?.[dayPlan.day];
              return (
                <div key={dayPlan.day} style={{ background: theme.panelSoft, borderRadius: 12, overflow: "hidden" }}>
                  <button onClick={() => setExpandedDay(isExpanded ? null : dayPlan.day)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none", textAlign: "left" }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${allDone ? theme.accent : theme.line}`, background: allDone ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 9, color: allDone ? theme.bg : theme.muted, fontWeight: 700 }}>
                      {allDone ? <Check size={13} color={theme.bg} /> : doneCount}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text }}>{t.day} {dayPlan.day}</div>
                      <div style={{ fontSize: 10.5, color: theme.muted }}>{doneCount}/{dayPlan.tasks.length} {t.tasksOf}</div>
                    </div>
                    {photo && <img src={photo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                    <ChevronDown size={15} color={theme.muted} style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s ease", flexShrink: 0 }} />
                  </button>
                  {isExpanded && (
                    <div style={{ padding: "0 12px 12px" }}>
                      {dayPlan.tasks.map((task, i) => (
                        <button key={i} onClick={() => onToggleDayTask(challenge.id, dayPlan.day, i, dayPlan.tasks.length)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", padding: "7px 0", textAlign: "left" }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${progress[i] ? theme.accent : theme.line}`, background: progress[i] ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {progress[i] && <Check size={12} color={theme.bg} />}
                          </div>
                          <span style={{ fontSize: 12.5, color: theme.text, textDecoration: progress[i] ? "line-through" : "none", opacity: progress[i] ? 0.55 : 1 }}>{task}</span>
                        </button>
                      ))}
                      <input ref={(el) => (fileInputRefs.current[dayPlan.day] = el)} type="file" accept="image/*" style={{ display: "none" }}
                        onChange={(e) => e.target.files[0] && onAddPhoto(challenge.id, dayPlan.day, e.target.files[0])} />
                      <button onClick={() => triggerPhotoInput(dayPlan.day)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${theme.line}`, borderRadius: 8, padding: "6px 10px", fontSize: 11, color: theme.accentSoft, marginTop: 6 }}>
                        {photo ? <ImageIcon size={12} /> : <Camera size={12} />} {t.addPhoto}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
        <div className="fraunces" style={{ fontSize: 15, marginBottom: 4 }}>{t.title}</div>
        <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{t.tapToCheck}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
          {days.map((day) => {
            const hasChecklist = (challenge.days || []).some((d) => d.day === day);
            const done = isDayDone(challenge, day);
            return (
              <button
                key={day}
                onClick={() => hasChecklist ? setExpandedDay(day) : onToggleSimpleDay(challenge.id, day)}
                style={{ position: "relative", aspectRatio: "1", borderRadius: 8, border: `1px solid ${done ? theme.accent : theme.line}`, background: done ? theme.accent : theme.panelSoft, color: done ? theme.bg : theme.muted, fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                {done ? <Check size={12} /> : day}
                {hasChecklist && !done && <span style={{ position: "absolute", top: 3, right: 3, width: 4, height: 4, borderRadius: "50%", background: theme.accent }} />}
              </button>
            );
          })}
        </div>
      </div>

      <button onClick={() => onDelete(challenge.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "none", border: `1px solid ${theme.line}`, borderRadius: 12, padding: "12px 0", fontSize: 12.5, color: theme.muted }}>
        <Trash2 size={14} /> {t.delete}
      </button>
    </div>
  );
}


const REFLECT_STRINGS = {
  en: {
    title: "Reflect", subtitle: "Your mood, your words, your year.",
    howFeeling: "How are you feeling today?",
    journalTitle: "Journal", journalPlaceholder: "Write whatever's on your mind…", save: "Save", saved: "Saved for today",
    hydrationTitle: "Hydration", liters: "liters today",
    habitStats: "Habit Stats", overallStreak: "Overall streak", questStreak: "Quest streak",
    questsCompleted: "Quests completed", tasksCompleted: "Tasks completed", challengeDays: "Challenge days logged",
    moodCheckins: "Mood check-ins", journalEntries: "Journal entries", avgHydration: "Avg liters/day", badges: "Badges collected",
    notTracked: "Not tracked yet",
    yearInReview: "Year in Review", viewWrapped: "View My {year} Wrapped", notEnoughData: "Not enough logged yet this year — check back as it fills in.",
    pastEntries: "Recent entries", noEntries: "Nothing logged yet.",
    days: "days", entries: "entries",
    wrappedIntro: "Your {year}\nin Review", tapToBegin: "Tap to begin",
    slideQuestsTitle: "Quests completed", slideStreakTitle: "Longest streak", slideMoodTitle: "Most-felt mood", slideJournalTitle: "Words written down", slideHydrationTitle: "Average hydration", slideTasksTitle: "Tasks handled", slideMemoryTitle: "A moment worth remembering", slideBadgesTitle: "Badges collected", slideClosingTitle: "That's a wrap", slideClosingSub: "Here's to the next one.",
    topCategory: "Most active in", download: "Download image", close: "Close",
    cupsUnit: "L", entriesUnit: "entries", daysUnit: "days",
    yourYearAtAGlance: "Your year at a glance", timesCried: "times you cried", goodNewsMoments: "good news moments", litersThisYear: "liters this year",
  },
  de: {
    title: "Reflect", subtitle: "Deine Stimmung, deine Worte, dein Jahr.",
    howFeeling: "Wie fühlst du dich heute?",
    journalTitle: "Tagebuch", journalPlaceholder: "Schreib, was dir gerade durch den Kopf geht…", save: "Speichern", saved: "Heute gespeichert",
    hydrationTitle: "Hydration", liters: "Liter heute",
    habitStats: "Gewohnheits-Statistik", overallStreak: "Gesamt-Serie", questStreak: "Quest-Serie",
    questsCompleted: "Aufgaben erledigt", tasksCompleted: "Todos erledigt", challengeDays: "Challenge-Tage",
    moodCheckins: "Stimmungs-Check-ins", journalEntries: "Tagebucheinträge", avgHydration: "Ø Liter/Tag", badges: "Abzeichen gesammelt",
    notTracked: "Noch nicht erfasst",
    yearInReview: "Jahresrückblick", viewWrapped: "Meinen {year} Rückblick ansehen", notEnoughData: "Noch nicht genug erfasst dieses Jahr — schau später wieder vorbei.",
    pastEntries: "Letzte Einträge", noEntries: "Noch nichts eingetragen.",
    days: "Tage", entries: "Einträge",
    wrappedIntro: "Dein {year}\nim Rückblick", tapToBegin: "Tippen zum Start",
    slideQuestsTitle: "Aufgaben erledigt", slideStreakTitle: "Längste Serie", slideMoodTitle: "Häufigste Stimmung", slideJournalTitle: "Worte festgehalten", slideHydrationTitle: "Durchschnittliche Hydration", slideTasksTitle: "Erledigte Todos", slideMemoryTitle: "Ein besonderer Moment", slideBadgesTitle: "Abzeichen gesammelt", slideClosingTitle: "Das war's", slideClosingSub: "Auf das nächste Jahr.",
    topCategory: "Am aktivsten bei", download: "Bild herunterladen", close: "Schließen",
    cupsUnit: "L", entriesUnit: "Einträge", daysUnit: "Tage",
    yourYearAtAGlance: "Dein Jahr auf einen Blick", timesCried: "Mal geweint", goodNewsMoments: "gute Nachrichten", litersThisYear: "Liter dieses Jahr",
  },
  es: {
    title: "Reflejo", subtitle: "Tu ánimo, tus palabras, tu año.",
    howFeeling: "¿Cómo te sientes hoy?",
    journalTitle: "Diario", journalPlaceholder: "Escribe lo que tengas en mente…", save: "Guardar", saved: "Guardado por hoy",
    hydrationTitle: "Hidratación", liters: "litros hoy",
    habitStats: "Estadísticas de hábitos", overallStreak: "Racha general", questStreak: "Racha de misiones",
    questsCompleted: "Misiones completadas", tasksCompleted: "Tareas completadas", challengeDays: "Días de desafío registrados",
    moodCheckins: "Registros de ánimo", journalEntries: "Entradas de diario", avgHydration: "Prom. litros/día", badges: "Insignias obtenidas",
    notTracked: "Aún sin registrar",
    yearInReview: "Resumen del año", viewWrapped: "Ver mi resumen de {year}", notEnoughData: "Aún no hay suficiente registrado este año — vuelve más adelante.",
    pastEntries: "Entradas recientes", noEntries: "Nada registrado todavía.",
    days: "días", entries: "entradas",
    wrappedIntro: "Tu {year}\nen resumen", tapToBegin: "Toca para empezar",
    slideQuestsTitle: "Misiones completadas", slideStreakTitle: "Racha más larga", slideMoodTitle: "Ánimo más frecuente", slideJournalTitle: "Palabras escritas", slideHydrationTitle: "Hidratación promedio", slideTasksTitle: "Tareas completadas", slideMemoryTitle: "Un momento para recordar", slideBadgesTitle: "Insignias obtenidas", slideClosingTitle: "Eso es todo", slideClosingSub: "Por el próximo año.",
    topCategory: "Más activo en", download: "Descargar imagen", close: "Cerrar",
    cupsUnit: "L", entriesUnit: "entradas", daysUnit: "días",
    yourYearAtAGlance: "Tu año de un vistazo", timesCried: "veces que lloraste", goodNewsMoments: "momentos de buenas noticias", litersThisYear: "litros este año",
  },
  fr: {
    title: "Réflexion", subtitle: "Ton humeur, tes mots, ton année.",
    howFeeling: "Comment te sens-tu aujourd'hui ?",
    journalTitle: "Journal", journalPlaceholder: "Écris ce qui te passe par la tête…", save: "Enregistrer", saved: "Enregistré pour aujourd'hui",
    hydrationTitle: "Hydratation", liters: "litres aujourd'hui",
    habitStats: "Statistiques d'habitudes", overallStreak: "Série globale", questStreak: "Série de quêtes",
    questsCompleted: "Quêtes terminées", tasksCompleted: "Tâches terminées", challengeDays: "Jours de défi enregistrés",
    moodCheckins: "Suivis d'humeur", journalEntries: "Entrées de journal", avgHydration: "Moy. litres/jour", badges: "Badges obtenus",
    notTracked: "Pas encore suivi",
    yearInReview: "Rétrospective annuelle", viewWrapped: "Voir mon récap {year}", notEnoughData: "Pas encore assez de données cette année — reviens plus tard.",
    pastEntries: "Entrées récentes", noEntries: "Rien d'enregistré pour l'instant.",
    days: "jours", entries: "entrées",
    wrappedIntro: "Ton {year}\nen rétrospective", tapToBegin: "Touche pour commencer",
    slideQuestsTitle: "Quêtes terminées", slideStreakTitle: "Plus longue série", slideMoodTitle: "Humeur la plus fréquente", slideJournalTitle: "Mots écrits", slideHydrationTitle: "Hydratation moyenne", slideTasksTitle: "Tâches gérées", slideMemoryTitle: "Un moment à retenir", slideBadgesTitle: "Badges obtenus", slideClosingTitle: "C'est un wrap", slideClosingSub: "À la prochaine année.",
    topCategory: "Le plus actif dans", download: "Télécharger l'image", close: "Fermer",
    cupsUnit: "L", entriesUnit: "entrées", daysUnit: "jours",
    yourYearAtAGlance: "Ton année en un coup d'œil", timesCried: "fois où tu as pleuré", goodNewsMoments: "moments de bonnes nouvelles", litersThisYear: "litres cette année",
  },
  it: {
    title: "Riflessione", subtitle: "Il tuo umore, le tue parole, il tuo anno.",
    howFeeling: "Come ti senti oggi?",
    journalTitle: "Diario", journalPlaceholder: "Scrivi quello che hai in mente…", save: "Salva", saved: "Salvato per oggi",
    hydrationTitle: "Idratazione", liters: "litri oggi",
    habitStats: "Statistiche abitudini", overallStreak: "Serie complessiva", questStreak: "Serie missioni",
    questsCompleted: "Missioni completate", tasksCompleted: "Attività completate", challengeDays: "Giorni di sfida registrati",
    moodCheckins: "Check-in umore", journalEntries: "Voci del diario", avgHydration: "Media litri/giorno", badges: "Distintivi raccolti",
    notTracked: "Non ancora monitorato",
    yearInReview: "Riepilogo dell'anno", viewWrapped: "Vedi il mio riepilogo {year}", notEnoughData: "Non ci sono ancora abbastanza dati quest'anno — ricontrolla più avanti.",
    pastEntries: "Voci recenti", noEntries: "Ancora nulla registrato.",
    days: "giorni", entries: "voci",
    wrappedIntro: "Il tuo {year}\nin sintesi", tapToBegin: "Tocca per iniziare",
    slideQuestsTitle: "Missioni completate", slideStreakTitle: "Serie più lunga", slideMoodTitle: "Umore più frequente", slideJournalTitle: "Parole scritte", slideHydrationTitle: "Idratazione media", slideTasksTitle: "Attività gestite", slideMemoryTitle: "Un momento da ricordare", slideBadgesTitle: "Distintivi raccolti", slideClosingTitle: "Ecco fatto", slideClosingSub: "Al prossimo anno.",
    topCategory: "Più attivo in", download: "Scarica immagine", close: "Chiudi",
    cupsUnit: "L", entriesUnit: "voci", daysUnit: "giorni",
    yourYearAtAGlance: "Il tuo anno in breve", timesCried: "volte che hai pianto", goodNewsMoments: "momenti di buone notizie", litersThisYear: "litri quest'anno",
  },
  pt: {
    title: "Reflexão", subtitle: "Seu humor, suas palavras, seu ano.",
    howFeeling: "Como você está se sentindo hoje?",
    journalTitle: "Diário", journalPlaceholder: "Escreva o que estiver pensando…", save: "Salvar", saved: "Salvo por hoje",
    hydrationTitle: "Hidratação", liters: "litros hoje",
    habitStats: "Estatísticas de hábitos", overallStreak: "Sequência geral", questStreak: "Sequência de missões",
    questsCompleted: "Missões concluídas", tasksCompleted: "Tarefas concluídas", challengeDays: "Dias de desafio registrados",
    moodCheckins: "Check-ins de humor", journalEntries: "Entradas de diário", avgHydration: "Média litros/dia", badges: "Emblemas coletados",
    notTracked: "Ainda não registrado",
    yearInReview: "Retrospectiva do ano", viewWrapped: "Ver minha retrospectiva de {year}", notEnoughData: "Ainda não há dados suficientes este ano — volte mais tarde.",
    pastEntries: "Entradas recentes", noEntries: "Nada registrado ainda.",
    days: "dias", entries: "entradas",
    wrappedIntro: "Seu {year}\nem retrospectiva", tapToBegin: "Toque para começar",
    slideQuestsTitle: "Missões concluídas", slideStreakTitle: "Maior sequência", slideMoodTitle: "Humor mais frequente", slideJournalTitle: "Palavras escritas", slideHydrationTitle: "Hidratação média", slideTasksTitle: "Tarefas concluídas", slideMemoryTitle: "Um momento para lembrar", slideBadgesTitle: "Emblemas coletados", slideClosingTitle: "Isso é um resumo", slideClosingSub: "Ao próximo ano.",
    topCategory: "Mais ativo em", download: "Baixar imagem", close: "Fechar",
    cupsUnit: "L", entriesUnit: "entradas", daysUnit: "dias",
    yourYearAtAGlance: "Seu ano em resumo", timesCried: "vezes que você chorou", goodNewsMoments: "momentos de boas notícias", litersThisYear: "litros este ano",
  },
  tr: {
    title: "Yansıma", subtitle: "Ruh halin, kelimelerin, yılın.",
    howFeeling: "Bugün nasıl hissediyorsun?",
    journalTitle: "Günlük", journalPlaceholder: "Aklından geçeni yaz…", save: "Kaydet", saved: "Bugün için kaydedildi",
    hydrationTitle: "Hidrasyon", liters: "litre bugün",
    habitStats: "Alışkanlık İstatistikleri", overallStreak: "Genel seri", questStreak: "Görev serisi",
    questsCompleted: "Tamamlanan görevler", tasksCompleted: "Tamamlanan todolar", challengeDays: "Kaydedilen hedef günleri",
    moodCheckins: "Ruh hali kayıtları", journalEntries: "Günlük kayıtları", avgHydration: "Ort. litre/gün", badges: "Toplanan rozetler",
    notTracked: "Henüz izlenmedi",
    yearInReview: "Yıl Değerlendirmesi", viewWrapped: "{year} Özetimi Gör", notEnoughData: "Bu yıl henüz yeterli veri yok — daha sonra tekrar kontrol et.",
    pastEntries: "Son kayıtlar", noEntries: "Henüz kayıt yok.",
    days: "gün", entries: "kayıt",
    wrappedIntro: "{year}\nÖzetin", tapToBegin: "Başlamak için dokun",
    slideQuestsTitle: "Tamamlanan görevler", slideStreakTitle: "En uzun seri", slideMoodTitle: "En sık hissedilen ruh hali", slideJournalTitle: "Yazılan kelimeler", slideHydrationTitle: "Ortalama hidrasyon", slideTasksTitle: "Tamamlanan todolar", slideMemoryTitle: "Hatırlanmaya değer bir an", slideBadgesTitle: "Toplanan rozetler", slideClosingTitle: "İşte bu kadar", slideClosingSub: "Bir sonrakine.",
    topCategory: "En aktif olduğun alan", download: "Görseli indir", close: "Kapat",
    cupsUnit: "L", entriesUnit: "kayıt", daysUnit: "gün",
    yourYearAtAGlance: "Yılın bir bakışta", timesCried: "ağladığın kez sayısı", goodNewsMoments: "iyi haber anları", litersThisYear: "bu yılki litre",
  },
  ar: {
    title: "تأمل", subtitle: "مزاجك، كلماتك، سنتك.",
    howFeeling: "كيف تشعر اليوم؟",
    journalTitle: "اليوميات", journalPlaceholder: "اكتب ما يدور في ذهنك…", save: "حفظ", saved: "تم الحفظ لهذا اليوم",
    hydrationTitle: "الترطيب", liters: "لتر اليوم",
    habitStats: "إحصائيات العادات", overallStreak: "التتابع العام", questStreak: "تتابع المهام",
    questsCompleted: "المهام المكتملة", tasksCompleted: "المهام المنجزة", challengeDays: "أيام التحدي المسجلة",
    moodCheckins: "تسجيلات المزاج", journalEntries: "مدخلات اليوميات", avgHydration: "متوسط لتر/يوم", badges: "الشارات المجمّعة",
    notTracked: "لم يُسجَّل بعد",
    yearInReview: "ملخص العام", viewWrapped: "عرض ملخص {year}", notEnoughData: "لا توجد بيانات كافية هذا العام بعد — عد لاحقًا.",
    pastEntries: "أحدث المدخلات", noEntries: "لا شيء مسجل بعد.",
    days: "أيام", entries: "مدخلات",
    wrappedIntro: "عامك {year}\nفي ملخص", tapToBegin: "اضغط للبدء",
    slideQuestsTitle: "المهام المكتملة", slideStreakTitle: "أطول تتابع", slideMoodTitle: "المزاج الأكثر شيوعًا", slideJournalTitle: "كلمات مكتوبة", slideHydrationTitle: "متوسط الترطيب", slideTasksTitle: "المهام المنجزة", slideMemoryTitle: "لحظة تستحق التذكر", slideBadgesTitle: "الشارات المجمّعة", slideClosingTitle: "هذا كل شيء", slideClosingSub: "إلى العام القادم.",
    topCategory: "الأكثر نشاطًا في", download: "تحميل الصورة", close: "إغلاق",
    cupsUnit: "لتر", entriesUnit: "مدخلات", daysUnit: "أيام",
    yourYearAtAGlance: "عامك في لمحة", timesCried: "عدد مرات البكاء", goodNewsMoments: "لحظات الأخبار السارة", litersThisYear: "لترات هذا العام",
  },
};

const REFLECT_MOODS = [
  { key: "happy", emoji: "😊", en: "Happy", de: "Glücklich", es: "Feliz", fr: "Heureux", it: "Felice", pt: "Feliz", tr: "Mutlu", ar: "سعيد", color: "#f2c94c" },
  { key: "goodnews", emoji: "🎉", en: "Good news", de: "Gute Nachricht", es: "Buenas noticias", fr: "Bonne nouvelle", it: "Buone notizie", pt: "Boas notícias", tr: "İyi haber", ar: "خبر سار", color: "#eb9fc1" },
  { key: "neutral", emoji: "😐", en: "Neutral", de: "Neutral", es: "Neutral", fr: "Neutre", it: "Neutro", pt: "Neutro", tr: "Nötr", ar: "محايد", color: "#9aa3ab" },
  { key: "tired", emoji: "😴", en: "Tired", de: "Müde", es: "Cansado", fr: "Fatigué", it: "Stanco", pt: "Cansado", tr: "Yorgun", ar: "متعب", color: "#8e9bc4" },
  { key: "stressed", emoji: "😣", en: "Stressed", de: "Gestresst", es: "Estresado", fr: "Stressé", it: "Stressato", pt: "Estressado", tr: "Stresli", ar: "متوتر", color: "#e0885f" },
  { key: "sad", emoji: "😢", en: "Sad", de: "Traurig", es: "Triste", fr: "Triste", it: "Triste", pt: "Triste", tr: "Üzgün", ar: "حزين", color: "#6f9bd1" },
  { key: "cried", emoji: "😭", en: "Cried", de: "Geweint", es: "Lloré", fr: "J'ai pleuré", it: "Ho pianto", pt: "Chorei", tr: "Ağladım", ar: "بكيت", color: "#5f7fbf" },
  { key: "badnews", emoji: "💔", en: "Bad news", de: "Schlechte Nachricht", es: "Malas noticias", fr: "Mauvaise nouvelle", it: "Cattive notizie", pt: "Más notícias", tr: "Kötü haber", ar: "خبر سيئ", color: "#c65f6f" },
];

// TODO: swap this for the real app name once it's decided — used on the
// Wrapped closing card and the downloadable share image.
// APP_NAME is declared once, shared across the whole app (see top of file)

const CATEGORY_LABEL = {
  en: { exploration: "Exploration", social: "Social", health: "Health", creativity: "Creativity" },
  de: { exploration: "Entdeckung", social: "Sozial", health: "Gesundheit", creativity: "Kreativität" },
  es: { exploration: "Exploración", social: "Social", health: "Salud", creativity: "Creatividad" },
  fr: { exploration: "Exploration", social: "Social", health: "Santé", creativity: "Créativité" },
  it: { exploration: "Esplorazione", social: "Sociale", health: "Salute", creativity: "Creatività" },
  pt: { exploration: "Exploração", social: "Social", health: "Saúde", creativity: "Criatividade" },
  tr: { exploration: "Keşif", social: "Sosyal", health: "Sağlık", creativity: "Yaratıcılık" },
  ar: { exploration: "استكشاف", social: "اجتماعي", health: "صحة", creativity: "إبداع" },
};

function yearOfKey(key) {
  return Number(String(key).slice(0, 4));
}
function prevDayKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return dateKeyFor(new Date(y, m - 1, d - 1));
}

function computeCurrentStreak(dateKeySet) {
  let streak = 0;
  let cursor = todayKey();
  if (!dateKeySet.has(cursor)) cursor = prevDayKey(cursor); // today not logged yet is OK, streak can still be "alive"
  while (dateKeySet.has(cursor)) { streak++; cursor = prevDayKey(cursor); }
  return streak;
}

function computeLongestStreak(dateKeySet) {
  const sorted = Array.from(dateKeySet).sort();
  let longest = 0, current = 0, prev = null;
  for (const key of sorted) {
    if (prev && prevDayKey(key) === prev) current += 1; else current = 1;
    longest = Math.max(longest, current);
    prev = key;
  }
  return longest;
}


// Slide background gradients — deliberately more saturated than the app's
// normal palette, Wrapped-style, rather than tied to the current theme.
const REFLECT_SLIDE_BACKGROUNDS = [
  "linear-gradient(160deg,#1b1030,#4a1942)",
  "linear-gradient(160deg,#0f2340,#1c5f6b)",
  "linear-gradient(160deg,#3a1620,#8a3b3b)",
  "linear-gradient(160deg,#241a0a,#a8752f)",
  "linear-gradient(160deg,#12241a,#2f7d5c)",
  "linear-gradient(160deg,#1a1030,#5c3aa8)",
  "linear-gradient(160deg,#2a0f1f,#a83a6b)",
  "linear-gradient(160deg,#0d1b2a,#3a6b8a)",
  "linear-gradient(160deg,#1c1c1c,#4a4a4a)",
  "linear-gradient(160deg,#160e26,#3a2a6b)",
];

function buildWrappedSlides({ year, dl, t, scrapbook, moodLogs, journalEntries, hydrationLogs, tasks, challenges, badgeCount }) {
  const slides = [];
  let bgIdx = 0;
  const nextBg = () => REFLECT_SLIDE_BACKGROUNDS[bgIdx++ % REFLECT_SLIDE_BACKGROUNDS.length];

  slides.push({ key: "intro", bg: nextBg(), render: () => (
    <>
      <div style={{ fontSize: 15, opacity: 0.75, marginBottom: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>{APP_NAME} · {year}</div>
      <div className="fraunces-w" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.25, whiteSpace: "pre-line" }}>{t.wrappedIntro.replace("{year}", year)}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 26 }}>{t.tapToBegin}</div>
    </>
  )});

  const scrapbookThisYear = (scrapbook || []).filter((e) => new Date(e.date).getFullYear() === year);
  if (scrapbookThisYear.length > 0) {
    const catTally = {};
    scrapbookThisYear.forEach((e) => { catTally[e.category] = (catTally[e.category] || 0) + 1; });
    const topCat = Object.entries(catTally).sort((a, b) => b[1] - a[1])[0]?.[0];
    slides.push({ key: "quests", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideQuestsTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 88, fontWeight: 700, lineHeight: 1 }}>{scrapbookThisYear.length}</div>
        {topCat && <div style={{ fontSize: 15, opacity: 0.85, marginTop: 16 }}>{t.topCategory} <b>{CATEGORY_LABEL[dl][topCat]}</b></div>}
      </>
    )});
  }

  const questDateKeys = new Set(scrapbookThisYear.map((e) => dateKeyFor(new Date(e.date))));
  const longest = computeLongestStreak(questDateKeys);
  if (longest > 0) {
    slides.push({ key: "streak", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 40, marginBottom: 6 }}>🔥</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideStreakTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 72, fontWeight: 700 }}>{longest} <span style={{ fontSize: 24, fontWeight: 400, opacity: 0.7 }}>{t.days}</span></div>
      </>
    )});
  }

  const moodThisYear = Object.entries(moodLogs || {}).filter(([k]) => yearOfKey(k) === year);
  const moodTally = {};
  moodThisYear.forEach(([, m]) => { moodTally[m] = (moodTally[m] || 0) + 1; });
  const summaryItems = [];
  if (scrapbookThisYear.length > 0) summaryItems.push({ emoji: "✅", value: scrapbookThisYear.length, label: t.questsCompleted });
  if (longest > 0) summaryItems.push({ emoji: "🔥", value: longest, label: t.days });

  if (moodThisYear.length > 0) {
    const topMoodKey = Object.entries(moodTally).sort((a, b) => b[1] - a[1])[0]?.[0];
    const moodDef = REFLECT_MOODS.find((m) => m.key === topMoodKey);
    slides.push({ key: "mood", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 64, marginBottom: 10 }}>{moodDef?.emoji || "🙂"}</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideMoodTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 32, fontWeight: 600 }}>{moodDef ? (moodDef[dl] || moodDef.en) : "—"}</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>{moodThisYear.length} {t.entriesUnit}</div>
      </>
    )});
  }
  if (moodTally.cried > 0) summaryItems.push({ emoji: "😭", value: moodTally.cried, label: t.timesCried });
  if (moodTally.goodnews > 0) summaryItems.push({ emoji: "🎉", value: moodTally.goodnews, label: t.goodNewsMoments });

  const journalThisYear = Object.entries(journalEntries || {}).filter(([k, v]) => yearOfKey(k) === year && v && v.trim());
  if (journalThisYear.length > 0) {
    slides.push({ key: "journal", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideJournalTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 72, fontWeight: 700 }}>{journalThisYear.length}</div>
        <div style={{ fontSize: 14, opacity: 0.75, marginTop: 12 }}>{t.journalEntries}</div>
      </>
    )});
    summaryItems.push({ emoji: "📓", value: journalThisYear.length, label: t.journalEntries });
  }

  // Hydration is shown as a YEARLY TOTAL here (not the daily average used in
  // the always-on Habit Stats dashboard) — a big cumulative number reads
  // much more "wow" in a Wrapped-style reveal.
  const hydrationThisYear = Object.entries(hydrationLogs || {}).filter(([k]) => yearOfKey(k) === year);
  if (hydrationThisYear.length > 0) {
    const totalLiters = Math.round(hydrationThisYear.reduce((sum, [, v]) => sum + v, 0) * 10) / 10;
    slides.push({ key: "hydration", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 44, marginBottom: 8 }}>💧</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideHydrationTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 60, fontWeight: 700 }}>{totalLiters} <span style={{ fontSize: 20, fontWeight: 400, opacity: 0.7 }}>{t.cupsUnit}</span></div>
      </>
    )});
    summaryItems.push({ emoji: "💧", value: `${totalLiters}${dl === "de" ? "L" : "L"}`, label: t.litersThisYear });
  }

  const tasksThisYear = (tasks || []).reduce((sum, tk) => sum + (tk.completedDates || []).filter((d) => yearOfKey(d) === year).length, 0);
  if (tasksThisYear > 0) {
    slides.push({ key: "tasks", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideTasksTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 88, fontWeight: 700 }}>{tasksThisYear}</div>
      </>
    )});
    summaryItems.push({ emoji: "📝", value: tasksThisYear, label: t.tasksCompleted });
  }

  const memoryEntry = [...scrapbookThisYear].reverse().find((e) => e.photos && e.photos.length > 0);
  if (memoryEntry) {
    slides.push({ key: "memory", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>{t.slideMemoryTitle}</div>
        <img src={memoryEntry.photos[0]} alt="" style={{ width: 200, height: 200, objectFit: "cover", borderRadius: 18, boxShadow: "0 12px 40px rgba(0,0,0,0.4)", marginBottom: 14 }} />
        <div style={{ fontSize: 13.5, opacity: 0.85, maxWidth: 260 }}>{memoryEntry.questText}</div>
      </>
    )});
  }

  const challengeDaysThisYear = (challenges || []).reduce((sum, c) => (new Date(c.startDate).getFullYear() === year ? sum + (c.checkedDays || []).length : sum), 0);
  if (challengeDaysThisYear > 0) {
    slides.push({ key: "challenges", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.challengeDays}</div>
        <div className="fraunces-w" style={{ fontSize: 88, fontWeight: 700 }}>{challengeDaysThisYear}</div>
      </>
    )});
    summaryItems.push({ emoji: "🏁", value: challengeDaysThisYear, label: t.challengeDays });
  }

  if (badgeCount > 0) {
    slides.push({ key: "badges", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🏆</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideBadgesTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 60, fontWeight: 700 }}>{badgeCount}</div>
      </>
    )});
    summaryItems.push({ emoji: "🏆", value: badgeCount, label: t.badges });
  }

  // Closing card is the actual shareable recap — a compact emoji stat grid,
  // capped so it stays legible, rather than just a generic sign-off line.
  const topSummaryItems = summaryItems.slice(0, 6);
  slides.push({ key: "closing", bg: nextBg(), isClosing: true, render: ({ onDownload, imageUrl }) => (
    <>
      <div style={{ fontSize: 34, marginBottom: 8 }}>✨</div>
      <div className="fraunces-w" style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>{t.slideClosingTitle}</div>
      <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 20 }}>{t.yourYearAtAGlance} · {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, width: "100%", maxWidth: 280, pointerEvents: "auto" }}>
        {topSummaryItems.map((item, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 22 }}>{item.emoji}</span>
            <span className="fraunces-w" style={{ fontSize: 20, fontWeight: 700 }}>{item.value}</span>
            <span style={{ fontSize: 9.5, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>{item.label}</span>
          </div>
        ))}
      </div>
      {imageUrl ? (
        <div id="wrapped-download-image" style={{ marginTop: 20, pointerEvents: "auto", textAlign: "center" }}>
          <img src={imageUrl} alt="" style={{ width: 140, borderRadius: 12, display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 10.5, opacity: 0.7 }}>Press and hold the image above to save it</div>
        </div>
      ) : (
        <button onClick={onDownload} style={{ pointerEvents: "auto", marginTop: 22, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 24, padding: "12px 22px", color: "#fff", fontSize: 13.5, fontWeight: 600 }}>
          <Download size={15} /> {t.download}
        </button>
      )}
      <div style={{ marginTop: 16, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{APP_NAME}</div>
    </>
  )});

  return { slides, summaryItems: topSummaryItems };
}

function ReflectYearWrapped({ slides, onClose, year, stats, dl, t }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const touchStartX = useRef(null);
  const SLIDE_MS = 5200;

  useEffect(() => {
    if (paused) return;
    let start = Date.now() - progress * SLIDE_MS;
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) {
        if (idx < slides.length - 1) { setIdx((v) => v + 1); setProgress(0); }
        else clearInterval(iv);
      }
    }, 60);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused]);

  function goNext() { if (idx < slides.length - 1) { setIdx(idx + 1); setProgress(0); } }
  function goPrev() { if (idx > 0) { setIdx(idx - 1); setProgress(0); } }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; setPaused(true); }
  function onTouchEnd(e) {
    setPaused(false);
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx < 0) goNext(); else goPrev(); }
    touchStartX.current = null;
  }

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 540; canvas.height = 960;
    const grad = ctx.createLinearGradient(0, 0, 540, 960);
    grad.addColorStop(0, "#1b1030"); grad.addColorStop(1, "#4a1942");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 540, 960);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";

    ctx.font = "600 30px Georgia";
    ctx.fillText("✨", 270, 130);
    ctx.font = "700 40px Georgia";
    ctx.fillText(t.slideClosingTitle, 270, 185);
    ctx.font = "400 17px Georgia"; ctx.globalAlpha = 0.7;
    ctx.fillText(`${t.yourYearAtAGlance} · ${year}`, 270, 216);
    ctx.globalAlpha = 1;

    // Emoji stat grid — 2 columns, up to 6 items
    const items = (stats.summaryItems || []).slice(0, 6);
    const cols = 2;
    const cellW = 220, cellH = 130;
    const gridW = cellW * cols + 16;
    const startX = 270 - gridW / 2 + cellW / 2;
    const startY = 300;
    items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = startX + col * (cellW + 16);
      const cy = startY + row * (cellH + 14);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      const rx = cx - cellW / 2, ry = cy - cellH / 2, rw = cellW, rh = cellH, rr = 18;
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      ctx.arcTo(rx, ry + rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx + rw, ry, rr);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "38px Georgia";
      ctx.fillText(item.emoji, cx, cy - 20);
      ctx.font = "700 30px Georgia";
      ctx.fillText(String(item.value), cx, cy + 20);
      ctx.font = "400 12px Georgia"; ctx.globalAlpha = 0.75;
      ctx.fillText(item.label, cx, cy + 42);
      ctx.globalAlpha = 1;
    });

    ctx.font = "600 15px Georgia"; ctx.globalAlpha = 0.55;
    ctx.fillText(APP_NAME.toUpperCase(), 270, 900);
    ctx.globalAlpha = 1;

    const dataUrl = canvas.toDataURL("image/png");
    // Primary, reliable path: show the image directly in the page so it can be
    // long-pressed and saved — this works even in sandboxed previews where
    // programmatic downloads and popups are blocked.
    setCardImageUrl(dataUrl);
    setTimeout(() => document.getElementById("wrapped-download-image")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    try {
      const link = document.createElement("a");
      link.download = `${APP_NAME.toLowerCase()}-wrapped-${year}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {}
  }

  const slide = slides[idx];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: slide.bg, zIndex: 200, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.4s ease" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
    >
      <style>{`.fraunces-w { font-family: 'Fraunces', Georgia, serif; }`}</style>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: 4, padding: "16px 14px 0", zIndex: 5 }}>
        {slides.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%", background: "#fff" }} />
          </div>
        ))}
      </div>

      <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: 8, zIndex: 10 }}>
        <X size={18} color="#fff" />
      </button>

      <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 2 }}>
        <div style={{ flex: 1 }} onClick={goPrev} />
        <div style={{ flex: 2 }} onClick={goNext} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 30px", textAlign: "center", position: "relative", zIndex: 3, pointerEvents: "none" }}>
        {slide.render({ onDownload: downloadCard, imageUrl: cardImageUrl })}
      </div>
    </div>
  );
}

function Reflect({ globalTheme, globalLang, isActive }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [storageReady, setStorageReady] = useState(false);
  const [moodLogs, setMoodLogs] = useState({});
  const [journalEntries, setJournalEntries] = useState({});
  const [journalDraft, setJournalDraft] = useState("");
  const [justSavedJournal, setJustSavedJournal] = useState(false);
  const [hydrationLogs, setHydrationLogs] = useState({});
  const [crossTab, setCrossTab] = useState({ quest: null, todo: null, challenges: null });
  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedSlides, setWrappedSlides] = useState(null);
  const [notEnoughToast, setNotEnoughToast] = useState(false);
  const [crossTabDebug, setCrossTabDebug] = useState("");

  const theme = THEMES[themeKey];
  const t = REFLECT_STRINGS[lang] || REFLECT_STRINGS.en;
  const dl = lang; // was hardcoded to en/de only — this is the actual bug that broke every non-en/de mood label
  const year = new Date().getFullYear();
  const { liveSync } = useContext(LiveSyncContext) || {};

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("reflect-state-v1");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          setMoodLogs(d.moodLogs || {});
          setJournalEntries(d.journalEntries || {});
          setJournalDraft((d.journalEntries || {})[todayKey()] || "");
          setHydrationLogs(d.hydrationLogs || {});
        }
      } catch (e) {}
      await refreshCrossTabData();
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try { await supaSet("reflect-state-v1", JSON.stringify({ moodLogs, journalEntries, hydrationLogs, lang })); }
      catch (e) { console.error(e); }
    })();
  }, [moodLogs, journalEntries, hydrationLogs, lang, storageReady]);

  const liveSyncCtx = useContext(LiveSyncContext);
  useEffect(() => {
    liveSyncCtx?.updateLiveSync("reflect", { moodLogs, setMoodLogs, journalEntries, setJournalEntries, hydrationLogs, setHydrationLogs });
  }, [moodLogs, journalEntries, hydrationLogs]);

  // Tabs stay mounted the whole session (not remounted on switch), so
  // re-sync cross-tab stats every time this tab becomes the visible one,
  // and keep polling lightly while it's open.
  useEffect(() => {
    if (isActive) refreshCrossTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(refreshCrossTabData, 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  async function refreshCrossTabData() {
    const result = { quest: null, todo: null, challenges: null };
    try { const r = await supaGet("quest-wheel-state-v2"); if (r && r.value) result.quest = JSON.parse(r.value); } catch (e) {}
    try { const r = await supaGet("todo-templates-state-v3"); if (r && r.value) result.todo = JSON.parse(r.value); } catch (e) {}
    try { const r = await supaGet("challenges-state-v3"); if (r && r.value) result.challenges = JSON.parse(r.value); } catch (e) {}
    setCrossTab(result);
    return result;
  }

  function logMood(moodKey) {
    setMoodLogs({ ...moodLogs, [todayKey()]: moodKey });
    playTick(0.15); vibrate(20);
  }

  function saveJournal() {
    setJournalEntries({ ...journalEntries, [todayKey()]: journalDraft.trim() });
    playChime(); vibrate([0, 30, 40, 30]);
    setJustSavedJournal(true);
    setTimeout(() => setJustSavedJournal(false), 1800);
  }

  function adjustHydration(delta) {
    const current = hydrationLogs[todayKey()] || 0;
    // Round to the nearest 0.25 to avoid floating-point drift (0.1 + 0.2 etc.)
    const next = Math.max(0, Math.round((current + delta) * 4) / 4);
    setHydrationLogs({ ...hydrationLogs, [todayKey()]: next });
    playTick(0.12); vibrate(15);
  }

  const todayMood = moodLogs[todayKey()] || null;
  const todayLiters = hydrationLogs[todayKey()] || 0;

  const scrapbook = liveSync?.quest?.scrapbook || [];
  const tasks = liveSync?.todo?.tasks || [];
  const challenges = liveSync?.challenges?.challenges || [];

  const questDateKeys = new Set(scrapbook.map((e) => dateKeyFor(new Date(e.date))));
  const moodDateKeys = new Set(Object.keys(moodLogs));
  const combinedActiveDates = new Set([...questDateKeys, ...moodDateKeys]);
  const overallStreak = computeCurrentStreak(combinedActiveDates);

  const totalQuests = liveSync?.quest?.totalCompleted ?? scrapbook.length;
  const questStreak = liveSync?.quest?.streak || 0;
  const badgeCount = liveSync?.quest?.unlockedBadges?.length || 0;
  const tasksCompletedTotal = tasks.reduce((sum, tk) => sum + (tk.completedDates || []).length, 0);
  const challengeDaysTotal = challenges.reduce((sum, c) => sum + (c.checkedDays || []).length, 0);
  const moodCheckinsTotal = Object.keys(moodLogs).length;
  const journalEntriesTotal = Object.values(journalEntries).filter((v) => v && v.trim()).length;
  const hydrationDaysLogged = Object.keys(hydrationLogs).length;
  const avgHydration = hydrationDaysLogged ? (Object.values(hydrationLogs).reduce((a, b) => a + b, 0) / hydrationDaysLogged).toFixed(1) : null;

  function openWrapped() {
    const fresh = liveSync || {};
    const debugLine = `quest: ${fresh.quest ? `found (${fresh.quest.scrapbook?.length || 0} entries)` : "NOT FOUND — check that tab has been opened this session"} · todo: ${fresh.todo ? `found (${fresh.todo.tasks?.length || 0} tasks)` : "NOT FOUND — check that tab has been opened this session"} · challenges: ${fresh.challenges ? `found (${fresh.challenges.challenges?.length || 0})` : "NOT FOUND — check that tab has been opened this session"}`;
    setCrossTabDebug(debugLine);
    const { slides, summaryItems } = buildWrappedSlides({
      year, dl, t,
      scrapbook: fresh.quest?.scrapbook || [],
      moodLogs, journalEntries, hydrationLogs,
      tasks: fresh.todo?.tasks || [],
      challenges: fresh.challenges?.challenges || [],
      badgeCount: fresh.quest?.unlockedBadges?.length || 0,
    });
    if (slides.length <= 2) { setNotEnoughToast(true); setTimeout(() => setNotEnoughToast(false), 2600); return; }
    setWrappedSlides({ slides, stats: { summaryItems } });
    setShowWrapped(true);
  }

  const statRow = (label, value, unit) => (
    <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: "14px 16px", flex: "1 1 45%", minWidth: 140 }}>
      <div style={{ fontSize: 11, color: theme.muted, marginBottom: 4 }}>{label}</div>
      <div className="fraunces-r" style={{ fontSize: 22, fontWeight: 600 }}>{value != null ? value : "—"} {value != null && unit ? <span style={{ fontSize: 12, fontWeight: 400, color: theme.muted }}>{unit}</span> : null}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 130 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        .fraunces-r { font-family: 'Fraunces', serif; }
        button { font-family: inherit; cursor: pointer; }
        textarea, input { font-family: inherit; }
      `}</style>

      <div style={{ padding: "22px 20px 0" }}>
        <div className="fraunces-r" style={{ fontSize: 24, fontWeight: 500 }}>{t.title}</div>
        <div style={{ fontSize: 12.5, color: theme.muted, marginTop: 4 }}>{t.subtitle}</div>
      </div>

      {/* Mood check-in */}
      <div style={{ maxWidth: 460, margin: "22px auto 0", padding: "0 20px" }}>
        <div style={{ fontSize: 13, color: theme.muted, marginBottom: 10 }}>{t.howFeeling}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {REFLECT_MOODS.map((m) => {
            const active = todayMood === m.key;
            return (
              <button key={m.key} onClick={() => logMood(m.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: active ? m.color + "33" : theme.panel, border: `1.5px solid ${active ? m.color : theme.line}`, borderRadius: 12, padding: "10px 4px" }}>
                <span style={{ fontSize: 22 }}>{m.emoji}</span>
                <span style={{ fontSize: 9.5, color: active ? theme.text : theme.muted, fontWeight: active ? 600 : 400, textAlign: "center" }}>{m[dl] || m.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Journal */}
      <div style={{ maxWidth: 460, margin: "26px auto 0", padding: "0 20px" }}>
        <div className="fraunces-r" style={{ fontSize: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><BookOpen size={16} color={theme.accent} /> {t.journalTitle}</div>
        <textarea value={journalDraft} onChange={(e) => setJournalDraft(e.target.value)} placeholder={t.journalPlaceholder} rows={4} style={{ width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 14, color: theme.text, fontSize: 13.5, resize: "none", outline: "none" }} />
        <button onClick={saveJournal} style={{ marginTop: 8, width: "100%", background: justSavedJournal ? theme.panelSoft : theme.accent, color: justSavedJournal ? theme.accent : theme.bg, border: justSavedJournal ? `1px solid ${theme.accent}` : "none", borderRadius: 12, padding: "11px 0", fontSize: 13.5, fontWeight: 600, transition: "all 0.2s ease" }}>
          {justSavedJournal ? `✓ ${t.saved}` : t.save}
        </button>
      </div>

      {/* Hydration */}
      <div style={{ maxWidth: 460, margin: "26px auto 0", padding: "0 20px" }}>
        <div className="fraunces-r" style={{ fontSize: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Droplet size={16} color={theme.accent} /> {t.hydrationTitle}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: "14px 18px" }}>
          <button onClick={() => adjustHydration(-0.25)} style={{ width: 34, height: 34, borderRadius: "50%", background: theme.panelSoft, border: `1px solid ${theme.line}`, color: theme.text, fontSize: 18, fontWeight: 600 }}>−</button>
          <div style={{ textAlign: "center" }}>
            <div className="fraunces-r" style={{ fontSize: 26, fontWeight: 600 }}>{todayLiters} L</div>
            <div style={{ fontSize: 10.5, color: theme.muted }}>{t.liters}</div>
          </div>
          <button onClick={() => adjustHydration(0.25)} style={{ width: 34, height: 34, borderRadius: "50%", background: theme.accent, border: "none", color: theme.bg, fontSize: 18, fontWeight: 600 }}>+</button>
        </div>
      </div>

      {/* Habit stats */}
      <div style={{ maxWidth: 460, margin: "30px auto 0", padding: "0 20px" }}>
        <div className="fraunces-r" style={{ fontSize: 16, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><TrendingUp size={16} color={theme.accent} /> {t.habitStats}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {statRow(t.overallStreak, overallStreak, t.days)}
          {statRow(t.questStreak, liveSync?.quest ? questStreak : null, t.days)}
          {statRow(t.questsCompleted, liveSync?.quest ? totalQuests : null)}
          {statRow(t.tasksCompleted, liveSync?.todo ? tasksCompletedTotal : null)}
          {statRow(t.challengeDays, liveSync?.challenges ? challengeDaysTotal : null)}
          {statRow(t.moodCheckins, moodCheckinsTotal)}
          {statRow(t.journalEntries, journalEntriesTotal)}
          {statRow(t.avgHydration, avgHydration)}
          {statRow(t.badges, liveSync?.quest ? badgeCount : null)}
        </div>
      </div>

      {/* Year in Review */}
      <div style={{ maxWidth: 460, margin: "30px auto 0", padding: "0 20px 20px" }}>
        <div style={{ background: `linear-gradient(135deg, ${theme.accent}22, ${theme.panel})`, border: `1px solid ${theme.accent}55`, borderRadius: 18, padding: 20, textAlign: "center", position: "relative" }}>
          <Sparkles size={20} color={theme.accent} style={{ marginBottom: 8 }} />
          <div className="fraunces-r" style={{ fontSize: 17, marginBottom: 6 }}>{t.yearInReview}</div>
          <button onClick={openWrapped} style={{ marginTop: 8, background: theme.accent, color: theme.bg, border: "none", borderRadius: 30, padding: "12px 22px", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t.viewWrapped.replace("{year}", year)} <ChevronRight size={15} />
          </button>
          {notEnoughToast && <div style={{ marginTop: 12, fontSize: 12, color: theme.muted }}>{t.notEnoughData}</div>}
          {crossTabDebug && <div style={{ marginTop: 10, fontSize: 9.5, color: theme.muted, opacity: 0.8, lineHeight: 1.5 }}>debug — {crossTabDebug}</div>}
        </div>
      </div>

      {showWrapped && wrappedSlides && (
        <ReflectYearWrapped slides={wrappedSlides.slides} stats={wrappedSlides.stats} year={year} dl={dl} t={t} onClose={() => setShowWrapped(false)} />
      )}
    </div>
  );
}


const FINANCE_STRINGS = {
  en: {
    title: "Finance", subtitle: "Where it's coming from, where it's going.",
    theme: "Look", language: "Language",
    totalIncome: "Income", spent: "Spent", remaining: "Remaining",
    breakdown: "Where it went", noBreakdown: "Log an expense to see your breakdown.",
    income: "Income", addIncome: "Add income",
    recurringIncome: "Recurring", oneTimeIncome: "One-time",
    noRecurringIncome: "No recurring income yet.", noOneTimeIncome: "No one-time income this month.",
    expenses: "Expenses", addExpense: "Add expense", noExpenses: "Nothing logged yet this month.",
    bills: "Recurring bills", addBill: "Add bill", noBills: "No recurring bills yet.", billsThisMonth: "paid this month",
    savings: "Savings", goal: "Goal", setGoal: "Set savings goal", goalAmount: "Target amount",
    addContribution: "Add contribution", totalSaved: "Total saved", ofGoal: "of goal",
    goalReached: "Goal reached 🎉", noGoalYet: "Set a goal to start tracking.",
    recentContributions: "Recent", savedThisMonth: "saved this month",
    name: "Name…", amountLabel: "Amount", category: "Category",
    save: "Save", cancel: "Cancel",
    categories: { rent: "Rent", food: "Food", transport: "Transport", subscriptions: "Subscriptions", shopping: "Shopping", health: "Health", entertainment: "Entertainment", other: "Other" },
    yearInReview: "Year in Review", viewWrapped: "View My {year} Wrapped", notEnoughData: "Not enough logged yet this year — check back as it fills in.",
    wrappedIntro: "Your {year}\nin Money", tapToBegin: "Tap to begin",
    slideSpentTitle: "You spent", slideTopCatTitle: "Most of it went to", slideIncomeTitle: "Money in", slideSavedTitle: "You saved", slideBillsTitle: "Bills paid on time", slideClosingTitle: "That's a wrap", download: "Download image", close: "Close",
    yourYearAtAGlance: "Your year at a glance", percentOfSpend: "of your spending",
  },
  de: {
    title: "Finanzen", subtitle: "Woher es kommt, wohin es geht.",
    theme: "Aussehen", language: "Sprache",
    totalIncome: "Einnahmen", spent: "Ausgegeben", remaining: "Übrig",
    breakdown: "Wohin es ging", noBreakdown: "Trage eine Ausgabe ein, um deine Aufteilung zu sehen.",
    income: "Einnahmen", addIncome: "Einnahme hinzufügen",
    recurringIncome: "Wiederkehrend", oneTimeIncome: "Einmalig",
    noRecurringIncome: "Noch keine wiederkehrenden Einnahmen.", noOneTimeIncome: "Keine einmaligen Einnahmen diesen Monat.",
    expenses: "Ausgaben", addExpense: "Ausgabe hinzufügen", noExpenses: "Diesen Monat noch nichts eingetragen.",
    bills: "Wiederkehrende Rechnungen", addBill: "Rechnung hinzufügen", noBills: "Noch keine wiederkehrenden Rechnungen.", billsThisMonth: "diesen Monat bezahlt",
    savings: "Sparen", goal: "Ziel", setGoal: "Sparziel festlegen", goalAmount: "Zielbetrag",
    addContribution: "Einzahlung hinzufügen", totalSaved: "Gesamt gespart", ofGoal: "des Ziels",
    goalReached: "Ziel erreicht 🎉", noGoalYet: "Lege ein Ziel fest, um den Fortschritt zu verfolgen.",
    recentContributions: "Zuletzt", savedThisMonth: "diesen Monat gespart",
    name: "Name…", amountLabel: "Betrag", category: "Kategorie",
    save: "Speichern", cancel: "Abbrechen",
    categories: { rent: "Miete", food: "Essen", transport: "Transport", subscriptions: "Abos", shopping: "Einkäufe", health: "Gesundheit", entertainment: "Unterhaltung", other: "Sonstiges" },
    yearInReview: "Jahresrückblick", viewWrapped: "Meinen {year} Rückblick ansehen", notEnoughData: "Noch nicht genug erfasst dieses Jahr — schau später wieder vorbei.",
    wrappedIntro: "Dein {year}\nin Geld", tapToBegin: "Tippen zum Start",
    slideSpentTitle: "Du hast ausgegeben", slideTopCatTitle: "Das meiste ging an", slideIncomeTitle: "Geld eingenommen", slideSavedTitle: "Du hast gespart", slideBillsTitle: "Rechnungen pünktlich bezahlt", slideClosingTitle: "Das war's", download: "Bild herunterladen", close: "Schließen",
    yourYearAtAGlance: "Dein Jahr auf einen Blick", percentOfSpend: "deiner Ausgaben",
  },
  es: {
    title: "Finanzas", subtitle: "De dónde viene, a dónde va.",
    theme: "Estilo", language: "Idioma",
    totalIncome: "Ingresos", spent: "Gastado", remaining: "Restante",
    breakdown: "A dónde fue", noBreakdown: "Registra un gasto para ver tu desglose.",
    income: "Ingresos", addIncome: "Añadir ingreso",
    recurringIncome: "Recurrente", oneTimeIncome: "Puntual",
    noRecurringIncome: "Aún no hay ingresos recurrentes.", noOneTimeIncome: "No hay ingresos puntuales este mes.",
    expenses: "Gastos", addExpense: "Añadir gasto", noExpenses: "Nada registrado este mes todavía.",
    bills: "Facturas recurrentes", addBill: "Añadir factura", noBills: "Aún no hay facturas recurrentes.", billsThisMonth: "pagadas este mes",
    savings: "Ahorros", goal: "Meta", setGoal: "Establecer meta de ahorro", goalAmount: "Cantidad objetivo",
    addContribution: "Añadir aporte", totalSaved: "Total ahorrado", ofGoal: "de la meta",
    goalReached: "Meta alcanzada 🎉", noGoalYet: "Establece una meta para empezar a hacer seguimiento.",
    recentContributions: "Recientes", savedThisMonth: "ahorrado este mes",
    name: "Nombre…", amountLabel: "Cantidad", category: "Categoría",
    save: "Guardar", cancel: "Cancelar",
    categories: { rent: "Alquiler", food: "Comida", transport: "Transporte", subscriptions: "Suscripciones", shopping: "Compras", health: "Salud", entertainment: "Ocio", other: "Otros" },
    yearInReview: "Resumen del año", viewWrapped: "Ver mi resumen de {year}", notEnoughData: "Aún no hay suficiente registrado este año — vuelve más adelante.",
    wrappedIntro: "Tu {year}\nen dinero", tapToBegin: "Toca para empezar",
    slideSpentTitle: "Gastaste", slideTopCatTitle: "La mayor parte fue a", slideIncomeTitle: "Dinero recibido", slideSavedTitle: "Ahorraste", slideBillsTitle: "Facturas pagadas a tiempo", slideClosingTitle: "Eso es todo", download: "Descargar imagen", close: "Cerrar",
    yourYearAtAGlance: "Tu año de un vistazo", percentOfSpend: "de tu gasto",
  },
  fr: {
    title: "Finances", subtitle: "D'où ça vient, où ça va.",
    theme: "Apparence", language: "Langue",
    totalIncome: "Revenus", spent: "Dépensé", remaining: "Restant",
    breakdown: "Où c'est parti", noBreakdown: "Enregistre une dépense pour voir ta répartition.",
    income: "Revenus", addIncome: "Ajouter un revenu",
    recurringIncome: "Récurrent", oneTimeIncome: "Ponctuel",
    noRecurringIncome: "Pas encore de revenu récurrent.", noOneTimeIncome: "Aucun revenu ponctuel ce mois-ci.",
    expenses: "Dépenses", addExpense: "Ajouter une dépense", noExpenses: "Rien d'enregistré ce mois-ci pour l'instant.",
    bills: "Factures récurrentes", addBill: "Ajouter une facture", noBills: "Pas encore de facture récurrente.", billsThisMonth: "payées ce mois-ci",
    savings: "Épargne", goal: "Objectif", setGoal: "Définir un objectif d'épargne", goalAmount: "Montant cible",
    addContribution: "Ajouter une contribution", totalSaved: "Total épargné", ofGoal: "de l'objectif",
    goalReached: "Objectif atteint 🎉", noGoalYet: "Définis un objectif pour commencer à suivre.",
    recentContributions: "Récents", savedThisMonth: "épargné ce mois-ci",
    name: "Nom…", amountLabel: "Montant", category: "Catégorie",
    save: "Enregistrer", cancel: "Annuler",
    categories: { rent: "Loyer", food: "Alimentation", transport: "Transport", subscriptions: "Abonnements", shopping: "Achats", health: "Santé", entertainment: "Loisirs", other: "Autre" },
    yearInReview: "Rétrospective annuelle", viewWrapped: "Voir mon récap {year}", notEnoughData: "Pas encore assez de données cette année — reviens plus tard.",
    wrappedIntro: "Ton {year}\nen argent", tapToBegin: "Touche pour commencer",
    slideSpentTitle: "Tu as dépensé", slideTopCatTitle: "La majeure partie est allée à", slideIncomeTitle: "Argent reçu", slideSavedTitle: "Tu as épargné", slideBillsTitle: "Factures payées à temps", slideClosingTitle: "C'est un wrap", download: "Télécharger l'image", close: "Fermer",
    yourYearAtAGlance: "Ton année en un coup d'œil", percentOfSpend: "de tes dépenses",
  },
  it: {
    title: "Finanze", subtitle: "Da dove viene, dove va.",
    theme: "Aspetto", language: "Lingua",
    totalIncome: "Entrate", spent: "Speso", remaining: "Rimanente",
    breakdown: "Dove è andato", noBreakdown: "Registra una spesa per vedere la tua suddivisione.",
    income: "Entrate", addIncome: "Aggiungi entrata",
    recurringIncome: "Ricorrente", oneTimeIncome: "Una tantum",
    noRecurringIncome: "Ancora nessuna entrata ricorrente.", noOneTimeIncome: "Nessuna entrata una tantum questo mese.",
    expenses: "Spese", addExpense: "Aggiungi spesa", noExpenses: "Ancora nulla registrato questo mese.",
    bills: "Bollette ricorrenti", addBill: "Aggiungi bolletta", noBills: "Ancora nessuna bolletta ricorrente.", billsThisMonth: "pagate questo mese",
    savings: "Risparmi", goal: "Obiettivo", setGoal: "Imposta obiettivo di risparmio", goalAmount: "Importo obiettivo",
    addContribution: "Aggiungi contributo", totalSaved: "Totale risparmiato", ofGoal: "dell'obiettivo",
    goalReached: "Obiettivo raggiunto 🎉", noGoalYet: "Imposta un obiettivo per iniziare a monitorare.",
    recentContributions: "Recenti", savedThisMonth: "risparmiato questo mese",
    name: "Nome…", amountLabel: "Importo", category: "Categoria",
    save: "Salva", cancel: "Annulla",
    categories: { rent: "Affitto", food: "Cibo", transport: "Trasporti", subscriptions: "Abbonamenti", shopping: "Shopping", health: "Salute", entertainment: "Intrattenimento", other: "Altro" },
    yearInReview: "Riepilogo dell'anno", viewWrapped: "Vedi il mio riepilogo {year}", notEnoughData: "Non ci sono ancora abbastanza dati quest'anno — ricontrolla più avanti.",
    wrappedIntro: "Il tuo {year}\nin soldi", tapToBegin: "Tocca per iniziare",
    slideSpentTitle: "Hai speso", slideTopCatTitle: "La maggior parte è andata a", slideIncomeTitle: "Denaro ricevuto", slideSavedTitle: "Hai risparmiato", slideBillsTitle: "Bollette pagate in tempo", slideClosingTitle: "Ecco fatto", download: "Scarica immagine", close: "Chiudi",
    yourYearAtAGlance: "Il tuo anno in breve", percentOfSpend: "della tua spesa",
  },
  pt: {
    title: "Finanças", subtitle: "De onde vem, para onde vai.",
    theme: "Aparência", language: "Idioma",
    totalIncome: "Renda", spent: "Gasto", remaining: "Restante",
    breakdown: "Para onde foi", noBreakdown: "Registre uma despesa para ver sua distribuição.",
    income: "Renda", addIncome: "Adicionar renda",
    recurringIncome: "Recorrente", oneTimeIncome: "Pontual",
    noRecurringIncome: "Ainda sem renda recorrente.", noOneTimeIncome: "Nenhuma renda pontual este mês.",
    expenses: "Despesas", addExpense: "Adicionar despesa", noExpenses: "Nada registrado este mês ainda.",
    bills: "Contas recorrentes", addBill: "Adicionar conta", noBills: "Ainda sem contas recorrentes.", billsThisMonth: "pagas este mês",
    savings: "Poupança", goal: "Meta", setGoal: "Definir meta de poupança", goalAmount: "Valor da meta",
    addContribution: "Adicionar contribuição", totalSaved: "Total poupado", ofGoal: "da meta",
    goalReached: "Meta atingida 🎉", noGoalYet: "Defina uma meta para começar a acompanhar.",
    recentContributions: "Recentes", savedThisMonth: "poupado este mês",
    name: "Nome…", amountLabel: "Valor", category: "Categoria",
    save: "Salvar", cancel: "Cancelar",
    categories: { rent: "Aluguel", food: "Comida", transport: "Transporte", subscriptions: "Assinaturas", shopping: "Compras", health: "Saúde", entertainment: "Entretenimento", other: "Outros" },
    yearInReview: "Retrospectiva do ano", viewWrapped: "Ver minha retrospectiva de {year}", notEnoughData: "Ainda não há dados suficientes este ano — volte mais tarde.",
    wrappedIntro: "Seu {year}\nem dinheiro", tapToBegin: "Toque para começar",
    slideSpentTitle: "Você gastou", slideTopCatTitle: "A maior parte foi para", slideIncomeTitle: "Dinheiro recebido", slideSavedTitle: "Você poupou", slideBillsTitle: "Contas pagas em dia", slideClosingTitle: "Isso é um resumo", download: "Baixar imagem", close: "Fechar",
    yourYearAtAGlance: "Seu ano em resumo", percentOfSpend: "dos seus gastos",
  },
  tr: {
    title: "Finans", subtitle: "Nereden geliyor, nereye gidiyor.",
    theme: "Görünüm", language: "Dil",
    totalIncome: "Gelir", spent: "Harcanan", remaining: "Kalan",
    breakdown: "Nereye gitti", noBreakdown: "Dağılımını görmek için bir harcama kaydet.",
    income: "Gelir", addIncome: "Gelir ekle",
    recurringIncome: "Tekrarlayan", oneTimeIncome: "Tek seferlik",
    noRecurringIncome: "Henüz tekrarlayan gelir yok.", noOneTimeIncome: "Bu ay tek seferlik gelir yok.",
    expenses: "Giderler", addExpense: "Gider ekle", noExpenses: "Bu ay henüz bir şey kaydedilmedi.",
    bills: "Tekrarlayan faturalar", addBill: "Fatura ekle", noBills: "Henüz tekrarlayan fatura yok.", billsThisMonth: "bu ay ödendi",
    savings: "Birikim", goal: "Hedef", setGoal: "Birikim hedefi belirle", goalAmount: "Hedef tutar",
    addContribution: "Katkı ekle", totalSaved: "Toplam birikim", ofGoal: "hedefin",
    goalReached: "Hedefe ulaşıldı 🎉", noGoalYet: "İzlemeye başlamak için bir hedef belirle.",
    recentContributions: "Son işlemler", savedThisMonth: "bu ay biriktirildi",
    name: "İsim…", amountLabel: "Tutar", category: "Kategori",
    save: "Kaydet", cancel: "İptal",
    categories: { rent: "Kira", food: "Yemek", transport: "Ulaşım", subscriptions: "Abonelikler", shopping: "Alışveriş", health: "Sağlık", entertainment: "Eğlence", other: "Diğer" },
    yearInReview: "Yıl Değerlendirmesi", viewWrapped: "{year} Özetimi Gör", notEnoughData: "Bu yıl henüz yeterli veri yok — daha sonra tekrar kontrol et.",
    wrappedIntro: "{year}\nPara Özetin", tapToBegin: "Başlamak için dokun",
    slideSpentTitle: "Harcadığın tutar", slideTopCatTitle: "Çoğu şuraya gitti", slideIncomeTitle: "Gelen para", slideSavedTitle: "Biriktirdiğin tutar", slideBillsTitle: "Zamanında ödenen faturalar", slideClosingTitle: "İşte bu kadar", download: "Görseli indir", close: "Kapat",
    yourYearAtAGlance: "Yılın bir bakışta", percentOfSpend: "harcamanın",
  },
  ar: {
    title: "المالية", subtitle: "من أين يأتي، وإلى أين يذهب.",
    theme: "المظهر", language: "اللغة",
    totalIncome: "الدخل", spent: "الإنفاق", remaining: "المتبقي",
    breakdown: "إلى أين ذهب", noBreakdown: "سجّل مصروفًا لرؤية توزيعك.",
    income: "الدخل", addIncome: "إضافة دخل",
    recurringIncome: "متكرر", oneTimeIncome: "لمرة واحدة",
    noRecurringIncome: "لا يوجد دخل متكرر بعد.", noOneTimeIncome: "لا يوجد دخل لمرة واحدة هذا الشهر.",
    expenses: "المصروفات", addExpense: "إضافة مصروف", noExpenses: "لم يُسجَّل شيء هذا الشهر بعد.",
    bills: "الفواتير المتكررة", addBill: "إضافة فاتورة", noBills: "لا توجد فواتير متكررة بعد.", billsThisMonth: "مدفوعة هذا الشهر",
    savings: "المدخرات", goal: "الهدف", setGoal: "تحديد هدف الادخار", goalAmount: "المبلغ المستهدف",
    addContribution: "إضافة مساهمة", totalSaved: "إجمالي المدخر", ofGoal: "من الهدف",
    goalReached: "تم بلوغ الهدف 🎉", noGoalYet: "حدد هدفًا لبدء التتبع.",
    recentContributions: "الأخيرة", savedThisMonth: "تم ادخاره هذا الشهر",
    name: "الاسم…", amountLabel: "المبلغ", category: "الفئة",
    save: "حفظ", cancel: "إلغاء",
    categories: { rent: "الإيجار", food: "الطعام", transport: "المواصلات", subscriptions: "الاشتراكات", shopping: "التسوق", health: "الصحة", entertainment: "الترفيه", other: "أخرى" },
    yearInReview: "ملخص العام", viewWrapped: "عرض ملخص {year}", notEnoughData: "لا توجد بيانات كافية هذا العام بعد — عد لاحقًا.",
    wrappedIntro: "عامك {year}\nماليًا", tapToBegin: "اضغط للبدء",
    slideSpentTitle: "أنفقت", slideTopCatTitle: "ذهب معظمه إلى", slideIncomeTitle: "المال الوارد", slideSavedTitle: "ادخرت", slideBillsTitle: "فواتير مدفوعة في وقتها", slideClosingTitle: "هذا كل شيء", download: "تحميل الصورة", close: "إغلاق",
    yourYearAtAGlance: "عامك في لمحة", percentOfSpend: "من إنفاقك",
  },
};

const CATEGORY_META = {
  rent: { icon: "🏠", color: "#c9a961" },
  food: { icon: "🍔", color: "#e0885f" },
  transport: { icon: "🚗", color: "#5fb4c9" },
  subscriptions: { icon: "📱", color: "#8e9bc4" },
  shopping: { icon: "🛍️", color: "#c76b7a" },
  health: { icon: "💊", color: "#6fbf8f" },
  entertainment: { icon: "🎬", color: "#eb9fc1" },
  other: { icon: "📦", color: "#9aa3ab" },
};
const CATEGORY_KEYS = Object.keys(CATEGORY_META);

// TODO: swap this for the real app name once it's decided — used on the
// Wrapped closing card and the downloadable share image.
// APP_NAME is declared once, shared across the whole app (see top of file)

// Slide background gradients — deliberately more saturated than the app's
// normal palette, Wrapped-style, rather than tied to the current theme.
const FINANCE_SLIDE_BACKGROUNDS = [
  "linear-gradient(160deg,#1b1030,#4a1942)",
  "linear-gradient(160deg,#0f2340,#1c5f6b)",
  "linear-gradient(160deg,#3a1620,#8a3b3b)",
  "linear-gradient(160deg,#241a0a,#a8752f)",
  "linear-gradient(160deg,#12241a,#2f7d5c)",
  "linear-gradient(160deg,#1a1030,#5c3aa8)",
  "linear-gradient(160deg,#2a0f1f,#a83a6b)",
];

function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function thisMonthKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthKeyOf(dateStr) { return String(dateStr).slice(0, 7); }
function firstOfMonthISO(mk) { return `${mk}-01`; }
function shiftMonth(mk, delta) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(mk, lang) {
  const [y, m] = mk.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(localeFor(lang), { month: "long", year: "numeric" });
}
function fmtMoney(n, lang, currency) {
  return new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: currency || "EUR", maximumFractionDigits: 2 }).format(n || 0);
}
function currencySymbol(currency, lang) {
  try {
    const parts = new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: currency || "EUR", currencyDisplay: "narrowSymbol" }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value || (currency || "EUR");
  } catch (e) { return currency || "EUR"; }
}

function Donut({ segments, theme, size = 152, thickness = 22, centerValue, centerLabel }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let cursor = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.line} strokeWidth={thickness} />
        {total > 0 && segments.map((s) => {
          const len = (s.value / total) * c;
          const dashoffset = -cursor;
          cursor += len;
          return <circle key={s.key} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={dashoffset} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: 8 }}>
        <div className="fraunces" style={{ fontSize: 17, fontWeight: 600, color: theme.text }}>{centerValue}</div>
        <div style={{ fontSize: 9.5, color: theme.muted }}>{centerLabel}</div>
      </div>
    </div>
  );
}

function ProgressRing({ pct, theme, size = 132, thickness = 15, children }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, pct)) * c;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.line} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.accent} strokeWidth={thickness} strokeDasharray={`${filled} ${c - filled}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>{children}</div>
    </div>
  );
}

function FinanceSection({ title, icon, subtitle, onAdd, addLabel, children, theme }) {
  return (
    <div style={{ maxWidth: 460, margin: "28px auto 0", padding: "0 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: subtitle ? 2 : 12 }}>
        <div className="fraunces" style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8 }}>{icon}{title}</div>
        {onAdd && (
          <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 4, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "6px 10px", color: theme.accent, fontSize: 12, fontWeight: 600 }}>
            <Plus size={13} /> {addLabel}
          </button>
        )}
      </div>
      {subtitle && <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}

function FormPanel({ theme, children }) {
  return <div style={{ background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>;
}
function SaveCancelRow({ onSave, onCancel, t, theme }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={onCancel} style={{ flex: 1, background: "transparent", border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 0", color: theme.muted, fontSize: 13 }}>{t.cancel}</button>
      <button onClick={onSave} style={{ flex: 2, background: theme.accent, border: "none", borderRadius: 10, padding: "9px 0", color: theme.bg, fontSize: 13, fontWeight: 600 }}>{t.save}</button>
    </div>
  );
}
function ToggleChip({ active, onClick, children, theme }) {
  return <button onClick={onClick} style={{ flex: 1, background: active ? theme.accent : theme.panel, color: active ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 0", fontSize: 12.5, fontWeight: 500 }}>{children}</button>;
}
function CategoryPicker({ value, onChange, theme, t }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {CATEGORY_KEYS.map((k) => {
        const active = value === k;
        return (
          <button key={k} onClick={() => onChange(k)} style={{ display: "flex", alignItems: "center", gap: 5, background: active ? theme.accent : theme.panel, color: active ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "6px 10px", fontSize: 12 }}>
            <span>{CATEGORY_META[k].icon}</span><span>{t.categories[k]}</span>
          </button>
        );
      })}
    </div>
  );
}
function FinanceEmpty({ children, theme }) {
  return <div style={{ fontSize: 12.5, color: theme.muted, padding: "4px 2px 2px" }}>{children}</div>;
}
function Row({ icon, name, sub, amount, onEdit, onDelete, theme }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        {sub && <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" }}>{amount}</div>
      {onEdit && <button onClick={onEdit} style={{ background: "transparent", border: "none", color: theme.muted, padding: 4, flexShrink: 0 }}><Pencil size={13} /></button>}
      {onDelete && <button onClick={onDelete} style={{ background: "transparent", border: "none", color: theme.muted, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>}
    </div>
  );
}
function BillRow({ bill, paid, onToggle, onEdit, onDelete, theme, t, lang }) {
  const meta = CATEGORY_META[bill.category] || CATEGORY_META.other;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: theme.panel, border: `1px solid ${paid ? theme.accent : theme.line}`, borderRadius: 12, padding: "10px 12px", marginBottom: 8 }}>
      <button onClick={onToggle} style={{ width: 24, height: 24, borderRadius: "50%", border: `1.5px solid ${paid ? theme.accent : theme.line}`, background: paid ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {paid && <Check size={14} color={theme.bg} />}
      </button>
      <span style={{ fontSize: 16 }}>{meta.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{bill.name}</div>
        <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{t.categories[bill.category]}</div>
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: paid ? theme.text : theme.muted, whiteSpace: "nowrap" }}>{fmtMoney(bill.amount, lang, currency)}</div>
      <button onClick={onEdit} style={{ background: "transparent", border: "none", color: theme.muted, padding: 4, flexShrink: 0 }}><Pencil size={13} /></button>
      <button onClick={onDelete} style={{ background: "transparent", border: "none", color: theme.muted, padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
    </div>
  );
}
function SummaryCard({ label, value, theme, icon, highlight }) {
  return (
    <div style={{ background: theme.panel, border: `1px solid ${highlight ? "#c65f6f" : theme.line}`, borderRadius: 14, padding: "13px 14px", flex: "1 1 28%", minWidth: 108 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10.5, color: theme.muted, marginBottom: 4 }}>{icon}{label}</div>
      <div className="fraunces" style={{ fontSize: 16.5, fontWeight: 600, color: highlight ? "#c65f6f" : theme.text }}>{value}</div>
    </div>
  );
}

function buildFinanceWrappedSlides({ year, lang, currency, t, expenses, bills, incomeSources, oneOffIncome, savingsEntries }) {
  const slides = [];
  let bgIdx = 0;
  const nextBg = () => FINANCE_SLIDE_BACKGROUNDS[bgIdx++ % FINANCE_SLIDE_BACKGROUNDS.length];
  const yearOf = (d) => Number(String(d).slice(0, 4));

  const expensesThisYear = (expenses || []).filter((e) => yearOf(e.date) === year);
  const catTotals = {};
  expensesThisYear.forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });

  let billsPaidTotal = 0, billsPaidCount = 0;
  (bills || []).forEach((b) => {
    const paidThisYear = (b.paidMonths || []).filter((mk) => yearOf(mk) === year);
    billsPaidCount += paidThisYear.length;
    billsPaidTotal += paidThisYear.length * b.amount;
    if (paidThisYear.length > 0) catTotals[b.category] = (catTotals[b.category] || 0) + paidThisYear.length * b.amount;
  });

  const totalSpent = expensesThisYear.reduce((s, e) => s + e.amount, 0) + billsPaidTotal;

  const now = new Date();
  const monthsElapsed = year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 0;
  const recurringIncomeTotal = (incomeSources || []).reduce((s, x) => s + x.amount, 0) * monthsElapsed;
  const oneOffThisYear = (oneOffIncome || []).filter((x) => yearOf(x.date) === year).reduce((s, x) => s + x.amount, 0);
  const totalIncome = recurringIncomeTotal + oneOffThisYear;

  const savedThisYear = (savingsEntries || []).filter((x) => yearOf(x.date) === year).reduce((s, x) => s + x.amount, 0);

  const summaryItems = [];

  slides.push({ key: "intro", bg: nextBg(), render: () => (
    <>
      <div style={{ fontSize: 15, opacity: 0.75, marginBottom: 14, letterSpacing: "0.08em", textTransform: "uppercase" }}>{APP_NAME} · {year}</div>
      <div className="fraunces-w" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.25, whiteSpace: "pre-line" }}>{t.wrappedIntro.replace("{year}", year)}</div>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 26 }}>{t.tapToBegin}</div>
    </>
  )});

  if (totalSpent > 0) {
    slides.push({ key: "spent", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideSpentTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 56, fontWeight: 700, lineHeight: 1 }}>{fmtMoney(totalSpent, lang, currency)}</div>
      </>
    )});
    summaryItems.push({ emoji: "💸", value: fmtMoney(totalSpent, lang, currency), label: t.spent });
  }

  const topCatEntry = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  if (topCatEntry) {
    const [topCatKey, topCatValue] = topCatEntry;
    const pct = totalSpent > 0 ? Math.round((topCatValue / totalSpent) * 100) : 0;
    slides.push({ key: "topcat", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{CATEGORY_META[topCatKey]?.icon}</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideTopCatTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 34, fontWeight: 600 }}>{t.categories[topCatKey]}</div>
        <div style={{ fontSize: 14, opacity: 0.75, marginTop: 10 }}>{fmtMoney(topCatValue, lang, currency)} · {pct}% {t.percentOfSpend}</div>
      </>
    )});
    summaryItems.push({ emoji: CATEGORY_META[topCatKey]?.icon || "🏷️", value: t.categories[topCatKey], label: t.breakdown });
  }

  if (totalIncome > 0) {
    slides.push({ key: "income", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideIncomeTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 56, fontWeight: 700 }}>{fmtMoney(totalIncome, lang, currency)}</div>
      </>
    )});
    summaryItems.push({ emoji: "💰", value: fmtMoney(totalIncome, lang, currency), label: t.totalIncome });
  }

  if (savedThisYear > 0) {
    slides.push({ key: "saved", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🐷</div>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideSavedTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 52, fontWeight: 700 }}>{fmtMoney(savedThisYear, lang, currency)}</div>
      </>
    )});
    summaryItems.push({ emoji: "🐷", value: fmtMoney(savedThisYear, lang, currency), label: t.savings });
  }

  if (billsPaidCount > 0) {
    slides.push({ key: "bills", bg: nextBg(), render: () => (
      <>
        <div style={{ fontSize: 13, opacity: 0.75, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>{t.slideBillsTitle}</div>
        <div className="fraunces-w" style={{ fontSize: 72, fontWeight: 700 }}>{billsPaidCount}</div>
      </>
    )});
    summaryItems.push({ emoji: "🧾", value: billsPaidCount, label: t.bills });
  }

  const topSummaryItems = summaryItems.slice(0, 6);
  slides.push({ key: "closing", bg: nextBg(), isClosing: true, render: ({ onDownload, imageUrl }) => (
    <>
      <div style={{ fontSize: 34, marginBottom: 8 }}>✨</div>
      <div className="fraunces-w" style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>{t.slideClosingTitle}</div>
      <div style={{ fontSize: 12.5, opacity: 0.7, marginBottom: 20 }}>{t.yourYearAtAGlance} · {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, width: "100%", maxWidth: 280, pointerEvents: "auto" }}>
        {topSummaryItems.map((item, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 14, padding: "12px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 22 }}>{item.emoji}</span>
            <span className="fraunces-w" style={{ fontSize: 16, fontWeight: 700 }}>{item.value}</span>
            <span style={{ fontSize: 9.5, opacity: 0.75, textAlign: "center", lineHeight: 1.2 }}>{item.label}</span>
          </div>
        ))}
      </div>
      {imageUrl ? (
        <div id="wrapped-download-image" style={{ marginTop: 20, pointerEvents: "auto", textAlign: "center" }}>
          <img src={imageUrl} alt="" style={{ width: 140, borderRadius: 12, display: "block", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 10.5, opacity: 0.7 }}>Press and hold the image above to save it</div>
        </div>
      ) : (
        <button onClick={onDownload} style={{ pointerEvents: "auto", marginTop: 22, display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.35)", borderRadius: 24, padding: "12px 22px", color: "#fff", fontSize: 13.5, fontWeight: 600 }}>
          <Download size={15} /> {t.download}
        </button>
      )}
      <div style={{ marginTop: 16, fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.5 }}>{APP_NAME}</div>
    </>
  )});

  return { slides, summaryItems: topSummaryItems };
}

function FinanceYearWrapped({ slides, stats, year, t, onClose }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef(null);
  const [cardImageUrl, setCardImageUrl] = useState(null);
  const touchStartX = useRef(null);
  const SLIDE_MS = 5200;

  useEffect(() => {
    if (paused) return;
    let start = Date.now() - progress * SLIDE_MS;
    const iv = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / SLIDE_MS);
      setProgress(p);
      if (p >= 1) {
        if (idx < slides.length - 1) { setIdx((v) => v + 1); setProgress(0); }
        else clearInterval(iv);
      }
    }, 60);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused]);

  function goNext() { if (idx < slides.length - 1) { setIdx(idx + 1); setProgress(0); } }
  function goPrev() { if (idx > 0) { setIdx(idx - 1); setProgress(0); } }
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; setPaused(true); }
  function onTouchEnd(e) {
    setPaused(false);
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(dx) > 40) { if (dx < 0) goNext(); else goPrev(); }
    touchStartX.current = null;
  }

  function downloadCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = 540; canvas.height = 960;
    const grad = ctx.createLinearGradient(0, 0, 540, 960);
    grad.addColorStop(0, "#1b1030"); grad.addColorStop(1, "#4a1942");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 540, 960);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center";

    ctx.font = "600 30px Georgia";
    ctx.fillText("✨", 270, 130);
    ctx.font = "700 40px Georgia";
    ctx.fillText(t.slideClosingTitle, 270, 185);
    ctx.font = "400 17px Georgia"; ctx.globalAlpha = 0.7;
    ctx.fillText(`${t.yourYearAtAGlance} · ${year}`, 270, 216);
    ctx.globalAlpha = 1;

    const items = (stats.summaryItems || []).slice(0, 6);
    const cols = 2;
    const cellW = 220, cellH = 130;
    const gridW = cellW * cols + 16;
    const startX = 270 - gridW / 2 + cellW / 2;
    const startY = 300;
    items.forEach((item, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const cx = startX + col * (cellW + 16);
      const cy = startY + row * (cellH + 14);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1.5;
      const rx = cx - cellW / 2, ry = cy - cellH / 2, rw = cellW, rh = cellH, rr = 18;
      ctx.beginPath();
      ctx.moveTo(rx + rr, ry);
      ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, rr);
      ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, rr);
      ctx.arcTo(rx, ry + rh, rx, ry, rr);
      ctx.arcTo(rx, ry, rx + rw, ry, rr);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "34px Georgia";
      ctx.fillText(item.emoji, cx, cy - 20);
      ctx.font = "700 22px Georgia";
      ctx.fillText(String(item.value), cx, cy + 20);
      ctx.font = "400 12px Georgia"; ctx.globalAlpha = 0.75;
      ctx.fillText(item.label, cx, cy + 42);
      ctx.globalAlpha = 1;
    });

    ctx.font = "600 15px Georgia"; ctx.globalAlpha = 0.55;
    ctx.fillText(APP_NAME.toUpperCase(), 270, 900);
    ctx.globalAlpha = 1;

    const dataUrl = canvas.toDataURL("image/png");
    setCardImageUrl(dataUrl);
    setTimeout(() => document.getElementById("wrapped-download-image")?.scrollIntoView({ behavior: "smooth", block: "center" }), 120);
    try {
      const link = document.createElement("a");
      link.download = `${APP_NAME.toLowerCase()}-money-wrapped-${year}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {}
  }

  const slide = slides[idx];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: slide.bg, zIndex: 200, display: "flex", flexDirection: "column", color: "#fff", fontFamily: "'Inter', system-ui, sans-serif", transition: "background 0.4s ease" }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
    >
      <style>{`.fraunces-w { font-family: 'Fraunces', Georgia, serif; }`}</style>
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div style={{ display: "flex", gap: 4, padding: "16px 14px 0", zIndex: 5 }}>
        {slides.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.28)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: i < idx ? "100%" : i === idx ? `${progress * 100}%` : "0%", background: "#fff" }} />
          </div>
        ))}
      </div>

      <button onClick={onClose} style={{ position: "absolute", top: 14, right: 14, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 20, padding: 8, zIndex: 10 }}>
        <X size={18} color="#fff" />
      </button>

      <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 2 }}>
        <div style={{ flex: 1 }} onClick={goPrev} />
        <div style={{ flex: 2 }} onClick={goNext} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 30px", textAlign: "center", position: "relative", zIndex: 3, pointerEvents: "none" }}>
        {slide.render({ onDownload: downloadCard, imageUrl: cardImageUrl })}
      </div>
    </div>
  );
}

function Finance({ globalTheme, globalLang, currency }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [storageReady, setStorageReady] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(thisMonthKey());

  const [incomeSources, setIncomeSources] = useState([]);
  const [oneOffIncome, setOneOffIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [bills, setBills] = useState([]);
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [savingsEntries, setSavingsEntries] = useState([]);

  const [showAddIncome, setShowAddIncome] = useState(false);
  const [incomeName, setIncomeName] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeRecurring, setIncomeRecurring] = useState(true);
  const [editingIncomeId, setEditingIncomeId] = useState(null);

  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseCategory, setExpenseCategory] = useState("other");
  const [editingExpenseId, setEditingExpenseId] = useState(null);

  const [showAddBill, setShowAddBill] = useState(false);
  const [billName, setBillName] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billCategory, setBillCategory] = useState("other");
  const [editingBillId, setEditingBillId] = useState(null);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState("");
  const [showAddSaving, setShowAddSaving] = useState(false);
  const [savingAmount, setSavingAmount] = useState("");
  const [editingSavingId, setEditingSavingId] = useState(null);

  const [showWrapped, setShowWrapped] = useState(false);
  const [wrappedSlides, setWrappedSlides] = useState(null);
  const [notEnoughToast, setNotEnoughToast] = useState(false);

  const theme = THEMES[themeKey];
  const t = FINANCE_STRINGS[lang] || FINANCE_STRINGS.en;
  const year = new Date().getFullYear();

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("finance-state-v1");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          setIncomeSources(d.incomeSources || []);
          setOneOffIncome(d.oneOffIncome || []);
          setExpenses(d.expenses || []);
          setBills(d.bills || []);
          setSavingsGoal(d.savingsGoal || 0);
          setSavingsEntries(d.savingsEntries || []);
        }
      } catch (e) {}
      setStorageReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    (async () => {
      try {
        await supaSet("finance-state-v1", JSON.stringify({ themeKey, lang, incomeSources, oneOffIncome, expenses, bills, savingsGoal, savingsEntries }));
      } catch (e) { console.error(e); }
    })();
  }, [themeKey, lang, incomeSources, oneOffIncome, expenses, bills, savingsGoal, savingsEntries, storageReady]);

  const isCurrentMonth = currentMonth === thisMonthKey();
  const entryDate = () => (isCurrentMonth ? todayISO() : firstOfMonthISO(currentMonth));
  const inputStyle = { width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 12px", color: theme.text, fontSize: 13, outline: "none" };

  function saveIncome() {
    const amt = parseFloat(incomeAmount);
    if (!incomeName.trim() || !amt || amt <= 0) return;
    if (editingIncomeId) {
      const preservedDate = oneOffIncome.find((x) => x.id === editingIncomeId)?.date || entryDate();
      const remainingSources = incomeSources.filter((x) => x.id !== editingIncomeId);
      const remainingOneOff = oneOffIncome.filter((x) => x.id !== editingIncomeId);
      if (incomeRecurring) {
        setIncomeSources([...remainingSources, { id: editingIncomeId, name: incomeName.trim(), amount: amt }]);
        setOneOffIncome(remainingOneOff);
      } else {
        setOneOffIncome([...remainingOneOff, { id: editingIncomeId, name: incomeName.trim(), amount: amt, date: preservedDate }]);
        setIncomeSources(remainingSources);
      }
    } else if (incomeRecurring) {
      setIncomeSources([...incomeSources, { id: uid(), name: incomeName.trim(), amount: amt }]);
    } else {
      setOneOffIncome([...oneOffIncome, { id: uid(), name: incomeName.trim(), amount: amt, date: entryDate() }]);
    }
    resetIncomeForm();
    vibrate(20);
  }
  function resetIncomeForm() {
    setIncomeName(""); setIncomeAmount(""); setIncomeRecurring(true); setShowAddIncome(false); setEditingIncomeId(null);
  }
  function startEditIncomeSource(src) {
    setIncomeName(src.name); setIncomeAmount(String(src.amount)); setIncomeRecurring(true); setEditingIncomeId(src.id); setShowAddIncome(true);
  }
  function startEditOneOffIncome(inc) {
    setIncomeName(inc.name); setIncomeAmount(String(inc.amount)); setIncomeRecurring(false); setEditingIncomeId(inc.id); setShowAddIncome(true);
  }

  function saveExpense() {
    const amt = parseFloat(expenseAmount);
    if (!expenseName.trim() || !amt || amt <= 0) return;
    if (editingExpenseId) {
      setExpenses(expenses.map((x) => x.id === editingExpenseId ? { ...x, name: expenseName.trim(), amount: amt, category: expenseCategory } : x));
    } else {
      setExpenses([...expenses, { id: uid(), name: expenseName.trim(), amount: amt, category: expenseCategory, date: entryDate() }]);
    }
    resetExpenseForm();
    vibrate(20);
  }
  function resetExpenseForm() {
    setExpenseName(""); setExpenseAmount(""); setExpenseCategory("other"); setShowAddExpense(false); setEditingExpenseId(null);
  }
  function startEditExpense(ex) {
    setExpenseName(ex.name); setExpenseAmount(String(ex.amount)); setExpenseCategory(ex.category); setEditingExpenseId(ex.id); setShowAddExpense(true);
  }

  function saveBill() {
    const amt = parseFloat(billAmount);
    if (!billName.trim() || !amt || amt <= 0) return;
    if (editingBillId) {
      setBills(bills.map((x) => x.id === editingBillId ? { ...x, name: billName.trim(), amount: amt, category: billCategory } : x));
    } else {
      setBills([...bills, { id: uid(), name: billName.trim(), amount: amt, category: billCategory, paidMonths: [] }]);
    }
    resetBillForm();
    vibrate(20);
  }
  function resetBillForm() {
    setBillName(""); setBillAmount(""); setBillCategory("other"); setShowAddBill(false); setEditingBillId(null);
  }
  function startEditBill(b) {
    setBillName(b.name); setBillAmount(String(b.amount)); setBillCategory(b.category); setEditingBillId(b.id); setShowAddBill(true);
  }
  function toggleBillPaid(id) {
    setBills(bills.map((b) => {
      if (b.id !== id) return b;
      const paid = b.paidMonths.includes(currentMonth);
      return { ...b, paidMonths: paid ? b.paidMonths.filter((m) => m !== currentMonth) : [...b.paidMonths, currentMonth] };
    }));
    vibrate(15);
  }
  function saveGoal() {
    const amt = parseFloat(goalDraft);
    setSavingsGoal(amt > 0 ? amt : 0);
    setEditingGoal(false);
  }
  function saveSavingContribution() {
    const amt = parseFloat(savingAmount);
    if (!amt || amt <= 0) return;
    if (editingSavingId) {
      setSavingsEntries(savingsEntries.map((x) => x.id === editingSavingId ? { ...x, amount: amt } : x));
    } else {
      setSavingsEntries([...savingsEntries, { id: uid(), amount: amt, date: entryDate() }]);
    }
    resetSavingForm();
    vibrate(20);
  }
  function resetSavingForm() {
    setSavingAmount(""); setShowAddSaving(false); setEditingSavingId(null);
  }
  function startEditSaving(entry) {
    setSavingAmount(String(entry.amount)); setEditingSavingId(entry.id); setShowAddSaving(true);
  }

  function openWrapped() {
    const { slides, summaryItems } = buildFinanceWrappedSlides({ year, lang, currency, t, expenses, bills, incomeSources, oneOffIncome, savingsEntries });
    if (slides.length <= 2) { setNotEnoughToast(true); setTimeout(() => setNotEnoughToast(false), 2600); return; }
    setWrappedSlides({ slides, summaryItems });
    setShowWrapped(true);
  }

  const recurringIncomeTotal = incomeSources.reduce((s, x) => s + x.amount, 0);
  const oneOffThisMonth = oneOffIncome.filter((x) => monthKeyOf(x.date) === currentMonth);
  const oneOffTotal = oneOffThisMonth.reduce((s, x) => s + x.amount, 0);
  const totalIncome = recurringIncomeTotal + oneOffTotal;

  const expensesThisMonth = [...expenses].filter((x) => monthKeyOf(x.date) === currentMonth).sort((a, b) => b.date.localeCompare(a.date));
  const expensesTotal = expensesThisMonth.reduce((s, x) => s + x.amount, 0);

  const billsPaidThisMonth = bills.filter((b) => b.paidMonths.includes(currentMonth));
  const billsPaidTotal = billsPaidThisMonth.reduce((s, x) => s + x.amount, 0);
  const billsAllTotal = bills.reduce((s, x) => s + x.amount, 0);

  const totalSpent = expensesTotal + billsPaidTotal;
  const remaining = totalIncome - totalSpent;

  const savingsThisMonth = savingsEntries.filter((x) => monthKeyOf(x.date) === currentMonth).reduce((s, x) => s + x.amount, 0);
  const totalSaved = savingsEntries.reduce((s, x) => s + x.amount, 0);
  const savingsPct = savingsGoal > 0 ? totalSaved / savingsGoal : 0;

  const categoryTotals = {};
  expensesThisMonth.forEach((e) => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount; });
  billsPaidThisMonth.forEach((b) => { categoryTotals[b.category] = (categoryTotals[b.category] || 0) + b.amount; });
  const segments = CATEGORY_KEYS
    .map((k) => ({ key: k, value: categoryTotals[k] || 0, color: CATEGORY_META[k].color, label: t.categories[k] }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 130 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .fraunces { font-family: 'Fraunces', serif; }
        button { font-family: inherit; cursor: pointer; }
        input, select, textarea { font-family: inherit; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 20px 0" }}>
        <div>
          <div className="fraunces" style={{ fontSize: 24, fontWeight: 500 }}>{t.title}</div>
          <div style={{ fontSize: 12.5, color: theme.muted, marginTop: 4 }}>{t.subtitle}</div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, margin: "22px 20px 0" }}>
        <button onClick={() => setCurrentMonth(shiftMonth(currentMonth, -1))} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text }}>
          <ChevronLeft size={16} />
        </button>
        <div className="fraunces" style={{ fontSize: 16, minWidth: 150, textAlign: "center" }}>{monthLabel(currentMonth, lang)}</div>
        <button onClick={() => setCurrentMonth(shiftMonth(currentMonth, 1))} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: theme.text }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ maxWidth: 460, margin: "20px auto 0", padding: "0 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <SummaryCard label={t.totalIncome} value={fmtMoney(totalIncome, lang, currency)} theme={theme} icon={<TrendingUp size={13} color="#6fbf8f" />} />
        <SummaryCard label={t.spent} value={fmtMoney(totalSpent, lang, currency)} theme={theme} icon={<TrendingDown size={13} color="#e0885f" />} />
        <SummaryCard label={t.remaining} value={fmtMoney(remaining, lang, currency)} theme={theme} highlight={remaining < 0} />
      </div>

      <div style={{ maxWidth: 460, margin: "28px auto 0", padding: "0 20px" }}>
        <div className="fraunces" style={{ fontSize: 16, marginBottom: 14 }}>{t.breakdown}</div>
        {segments.length === 0 ? (
          <FinanceEmpty theme={theme}>{t.noBreakdown}</FinanceEmpty>
        ) : (
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <Donut segments={segments} theme={theme} centerValue={fmtMoney(totalSpent, lang, currency)} centerLabel={t.spent} />
            <div style={{ flex: 1, minWidth: 140, display: "flex", flexDirection: "column", gap: 8 }}>
              {segments.map((s) => (
                <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, color: theme.text }}>{s.label}</span>
                  <span style={{ color: theme.muted }}>{fmtMoney(s.value, lang, currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <FinanceSection title={t.income} icon={<Wallet size={16} color={theme.accent} />} onAdd={() => { if (showAddIncome) resetIncomeForm(); else { setEditingIncomeId(null); setIncomeName(""); setIncomeAmount(""); setIncomeRecurring(true); setShowAddIncome(true); } }} addLabel={t.addIncome} theme={theme}>
        {showAddIncome && (
          <FormPanel theme={theme}>
            <input placeholder={t.name} value={incomeName} onChange={(e) => setIncomeName(e.target.value)} style={inputStyle} />
            <input type="number" placeholder={`${t.amountLabel} (${currencySymbol(currency, lang)})`} value={incomeAmount} onChange={(e) => setIncomeAmount(e.target.value)} style={inputStyle} />
            <div style={{ display: "flex", gap: 8 }}>
              <ToggleChip active={incomeRecurring} onClick={() => setIncomeRecurring(true)} theme={theme}>{t.recurringIncome}</ToggleChip>
              <ToggleChip active={!incomeRecurring} onClick={() => setIncomeRecurring(false)} theme={theme}>{t.oneTimeIncome}</ToggleChip>
            </div>
            <SaveCancelRow onSave={saveIncome} onCancel={resetIncomeForm} t={t} theme={theme} />
          </FormPanel>
        )}
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.muted, margin: "4px 0 8px" }}>{t.recurringIncome}</div>
        {incomeSources.length === 0 ? <FinanceEmpty theme={theme}>{t.noRecurringIncome}</FinanceEmpty> : incomeSources.map((src) => (
          <Row key={src.id} name={src.name} amount={fmtMoney(src.amount, lang, currency)} onEdit={() => startEditIncomeSource(src)} onDelete={() => setIncomeSources(incomeSources.filter((x) => x.id !== src.id))} theme={theme} />
        ))}
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.muted, margin: "14px 0 8px" }}>{t.oneTimeIncome}</div>
        {oneOffThisMonth.length === 0 ? <FinanceEmpty theme={theme}>{t.noOneTimeIncome}</FinanceEmpty> : oneOffThisMonth.map((inc) => (
          <Row key={inc.id} name={inc.name} amount={fmtMoney(inc.amount, lang, currency)} onEdit={() => startEditOneOffIncome(inc)} onDelete={() => setOneOffIncome(oneOffIncome.filter((x) => x.id !== inc.id))} theme={theme} />
        ))}
      </FinanceSection>

      <FinanceSection title={t.expenses} icon={<Receipt size={16} color={theme.accent} />} onAdd={() => { if (showAddExpense) resetExpenseForm(); else { setEditingExpenseId(null); setExpenseName(""); setExpenseAmount(""); setExpenseCategory("other"); setShowAddExpense(true); } }} addLabel={t.addExpense} theme={theme}>
        {showAddExpense && (
          <FormPanel theme={theme}>
            <input placeholder={t.name} value={expenseName} onChange={(e) => setExpenseName(e.target.value)} style={inputStyle} />
            <input type="number" placeholder={`${t.amountLabel} (${currencySymbol(currency, lang)})`} value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={inputStyle} />
            <CategoryPicker value={expenseCategory} onChange={setExpenseCategory} theme={theme} t={t} />
            <SaveCancelRow onSave={saveExpense} onCancel={resetExpenseForm} t={t} theme={theme} />
          </FormPanel>
        )}
        {expensesThisMonth.length === 0 ? <FinanceEmpty theme={theme}>{t.noExpenses}</FinanceEmpty> : expensesThisMonth.map((ex) => (
          <Row key={ex.id} icon={CATEGORY_META[ex.category]?.icon} name={ex.name} sub={t.categories[ex.category]} amount={fmtMoney(ex.amount, lang, currency)} onEdit={() => startEditExpense(ex)} onDelete={() => setExpenses(expenses.filter((x) => x.id !== ex.id))} theme={theme} />
        ))}
      </FinanceSection>

      <FinanceSection
        title={t.bills}
        icon={<Repeat size={16} color={theme.accent} />}
        onAdd={() => { if (showAddBill) resetBillForm(); else { setEditingBillId(null); setBillName(""); setBillAmount(""); setBillCategory("other"); setShowAddBill(true); } }}
        addLabel={t.addBill}
        subtitle={bills.length > 0 ? `${fmtMoney(billsPaidTotal, lang, currency)} / ${fmtMoney(billsAllTotal, lang, currency)} ${t.billsThisMonth}` : null}
        theme={theme}
      >
        {showAddBill && (
          <FormPanel theme={theme}>
            <input placeholder={t.name} value={billName} onChange={(e) => setBillName(e.target.value)} style={inputStyle} />
            <input type="number" placeholder={`${t.amountLabel} (${currencySymbol(currency, lang)})`} value={billAmount} onChange={(e) => setBillAmount(e.target.value)} style={inputStyle} />
            <CategoryPicker value={billCategory} onChange={setBillCategory} theme={theme} t={t} />
            <SaveCancelRow onSave={saveBill} onCancel={resetBillForm} t={t} theme={theme} />
          </FormPanel>
        )}
        {bills.length === 0 ? <FinanceEmpty theme={theme}>{t.noBills}</FinanceEmpty> : bills.map((b) => (
          <BillRow key={b.id} bill={b} paid={b.paidMonths.includes(currentMonth)} onToggle={() => toggleBillPaid(b.id)} onEdit={() => startEditBill(b)} onDelete={() => setBills(bills.filter((x) => x.id !== b.id))} theme={theme} t={t} lang={lang} />
        ))}
      </FinanceSection>

      <FinanceSection title={t.savings} icon={<PiggyBank size={16} color={theme.accent} />} theme={theme}>
        <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
          <ProgressRing pct={savingsPct} theme={theme}>
            <div className="fraunces" style={{ fontSize: 19, fontWeight: 600 }}>{Math.round(savingsPct * 100)}%</div>
            <div style={{ fontSize: 9.5, color: theme.muted }}>{t.ofGoal}</div>
          </ProgressRing>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 12, color: theme.muted, marginBottom: 2 }}>{t.totalSaved}</div>
            <div className="fraunces" style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{fmtMoney(totalSaved, lang, currency)}</div>
            {savingsGoal > 0 ? (
              <div style={{ fontSize: 12, color: theme.muted }}>{t.goal}: {fmtMoney(savingsGoal, lang, currency)}</div>
            ) : (
              <div style={{ fontSize: 12, color: theme.muted }}>{t.noGoalYet}</div>
            )}
            {savingsThisMonth > 0 && <div style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>+{fmtMoney(savingsThisMonth, lang, currency)} {t.savedThisMonth}</div>}
            {savingsGoal > 0 && savingsPct >= 1 && <div style={{ fontSize: 12.5, color: theme.accent, marginTop: 6, fontWeight: 600 }}>{t.goalReached}</div>}
          </div>
        </div>

        {!editingGoal ? (
          <button onClick={() => { setEditingGoal(true); setGoalDraft(savingsGoal ? String(savingsGoal) : ""); }} style={{ width: "100%", background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "9px 0", color: theme.text, fontSize: 12.5, marginBottom: 10 }}>
            {t.setGoal}
          </button>
        ) : (
          <FormPanel theme={theme}>
            <input type="number" placeholder={t.goalAmount} value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} style={inputStyle} />
            <SaveCancelRow onSave={saveGoal} onCancel={() => setEditingGoal(false)} t={t} theme={theme} />
          </FormPanel>
        )}

        {!showAddSaving ? (
          <button onClick={() => { setEditingSavingId(null); setSavingAmount(""); setShowAddSaving(true); }} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: theme.accent, border: "none", borderRadius: 10, padding: "10px 0", color: theme.bg, fontSize: 13, fontWeight: 600, marginBottom: 14 }}>
            <Plus size={14} /> {t.addContribution}
          </button>
        ) : (
          <FormPanel theme={theme}>
            <input type="number" placeholder={`${t.amountLabel} (${currencySymbol(currency, lang)})`} value={savingAmount} onChange={(e) => setSavingAmount(e.target.value)} style={inputStyle} />
            <SaveCancelRow onSave={saveSavingContribution} onCancel={resetSavingForm} t={t} theme={theme} />
          </FormPanel>
        )}

        {savingsEntries.length > 0 && (
          <>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: theme.muted, margin: "4px 0 8px" }}>{t.recentContributions}</div>
            {[...savingsEntries].reverse().slice(0, 5).map((entry) => (
              <Row key={entry.id} name={entry.date} amount={fmtMoney(entry.amount, lang, currency)} onEdit={() => startEditSaving(entry)} onDelete={() => setSavingsEntries(savingsEntries.filter((x) => x.id !== entry.id))} theme={theme} />
            ))}
          </>
        )}
      </FinanceSection>

      <div style={{ maxWidth: 460, margin: "30px auto 0", padding: "0 20px 20px" }}>
        <div style={{ background: `linear-gradient(135deg, ${theme.accent}22, ${theme.panel})`, border: `1px solid ${theme.accent}55`, borderRadius: 18, padding: 20, textAlign: "center" }}>
          <Sparkles size={20} color={theme.accent} style={{ marginBottom: 8 }} />
          <div className="fraunces" style={{ fontSize: 17, marginBottom: 6 }}>{t.yearInReview}</div>
          <button onClick={openWrapped} style={{ marginTop: 8, background: theme.accent, color: theme.bg, border: "none", borderRadius: 30, padding: "12px 22px", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 8 }}>
            {t.viewWrapped.replace("{year}", year)} <ChevronRight size={15} />
          </button>
          {notEnoughToast && <div style={{ marginTop: 12, fontSize: 12, color: theme.muted }}>{t.notEnoughData}</div>}
        </div>
      </div>

      {showWrapped && wrappedSlides && (
        <FinanceYearWrapped slides={wrappedSlides.slides} stats={{ summaryItems: wrappedSlides.summaryItems }} year={year} t={t} onClose={() => setShowWrapped(false)} />
      )}
    </div>
  );
}


const TODAY_STRINGS = {
  en: {
    title: "Today", subtitle: "Everything on your plate, in one place.",
    theme: "Look", language: "Language", refresh: "Refresh",
    todoTitle: "To-Do Today", noTodos: "Nothing on your list for today.",
    habitsTitle: "Habits", noHabits: "No daily habits set up yet.",
    hydration: "Hydration", liters: "L today",
    challengeTitle: "Today's Challenge", noChallenge: "No active challenges right now.",
    dayOf: "Day {day} of {total}", moreChallenges: "+{n} more in progress",
    questTitle: "Today's Quest", questDone: "Quest complete for today ✓", questPending: "You haven't spun the wheel yet today.", goSpin: "Head over to the Quest tab to spin.",
    reflectTitle: "How are you feeling?", journalPlaceholder: "Anything on your mind today…", save: "Save", saved: "Saved",
    streakDays: "day streak",
  },
  de: {
    title: "Heute", subtitle: "Alles Wichtige an einem Ort.",
    theme: "Aussehen", language: "Sprache", refresh: "Aktualisieren",
    todoTitle: "Heutige Aufgaben", noTodos: "Für heute steht nichts auf deiner Liste.",
    habitsTitle: "Gewohnheiten", noHabits: "Noch keine täglichen Gewohnheiten eingerichtet.",
    hydration: "Hydration", liters: "L heute",
    challengeTitle: "Heutige Challenge", noChallenge: "Gerade keine aktive Challenge.",
    dayOf: "Tag {day} von {total}", moreChallenges: "+{n} weitere in Bearbeitung",
    questTitle: "Heutige Aufgabe", questDone: "Heutige Aufgabe erledigt ✓", questPending: "Du hast das Rad heute noch nicht gedreht.", goSpin: "Geh zum Aufgaben-Tab, um zu drehen.",
    reflectTitle: "Wie fühlst du dich?", journalPlaceholder: "Was beschäftigt dich heute…", save: "Speichern", saved: "Gespeichert",
    streakDays: "Tage-Serie",
  },
  es: {
    title: "Hoy", subtitle: "Todo lo tuyo, en un solo lugar.",
    theme: "Estilo", language: "Idioma", refresh: "Actualizar",
    todoTitle: "Tareas de hoy", noTodos: "No tienes nada en tu lista para hoy.",
    habitsTitle: "Hábitos", noHabits: "Aún no has configurado hábitos diarios.",
    hydration: "Hidratación", liters: "L hoy",
    challengeTitle: "Desafío de hoy", noChallenge: "No hay desafíos activos ahora mismo.",
    dayOf: "Día {day} de {total}", moreChallenges: "+{n} más en curso",
    questTitle: "Misión de hoy", questDone: "Misión completada hoy ✓", questPending: "Todavía no has girado la rueda hoy.", goSpin: "Ve a la pestaña Misión para girar.",
    reflectTitle: "¿Cómo te sientes?", journalPlaceholder: "¿Qué tienes en mente hoy…", save: "Guardar", saved: "Guardado",
    streakDays: "días de racha",
  },
  fr: {
    title: "Aujourd'hui", subtitle: "Tout ce que tu as à faire, au même endroit.",
    theme: "Apparence", language: "Langue", refresh: "Actualiser",
    todoTitle: "Tâches du jour", noTodos: "Rien sur ta liste pour aujourd'hui.",
    habitsTitle: "Habitudes", noHabits: "Aucune habitude quotidienne configurée pour l'instant.",
    hydration: "Hydratation", liters: "L aujourd'hui",
    challengeTitle: "Défi du jour", noChallenge: "Aucun défi actif pour le moment.",
    dayOf: "Jour {day} sur {total}", moreChallenges: "+{n} autres en cours",
    questTitle: "Quête du jour", questDone: "Quête terminée aujourd'hui ✓", questPending: "Tu n'as pas encore tourné la roue aujourd'hui.", goSpin: "Va dans l'onglet Quête pour tourner la roue.",
    reflectTitle: "Comment te sens-tu ?", journalPlaceholder: "Qu'as-tu en tête aujourd'hui…", save: "Enregistrer", saved: "Enregistré",
    streakDays: "jours de série",
  },
  it: {
    title: "Oggi", subtitle: "Tutto quello che hai da fare, in un unico posto.",
    theme: "Aspetto", language: "Lingua", refresh: "Aggiorna",
    todoTitle: "Cose da fare oggi", noTodos: "Nulla nella tua lista per oggi.",
    habitsTitle: "Abitudini", noHabits: "Nessuna abitudine quotidiana impostata ancora.",
    hydration: "Idratazione", liters: "L oggi",
    challengeTitle: "Sfida di oggi", noChallenge: "Nessuna sfida attiva al momento.",
    dayOf: "Giorno {day} di {total}", moreChallenges: "+{n} altre in corso",
    questTitle: "Missione di oggi", questDone: "Missione completata oggi ✓", questPending: "Non hai ancora girato la ruota oggi.", goSpin: "Vai alla scheda Missione per girare.",
    reflectTitle: "Come ti senti?", journalPlaceholder: "Cosa hai in mente oggi…", save: "Salva", saved: "Salvato",
    streakDays: "giorni di serie",
  },
  pt: {
    title: "Hoje", subtitle: "Tudo o que você tem para fazer, em um só lugar.",
    theme: "Aparência", language: "Idioma", refresh: "Atualizar",
    todoTitle: "Tarefas de hoje", noTodos: "Nada na sua lista para hoje.",
    habitsTitle: "Hábitos", noHabits: "Nenhum hábito diário configurado ainda.",
    hydration: "Hidratação", liters: "L hoje",
    challengeTitle: "Desafio de hoje", noChallenge: "Nenhum desafio ativo no momento.",
    dayOf: "Dia {day} de {total}", moreChallenges: "+{n} outros em andamento",
    questTitle: "Missão de hoje", questDone: "Missão concluída hoje ✓", questPending: "Você ainda não girou a roda hoje.", goSpin: "Vá até a aba Missão para girar.",
    reflectTitle: "Como você está se sentindo?", journalPlaceholder: "O que está passando pela sua cabeça hoje…", save: "Salvar", saved: "Salvo",
    streakDays: "dias de sequência",
  },
  tr: {
    title: "Bugün", subtitle: "Yapman gereken her şey, tek bir yerde.",
    theme: "Görünüm", language: "Dil", refresh: "Yenile",
    todoTitle: "Bugünün Yapılacakları", noTodos: "Bugün için listende hiçbir şey yok.",
    habitsTitle: "Alışkanlıklar", noHabits: "Henüz günlük alışkanlık ayarlanmadı.",
    hydration: "Hidrasyon", liters: "L bugün",
    challengeTitle: "Bugünün Hedefi", noChallenge: "Şu anda aktif bir hedef yok.",
    dayOf: "{total} günün {day}. günü", moreChallenges: "+{n} tane daha devam ediyor",
    questTitle: "Bugünün Görevi", questDone: "Bugünkü görev tamamlandı ✓", questPending: "Bugün henüz çarkı çevirmedin.", goSpin: "Çevirmek için Görev sekmesine git.",
    reflectTitle: "Nasıl hissediyorsun?", journalPlaceholder: "Bugün aklında ne var…", save: "Kaydet", saved: "Kaydedildi",
    streakDays: "gün seri",
  },
  ar: {
    title: "اليوم", subtitle: "كل ما عليك فعله، في مكان واحد.",
    theme: "المظهر", language: "اللغة", refresh: "تحديث",
    todoTitle: "مهام اليوم", noTodos: "لا يوجد شيء في قائمتك لهذا اليوم.",
    habitsTitle: "العادات", noHabits: "لم يتم إعداد أي عادات يومية بعد.",
    hydration: "الترطيب", liters: "لتر اليوم",
    challengeTitle: "تحدي اليوم", noChallenge: "لا توجد تحديات نشطة حاليًا.",
    dayOf: "اليوم {day} من {total}", moreChallenges: "+{n} أخرى قيد التقدم",
    questTitle: "مهمة اليوم", questDone: "تم إكمال مهمة اليوم ✓", questPending: "لم تُدر العجلة بعد اليوم.", goSpin: "انتقل إلى تبويب المهمة لتديرها.",
    reflectTitle: "كيف تشعر؟", journalPlaceholder: "ما الذي يشغل بالك اليوم…", save: "حفظ", saved: "تم الحفظ",
    streakDays: "أيام متتالية",
  },
};

const TODAY_MOODS = [
  { key: "happy", emoji: "😊", en: "Happy", de: "Glücklich", es: "Feliz", fr: "Heureux", it: "Felice", pt: "Feliz", tr: "Mutlu", ar: "سعيد", color: "#f2c94c" },
  { key: "goodnews", emoji: "🎉", en: "Good news", de: "Gute Nachricht", es: "Buenas noticias", fr: "Bonne nouvelle", it: "Buone notizie", pt: "Boas notícias", tr: "İyi haber", ar: "خبر سار", color: "#eb9fc1" },
  { key: "neutral", emoji: "😐", en: "Neutral", de: "Neutral", es: "Neutral", fr: "Neutre", it: "Neutro", pt: "Neutro", tr: "Nötr", ar: "محايد", color: "#9aa3ab" },
  { key: "tired", emoji: "😴", en: "Tired", de: "Müde", es: "Cansado", fr: "Fatigué", it: "Stanco", pt: "Cansado", tr: "Yorgun", ar: "متعب", color: "#8e9bc4" },
  { key: "stressed", emoji: "😣", en: "Stressed", de: "Gestresst", es: "Estresado", fr: "Stressé", it: "Stressato", pt: "Estressado", tr: "Stresli", ar: "متوتر", color: "#e0885f" },
  { key: "sad", emoji: "😢", en: "Sad", de: "Traurig", es: "Triste", fr: "Triste", it: "Triste", pt: "Triste", tr: "Üzgün", ar: "حزين", color: "#6f9bd1" },
  { key: "cried", emoji: "😭", en: "Cried", de: "Geweint", es: "Lloré", fr: "J'ai pleuré", it: "Ho pianto", pt: "Chorei", tr: "Ağladım", ar: "بكيت", color: "#5f7fbf" },
  { key: "badnews", emoji: "💔", en: "Bad news", de: "Schlechte Nachricht", es: "Malas noticias", fr: "Mauvaise nouvelle", it: "Cattive notizie", pt: "Más notícias", tr: "Kötü haber", ar: "خبر سيئ", color: "#c65f6f" },
];

function daysBetween(aISO, bISO) {
  const a = new Date(aISO + "T00:00:00");
  const b = new Date(bISO + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

function TodaySection({ title, icon, subtitle, theme, children }) {
  return (
    <div style={{ maxWidth: 460, margin: "26px auto 0", padding: "0 20px" }}>
      <div className="fraunces-t" style={{ fontSize: 16, display: "flex", alignItems: "center", gap: 8, marginBottom: subtitle ? 2 : 12 }}>{icon}{title}</div>
      {subtitle && <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{subtitle}</div>}
      {children}
    </div>
  );
}
function TodayEmpty({ children, theme }) {
  return <div style={{ fontSize: 12.5, color: theme.muted, padding: "4px 2px 10px" }}>{children}</div>;
}
function CheckRow({ label, sub, done, onToggle, theme }) {
  return (
    <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "11px 12px", marginBottom: 8, textAlign: "left" }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${done ? theme.accent : theme.line}`, background: done ? theme.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {done && <Check size={14} color={theme.bg} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: theme.text, textDecoration: done ? "line-through" : "none", opacity: done ? 0.55 : 1 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: theme.muted, marginTop: 1 }}>{sub}</div>}
      </span>
    </button>
  );
}
function HabitPill({ label, done, onToggle, theme }) {
  return (
    <button onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: 6, background: done ? theme.accent : theme.panel, color: done ? theme.bg : theme.text, border: `1px solid ${done ? theme.accent : theme.line}`, borderRadius: 20, padding: "8px 12px", fontSize: 12.5, fontWeight: 500 }}>
      {done ? <Check size={13} /> : <span style={{ width: 13, height: 13, borderRadius: "50%", border: `1.5px solid ${theme.muted}` }} />}
      {label}
    </button>
  );
}

function Today({ globalTheme, globalLang, isActive }) {
  const [themeKey, setThemeKey] = useState(globalTheme || "midnight");
  const [lang, setLang] = useState(globalLang || "en");
  useEffect(() => { if (globalTheme) setThemeKey(globalTheme); }, [globalTheme]);
  useEffect(() => { if (globalLang) setLang(globalLang); }, [globalLang]);
  const [storageReady, setStorageReady] = useState(false);
  const [crossTab, setCrossTab] = useState({ todo: null, challenges: null, reflect: null, quest: null });
  const [journalDraft, setJournalDraft] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const theme = THEMES[themeKey];
  const t = TODAY_STRINGS[lang] || TODAY_STRINGS.en;
  const dl = lang; // was hardcoded to en/de only — this is the actual bug that broke every non-en/de mood label
  const today = todayKey();
  const { liveSync } = useContext(LiveSyncContext) || {};

  async function refreshCrossTabData() {
    const result = { todo: null, challenges: null, reflect: null, quest: null };
    try { const r = await supaGet("todo-templates-state-v3"); if (r && r.value) result.todo = JSON.parse(r.value); } catch (e) {}
    try { const r = await supaGet("challenges-state-v3"); if (r && r.value) result.challenges = JSON.parse(r.value); } catch (e) {}
    try { const r = await supaGet("reflect-state-v1"); if (r && r.value) result.reflect = JSON.parse(r.value); } catch (e) {}
    try { const r = await supaGet("quest-wheel-state-v2"); if (r && r.value) result.quest = JSON.parse(r.value); } catch (e) {}
    setCrossTab(result);
    setJournalDraft((result.reflect?.journalEntries || {})[today] || "");
    return result;
  }

  useEffect(() => {
    (async () => {
      await refreshCrossTabData();
      setStorageReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Other artifacts can change data behind the scenes, so re-sync whenever
  // this tab regains focus rather than only relying on the initial load.
  useEffect(() => {
    function onFocus() { refreshCrossTabData(); }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tabs stay mounted the whole session now (not remounted on switch), so
  // window "focus" alone isn't enough — re-sync every time this specific
  // tab becomes the visible one, and keep polling lightly while it's open
  // so data entered in another tab shows up without needing to leave and
  // come back.
  useEffect(() => {
    if (isActive) refreshCrossTabData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const iv = setInterval(refreshCrossTabData, 2500);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  async function manualRefresh() {
    setRefreshing(true);
    await refreshCrossTabData();
    setTimeout(() => setRefreshing(false), 500);
  }

  async function writeCrossTab(key, storageKey, newRaw) {
    setCrossTab((prev) => ({ ...prev, [key]: newRaw }));
    try { await supaSet(storageKey, JSON.stringify(newRaw)); } catch (e) { console.error(e); }
  }

  // ---- To-Do / Habits (todo-templates-state-v3) ----
  const todoRaw = liveSync?.todo;
  const allTasks = todoRaw?.tasks || [];
  const tasksToday = allTasks.filter((tk) => {
    const targetDate = new Date(today + "T00:00:00");
    if (tk.repeat === "daily") return true;
    if (tk.repeat === "weekly") return tk.date && new Date(tk.date + "T00:00:00").getDay() === targetDate.getDay();
    if (tk.repeat === "custom") return (tk.customDays || []).includes(targetDate.getDay());
    return tk.date === today;
  });
  const plainTasksToday = tasksToday.filter((tk) => !tk.steps);
  const habitTasksToday = tasksToday.filter((tk) => !!tk.steps);

  function toggleTodoTask(taskId) {
    if (!todoRaw || !liveSync?.todo?.setTasks) return;
    const tasks = allTasks.map((tk) => {
      if (tk.id !== taskId) return tk;
      const done = tk.completedDates.includes(today);
      return { ...tk, completedDates: done ? tk.completedDates.filter((d) => d !== today) : [...tk.completedDates, today] };
    });
    liveSync.todo.setTasks(tasks);
    vibrate(15);
  }
  function toggleHabitTask(taskId) {
    if (!todoRaw || !liveSync?.todo?.setTasks) return;
    const tasks = allTasks.map((tk) => {
      if (tk.id !== taskId) return tk;
      const existing = tk.stepProgress?.[today] || new Array(tk.steps.length).fill(false);
      const isDone = existing.length === tk.steps.length && existing.every(Boolean);
      const updated = new Array(tk.steps.length).fill(!isDone);
      const completedDates = !isDone ? Array.from(new Set([...tk.completedDates, today])) : tk.completedDates.filter((d) => d !== today);
      return { ...tk, stepProgress: { ...tk.stepProgress, [today]: updated }, completedDates };
    });
    liveSync.todo.setTasks(tasks);
    vibrate(15);
  }
  function isHabitDone(tk) {
    const existing = tk.stepProgress?.[today] || new Array(tk.steps.length).fill(false);
    return existing.length === tk.steps.length && existing.every(Boolean);
  }

  // ---- Hydration lives here too, quick-tick style ----
  const reflectRaw = liveSync?.reflect;
  const todayLiters = (reflectRaw?.hydrationLogs || {})[today] || 0;
  function adjustHydration(delta) {
    if (!liveSync?.reflect?.setHydrationLogs) return;
    const raw = reflectRaw || {};
    const current = (raw.hydrationLogs || {})[today] || 0;
    const next = Math.max(0, Math.round((current + delta) * 4) / 4);
    const hydrationLogs = { ...(raw.hydrationLogs || {}), [today]: next };
    liveSync.reflect.setHydrationLogs(hydrationLogs);
    vibrate(12);
  }

  // ---- Today's Challenge (challenges-state-v3) ----
  const challengesRaw = liveSync?.challenges;
  const allChallenges = challengesRaw?.challenges || [];
  const activeChallenges = allChallenges
    .map((c) => {
      const dayNumber = daysBetween(c.startDate, today) + 1;
      return { c, dayNumber };
    })
    .filter(({ dayNumber, c }) => dayNumber >= 1 && dayNumber <= c.totalDays);

  function toggleChallengeDay(challengeId, dayNumber, dayPlan) {
    if (!challengesRaw || !liveSync?.challenges?.setChallenges) return;
    const challenges = allChallenges.map((c) => {
      if (c.id !== challengeId) return c;
      if (dayPlan && dayPlan.tasks.length > 0) {
        const existing = c.dayTasksProgress?.[dayNumber] || new Array(dayPlan.tasks.length).fill(false);
        const allDone = existing.length === dayPlan.tasks.length && existing.every(Boolean);
        return { ...c, dayTasksProgress: { ...c.dayTasksProgress, [dayNumber]: new Array(dayPlan.tasks.length).fill(!allDone) } };
      }
      const has = c.checkedDays.includes(dayNumber);
      return { ...c, checkedDays: has ? c.checkedDays.filter((d) => d !== dayNumber) : [...c.checkedDays, dayNumber] };
    });
    liveSync.challenges.setChallenges(challenges);
    vibrate(15);
  }
  function isChallengeDayDone(c, dayNumber, dayPlan) {
    if (dayPlan && dayPlan.tasks.length > 0) {
      const p = c.dayTasksProgress?.[dayNumber];
      return !!p && p.length === dayPlan.tasks.length && p.every(Boolean);
    }
    return c.checkedDays.includes(dayNumber);
  }

  // ---- Today's Quest (quest-wheel-state-v2, read-only reminder) ----
  const questRaw = liveSync?.quest;
  const questDoneToday = questRaw?.lastCompletedDate === today;
  const questStreak = questRaw?.streak || 0;

  // ---- Mood + journal quick entry (reflect-state-v1) ----
  const todayMood = (reflectRaw?.moodLogs || {})[today] || null;
  function logMood(moodKey) {
    if (!liveSync?.reflect?.setMoodLogs) return;
    const raw = reflectRaw || {};
    const moodLogs = { ...(raw.moodLogs || {}), [today]: moodKey };
    liveSync.reflect.setMoodLogs(moodLogs);
    vibrate(15);
  }
  function saveJournal() {
    if (!liveSync?.reflect?.setJournalEntries) return;
    const raw = reflectRaw || {};
    const journalEntries = { ...(raw.journalEntries || {}), [today]: journalDraft.trim() };
    liveSync.reflect.setJournalEntries(journalEntries);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  }

  const dateLabel = new Date(today + "T00:00:00").toLocaleDateString(localeFor(lang), { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: 130 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .fraunces-t { font-family: 'Fraunces', serif; }
        button { font-family: inherit; cursor: pointer; }
        textarea, input, select { font-family: inherit; }
      `}</style>

      <button onClick={manualRefresh} style={{ position: "fixed", top: "calc(22px + env(safe-area-inset-top))", right: 74, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "8px 10px", color: theme.text, zIndex: 40, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
        <RefreshCw size={16} color={theme.accent} style={{ transition: "transform 0.5s ease", transform: refreshing ? "rotate(360deg)" : "none" }} />
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "22px 20px 0" }}>
        <div>
          <div className="fraunces-t" style={{ fontSize: 24, fontWeight: 500 }}>{t.title}</div>
          <div style={{ fontSize: 12.5, color: theme.muted, marginTop: 4, textTransform: "capitalize" }}>{dateLabel}</div>
        </div>
      </div>

      <TodaySection title={t.todoTitle} icon={<ListChecks size={16} color={theme.accent} />} theme={theme}>
        {plainTasksToday.length === 0 ? <TodayEmpty theme={theme}>{t.noTodos}</TodayEmpty> : plainTasksToday.map((tk) => (
          <CheckRow key={tk.id} label={tk.text} sub={tk.time || null} done={tk.completedDates.includes(today)} onToggle={() => toggleTodoTask(tk.id)} theme={theme} />
        ))}
      </TodaySection>

      <TodaySection title={t.habitsTitle} icon={<Repeat size={16} color={theme.accent} />} theme={theme}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {habitTasksToday.length === 0 && <TodayEmpty theme={theme}>{t.noHabits}</TodayEmpty>}
          {habitTasksToday.map((tk) => (
            <HabitPill key={tk.id} label={tk.text} done={isHabitDone(tk)} onToggle={() => toggleHabitTask(tk.id)} theme={theme} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Droplet size={16} color={theme.accent} />
            <span style={{ fontSize: 13 }}>{t.hydration}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => adjustHydration(-0.25)} style={{ width: 28, height: 28, borderRadius: "50%", background: theme.panelSoft, border: `1px solid ${theme.line}`, color: theme.text, fontSize: 16, fontWeight: 600 }}>−</button>
            <span className="fraunces-t" style={{ fontSize: 15, fontWeight: 600, minWidth: 52, textAlign: "center" }}>{todayLiters} {t.liters}</span>
            <button onClick={() => adjustHydration(0.25)} style={{ width: 28, height: 28, borderRadius: "50%", background: theme.accent, border: "none", color: theme.bg, fontSize: 16, fontWeight: 600 }}>+</button>
          </div>
        </div>
      </TodaySection>

      <TodaySection
        title={t.challengeTitle}
        icon={<Target size={16} color={theme.accent} />}
        subtitle={activeChallenges.length > 1 ? t.moreChallenges.replace("{n}", activeChallenges.length - 1) : null}
        theme={theme}
      >
        {activeChallenges.length === 0 ? <TodayEmpty theme={theme}>{t.noChallenge}</TodayEmpty> : (
          <>
            {(() => {
              const { c, dayNumber } = activeChallenges[0];
              const dayPlan = (c.days || []).find((d) => d.day === dayNumber);
              const label = t.dayOf.replace("{day}", dayNumber).replace("{total}", c.totalDays);
              if (dayPlan && dayPlan.tasks.length > 0) {
                const progress = c.dayTasksProgress?.[dayNumber] || new Array(dayPlan.tasks.length).fill(false);
                return (
                  <div style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: "14px 16px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: theme.muted, marginBottom: 10 }}>{label}</div>
                    {dayPlan.tasks.map((task, i) => (
                      <CheckRow key={i} label={task} done={!!progress[i]} onToggle={() => toggleChallengeDay(c.id, dayNumber, dayPlan)} theme={theme} />
                    ))}
                  </div>
                );
              }
              return <CheckRow label={c.title} sub={label} done={isChallengeDayDone(c, dayNumber, dayPlan)} onToggle={() => toggleChallengeDay(c.id, dayNumber, dayPlan)} theme={theme} />;
            })()}
          </>
        )}
      </TodaySection>

      <TodaySection title={t.questTitle} icon={<Sparkles size={16} color={theme.accent} />} theme={theme}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: theme.panel, border: `1px solid ${questDoneToday ? theme.accent : theme.line}`, borderRadius: 14, padding: "14px 16px" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", background: questDoneToday ? theme.accent : theme.panelSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            {questDoneToday ? <Check size={17} color={theme.bg} /> : <Sparkles size={16} color={theme.muted} />}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{questDoneToday ? t.questDone : t.questPending}</div>
            {!questDoneToday && <div style={{ fontSize: 11, color: theme.muted, marginTop: 1 }}>{t.goSpin}</div>}
          </div>
          {questStreak > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12.5, color: theme.accent, fontWeight: 600, flexShrink: 0 }}>
              <Flame size={14} /> {questStreak}
            </div>
          )}
        </div>
      </TodaySection>

      <div style={{ maxWidth: 460, margin: "26px auto 0", padding: "0 20px" }}>
        <div className="fraunces-t" style={{ fontSize: 16, marginBottom: 10 }}>{t.reflectTitle}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
          {TODAY_MOODS.map((m) => {
            const active = todayMood === m.key;
            return (
              <button key={m.key} onClick={() => logMood(m.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: active ? m.color + "33" : theme.panel, border: `1.5px solid ${active ? m.color : theme.line}`, borderRadius: 12, padding: "10px 4px" }}>
                <span style={{ fontSize: 20 }}>{m.emoji}</span>
                <span style={{ fontSize: 9, color: active ? theme.text : theme.muted, fontWeight: active ? 600 : 400, textAlign: "center" }}>{m[dl] || m.en}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: theme.muted, fontSize: 12 }}>
          <BookOpen size={14} color={theme.accent} />
        </div>
        <textarea value={journalDraft} onChange={(e) => setJournalDraft(e.target.value)} placeholder={t.journalPlaceholder} rows={3} style={{ width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 14, padding: 14, color: theme.text, fontSize: 13.5, resize: "none", outline: "none" }} />
        <button onClick={saveJournal} style={{ marginTop: 8, width: "100%", background: justSaved ? theme.panelSoft : theme.accent, color: justSaved ? theme.accent : theme.bg, border: justSaved ? `1px solid ${theme.accent}` : "none", borderRadius: 12, padding: "11px 0", fontSize: 13.5, fontWeight: 600, transition: "all 0.2s ease" }}>
          {justSaved ? `✓ ${t.saved}` : t.save}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// GLOBAL SETTINGS SCREEN
// ============================================================================
function SettingsScreen({ themeKey, setThemeKey, lang, setLang, currency, setCurrency, onClose }) {
  const theme = THEMES[themeKey];
  const st = SETTINGS_STRINGS[lang] || SETTINGS_STRINGS.en;
  const [langSearchOpen, setLangSearchOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");

  function currencyLabel(code) {
    try {
      const parts = new Intl.NumberFormat(localeFor(lang), { style: "currency", currency: code, currencyDisplay: "narrowSymbol" }).formatToParts(0);
      const symbol = parts.find((p) => p.type === "currency")?.value || code;
      return `${code} (${symbol})`;
    } catch (e) { return code; }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", zIndex: 500, overflowY: "auto", paddingTop: "env(safe-area-inset-top)", paddingBottom: 60 }}>
      <style>{`.fraunces-s { font-family: 'Fraunces', serif; }`}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 20px 0" }}>
        <div className="fraunces-s" style={{ fontSize: 22, fontWeight: 500 }}>{st.settings}</div>
        <button onClick={onClose} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: 8 }}>
          <X size={18} color={theme.text} />
        </button>
      </div>

      {/* Theme */}
      <div style={{ maxWidth: 460, margin: "26px auto 0", padding: "0 20px" }}>
        <div className="fraunces-s" style={{ fontSize: 15, marginBottom: 2 }}>{st.theme}</div>
        <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{st.themeHint}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.keys(THEMES).map((key) => (
            <button key={key} onClick={() => setThemeKey(key)} style={{ display: "flex", alignItems: "center", gap: 6, background: themeKey === key ? THEMES[key].accent : theme.panelSoft, color: themeKey === key ? THEMES[key].bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 500 }}>
              <span style={{ width: 11, height: 11, borderRadius: "50%", background: THEMES[key].accent, border: `1px solid ${THEMES[key].bg}` }} />
              {THEMES[key].name}
            </button>
          ))}
        </div>
      </div>

      {/* Language */}
      <div style={{ maxWidth: 460, margin: "28px auto 0", padding: "0 20px" }}>
        <div className="fraunces-s" style={{ fontSize: 15, marginBottom: 2 }}>{st.language}</div>
        <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{st.languageHint}</div>

        {!langSearchOpen ? (
          <button onClick={() => { setLangSearchOpen(true); setLangQuery(""); }} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "12px 14px", color: theme.text, fontSize: 14, fontWeight: 600 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Globe size={15} color={theme.accent} /> {LANGUAGES.find((l) => l.code === lang)?.label}</span>
            <span style={{ fontSize: 12, color: theme.accentSoft, fontWeight: 500 }}>{st.changeLang}</span>
          </button>
        ) : (
          <div>
            <input
              autoFocus
              value={langQuery}
              onChange={(e) => setLangQuery(e.target.value)}
              placeholder={`${st.language}...`}
              style={{ width: "100%", background: theme.panel, border: `1px solid ${theme.accent}`, borderRadius: 12, padding: "12px 14px", color: theme.text, fontSize: 14, outline: "none", marginBottom: 8 }}
            />
            <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
              {LANGUAGES.filter((l) => l.label.toLowerCase().includes(langQuery.toLowerCase())).map((l) => (
                <button key={l.code} onClick={() => { setLang(l.code); setLangSearchOpen(false); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", background: lang === l.code ? theme.accent : theme.panel, color: lang === l.code ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 13.5, fontWeight: 500 }}>
                  <span>{l.label}</span>
                </button>
              ))}
              {LANGUAGES.filter((l) => l.label.toLowerCase().includes(langQuery.toLowerCase())).length === 0 && (
                <div style={{ fontSize: 12.5, color: theme.muted, padding: "6px 12px" }}>{st.noMatches}</div>
              )}
            </div>
          </div>
        )}
        <div style={{ fontSize: 11, color: theme.muted, marginTop: 10, lineHeight: 1.5 }}>{st.enInterfaceOnly}</div>
      </div>

      {/* Currency */}
      <div style={{ maxWidth: 460, margin: "28px auto 0", padding: "0 20px" }}>
        <div className="fraunces-s" style={{ fontSize: 15, marginBottom: 2 }}>{st.currency}</div>
        <div style={{ fontSize: 11.5, color: theme.muted, marginBottom: 12 }}>{st.currencyHint}</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CURRENCIES.map((code) => (
            <button key={code} onClick={() => setCurrency(code)} style={{ background: currency === code ? theme.accent : theme.panel, color: currency === code ? theme.bg : theme.text, border: `1px solid ${theme.line}`, borderRadius: 12, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
              {currencyLabel(code)}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 460, margin: "34px auto 0", padding: "0 20px" }}>
        <button onClick={onClose} style={{ width: "100%", background: theme.accent, color: theme.bg, border: "none", borderRadius: 14, padding: "13px 0", fontSize: 14, fontWeight: 600 }}>{st.done}</button>
        <button onClick={() => { supabaseLogout(); onClose(); }} style={{ width: "100%", marginTop: 10, background: "none", color: theme.muted, border: `1px solid ${theme.line}`, borderRadius: 14, padding: "12px 0", fontSize: 13 }}>
          {lang === "de" ? "Abmelden" : "Log out"}
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// BOTTOM NAVIGATION
// ============================================================================
const NAV_LABELS = {
  en: { today: "Today", quest: "Quest", todo: "To-Do", challenges: "Goals", reflect: "Reflect", finance: "Finance" },
  de: { today: "Heute", quest: "Quest", todo: "To-Do", challenges: "Ziele", reflect: "Reflect", finance: "Finanzen" },
  es: { today: "Hoy", quest: "Misión", todo: "Tareas", challenges: "Metas", reflect: "Reflejo", finance: "Finanzas" },
  fr: { today: "Aujourd'hui", quest: "Quête", todo: "Tâches", challenges: "Objectifs", reflect: "Réflexion", finance: "Finances" },
  it: { today: "Oggi", quest: "Missione", todo: "Attività", challenges: "Obiettivi", reflect: "Riflessione", finance: "Finanze" },
  pt: { today: "Hoje", quest: "Missão", todo: "Tarefas", challenges: "Metas", reflect: "Reflexão", finance: "Finanças" },
  tr: { today: "Bugün", quest: "Görev", todo: "Yapılacaklar", challenges: "Hedefler", reflect: "Yansıma", finance: "Finans" },
  ar: { today: "اليوم", quest: "مهمة", todo: "المهام", challenges: "الأهداف", reflect: "تأمل", finance: "المالية" },
};

function BottomNav({ activeTab, setActiveTab, themeKey, lang }) {
  const theme = THEMES[themeKey] || THEMES.midnight;
  const navLabels = NAV_LABELS[lang] || NAV_LABELS.en;
  const tabs = [
    { key: "today", label: navLabels.today, icon: Home },
    { key: "quest", label: navLabels.quest, icon: Sparkles },
    { key: "todo", label: navLabels.todo, icon: ListChecks },
    { key: "challenges", label: navLabels.challenges, icon: Target },
    { key: "reflect", label: navLabels.reflect, icon: BookOpen },
    { key: "finance", label: navLabels.finance, icon: Wallet },
  ];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", justifyContent: "center", padding: "8px 8px calc(16px + env(safe-area-inset-bottom))", zIndex: 30 }}>
      <div style={{ display: "flex", gap: 2, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: 5, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", maxWidth: "100%", overflowX: "auto" }}>
        {tabs.map((tabDef) => {
          const Icon = tabDef.icon;
          const active = activeTab === tabDef.key;
          return (
            <button key={tabDef.key} onClick={() => setActiveTab(tabDef.key)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: active ? theme.accent : "transparent", color: active ? theme.bg : theme.muted, border: "none", borderRadius: 14, padding: "8px 11px", fontSize: 9.5, fontWeight: 600, whiteSpace: "nowrap" }}>
              <Icon size={16} /> {tabDef.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// APP SHELL — owns global settings, renders the active tab + nav + settings
// ============================================================================
const AUTH_STRINGS = {
  en: {
    welcome: "Welcome to Mai", tagline: "Your day, your habits, your reflection — all in one place.",
    signUp: "Sign up", logIn: "Log in", firstName: "First name", lastName: "Last name",
    location: "Where you're based", age: "Age", email: "Email", password: "Password",
    createAccount: "Create account", welcomeBack: "Welcome back", noAccount: "Don't have an account?",
    haveAccount: "Already have an account?", switchToLogin: "Log in", switchToSignup: "Sign up",
    submitting: "One moment…", checkEmail: "Almost there — check your email to confirm your account, then log in.",
    genericError: "Something went wrong. Please try again.",
  },
  de: {
    welcome: "Willkommen bei Mai", tagline: "Dein Tag, deine Gewohnheiten, deine Reflexion — alles an einem Ort.",
    signUp: "Registrieren", logIn: "Anmelden", firstName: "Vorname", lastName: "Nachname",
    location: "Wo du wohnst", age: "Alter", email: "E-Mail", password: "Passwort",
    createAccount: "Konto erstellen", welcomeBack: "Willkommen zurück", noAccount: "Noch kein Konto?",
    haveAccount: "Schon ein Konto?", switchToLogin: "Anmelden", switchToSignup: "Registrieren",
    submitting: "Einen Moment…", checkEmail: "Fast geschafft — bestätige dein Konto per E-Mail und melde dich dann an.",
    genericError: "Etwas ist schiefgelaufen. Bitte versuch es erneut.",
  },
  es: {
    welcome: "Bienvenido a Mai", tagline: "Tu día, tus hábitos, tu reflexión — todo en un solo lugar.",
    signUp: "Regístrate", logIn: "Iniciar sesión", firstName: "Nombre", lastName: "Apellido",
    location: "Dónde vives", age: "Edad", email: "Correo electrónico", password: "Contraseña",
    createAccount: "Crear cuenta", welcomeBack: "Bienvenido de nuevo", noAccount: "¿No tienes una cuenta?",
    haveAccount: "¿Ya tienes una cuenta?", switchToLogin: "Iniciar sesión", switchToSignup: "Regístrate",
    submitting: "Un momento…", checkEmail: "Ya casi — revisa tu correo para confirmar tu cuenta y luego inicia sesión.",
    genericError: "Algo salió mal. Inténtalo de nuevo.",
  },
  fr: {
    welcome: "Bienvenue sur Mai", tagline: "Ta journée, tes habitudes, ta réflexion — tout au même endroit.",
    signUp: "S'inscrire", logIn: "Se connecter", firstName: "Prénom", lastName: "Nom",
    location: "Où tu habites", age: "Âge", email: "E-mail", password: "Mot de passe",
    createAccount: "Créer un compte", welcomeBack: "Bon retour", noAccount: "Pas encore de compte ?",
    haveAccount: "Déjà un compte ?", switchToLogin: "Se connecter", switchToSignup: "S'inscrire",
    submitting: "Un instant…", checkEmail: "Presque terminé — vérifie ton e-mail pour confirmer ton compte, puis connecte-toi.",
    genericError: "Une erreur s'est produite. Réessaie.",
  },
  it: {
    welcome: "Benvenuto su Mai", tagline: "La tua giornata, le tue abitudini, la tua riflessione — tutto in un unico posto.",
    signUp: "Registrati", logIn: "Accedi", firstName: "Nome", lastName: "Cognome",
    location: "Dove vivi", age: "Età", email: "Email", password: "Password",
    createAccount: "Crea account", welcomeBack: "Bentornato", noAccount: "Non hai un account?",
    haveAccount: "Hai già un account?", switchToLogin: "Accedi", switchToSignup: "Registrati",
    submitting: "Un momento…", checkEmail: "Ci siamo quasi — controlla la tua email per confermare l'account, poi accedi.",
    genericError: "Qualcosa è andato storto. Riprova.",
  },
  pt: {
    welcome: "Bem-vindo ao Mai", tagline: "Seu dia, seus hábitos, sua reflexão — tudo em um só lugar.",
    signUp: "Cadastre-se", logIn: "Entrar", firstName: "Nome", lastName: "Sobrenome",
    location: "Onde você mora", age: "Idade", email: "E-mail", password: "Senha",
    createAccount: "Criar conta", welcomeBack: "Bem-vindo de volta", noAccount: "Não tem uma conta?",
    haveAccount: "Já tem uma conta?", switchToLogin: "Entrar", switchToSignup: "Cadastre-se",
    submitting: "Um momento…", checkEmail: "Quase lá — confira seu e-mail para confirmar sua conta e depois entre.",
    genericError: "Algo deu errado. Tente novamente.",
  },
  tr: {
    welcome: "Mai'ye Hoş Geldin", tagline: "Günün, alışkanlıkların, yansıman — hepsi tek bir yerde.",
    signUp: "Kaydol", logIn: "Giriş yap", firstName: "Ad", lastName: "Soyad",
    location: "Yaşadığın yer", age: "Yaş", email: "E-posta", password: "Şifre",
    createAccount: "Hesap oluştur", welcomeBack: "Tekrar hoş geldin", noAccount: "Hesabın yok mu?",
    haveAccount: "Zaten hesabın var mı?", switchToLogin: "Giriş yap", switchToSignup: "Kaydol",
    submitting: "Bir saniye…", checkEmail: "Neredeyse tamam — hesabını onaylamak için e-postanı kontrol et, sonra giriş yap.",
    genericError: "Bir şeyler ters gitti. Lütfen tekrar dene.",
  },
  ar: {
    welcome: "مرحبًا بك في Mai", tagline: "يومك، عاداتك، تأملاتك — كل ذلك في مكان واحد.",
    signUp: "إنشاء حساب", logIn: "تسجيل الدخول", firstName: "الاسم الأول", lastName: "اسم العائلة",
    location: "أين تقيم", age: "العمر", email: "البريد الإلكتروني", password: "كلمة المرور",
    createAccount: "إنشاء حساب", welcomeBack: "مرحبًا بعودتك", noAccount: "ليس لديك حساب؟",
    haveAccount: "لديك حساب بالفعل؟", switchToLogin: "تسجيل الدخول", switchToSignup: "إنشاء حساب",
    submitting: "لحظة واحدة…", checkEmail: "أوشكت على الانتهاء — تحقق من بريدك الإلكتروني لتأكيد حسابك، ثم سجّل الدخول.",
    genericError: "حدث خطأ ما. حاول مرة أخرى.",
  },
};

function AuthScreen({ onAuthed }) {
  const theme = THEMES.midnight;
  const [lang, setLang] = useState("en");
  const t = AUTH_STRINGS[lang] || AUTH_STRINGS.en;
  const [mode, setMode] = useState("signup"); // 'signup' | 'login'
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [location, setLocation] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [infoKey, setInfoKey] = useState("");

  async function handleSubmit() {
    setError(""); setInfoKey(""); setSubmitting(true);
    try {
      if (mode === "signup") {
        const data = await supabaseSignUp({ email, password, firstName, lastName, location, age });
        if (data.access_token) {
          onAuthed();
        } else {
          // Supabase created the account but is holding the session until the
          // person confirms their email — this is the default project setting,
          // not a bug. Tell them clearly instead of doing nothing.
          setInfoKey("checkEmail");
          setMode("login");
        }
      } else {
        await supabaseLogin({ email, password });
        onAuthed();
      }
    } catch (e) {
      setError((e && e.message) ? e.message : t.genericError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "'Inter', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap'); * { box-sizing: border-box; } button { font-family: inherit; cursor: pointer; } input { font-family: inherit; }`}</style>

      <div style={{ position: "absolute", top: "calc(20px + env(safe-area-inset-top))", right: 20 }}>
        <select value={lang} onChange={(e) => setLang(e.target.value)} style={{ background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "6px 8px", color: theme.text, fontSize: 12 }}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
        </select>
      </div>

      <div style={{ width: 64, height: 64, borderRadius: 16, background: theme.panel, border: `1px solid ${theme.line}`, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img src="/icons/icon-96.png" alt="Mai" style={{ width: 40, height: 40 }} />
      </div>
      <div className="fraunces-t" style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600, marginBottom: 6, textAlign: "center" }}>{t.welcome}</div>
      <div style={{ fontSize: 13, color: theme.muted, textAlign: "center", marginBottom: 30, maxWidth: 280 }}>{t.tagline}</div>

      <div style={{ width: "100%", maxWidth: 340, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 18, padding: 22 }}>
        <div style={{ display: "flex", background: theme.panelSoft, borderRadius: 12, padding: 4, marginBottom: 18 }}>
          <button onClick={() => setMode("signup")} style={{ flex: 1, background: mode === "signup" ? theme.accent : "transparent", color: mode === "signup" ? theme.bg : theme.text, border: "none", borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600 }}>{t.signUp}</button>
          <button onClick={() => setMode("login")} style={{ flex: 1, background: mode === "login" ? theme.accent : "transparent", color: mode === "login" ? theme.bg : theme.text, border: "none", borderRadius: 9, padding: "9px 0", fontSize: 13, fontWeight: 600 }}>{t.logIn}</button>
        </div>

        {mode === "signup" && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t.firstName} style={inputStyle(theme)} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t.lastName} style={inputStyle(theme)} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t.location} style={{ ...inputStyle(theme), flex: 1 }} />
              <input value={age} onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))} placeholder={t.age} inputMode="numeric" maxLength={3} style={{ ...inputStyle(theme), flex: "0 0 64px", width: 64, textAlign: "center" }} />
            </div>
          </>
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.email} type="email" style={{ ...inputStyle(theme), width: "100%", marginBottom: 10 }} />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.password} type="password" style={{ ...inputStyle(theme), width: "100%", marginBottom: 14 }} />

        {infoKey && <div style={{ fontSize: 12, color: theme.accent, marginBottom: 12, lineHeight: 1.4 }}>{t[infoKey]}</div>}
        {error && <div style={{ fontSize: 12, color: "#e06b6b", marginBottom: 12, lineHeight: 1.4 }}>{error}</div>}

        <button onClick={handleSubmit} disabled={submitting || !email || !password} style={{ width: "100%", background: theme.accent, color: theme.bg, border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, opacity: submitting || !email || !password ? 0.6 : 1 }}>
          {submitting ? t.submitting : mode === "signup" ? t.createAccount : t.welcomeBack}
        </button>
      </div>
    </div>
  );
}
function inputStyle(theme) {
  return { flex: 1, minWidth: 0, background: theme.panelSoft, border: `1px solid ${theme.line}`, borderRadius: 10, padding: "11px 12px", color: theme.text, fontSize: 13.5, outline: "none" };
}

function MainApp() {
  const [activeTab, setActiveTab] = useState("today");
  const [themeKey, setThemeKey] = useState("midnight");
  const [lang, setLang] = useState("en");
  const [currency, setCurrency] = useState("EUR");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsReady, setSettingsReady] = useState(false);
  const [liveSync, setLiveSync] = useState({ quest: null, todo: null, challenges: null, reflect: null });
  const updateLiveSync = (key, data) => setLiveSync((prev) => ({ ...prev, [key]: data }));

  useEffect(() => {
    (async () => {
      try {
        const saved = await supaGet("app-settings-v1");
        if (saved && saved.value) {
          const d = JSON.parse(saved.value);
          if (d.themeKey) setThemeKey(d.themeKey);
          if (d.lang) setLang(d.lang);
          if (d.currency) setCurrency(d.currency);
        }
      } catch (e) {}
      setSettingsReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!settingsReady) return;
    (async () => {
      try { await supaSet("app-settings-v1", JSON.stringify({ themeKey, lang, currency })); }
      catch (e) { console.error(e); }
    })();
  }, [themeKey, lang, currency, settingsReady]);

  const theme = THEMES[themeKey];

  // Tabs stay mounted permanently (hidden via CSS, not unmounted) so
  // switching away and back never loses whatever you were mid-typing, and
  // never shows a "flash of empty" while a tab reloads its own storage.
  const tabStyle = (key) => ({ display: activeTab === key ? "block" : "none" });

  return (
    <LiveSyncContext.Provider value={{ liveSync, updateLiveSync }}>
    <div style={{ position: "relative", paddingTop: "env(safe-area-inset-top)" }}>
      <div style={tabStyle("today")}><Today globalTheme={themeKey} globalLang={lang} isActive={activeTab === "today"} /></div>
      <div style={tabStyle("quest")}><QuestWheel globalTheme={themeKey} globalLang={lang} /></div>
      <div style={tabStyle("todo")}><TodoTemplates globalTheme={themeKey} globalLang={lang} /></div>
      <div style={tabStyle("challenges")}><Challenges globalTheme={themeKey} globalLang={lang} /></div>
      <div style={tabStyle("reflect")}><Reflect globalTheme={themeKey} globalLang={lang} isActive={activeTab === "reflect"} /></div>
      <div style={tabStyle("finance")}><Finance globalTheme={themeKey} globalLang={lang} currency={currency} /></div>

      <button onClick={() => setShowSettings(true)} style={{ position: "fixed", top: "calc(22px + env(safe-area-inset-top))", right: 20, background: theme.panel, border: `1px solid ${theme.line}`, borderRadius: 20, padding: "8px 10px", zIndex: 40, boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }}>
        <Settings size={16} color={theme.accent} />
      </button>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} themeKey={themeKey} lang={lang} />

      {showSettings && (
        <SettingsScreen
          themeKey={themeKey} setThemeKey={setThemeKey}
          lang={lang} setLang={setLang}
          currency={currency} setCurrency={setCurrency}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
    </LiveSyncContext.Provider>
  );
}

// Real entry point: gates the whole app behind a signed-in Supabase session.
// Signed out -> AuthScreen. Signed in -> the actual app (MainApp).
export default function AppShell() {
  const session = useSession();
  const [checkedOnce, setCheckedOnce] = useState(false);
  useEffect(() => { setCheckedOnce(true); }, []);

  if (!session.accessToken) {
    return <AuthScreen onAuthed={() => setCheckedOnce((v) => !v)} />;
  }
  // key forces a clean remount of MainApp on every login, so a fresh
  // session always starts from a clean slate rather than stale state.
  return <MainApp key={session.userId} />;
}

